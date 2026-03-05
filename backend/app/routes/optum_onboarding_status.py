from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.optum_onboarding_status import OptumOnboardingStatus

router = APIRouter(prefix="/api/optum-onboarding", tags=["optum-onboarding"])


class OptumOnboardingIn(BaseModel):
    unique_job_posting_id: str
    customer_employee_id: str
    sap_id: str
    customer_onboarding_status: Optional[str] = None
    customer_onboarded_date: Optional[datetime] = None
    customer_employee_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_login_id: Optional[str] = None
    customer_lob: Optional[str] = None
    billing_start_date: Optional[datetime] = None
    customer_laptop_required: Optional[str] = None
    customer_laptop_status: Optional[str] = None
    customer_laptop_serial_no: Optional[str] = None
    created_by: Optional[str] = None
    modified_by: Optional[str] = None


def _serialize(row: OptumOnboardingStatus) -> dict:
    def dt(val: Optional[datetime]):
        return val.isoformat() if isinstance(val, datetime) else None

    return {
        "customer_employee_id": row.customer_employee_id,
        "unique_job_posting_id": row.unique_job_posting_id,
        "sap_id": row.sap_id,
        "customer_onboarding_status": row.customer_onboarding_status,
        "customer_onboarded_date": dt(row.customer_onboarded_date),
        "customer_employee_name": row.customer_employee_name,
        "customer_email": row.customer_email,
        "customer_login_id": row.customer_login_id,
        "customer_lob": row.customer_lob,
        "billing_start_date": dt(row.billing_start_date),
        "customer_laptop_required": row.customer_laptop_required,
        "customer_laptop_status": row.customer_laptop_status,
        "customer_laptop_serial_no": row.customer_laptop_serial_no,
        "created_at": dt(row.created_at),
        "modified_at": dt(row.modified_at),
        "created_by": row.created_by,
        "modified_by": row.modified_by,
    }


@router.get("/{unique_job_posting_id}")
def get_optum_onboarding(
    unique_job_posting_id: str,
    customer_employee_id: Optional[str] = None,
    sap_id: Optional[str] = None,
    demand_id: Optional[str] = None,  # accepted for compatibility; not used in filter
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(OptumOnboardingStatus).filter(
        OptumOnboardingStatus.unique_job_posting_id == unique_job_posting_id
    )
    if customer_employee_id:
        query = query.filter(OptumOnboardingStatus.customer_employee_id == customer_employee_id)
    if sap_id:
        query = query.filter(OptumOnboardingStatus.sap_id == sap_id)

    row = query.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Optum onboarding not found")
    return _serialize(row)


@router.put("/{unique_job_posting_id}")
def upsert_optum_onboarding(
    unique_job_posting_id: str, payload: OptumOnboardingIn, db: Session = Depends(get_db)
) -> dict:
    if payload.unique_job_posting_id != unique_job_posting_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="unique_job_posting_id in path and payload must match",
        )
    if not payload.customer_employee_id or not payload.sap_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="customer_employee_id and sap_id are required",
        )

    existing = (
        db.query(OptumOnboardingStatus)
        .filter(OptumOnboardingStatus.customer_employee_id == payload.customer_employee_id)
        .first()
    )
    now = datetime.utcnow()

    if existing:
        if existing.unique_job_posting_id != payload.unique_job_posting_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="unique_job_posting_id mismatch for this customer_employee_id",
            )
        data = payload.dict(exclude_unset=True)
        data["modified_at"] = now
        data["modified_by"] = payload.modified_by or existing.modified_by or "system"
        data.pop("customer_employee_id", None)  # primary key should not change
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
                detail="Integrity error while updating optum onboarding record",
            ) from exc
        return {"operation": "updated", "record": _serialize(existing)}

    data = payload.dict(exclude_unset=True)
    data.setdefault("created_at", now)
    data.setdefault("modified_at", now)
    data.setdefault("created_by", payload.created_by or "system")
    data.setdefault("modified_by", payload.modified_by or payload.created_by or "system")

    obj = OptumOnboardingStatus(**data)
    try:
        db.add(obj)
        db.commit()
        db.refresh(obj)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Integrity error while inserting optum onboarding record",
        ) from exc
    return {"operation": "inserted", "record": _serialize(obj)}
