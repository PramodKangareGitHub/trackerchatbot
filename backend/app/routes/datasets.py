from __future__ import annotations

import re
import uuid
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Iterable, List, Mapping

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import engine, get_db
from app.services.dataset_registry import create_dataset_entry, get_dataset, list_datasets
from app.models.dataset import Dataset
from app.services.auth_utils import require_user
from app.models.dataset_column_preference import DatasetColumnPreference
from app.models.user import User
from app.models import (
    CustomerRequirement,
    HclDemand,
    HclOnboardingStatus,
    InterviewedCandidateDetails,
    OptumOnboardingStatus,
)
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["datasets"], dependencies=[Depends(require_user)])


ALLOWED_EXTENSIONS = {".xlsx", ".xls"}
EXPECTED_SHEETS = {
    "customer_requirements": CustomerRequirement,
    "hcl_demand": HclDemand,
    "interviewed_candidate_details": InterviewedCandidateDetails,
    "hcl_onboarding_status": HclOnboardingStatus,
    "optum_onboarding_status": OptumOnboardingStatus,
}

JOINED_VIEW_NAME = "vw_job_postings_joined"
JOINED_DATASET_ID = "joined_job_postings"
JOIN_SOURCE_TABLES: list[tuple[str, str]] = [
    ("customer_requirements", "cr"),
    ("hcl_demand", "hd"),
    ("interviewed_candidate_details", "icd"),
    ("hcl_onboarding_status", "hos"),
    ("optum_onboarding_status", "oos"),
]


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


def _ensure_joined_dataset(db: Session) -> Dataset:
    """Create/refresh a unified view that left-joins all domain tables on unique_job_posting_id."""

    # Build select list with table aliases to avoid collisions and retain provenance
    select_cols: list[str] = [
        "cr.unique_job_posting_id AS unique_job_posting_id",
        "CASE WHEN cr.job_posting_status = 'Submitted' AND (hos.hcl_onboarding_status IS NULL OR LOWER(hos.hcl_onboarding_status) != 'onboarded') THEN 1 ELSE 0 END AS open_demand_flag",
    ]
    for table_name, alias in JOIN_SOURCE_TABLES:
        model_cls = EXPECTED_SHEETS[table_name]
        for col in model_cls.__table__.columns:
            col_name = col.name
            select_cols.append(f'{alias}."{col_name}" AS "{alias}_{col_name}"')

    join_sql = (
        f'CREATE VIEW "{JOINED_VIEW_NAME}" AS\n'
        f'SELECT\n  {",\n  ".join(select_cols)}\n'
        "FROM customer_requirements cr\n"
        "LEFT JOIN hcl_demand hd ON hd.unique_job_posting_id = cr.unique_job_posting_id\n"
        "LEFT JOIN interviewed_candidate_details icd ON icd.unique_job_posting_id = cr.unique_job_posting_id\n"
        "LEFT JOIN hcl_onboarding_status hos ON hos.unique_job_posting_id = cr.unique_job_posting_id\n"
        "LEFT JOIN optum_onboarding_status oos ON oos.unique_job_posting_id = cr.unique_job_posting_id"
    )

    with engine.begin() as conn:
        conn.execute(text(f'DROP VIEW IF EXISTS "{JOINED_VIEW_NAME}"'))
        conn.execute(text(join_sql))
        count_rows = conn.execute(text(f'SELECT COUNT(*) FROM "{JOINED_VIEW_NAME}"')).scalar() or 0

    joined_columns = [col.split(" AS ")[-1].strip('"') for col in select_cols]

    existing: Dataset | None = db.get(Dataset, JOINED_DATASET_ID)
    if existing:
        existing.table_name = JOINED_VIEW_NAME
        existing.original_file_name = "Joined job postings view"
        existing.row_count = int(count_rows)
        existing.columns_json = joined_columns
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    created = create_dataset_entry(
        original_file_name="Joined job postings view",
        table_name=JOINED_VIEW_NAME,
        row_count=int(count_rows),
        columns_json=joined_columns,
        db=db,
        dataset_id=JOINED_DATASET_ID,
    )
    return created


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
        all_sheets = pd.read_excel(BytesIO(contents), engine=read_engine, sheet_name=None)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {exc}") from exc

    # Normalize sheet lookup to be case-insensitive while preserving originals.
    sheet_lookup: Mapping[str, str] = {str(name).strip().lower(): str(name) for name in all_sheets.keys()}
    missing = [name for name in EXPECTED_SHEETS if name not in sheet_lookup]

    if not missing:
        # Multi-tab import flow for domain tables.
        def sanitize_records(df: pd.DataFrame, model_cls) -> list[dict[str, Any]]:
            if df is None or df.empty:
                return []
            df = df.where(pd.notnull(df), None)
            allowed_fields = {c.name for c in model_cls.__table__.columns}
            date_fields = {
                c.name
                for c in model_cls.__table__.columns
                if getattr(c.type, "python_type", None) in (datetime, date)
            }
            bool_fields = {
                c.name
                for c in model_cls.__table__.columns
                if getattr(c.type, "python_type", None) is bool
            }

            def _coerce_value(key: str, value: Any) -> Any:
                if value is None:
                    return None
                if key in date_fields:
                    ts = pd.to_datetime(value, errors="coerce")
                    if pd.isna(ts):
                        return None
                    if hasattr(ts, "to_pydatetime"):
                        return ts.to_pydatetime()
                    return value
                if key in bool_fields:
                    if isinstance(value, str):
                        return value.strip().lower() in {"true", "1", "yes", "y"}
                    return bool(value)
                return value

            records: list[dict[str, Any]] = []
            for row in df.to_dict(orient="records"):
                record = {k.strip(): v for k, v in row.items() if k is not None}
                filtered = {
                    k: _coerce_value(k, v)
                    for k, v in record.items()
                    if k in allowed_fields
                }
                records.append(filtered)
            # Drop duplicates based on primary key(s) to avoid unique violations.
            pk_cols = [c.name for c in model_cls.__table__.primary_key.columns]
            if pk_cols:
                seen = set()
                deduped: list[dict[str, Any]] = []
                for rec in records:
                    key = tuple(rec.get(pk) for pk in pk_cols)
                    if key in seen:
                        continue
                    seen.add(key)
                    deduped.append(rec)
                return deduped
            return records

        try:
            # Clear child tables first to satisfy FK constraints.
            db.query(OptumOnboardingStatus).delete()
            db.query(HclOnboardingStatus).delete()
            db.query(InterviewedCandidateDetails).delete()
            db.query(HclDemand).delete()
            db.query(CustomerRequirement).delete()
            db.flush()

            counts: dict[str, int] = {}

            # Insert in dependency-safe order.
            cr_sheet = all_sheets[sheet_lookup["customer_requirements"]]
            cr_records = sanitize_records(cr_sheet, CustomerRequirement)
            db.bulk_insert_mappings(CustomerRequirement, cr_records)  # allow empty list
            counts["customer_requirements"] = len(cr_records)

            hcl_demand_sheet = all_sheets[sheet_lookup["hcl_demand"]]
            hcl_demand_records = sanitize_records(hcl_demand_sheet, HclDemand)
            db.bulk_insert_mappings(HclDemand, hcl_demand_records)
            counts["hcl_demand"] = len(hcl_demand_records)

            candidate_sheet = all_sheets[sheet_lookup["interviewed_candidate_details"]]
            candidate_records = sanitize_records(candidate_sheet, InterviewedCandidateDetails)
            db.bulk_insert_mappings(InterviewedCandidateDetails, candidate_records)
            counts["interviewed_candidate_details"] = len(candidate_records)

            hcl_onboarding_sheet = all_sheets[sheet_lookup["hcl_onboarding_status"]]
            hcl_onboarding_records = sanitize_records(hcl_onboarding_sheet, HclOnboardingStatus)
            db.bulk_insert_mappings(HclOnboardingStatus, hcl_onboarding_records)
            counts["hcl_onboarding_status"] = len(hcl_onboarding_records)

            optum_sheet = all_sheets[sheet_lookup["optum_onboarding_status"]]
            optum_records = sanitize_records(optum_sheet, OptumOnboardingStatus)
            db.bulk_insert_mappings(OptumOnboardingStatus, optum_records)
            counts["optum_onboarding_status"] = len(optum_records)

            db.commit()
            # Refresh the unified joined view so chat can query across tables.
            _ensure_joined_dataset(db)
            return {
                "message": "Imported master data",
                "counts": counts,
                "sheets": list(EXPECTED_SHEETS.keys()),
            }
        except Exception:
            db.rollback()
            raise

    # Fallback to legacy single-sheet dataset import to avoid breaking existing flows.
    try:
        df = all_sheets[next(iter(all_sheets))]
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Failed to read Excel sheet: {exc}") from exc

    if df is None or df.empty:
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
        # Keep the joined dataset in sync each time the list is requested.
        try:
            _ensure_joined_dataset(db)
        except Exception:
            # Do not block listing if the view cannot be refreshed; log silently.
            pass

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
