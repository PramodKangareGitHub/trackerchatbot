from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.job_posting_sequence import JobPostingSequence
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from starlette.status import HTTP_409_CONFLICT

router = APIRouter()

@router.post("/wizard/unique-job-posting-id")
def generate_unique_job_posting_id(job_posting_id: str, db: Session = Depends(get_db)):
    """
    Generate a concurrency-safe UniqueJobPostingId for a given JobPostingId.
    Returns the new unique id (e.g., JP100_1, JP100_2, ...).
    """
    try:
        with db.begin():
            seq = db.execute(
                select(JobPostingSequence).where(JobPostingSequence.job_posting_id == job_posting_id).with_for_update()
            ).scalar_one_or_none()
            if seq is None:
                seq = JobPostingSequence(job_posting_id=job_posting_id, last_number=1)
                db.add(seq)
                db.flush()
            else:
                seq.last_number += 1
                db.flush()
            unique_id = f"{job_posting_id}_{seq.last_number}"
        return {"unique_job_posting_id": unique_id}
    except IntegrityError:
        raise HTTPException(status_code=HTTP_409_CONFLICT, detail="UniqueJobPostingId conflict. Please retry.")
