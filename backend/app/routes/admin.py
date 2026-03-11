from __future__ import annotations

import uuid
import io
import json
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, text

from app.db import engine, get_db
from app.models.dashboard import Dashboard
from app.models.dataset import Dataset
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


def _inspect_table_columns(table_name: str) -> List[str]:
    try:
        with engine.connect() as conn:
            rows = conn.execute(text(f'PRAGMA table_info("{table_name}")')).fetchall()
        return [r[1] for r in rows]
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to inspect table: {exc}") from exc


def _resolve_table_and_columns(
    dataset_id: str, dataset: Dataset | None, table_override: str | None = None
) -> Tuple[str, List[str]]:
    candidates: List[str] = []
    if table_override:
        candidates.append(table_override)
    if dataset and dataset.table_name:
        candidates.append(dataset.table_name)
    candidates.append(dataset_id)
    candidates.append(f"data_{dataset_id}")

    for table_name in candidates:
        cols: List[str] = []
        if dataset and table_name == dataset.table_name and dataset.columns_json:
            cols = list(dataset.columns_json or [])
        if not cols:
            cols = _inspect_table_columns(table_name)
        if cols:
            return table_name, cols

    raise HTTPException(status_code=404, detail="Dataset not found")


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

    def inspect_table(table_name: str) -> tuple[List[str], int]:
        with engine.connect() as conn:
            cols = conn.execute(text(f'PRAGMA table_info("{table_name}")')).fetchall()
            columns = [r[1] for r in cols]
            count = conn.execute(text(f'SELECT COUNT(*) AS c FROM "{table_name}"')).scalar_one()
            return columns, int(count)

    existing_tables = set()
    payload: List[Dict[str, Any]] = []

    for d in datasets:
        columns = list(d.columns_json or [])
        row_count = d.row_count
        try:
            inspected_columns, inspected_count = inspect_table(d.table_name)
            if inspected_columns:
                columns = inspected_columns
            row_count = inspected_count
        except Exception:
            # If inspection fails, fall back to stored metadata.
            pass

        payload.append(
            {
                "id": d.id,
                "original_file_name": d.original_file_name,
                "table_name": d.table_name,
                "row_count": row_count,
                "columns": columns,
                "created_at": d.created_at,
            }
        )
        existing_tables.add(d.table_name)

    # Include any physical tables that exist but are missing from the dataset registry.
    try:
        with engine.connect() as conn:
            table_rows = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
            table_names = [row[0] for row in table_rows]
    except Exception:
        table_names = []

    for table_name in table_names:
        if table_name.startswith("sqlite_"):
            continue
        if table_name in existing_tables:
            continue
        try:
            columns, row_count = inspect_table(table_name)
        except Exception:
            continue

        payload.append(
            {
                "id": table_name,
                "original_file_name": f"{table_name}.table",
                "table_name": table_name,
                "row_count": row_count,
                "columns": columns,
                "created_at": None,
            }
        )

    return payload


@router.get("/datasets/{dataset_id}/columns")
async def admin_get_dataset_columns(
    dataset_id: str,
    table: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    dataset: Dataset | None = None
    try:
        dataset = get_dataset(dataset_id, db)
    except HTTPException:
        # Allow direct table inspection even if dataset registry lacks this id.
        dataset = None

    table_name, columns = _resolve_table_and_columns(dataset_id, dataset, table)
    return {
        "dataset_id": dataset_id,
        "table_name": table_name,
        "columns": columns,
    }


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
    filters: Optional[List[str]] = Query(default=None),
    joined_tables: Optional[List[str]] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    dataset = get_dataset(dataset_id, db)

    # Parse multi-value filter inputs coming in as JSON array strings, pipe/comma delimited, or repeated params.
    def parse_filter_values(raw: str | list[str] | None) -> List[str]:
        if raw is None:
            return []
        values: List[str] = []
        raw_values = raw if isinstance(raw, list) else [raw]
        for item in raw_values:
            text = str(item).strip()
            if not text:
                continue
            try:
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    values.extend([str(v).strip() for v in parsed if str(v).strip()])
                    continue
            except Exception:
                pass
            if "|" in text:
                values.extend([p.strip() for p in text.split("|") if p.strip()])
                continue
            if "," in text:
                values.extend([p.strip() for p in text.split(",") if p.strip()])
                continue
            values.append(text)
        return values

    def discover_columns(table_name: str) -> List[str]:
        try:
            with engine.connect() as conn:
                rows = conn.execute(text(f'PRAGMA table_info("{table_name}")')).fetchall()
            return [r[1] for r in rows]
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"Failed to inspect table: {exc}") from exc

    def resolve_table(table_id: str) -> tuple[str, List[str]]:
        ds = get_dataset(table_id, db)
        try:
            return _resolve_table_and_columns(table_id, ds, None)
        except HTTPException:
            # fallback to raw table name
            cols = discover_columns(table_id)
            return table_id, cols

    base_table_name, base_columns = resolve_table(dataset_id)
    if not base_columns:
        raise HTTPException(status_code=404, detail="Dataset not found")

    join_ids = [t for t in (joined_tables or []) if t]
    join_entries: List[tuple[str, str, List[str]]] = []
    for tbl_id in join_ids:
        t_name, t_cols = resolve_table(tbl_id)
        if t_name == base_table_name:
            continue
        join_entries.append((tbl_id, t_name, t_cols))

    # Build lookup maps for validation and alias resolution
    table_entries: List[tuple[str, str, List[str]]] = [(dataset_id, base_table_name, base_columns)] + join_entries
    columns_by_key: Dict[str, List[str]] = {}
    alias_by_key: Dict[str, str] = {}
    for tid, tname, tcols in table_entries:
        columns_by_key[tid] = tcols
        columns_by_key[tname] = tcols
        alias_by_key[tid] = tname
        alias_by_key[tname] = tname

    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    where_clauses: List[str] = []
    params: Dict[str, Any] = {"limit": limit, "offset": offset}

    join_filter_clauses: List[str] = []

    if filter_by:
        prefix = filter_by.split(".")[0] if "." in filter_by else dataset_id
        column = filter_by.split(".")[-1]
        if prefix not in columns_by_key or column not in columns_by_key[prefix]:
            raise HTTPException(status_code=400, detail="Filter column not found in dataset")
        table_alias = alias_by_key[prefix]
        if filter_values:
            placeholders = []
            for idx, val in enumerate(filter_values):
                key = f"fv_{idx}"
                placeholders.append(f":{key}")
                params[key] = val
            clause = f'"{table_alias}"."{column}" IN ({", ".join(placeholders)})'
            if table_alias == base_table_name:
                where_clauses.append(clause)
            else:
                join_filter_clauses.append(
                    f"EXISTS (SELECT 1 FROM \"{table_alias}\" jf WHERE jf.\"unique_job_posting_id\" = \"{base_table_name}\".\"unique_job_posting_id\" AND {clause})"
                )

    if filters:
        def coerce_list(val: Any) -> List[str]:
            if val is None:
                return []
            if isinstance(val, list):
                return [str(v) for v in val if str(v).strip()]
            return [str(val)] if str(val).strip() else []

        def build_clause(
            table_alias: str,
            column: str,
            op: str,
            values: List[str],
            idx: int,
            expr_alias: str | None = None,
        ) -> tuple[str, str | None]:
            op_l = op.lower()
            alias = expr_alias or table_alias
            placeholders: List[str] = []

            def add(val: str, suffix: str) -> str:
                key = f"multi_f_{idx}_{suffix}"
                params[key] = val
                return f":{key}"

            if op_l in {"in", "not_in"}:
                for i, v in enumerate(values):
                    placeholders.append(add(v, str(i)));
                if not placeholders:
                    return "", None;
                base = f'"{alias}"."{column}" IN ({", ".join(placeholders)})'
                if op_l == "not_in":
                    disallow = base
                    return f"(NOT {base} OR \"{alias}\".\"{column}\" IS NULL)", disallow
                return base, None

            if op_l in {"=", "!=", ">", ">=", "<", "<=", "contains"}:
                target = add(values[0], "0")
                comparator = "LIKE" if op_l == "contains" else op_l
                if op_l == "contains":
                    params[f"multi_f_{idx}_0"] = f"%{values[0]}%"
                clause = f'"{alias}"."{column}" {comparator} {target}'
                if op_l == "!=":
                    disallow = f'"{alias}"."{column}" = {target}'
                    return f"({clause} OR \"{alias}\".\"{column}\" IS NULL)", disallow
                return clause, None

            if op_l == "between":
                if len(values) < 2:
                    return "", None
                low = add(values[0], "0")
                high = add(values[1], "1")
                return f'"{alias}"."{column}" BETWEEN {low} AND {high}', None

            # fallback to equality/in
            target = add(values[0], "0")
            return f'"{alias}"."{column}" = {target}', None

        for idx, raw in enumerate(filters):
            parsed: Dict[str, Any] | None = None
            try:
                data = json.loads(raw)
                if isinstance(data, dict):
                    parsed = data
            except Exception:
                parsed = None

            if parsed is None:
                if ":" not in raw:
                    continue
                field_part, value_raw = raw.split(":", 1)
                op_part = "in"
                if "|" in field_part:
                    field_only, op_part = field_part.split("|", 1)
                else:
                    field_only = field_part
                parsed = {
                    "field": field_only,
                    "op": op_part,
                    "values": parse_filter_values(value_raw),
                }
            field = str(parsed.get("field") or "").strip()
            op = str(parsed.get("op") or "in").lower()
            values = coerce_list(parsed.get("values") or parsed.get("value"))
            table_override = parsed.get("table")

            if table_override and "." not in field:
                field = f"{table_override}.{field}"

            if not field or "." not in field:
                prefix = dataset_id
                column = field
            else:
                prefix = field.split(".")[0]
                column = field.split(".")[-1]

            if prefix not in columns_by_key or column not in columns_by_key[prefix]:
                raise HTTPException(status_code=400, detail="Filter column not found in dataset")
            table_alias = alias_by_key[prefix]
            if not values:
                continue

            expr_alias = "jf" if table_alias != base_table_name else table_alias
            clause, disallow_clause = build_clause(
                table_alias,
                column,
                op,
                values,
                idx,
                expr_alias=expr_alias,
            )
            if not clause:
                continue

            if table_alias == base_table_name:
                where_clauses.append(clause)
            else:
                if disallow_clause:
                    join_filter_clauses.append(
                        f"NOT EXISTS (SELECT 1 FROM \"{table_alias}\" jf WHERE jf.\"unique_job_posting_id\" = \"{base_table_name}\".\"unique_job_posting_id\" AND {disallow_clause})"
                    )
                else:
                    join_filter_clauses.append(
                        f"EXISTS (SELECT 1 FROM \"{table_alias}\" jf WHERE jf.\"unique_job_posting_id\" = \"{base_table_name}\".\"unique_job_posting_id\" AND {clause})"
                    )

    try:
        all_where_clauses = where_clauses + join_filter_clauses
        if not join_entries:
            where_sql = " WHERE " + " AND ".join(all_where_clauses) if all_where_clauses else ""
            with engine.connect() as conn:
                rows = conn.execute(
                    text(
                        f'SELECT rowid AS rowid, * FROM "{base_table_name}"{where_sql} LIMIT :limit OFFSET :offset'
                    ),
                    params,
                ).mappings().all()
                total = conn.execute(
                    text(f'SELECT COUNT(*) AS c FROM "{base_table_name}"{where_sql}'),
                    params,
                ).scalar_one()
            columns = base_columns
        else:
            base_alias = dataset_id
            select_cols = [f'"{base_table_name}"."rowid" AS "rowid"']
            columns: List[str] = []
            columns.extend([f"{base_alias}.{c}" for c in base_columns])
            for tid, _, tcols in join_entries:
                columns.extend([f"{tid}.{c}" for c in tcols])
            for col in base_columns:
                select_cols.append(f'"{base_table_name}"."{col}" AS "{base_alias}.{col}"')
            for tid, tbl_name, tcols in join_entries:
                for col in tcols:
                    select_cols.append(f'"{tbl_name}"."{col}" AS "{tid}.{col}"')

            join_sql = " ".join(
                [
                    f'LEFT JOIN "{tbl_name}" ON "{tbl_name}"."unique_job_posting_id" = "{base_table_name}"."unique_job_posting_id"'
                    for _, tbl_name, _ in join_entries
                ]
            )
            all_where_clauses = where_clauses + join_filter_clauses
            where_sql = " WHERE " + " AND ".join(all_where_clauses) if all_where_clauses else ""
            with engine.connect() as conn:
                rows = conn.execute(
                    text(
                        f'SELECT {", ".join(select_cols)} FROM "{base_table_name}" {join_sql}{where_sql} LIMIT :limit OFFSET :offset'
                    ),
                    params,
                ).mappings().all()
                total = conn.execute(
                    text(
                        f'SELECT COUNT(*) AS c FROM "{base_table_name}" {join_sql}{where_sql}'
                    ),
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
    # Normalize potential table-qualified column names
    table_override = None
    if "." in column:
        table_override, column = column.split(".", 1)

    dataset = get_dataset(dataset_id, db)

    table_name, columns = _resolve_table_and_columns(dataset_id, dataset, table_override)
    if column not in columns:
        raise HTTPException(status_code=400, detail="Column not found in dataset")

    try:
        values = fetch_distinct_values(table_name, column, engine=engine)
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
