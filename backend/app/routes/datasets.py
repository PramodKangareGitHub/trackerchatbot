from __future__ import annotations

import re
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any, List

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import engine, get_db
from app.services.dataset_registry import create_dataset_entry, get_dataset, list_datasets
from app.services.auth_utils import require_user
from app.models.dataset_column_preference import DatasetColumnPreference
from app.models.user import User
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["datasets"], dependencies=[Depends(require_user)])


ALLOWED_EXTENSIONS = {".xlsx", ".xls"}


def _normalize_column_name(name: str) -> str:
    cleaned = re.sub(r"[^0-9a-zA-Z]+", "_", name.strip())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_").lower()
    return cleaned or "column"


def _normalize_columns(columns: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    result: list[str] = []
    for idx, col in enumerate(columns):
        base = _normalize_column_name(str(col)) or f"col_{idx + 1}"
        candidate = base
        counter = 1
        while candidate in seen:
            counter += 1
            candidate = f"{base}_{counter}"
        seen[candidate] = 1
        result.append(candidate)
    return result


class ColumnPreferencePayload(BaseModel):
    columns: List[str]


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    file_name = file.filename or ""
    ext = Path(file_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are supported")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    read_engine = "openpyxl" if ext == ".xlsx" else None

    try:
        df = pd.read_excel(BytesIO(contents), engine=read_engine, sheet_name=0)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {exc}") from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="Excel file has no rows")

    normalized_columns = _normalize_columns([str(col) for col in df.columns])
    df.columns = normalized_columns

    dataset_id = str(uuid.uuid4())
    table_name = f"data_{dataset_id.replace('-', '_')}"

    # Persist the sheet into its own table
    df.to_sql(table_name, con=engine, if_exists="replace", index=False)

    dataset = create_dataset_entry(
        original_file_name=file_name,
        table_name=table_name,
        row_count=len(df.index),
        columns_json=normalized_columns,
        db=db,
        dataset_id=dataset_id,
    )

    return {
        "id": dataset.id,
        "original_file_name": dataset.original_file_name,
        "table_name": dataset.table_name,
        "row_count": dataset.row_count,
        "columns": dataset.columns_json,
        "created_at": dataset.created_at,
    }


@router.get("/datasets")
async def list_datasets_public(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
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


@router.get("/datasets/{dataset_id}/preview")
async def preview_dataset(dataset_id: str) -> dict[str, Any]:
    dataset = get_dataset(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    stmt = text(f'SELECT * FROM "{dataset.table_name}" LIMIT 10')
    try:
        df = pd.read_sql(stmt, con=engine)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to read dataset preview: {exc}") from exc

    preview_rows = df.to_dict(orient="records")

    return {
        "dataset": {
            "id": dataset.id,
            "original_file_name": dataset.original_file_name,
            "table_name": dataset.table_name,
            "row_count": dataset.row_count,
            "columns": dataset.columns_json,
            "created_at": dataset.created_at,
        },
        "preview_rows": preview_rows,
        "preview_count": len(preview_rows),
    }


@router.get("/datasets/{dataset_id}/column-preferences")
async def get_column_preferences(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> dict[str, Any]:
    dataset = get_dataset(dataset_id, db)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    allowed_columns = list(dataset.columns_json or [])
    pref = (
        db.query(DatasetColumnPreference)
        .filter(
            DatasetColumnPreference.dataset_id == dataset_id,
            DatasetColumnPreference.user_id == current_user.id,
        )
        .first()
    )

    if pref and pref.columns_json:
        selected = [c for c in pref.columns_json if c in allowed_columns]
    else:
        selected = list(allowed_columns)

    return {"columns": allowed_columns, "selected": selected}


@router.post("/datasets/{dataset_id}/column-preferences")
async def save_column_preferences(
    dataset_id: str,
    payload: ColumnPreferencePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> dict[str, Any]:
    dataset = get_dataset(dataset_id, db)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    allowed_columns = list(dataset.columns_json or [])
    allowed_set = set(allowed_columns)
    selected = [c for c in payload.columns if c in allowed_set]
    if not selected:
        selected = list(allowed_columns)

    pref = (
        db.query(DatasetColumnPreference)
        .filter(
            DatasetColumnPreference.dataset_id == dataset_id,
            DatasetColumnPreference.user_id == current_user.id,
        )
        .first()
    )

    if pref is None:
        pref = DatasetColumnPreference(
            dataset_id=dataset_id,
            user_id=current_user.id,
            columns_json=selected,
        )
        db.add(pref)
    else:
        pref.columns_json = selected
        db.add(pref)

    db.commit()
    db.refresh(pref)

    return {"columns": allowed_columns, "selected": selected}
