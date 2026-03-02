from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.hcl_demand import HclDemand

router = APIRouter(prefix="/api/hcl-demand", tags=["hcl-demand"])


class HclDemandIn(BaseModel):
    demand_id: str
    unique_job_posting_id: str
    tag_spoc: Optional[str] = None
    tsc_spoc: Optional[str] = None
    demand_created_date: Optional[datetime] = None
    demand_status: Optional[str] = None
    demand_approved_date: Optional[datetime] = None
    tag_first_profile_sourced_date: Optional[datetime] = None
    tsc_first_profile_sourced_date: Optional[datetime] = None
    tp_profiles_requested: Optional[int] = None
    tp_vendor_name: Optional[str] = None
    tp_profiles_requested_date: Optional[datetime] = None
    tp_first_profile_sourced_date: Optional[datetime] = None
    created_by: Optional[str] = None
    modified_by: Optional[str] = None


def _serialize(row: HclDemand) -> dict:
    fields = [
        "demand_id",
        "unique_job_posting_id",
        "tag_spoc",
        "tsc_spoc",
        "demand_created_date",
        "demand_status",
        "demand_approved_date",
        "tag_first_profile_sourced_date",
        "tsc_first_profile_sourced_date",
        "tp_profiles_requested",
        "tp_vendor_name",
        "tp_profiles_requested_date",
        "tp_first_profile_sourced_date",
        "created_at",
        "modified_at",
        "created_by",
        "modified_by",
    ]
    out: dict = {}
    for field in fields:
        val = getattr(row, field, None)
        if isinstance(val, datetime):
            out[field] = val.isoformat()
        else:
            out[field] = val
    return out


@router.get("/{unique_job_posting_id}")
def get_hcl_demand(
    unique_job_posting_id: str,
    demand_id: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict:
    row = (
        db.query(HclDemand)
        .filter(HclDemand.unique_job_posting_id == unique_job_posting_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HCL demand not found")
    if demand_id and row.demand_id and row.demand_id != demand_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="HCL demand not found for provided demand_id",
        )
    return _serialize(row)


@router.put("/{demand_id}")
def upsert_hcl_demand(
    demand_id: str, payload: HclDemandIn, db: Session = Depends(get_db)
) -> dict:
    if not payload.unique_job_posting_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="unique_job_posting_id is required"
        )

    if payload.demand_id and payload.demand_id != demand_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="demand_id in path and payload must match",
        )

    existing = db.query(HclDemand).filter(HclDemand.demand_id == demand_id).first()
    now = datetime.utcnow()

    if existing:
        if existing.unique_job_posting_id != payload.unique_job_posting_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="unique_job_posting_id mismatch for this demand id",
            )

        data = payload.dict(exclude_unset=True)
        data.pop("demand_id", None)
        data["modified_at"] = now
        data["modified_by"] = payload.modified_by or existing.modified_by or "system"
        for key, value in data.items():
            setattr(existing, key, value)
        try:
            db.add(existing)
            db.commit()
            db.refresh(existing)
        except IntegrityError as exc:  # surface FK/PK errors clearly
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Integrity error while updating demand (check unique_job_posting_id and primary key)",
            ) from exc
        return {"operation": "updated", "record": _serialize(existing)}

    data = payload.dict(exclude_unset=True)
    data["demand_id"] = demand_id
    data.setdefault("created_at", now)
    data.setdefault("modified_at", now)
    data.setdefault("created_by", payload.created_by or "system")
    data.setdefault("modified_by", payload.modified_by or payload.created_by or "system")
    demand = HclDemand(**data)
    try:
        db.add(demand)
        db.commit()
        db.refresh(demand)
    except IntegrityError as exc:  # likely FK mismatch or duplicate id
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Integrity error while inserting demand (check demand_id uniqueness and matching unique_job_posting_id)",
        ) from exc
    return {"operation": "inserted", "record": _serialize(demand)}
