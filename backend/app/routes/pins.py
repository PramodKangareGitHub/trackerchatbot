from __future__ import annotations

import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.pinned_question import PinnedQuestion
from app.services.auth_utils import require_user
from app.models.user import User

router = APIRouter(prefix="/api/pins", tags=["pins"], dependencies=[Depends(require_user)])


@router.get("")
async def list_pins(
    dataset_id: str = Query(..., description="Dataset identifier"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> Dict[str, Any]:
    if not dataset_id:
        raise HTTPException(status_code=400, detail="dataset_id is required")
    stmt = (
        select(PinnedQuestion)
        .where(
            PinnedQuestion.dataset_id == dataset_id,
            PinnedQuestion.user_id == current_user.id,
        )
        .order_by(PinnedQuestion.created_at.desc())
    )
    rows: List[PinnedQuestion] = db.execute(stmt).scalars().all()
    return {
        "status": "ok",
        "pins": [
            {
                "id": row.id,
                "dataset_id": row.dataset_id,
                "question": row.question,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ],
    }


@router.post("")
async def add_pin(
    payload: Dict[str, str],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> Dict[str, Any]:
    dataset_id = (payload.get("dataset_id") or "").strip()
    question = (payload.get("question") or "").strip()
    if not dataset_id or not question:
        raise HTTPException(status_code=400, detail="dataset_id and question are required")

    # Deduplicate per dataset
    stmt = select(PinnedQuestion).where(
        PinnedQuestion.dataset_id == dataset_id,
        PinnedQuestion.user_id == current_user.id,
        PinnedQuestion.question == question,
    )
    existing = db.execute(stmt).scalars().first()
    if existing:
        return {
            "status": "ok",
            "pin": {
                "id": existing.id,
                "dataset_id": existing.dataset_id,
                "question": existing.question,
                "created_at": existing.created_at.isoformat(),
            },
        }

    pin = PinnedQuestion(
        id=str(uuid.uuid4()),
        dataset_id=dataset_id,
        user_id=current_user.id,
        question=question,
    )
    db.add(pin)
    db.commit()
    db.refresh(pin)
    return {
        "status": "ok",
        "pin": {
            "id": pin.id,
            "dataset_id": pin.dataset_id,
            "question": pin.question,
            "created_at": pin.created_at.isoformat(),
        },
    }


@router.delete("/{pin_id}")
async def delete_pin(
    pin_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> Dict[str, Any]:
    if not pin_id:
        raise HTTPException(status_code=400, detail="pin_id is required")
    stmt = delete(PinnedQuestion).where(
        PinnedQuestion.id == pin_id,
        PinnedQuestion.user_id == current_user.id,
    )
    result = db.execute(stmt)
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Pin not found")
    return {"status": "ok"}
