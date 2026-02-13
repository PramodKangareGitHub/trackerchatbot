from __future__ import annotations

import uuid
import io
import json
from typing import Any, Dict, List

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, text

from app.db import engine, get_db
from app.models.dashboard_widget import DashboardWidget
from app.models.user import User
from app.services.auth_utils import ensure_allowed_role, get_current_user, require_admin_or_developer
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
    widgets: List[DashboardWidgetPayload] = Field(default_factory=list)


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

    # Admins/developers can replace the full dashboard; others can only manage their own role's widgets.
    if user_role in {"admin", "developer"}:
        db.query(DashboardWidget).delete()
    else:
        existing = (
            db.query(DashboardWidget)
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
                "title": widget.title,
                "widget_type": widget.widget_type,
                "roles": normalized_roles,
                "order_index": widget.order_index,
                "config": widget.config,
            }
        )

    db.commit()
    return {"widgets": widgets_out}


@router.get("/dashboard-config")
async def get_dashboard_config(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    user_role = ensure_allowed_role(user.role)
    widgets = (
        db.query(DashboardWidget)
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
        "widgets": [
            {
                "id": w.id,
                "title": w.title,
                "widget_type": w.widget_type,
                "roles": roles,
                "order_index": w.order_index,
                "config": w.config_json,
                "created_at": w.created_at,
                "updated_at": w.updated_at,
            }
            for w, roles in visible_widgets
        ]
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
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    dataset = get_dataset(dataset_id, db)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text(f'SELECT rowid AS rowid, * FROM "{dataset.table_name}" LIMIT :limit OFFSET :offset'),
                {"limit": limit, "offset": offset},
            ).mappings().all()
            total = conn.execute(text(f'SELECT COUNT(*) AS c FROM "{dataset.table_name}"')).scalar_one()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to fetch records: {exc}") from exc

    return {
        "columns": list(dataset.columns_json or []),
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
