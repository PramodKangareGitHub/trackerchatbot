from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.hcl_demand import HclDemand
from app.models.interviewed_candidate_details import InterviewedCandidateDetails
from app.models.hcl_onboarding_status import HclOnboardingStatus
from app.models.customer_requirement import CustomerRequirement

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


@router.put("/{unique_job_posting_id}")
def upsert_hcl_demand(
    unique_job_posting_id: str, payload: HclDemandIn, db: Session = Depends(get_db)
) -> dict:
    target_uid = payload.unique_job_posting_id or unique_job_posting_id
    if not target_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="unique_job_posting_id is required"
        )

    # Keep path and payload in sync to avoid accidental cross-updates
    if payload.unique_job_posting_id and payload.unique_job_posting_id != unique_job_posting_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="unique_job_posting_id in path and payload must match",
        )

    now = datetime.utcnow()

    # Ensure parent customer requirement exists to avoid FK failures
    parent = (
        db.query(CustomerRequirement)
        .filter(CustomerRequirement.unique_job_posting_id == target_uid)
        .first()
    )
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="unique_job_posting_id not found in customer_requirements",
        )

    # Find by unique_job_posting_id (the primary key)
    existing = db.query(HclDemand).filter(HclDemand.unique_job_posting_id == target_uid).first()

    if existing:
        data = payload.dict(exclude_unset=True)
        data["unique_job_posting_id"] = target_uid

        new_demand_id = payload.demand_id or existing.demand_id
        if new_demand_id != existing.demand_id:
          # Changing demand_id with child rows will violate FK (no ON UPDATE CASCADE); block if linked rows exist
          child_count = (
              db.query(InterviewedCandidateDetails)
              .filter(InterviewedCandidateDetails.demand_id == existing.demand_id)
              .count()
          ) + (
              db.query(HclOnboardingStatus)
              .filter(HclOnboardingStatus.demand_id == existing.demand_id)
              .count()
          )
          if child_count:
              raise HTTPException(
                  status_code=status.HTTP_400_BAD_REQUEST,
                  detail=(
                      "Cannot change demand_id because related interviewed candidates/onboarding rows exist. "
                      "Update or delete child rows first."
                  ),
              )
        data["demand_id"] = new_demand_id
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
            err = str(getattr(exc, "orig", exc))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Integrity error while updating demand (if demand_id still has a unique index, "
                    "run migration 20260309_0010_allow_duplicate_demand_id). DB: " + err
                ),
            ) from exc
        return {"operation": "updated", "record": _serialize(existing)}

    data = payload.dict(exclude_unset=True)
    data.setdefault("unique_job_posting_id", target_uid)
    data.setdefault("demand_id", payload.demand_id)
    data.setdefault("created_at", now)
    data.setdefault("modified_at", now)
    data.setdefault("created_by", payload.created_by or "system")
    data.setdefault("modified_by", payload.modified_by or payload.created_by or "system")
    demand = HclDemand(**data)
    try:
        db.add(demand)
        db.commit()
        db.refresh(demand)
    except IntegrityError as exc:  # likely FK mismatch or duplicate PK
        db.rollback()
        err = str(getattr(exc, "orig", exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Integrity error while inserting demand (ensure unique_job_posting_id exists "
                "in customer_requirements and this posting does not already have a demand). DB: "
                + err
            ),
        ) from exc
    return {"operation": "inserted", "record": _serialize(demand)}
