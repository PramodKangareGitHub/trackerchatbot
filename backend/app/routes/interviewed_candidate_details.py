from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.interviewed_candidate_details import InterviewedCandidateDetails

router = APIRouter(prefix="/api/interviewed-candidates", tags=["interviewed-candidates"])


class CandidateIn(BaseModel):
    candidate_contact: str = Field(..., max_length=64)
    candidate_name: Optional[str] = None
    candidate_type: Optional[str] = None
    tp_vendor_name: Optional[str] = None
    candidate_email: Optional[str] = None
    interview_status: Optional[str] = None
    initial_screening_status: Optional[str] = None
    initial_screening_rejected_reason: Optional[str] = None
    tp1_interview_status: Optional[str] = None
    tp1_rejected_reason: Optional[str] = None
    tp2_interview_status: Optional[str] = None
    tp2_skipped_rejected_reason: Optional[str] = None
    manager_interview_status: Optional[str] = None
    manager_skipped_rejected_reason: Optional[str] = None
    customer_interview_status: Optional[str] = None
    customer_interview_skipped_rejected_reason: Optional[str] = None
    candidate_selected_date: Optional[datetime] = None
    created_by: Optional[str] = None
    modified_by: Optional[str] = None


class BulkUpsertPayload(BaseModel):
    unique_job_posting_id: str
    demand_id: str
    records: List[CandidateIn]


def _serialize(row: InterviewedCandidateDetails) -> dict:
    out = {
        "candidate_contact": row.candidate_contact,
        "candidate_name": row.candidate_name,
        "unique_job_posting_id": row.unique_job_posting_id,
        "demand_id": row.demand_id,
        "candidate_type": row.candidate_type,
        "tp_vendor_name": row.tp_vendor_name,
        "candidate_email": row.candidate_email,
        "interview_status": row.interview_status,
        "initial_screening_status": row.initial_screening_status,
        "initial_screening_rejected_reason": row.initial_screening_rejected_reason,
        "tp1_interview_status": row.tp1_interview_status,
        "tp1_rejected_reason": row.tp1_rejected_reason,
        "tp2_interview_status": row.tp2_interview_status,
        "tp2_skipped_rejected_reason": row.tp2_skipped_rejected_reason,
        "manager_interview_status": row.manager_interview_status,
        "manager_skipped_rejected_reason": row.manager_skipped_rejected_reason,
        "customer_interview_status": row.customer_interview_status,
        "customer_interview_skipped_rejected_reason": row.customer_interview_skipped_rejected_reason,
        "candidate_selected_date": row.candidate_selected_date.isoformat() if row.candidate_selected_date else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "modified_at": row.modified_at.isoformat() if row.modified_at else None,
        "created_by": row.created_by,
        "modified_by": row.modified_by,
    }
    return out


@router.get("/{unique_job_posting_id}")
def list_candidates(
    unique_job_posting_id: str,
    demand_id: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[dict]:
    query = db.query(InterviewedCandidateDetails).filter(
        InterviewedCandidateDetails.unique_job_posting_id == unique_job_posting_id
    )
    if demand_id:
        query = query.filter(InterviewedCandidateDetails.demand_id == demand_id)
    rows = query.all()
    return [_serialize(r) for r in rows]


@router.put("/bulk")
def upsert_candidates(payload: BulkUpsertPayload, db: Session = Depends(get_db)) -> dict:
    if not payload.records:
        return {"inserted": 0, "updated": 0}

    inserted = 0
    updated = 0
    now = datetime.utcnow()

    for rec in payload.records:
        existing = (
            db.query(InterviewedCandidateDetails)
            .filter(InterviewedCandidateDetails.candidate_contact == rec.candidate_contact)
            .first()
        )

        if existing:
            # ensure FK alignment
            if existing.unique_job_posting_id != payload.unique_job_posting_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"candidate_contact {rec.candidate_contact} belongs to another job posting",
                )
            if existing.demand_id != payload.demand_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"candidate_contact {rec.candidate_contact} belongs to another demand",
                )
            data = rec.dict(exclude_unset=True)
            data.pop("candidate_contact", None)
            for key, value in data.items():
                setattr(existing, key, value)
            existing.modified_at = now
            existing.modified_by = rec.modified_by or existing.modified_by or "system"
            try:
                db.add(existing)
                db.flush()
            except IntegrityError as exc:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Integrity error updating candidate {rec.candidate_contact}",
                ) from exc
            updated += 1
            continue

        # new record
        new_obj = InterviewedCandidateDetails(
            candidate_contact=rec.candidate_contact,
            candidate_name=rec.candidate_name,
            unique_job_posting_id=payload.unique_job_posting_id,
            demand_id=payload.demand_id,
            candidate_type=rec.candidate_type,
            tp_vendor_name=rec.tp_vendor_name,
            candidate_email=rec.candidate_email,
            interview_status=rec.interview_status,
            initial_screening_status=rec.initial_screening_status,
            initial_screening_rejected_reason=rec.initial_screening_rejected_reason,
            tp1_interview_status=rec.tp1_interview_status,
            tp1_rejected_reason=rec.tp1_rejected_reason,
            tp2_interview_status=rec.tp2_interview_status,
            tp2_skipped_rejected_reason=rec.tp2_skipped_rejected_reason,
            manager_interview_status=rec.manager_interview_status,
            manager_skipped_rejected_reason=rec.manager_skipped_rejected_reason,
            customer_interview_status=rec.customer_interview_status,
            customer_interview_skipped_rejected_reason=rec.customer_interview_skipped_rejected_reason,
            candidate_selected_date=rec.candidate_selected_date,
            created_at=now,
            modified_at=now,
            created_by=rec.created_by or "system",
            modified_by=rec.modified_by or rec.created_by or "system",
        )
        try:
            db.add(new_obj)
            db.flush()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Integrity error inserting candidate {rec.candidate_contact}",
            ) from exc
        inserted += 1

    db.commit()
    return {"inserted": inserted, "updated": updated}
