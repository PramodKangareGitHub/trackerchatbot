from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.hcl_onboarding_status import HclOnboardingStatus

router = APIRouter(prefix="/api/hcl-onboarding", tags=["hcl-onboarding"])


class HclOnboardingIn(BaseModel):
    sap_id: str
    unique_job_posting_id: str
    demand_id: str
    candidate_contact: str
    candidate_email: Optional[str] = None
    hcl_onboarding_status: Optional[str] = None
    hire_loss_reason: Optional[str] = None
    onboarded_date: Optional[datetime] = None
    employee_name: Optional[str] = None
    employee_hcl_email: Optional[str] = None
    created_by: Optional[str] = None
    modified_by: Optional[str] = None


def _serialize(row: HclOnboardingStatus) -> dict:
    def dt(val: Optional[datetime]):
        return val.isoformat() if isinstance(val, datetime) else None

    return {
        "sap_id": row.sap_id,
        "unique_job_posting_id": row.unique_job_posting_id,
        "demand_id": row.demand_id,
        "candidate_contact": row.candidate_contact,
        "candidate_email": row.candidate_email,
        "hcl_onboarding_status": row.hcl_onboarding_status,
        "hire_loss_reason": row.hire_loss_reason,
        "onboarded_date": dt(row.onboarded_date),
        "employee_name": row.employee_name,
        "employee_hcl_email": row.employee_hcl_email,
        "created_at": dt(row.created_at),
        "modified_at": dt(row.modified_at),
        "created_by": row.created_by,
        "modified_by": row.modified_by,
    }


@router.get("")
def list_onboarding(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(HclOnboardingStatus)
    if status:
        query = query.filter(HclOnboardingStatus.hcl_onboarding_status == status)
    rows = query.all()
    return {"items": [_serialize(r) for r in rows]}


@router.get("/{unique_job_posting_id}")
def get_onboarding(
    unique_job_posting_id: str,
    demand_id: Optional[str] = None,
    candidate_contact: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(HclOnboardingStatus).filter(
        HclOnboardingStatus.unique_job_posting_id == unique_job_posting_id
    )
    if demand_id:
        query = query.filter(HclOnboardingStatus.demand_id == demand_id)
    if candidate_contact:
        query = query.filter(HclOnboardingStatus.candidate_contact == candidate_contact)
    row = query.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HCL onboarding not found")
    return _serialize(row)


@router.put("/{unique_job_posting_id}")
def upsert_onboarding(
    unique_job_posting_id: str, payload: HclOnboardingIn, db: Session = Depends(get_db)
) -> dict:
    if not payload.sap_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sap_id is required",
        )
    if not payload.unique_job_posting_id or not payload.demand_id or not payload.candidate_contact:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="unique_job_posting_id, demand_id, and candidate_contact are required",
        )

    existing = (
        db.query(HclOnboardingStatus)
        .filter(HclOnboardingStatus.unique_job_posting_id == unique_job_posting_id)
        .filter(HclOnboardingStatus.demand_id == payload.demand_id)
        .filter(HclOnboardingStatus.candidate_contact == payload.candidate_contact)
        .first()
    )
    now = datetime.utcnow()

    if existing:
        data = payload.dict(exclude_unset=True)
        data.pop("sap_id", None)
        data["modified_at"] = now
        data["modified_by"] = payload.modified_by or existing.modified_by or "system"
        for key, value in data.items():
            setattr(existing, key, value)
        try:
            db.add(existing)
            db.commit()
            db.refresh(existing)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Integrity error while updating onboarding record",
            ) from exc
        return {"operation": "updated", "record": _serialize(existing)}

    data = payload.dict(exclude_unset=True)
    data["sap_id"] = payload.sap_id
    data.setdefault("created_at", now)
    data.setdefault("modified_at", now)
    data.setdefault("created_by", payload.created_by or "system")
    data.setdefault("modified_by", payload.modified_by or payload.created_by or "system")

    obj = HclOnboardingStatus(**data)
    try:
        db.add(obj)
        db.commit()
        db.refresh(obj)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Integrity error while inserting onboarding record",
        ) from exc
    return {"operation": "inserted", "record": _serialize(obj)}
