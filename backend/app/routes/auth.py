from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.services.auth_utils import (
    create_access_token,
    ensure_allowed_role,
    get_current_user,
    hash_password,
    optional_current_user,
    require_admin,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class UserOut(BaseModel):
    id: str
    email: EmailStr
    role: str
    created_at: datetime

    class Config:
        orm_mode = True


class RegisterPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    role: str  # expected: admin, developer, leader, delivery_manager


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserOut


class SeedAdminPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class ChangePasswordPayload(BaseModel):
    new_password: str = Field(min_length=6)


class SelfChangePasswordPayload(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6)


def _first_user_exists(db: Session) -> bool:
    return db.query(User).first() is not None


def to_user_out(user: User) -> UserOut:
    # Pydantic v2: convert ORM object to dict first to avoid validation error
    normalized_role = (user.role or "").strip().lower()
    data = {
        "id": user.id,
        "email": user.email,
        "role": normalized_role,
        "created_at": user.created_at,
    }
    return UserOut.model_validate(data)


@router.post("/register", response_model=TokenResponse)
async def register_user(
    payload: RegisterPayload,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(optional_current_user),
):
    role = ensure_allowed_role(payload.role)

    # Allow open registration only for the first user; afterward require admin
    if _first_user_exists(db):
        if current_user is None or current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required")

    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token, expires_at = create_access_token(user)
    return TokenResponse(access_token=token, expires_at=expires_at, user=to_user_out(user))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token, expires_at = create_access_token(user)
    return TokenResponse(access_token=token, expires_at=expires_at, user=to_user_out(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return to_user_out(current_user)


@router.get("/users", response_model=List[UserOut])
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    users = db.query(User).order_by(User.created_at.asc()).all()
    return [to_user_out(u) for u in users]


@router.post("/seed-admin", response_model=TokenResponse)
async def seed_admin(payload: SeedAdminPayload, db: Session = Depends(get_db)):
    # Allow seeding only when the user table is empty to avoid privilege escalations.
    if _first_user_exists(db):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Users already exist")

    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token, expires_at = create_access_token(user)
    return TokenResponse(access_token=token, expires_at=expires_at, user=to_user_out(user))


@router.post("/users/{user_id}/password", response_model=UserOut)
async def change_password(
    user_id: str,
    payload: ChangePasswordPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.role not in {"leader", "delivery_manager"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only leader or delivery manager passwords can be reset",
        )

    target.password_hash = hash_password(payload.new_password)
    db.add(target)
    db.commit()
    db.refresh(target)
    return to_user_out(target)


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")
    db.delete(target)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/change-password", response_model=UserOut)
async def change_password_self(
    payload: SelfChangePasswordPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    user.password_hash = hash_password(payload.new_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return to_user_out(user)
