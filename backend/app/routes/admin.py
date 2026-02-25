from __future__ import annotations

import uuid
import io
import json
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, text

from app.db import engine, get_db
from app.models.dashboard import Dashboard
from app.models.dashboard_widget import DashboardWidget
from app.models.user import User
from app.models.role import Role
from app.services.auth_utils import (
    DEFAULT_ROLES,
    ensure_allowed_role,
    get_current_user,
    refresh_role_cache,
    require_admin,
    require_admin_or_developer,
)
from app.services.dataset_registry import (
    delete_all_datasets,
    delete_dataset,
    get_dataset,
    list_datasets,
)
from app.services.filter_discovery import fetch_distinct_values

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
)

HOME_DASHBOARD_ID = "home"
HOME_DASHBOARD_NAME = "Home"


def normalize_role_name(name: str) -> str:
    return (name or "").strip().lower().replace(" ", "_")


def parse_roles(raw: Any) -> List[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [ensure_allowed_role(r) for r in raw]
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [ensure_allowed_role(r) for r in data]
    except Exception:
        pass
    return [ensure_allowed_role(str(raw))]


class DashboardWidgetPayload(BaseModel):
    id: str | None = Field(default=None)
    title: str
    widget_type: str | None = Field(default=None)
    order_index: int | None = Field(default=None)
    roles: List[str] | None = Field(default=None)
    config: Dict[str, Any] = Field(default_factory=dict)


class DashboardConfigPayload(BaseModel):
    dashboard_id: str | None = Field(default=None)
    widgets: List[DashboardWidgetPayload] = Field(default_factory=list)


class DashboardCreatePayload(BaseModel):
    name: str = Field(..., min_length=1)
    description: str | None = Field(default=None)


class DashboardUpdatePayload(BaseModel):
    name: str | None = Field(default=None)
    description: str | None = Field(default=None)
    order_index: int | None = Field(default=None)


class DashboardReorderPayload(BaseModel):
    order: List[str] = Field(default_factory=list)


class RoleCreatePayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)


@router.get("/roles")
async def list_roles(
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
) -> Dict[str, Any]:
    roles = db.query(Role).order_by(Role.name.asc()).all()
    if not roles:
        db.add(Role(name="admin"))
        db.commit()
        roles = db.query(Role).order_by(Role.name.asc()).all()
    refresh_role_cache()
    return {"roles": [r.name for r in roles]}


@router.post("/roles", status_code=201)
async def create_role(
    payload: RoleCreatePayload,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
) -> Dict[str, str]:
    name = normalize_role_name(payload.name)
    if not name:
        raise HTTPException(status_code=400, detail="Role name is required")

    existing = db.query(Role).filter(func.lower(Role.name) == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Role already exists")

    role = Role(name=name)
    db.add(role)
    db.commit()
    db.refresh(role)
    refresh_role_cache()
    return {"name": role.name}


@router.delete("/roles/{role_name}", status_code=204)
async def delete_role(
    role_name: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    name = normalize_role_name(role_name)
    if name == "admin":
        raise HTTPException(status_code=400, detail="Admin role cannot be removed")

    in_use = db.query(User).filter(func.lower(User.role) == name).first()
    if in_use:
        raise HTTPException(status_code=400, detail="Role is assigned to a user")

    deleted = db.query(Role).filter(func.lower(Role.name) == name).delete()
    if not deleted:
        raise HTTPException(status_code=404, detail="Role not found")

    db.commit()
    refresh_role_cache()
    return Response(status_code=204)


def get_or_create_dashboard(
    db: Session, dashboard_id: Optional[str] = None, name: Optional[str] = None
) -> Dashboard:
    # Always ensure the Home dashboard exists for callers relying on defaults.
    home = db.query(Dashboard).filter(Dashboard.id == HOME_DASHBOARD_ID).first()
    if not home:
        lowest = db.query(func.min(Dashboard.order_index)).scalar()
        home_index = lowest if lowest is not None else 0
        home = Dashboard(id=HOME_DASHBOARD_ID, name=HOME_DASHBOARD_NAME, order_index=home_index)
        db.add(home)
        db.commit()
        db.refresh(home)

    dash: Optional[Dashboard]
    if dashboard_id:
        dash = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
        if dash:
            return dash
        dash = Dashboard(id=dashboard_id, name=name or "Dashboard")
        db.add(dash)
        db.commit()
        db.refresh(dash)
        return dash

    dash = (
        db.query(Dashboard)
        .order_by(Dashboard.created_at.asc())
        .first()
    )
    if dash:
        return dash

    default_dash = Dashboard(id="default", name="Default Dashboard")
    db.add(default_dash)
    db.commit()
    db.refresh(default_dash)
    return default_dash


@router.get("/dashboards")
async def list_dashboards(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    ensure_allowed_role(user.role)
    dashboards = (
        db.query(Dashboard)
        .order_by(
            Dashboard.order_index.asc().nulls_last(),
            Dashboard.created_at.asc(),
        )
        .all()
    )

    # Guarantee Home exists and is visible to all users.
    home = db.query(Dashboard).filter(Dashboard.id == HOME_DASHBOARD_ID).first()
    if not home:
        home = get_or_create_dashboard(db, HOME_DASHBOARD_ID, HOME_DASHBOARD_NAME)
        dashboards = [home] + dashboards

    user_role = ensure_allowed_role(user.role)
    if user_role not in {"admin", "developer"}:
        # Non-admins see Home plus any dashboards that contain at least one widget with their role.
        allowed_ids = {HOME_DASHBOARD_ID}
        widgets = (
            db.query(DashboardWidget.dashboard_id, DashboardWidget.role)
            .all()
        )
        for dash_id, role_json in widgets:
            roles = parse_roles(role_json)
            if user_role in roles:
                allowed_ids.add(dash_id)

        dashboards = [d for d in dashboards if d.id in allowed_ids]
    counts = dict(
        db.query(DashboardWidget.dashboard_id, func.count())
        .group_by(DashboardWidget.dashboard_id)
        .all()
    )
    return {
        "dashboards": [
          {
            "id": d.id,
            "name": d.name,
            "description": d.description,
                        "created_at": d.created_at,
                        "updated_at": d.updated_at,
                        "order_index": d.order_index,
            "widget_count": counts.get(d.id, 0),
          }
          for d in dashboards
        ]
    }


@router.post("/dashboards")
async def create_dashboard(
    payload: DashboardCreatePayload,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_developer),
) -> Dict[str, Any]:
    ensure_allowed_role(user.role)
    dash_id = str(uuid.uuid4())
    max_order = db.query(func.max(Dashboard.order_index)).scalar()
    next_order = (max_order or -1) + 1

    dashboard = Dashboard(
        id=dash_id,
        name=payload.name.strip(),
        description=(payload.description or "").strip() or None,
        order_index=next_order,
    )
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    return {
        "id": dashboard.id,
        "name": dashboard.name,
        "description": dashboard.description,
        "created_at": dashboard.created_at,
        "updated_at": dashboard.updated_at,
        "order_index": dashboard.order_index,
    }


@router.patch("/dashboards/{dashboard_id}")
async def update_dashboard(
    dashboard_id: str,
    payload: DashboardUpdatePayload,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_developer),
) -> Dict[str, Any]:
    ensure_allowed_role(user.role)
    dashboard = (
        db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    )
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if payload.name:
        dashboard.name = payload.name.strip()
    if payload.description is not None:
        dashboard.description = payload.description.strip() or None
    if payload.order_index is not None:
        dashboard.order_index = payload.order_index
    db.commit()
    db.refresh(dashboard)
    return {
        "id": dashboard.id,
        "name": dashboard.name,
        "description": dashboard.description,
        "created_at": dashboard.created_at,
        "updated_at": dashboard.updated_at,
        "order_index": dashboard.order_index,
    }


@router.post("/dashboards/reorder")
async def reorder_dashboards(
    payload: DashboardReorderPayload,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_developer),
) -> Dict[str, Any]:
    ensure_allowed_role(user.role)
    if not payload.order:
        return {"ok": True, "updated": 0}

    # Home should always remain; if missing, recreate it and keep it pinned to the top.
    home = get_or_create_dashboard(db, HOME_DASHBOARD_ID, HOME_DASHBOARD_NAME)
    if HOME_DASHBOARD_ID not in payload.order:
        payload.order = [HOME_DASHBOARD_ID] + payload.order

    current = (
        db.query(Dashboard)
        .order_by(
            Dashboard.order_index.asc().nulls_last(),
            Dashboard.created_at.asc(),
        )
        .all()
    )

    order_map = {dash_id: idx for idx, dash_id in enumerate(payload.order)}
    next_index = len(order_map)

    updated = 0
    for dash in current:
        if dash.id in order_map:
            dash.order_index = order_map[dash.id]
            updated += 1
        else:
            dash.order_index = next_index
            next_index += 1
            updated += 1

    db.commit()
    return {"ok": True, "updated": updated}


@router.delete("/dashboards/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_developer),
) -> Dict[str, Any]:
    ensure_allowed_role(user.role)
    if dashboard_id == HOME_DASHBOARD_ID:
        raise HTTPException(status_code=400, detail="Home dashboard cannot be deleted")
    dashboard = (
        db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    )
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    # Remove widgets attached to this dashboard
    db.query(DashboardWidget).filter(DashboardWidget.dashboard_id == dashboard_id).delete()
    db.delete(dashboard)
    db.commit()
    return {"ok": True}


class AddRecordsPayload(BaseModel):
    records: List[Dict[str, Any]] = Field(default_factory=list)


class UpdateRecordPayload(BaseModel):
    record: Dict[str, Any] = Field(default_factory=dict)


@router.post("/dashboard-config")
async def set_dashboard_config(
    payload: DashboardConfigPayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    user_role = ensure_allowed_role(user.role)

    if user_role in {"admin", "developer"}:
        dashboard = get_or_create_dashboard(db, payload.dashboard_id)
    else:
        # Non-admins always operate on Home.
        dashboard = get_or_create_dashboard(db, HOME_DASHBOARD_ID, HOME_DASHBOARD_NAME)

    # Admins/developers can replace the dashboard's widgets; others can only manage their own role's widgets for that dashboard.
    if user_role in {"admin", "developer"}:
        db.query(DashboardWidget).filter(
            DashboardWidget.dashboard_id == dashboard.id
        ).delete()
    else:
        existing = (
            db.query(DashboardWidget)
            .filter(DashboardWidget.dashboard_id == dashboard.id)
            .order_by(DashboardWidget.order_index.asc().nulls_last(), DashboardWidget.created_at.asc())
            .all()
        )
        for existing_widget in existing:
            roles = parse_roles(existing_widget.role)
            if user_role in roles:
                db.delete(existing_widget)
        db.commit()

    widgets_out: List[Dict[str, Any]] = []

    for widget in payload.widgets:
        wid = widget.id or str(uuid.uuid4())
        requested_roles = widget.roles or ([user_role] if user_role != "admin" else ["admin"])
        normalized_roles = [ensure_allowed_role(r) for r in requested_roles]
        if user_role not in {"admin", "developer"}:
            # Non-admins can only assign their own role
            normalized_roles = [user_role]
        elif not normalized_roles:
            normalized_roles = ["admin"]
        db_widget = DashboardWidget(
            id=wid,
            dashboard_id=dashboard.id,
            title=widget.title,
            widget_type=widget.widget_type,
            role=json.dumps(normalized_roles),
            order_index=widget.order_index,
            config_json=widget.config,
        )
        db.add(db_widget)
        widgets_out.append(
            {
                "id": wid,
                "dashboard_id": dashboard.id,
                "title": widget.title,
                "widget_type": widget.widget_type,
                "roles": normalized_roles,
                "order_index": widget.order_index,
                "config": widget.config,
            }
        )

    db.commit()
    return {"widgets": widgets_out, "dashboard_id": dashboard.id}


@router.get("/dashboard-config")
async def get_dashboard_config(
    dashboard_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    user_role = ensure_allowed_role(user.role)
    if user_role in {"admin", "developer"}:
        dashboard = get_or_create_dashboard(db, dashboard_id)
    else:
        # Non-admins can view Home, or any dashboard that contains a widget scoped to their role.
        target_dashboard_id = HOME_DASHBOARD_ID
        if dashboard_id and dashboard_id != HOME_DASHBOARD_ID:
            candidate = (
                db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
            )
            if candidate:
                candidate_widgets = (
                    db.query(DashboardWidget)
                    .filter(DashboardWidget.dashboard_id == candidate.id)
                    .all()
                )
                if any(user_role in parse_roles(w.role) for w in candidate_widgets):
                    target_dashboard_id = candidate.id

        dashboard = get_or_create_dashboard(
            db,
            target_dashboard_id,
            HOME_DASHBOARD_NAME if target_dashboard_id == HOME_DASHBOARD_ID else None,
        )
    widgets = (
        db.query(DashboardWidget)
        .filter(DashboardWidget.dashboard_id == dashboard.id)
        .order_by(DashboardWidget.order_index.asc().nulls_last(), DashboardWidget.created_at.asc())
        .all()
    )

    visible_widgets = []
    for w in widgets:
        roles = parse_roles(w.role)
        if user_role != "admin":
            # Non-admins must be explicitly included in the widget's roles.
            if not roles or user_role not in roles:
                continue
        visible_widgets.append((w, roles))

    return {
        "dashboard_id": dashboard.id,
        "widgets": [
            {
                "id": w.id,
                "dashboard_id": w.dashboard_id,
                "title": w.title,
                "widget_type": w.widget_type,
                "roles": roles,
                "order_index": w.order_index,
                "config": w.config_json,
                "created_at": w.created_at,
                "updated_at": w.updated_at,
            }
            for w, roles in visible_widgets
        ],
    }


@router.get("/datasets")
async def admin_list_datasets(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    datasets = list_datasets(db=db)
    return [
        {
            "id": d.id,
            "original_file_name": d.original_file_name,
            "table_name": d.table_name,
            "row_count": d.row_count,
            "columns": d.columns_json,
            "created_at": d.created_at,
        }
        for d in datasets
    ]


@router.delete("/datasets/{dataset_id}")
async def admin_delete_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_developer),
) -> Dict[str, Any]:
    deleted = delete_dataset(dataset_id, db=db, drop_table=True)
    if not deleted:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"deleted": True}


@router.delete("/datasets")
async def admin_delete_all_datasets(
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_developer),
) -> Dict[str, Any]:
    count = delete_all_datasets(db=db, drop_tables=True)
    return {"deleted_count": count}


@router.post("/datasets/{dataset_id}/records")
async def admin_add_records(
    dataset_id: str,
    payload: AddRecordsPayload,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_developer),
) -> Dict[str, Any]:
    dataset = get_dataset(dataset_id, db)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not payload.records:
        raise HTTPException(status_code=400, detail="records must not be empty")

    columns = list(dataset.columns_json or [])
    allowed = set(columns)

    normalized_records: List[Dict[str, Any]] = []
    for record in payload.records:
        extra = set(record.keys()) - allowed
        if extra:
            raise HTTPException(status_code=400, detail=f"Unexpected columns: {', '.join(sorted(extra))}")
        normalized_records.append({col: record.get(col) for col in columns})

    try:
        df = pd.DataFrame(normalized_records)
        df.to_sql(dataset.table_name, con=engine, if_exists="append", index=False)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to insert records: {exc}") from exc

    dataset.row_count = (dataset.row_count or 0) + len(normalized_records)
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    return {
        "id": dataset.id,
        "table_name": dataset.table_name,
        "row_count": dataset.row_count,
        "inserted": len(normalized_records),
    }


@router.get("/datasets/{dataset_id}/records")
async def admin_list_records(
    dataset_id: str,
    limit: int = 50,
    offset: int = 0,
    filter_by: Optional[str] = Query(default=None),
    filter_values: Optional[List[str]] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    dataset = get_dataset(dataset_id, db)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    columns = list(dataset.columns_json or [])
    where_clauses: List[str] = []
    params: Dict[str, Any] = {"limit": limit, "offset": offset}

    if filter_by:
        if filter_by not in columns:
            raise HTTPException(status_code=400, detail="Filter column not found in dataset")
        if filter_values:
            placeholders = []
            for idx, val in enumerate(filter_values):
                key = f"fv_{idx}"
                placeholders.append(f":{key}")
                params[key] = val
            clause = f'"{filter_by}" IN ({", ".join(placeholders)})'
            where_clauses.append(clause)

    try:
        where_sql = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        with engine.connect() as conn:
            rows = conn.execute(
                text(
                    f'SELECT rowid AS rowid, * FROM "{dataset.table_name}"{where_sql} LIMIT :limit OFFSET :offset'
                ),
                params,
            ).mappings().all()
            total = conn.execute(
                text(f'SELECT COUNT(*) AS c FROM "{dataset.table_name}"{where_sql}'),
                params,
            ).scalar_one()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to fetch records: {exc}") from exc

    return {
        "columns": columns,
        "rows": [dict(row) for row in rows],
        "total": int(total or 0),
    }


@router.get("/datasets/{dataset_id}/columns/{column}/values")
async def admin_distinct_column_values(
    dataset_id: str,
    column: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    dataset = get_dataset(dataset_id, db)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    columns = list(dataset.columns_json or [])
    if column not in columns:
        raise HTTPException(status_code=400, detail="Column not found in dataset")

    try:
        values = fetch_distinct_values(dataset.table_name, column, engine=engine)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to fetch distinct values: {exc}") from exc

    return {"column": column, "values": values}


@router.put("/datasets/{dataset_id}/records/{rowid}")
async def admin_update_record(
    dataset_id: str,
    rowid: int,
    payload: UpdateRecordPayload,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_developer),
) -> Dict[str, Any]:
    dataset = get_dataset(dataset_id, db)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    columns = list(dataset.columns_json or [])
    allowed = set(columns)

    if not payload.record:
        raise HTTPException(status_code=400, detail="record must not be empty")

    extra = set(payload.record.keys()) - allowed
    if extra:
        raise HTTPException(status_code=400, detail=f"Unexpected columns: {', '.join(sorted(extra))}")

    assignments = []
    params: Dict[str, Any] = {"rowid": rowid}
    for idx, col in enumerate(columns):
        if col not in payload.record:
            continue
        key = f"v_{idx}"
        assignments.append(f'"{col}" = :{key}')
        params[key] = payload.record[col]

    if not assignments:
        raise HTTPException(status_code=400, detail="No valid columns to update")

    sql = text(
        f'UPDATE "{dataset.table_name}" SET ' + ", ".join(assignments) + " WHERE rowid = :rowid"
    )

    try:
        with engine.begin() as conn:
            result = conn.execute(sql, params)
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Record not found")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to update record: {exc}") from exc

    return {"updated": True, "rowid": rowid}


@router.delete("/datasets/{dataset_id}/records/{rowid}")
async def admin_delete_record(
    dataset_id: str,
    rowid: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_developer),
) -> Dict[str, Any]:
    dataset = get_dataset(dataset_id, db)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        with engine.begin() as conn:
            result = conn.execute(
                text(f'DELETE FROM "{dataset.table_name}" WHERE rowid = :rowid'),
                {"rowid": rowid},
            )
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Record not found")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to delete record: {exc}") from exc

    dataset.row_count = max(0, (dataset.row_count or 0) - 1)
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    return {"deleted": True, "rowid": rowid, "row_count": dataset.row_count}


@router.get("/datasets/{dataset_id}/export")
async def admin_export_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_developer),
) -> StreamingResponse:
    dataset = get_dataset(dataset_id, db)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        df = pd.read_sql_query(f'SELECT rowid AS rowid, * FROM "{dataset.table_name}"', con=engine)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to export dataset: {exc}") from exc

    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)

    filename = f"{dataset.original_file_name or dataset.table_name}.csv"
    headers = {
        "Content-Disposition": f"attachment; filename={filename}",
        "Content-Type": "text/csv; charset=utf-8",
    }

    return StreamingResponse(iter([buffer.getvalue()]), headers=headers)
