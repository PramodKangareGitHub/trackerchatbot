from __future__ import annotations

import re
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import engine, get_db
from app.services.dataset_registry import create_dataset_entry, get_dataset

router = APIRouter(prefix="/api", tags=["datasets"])


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
