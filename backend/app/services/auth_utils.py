import os
from datetime import datetime, timedelta
from typing import Optional, Set

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_db
from app.models.user import User
from app.models.role import Role

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    default="pbkdf2_sha256",
    deprecated="auto",
)
http_bearer = HTTPBearer(auto_error=False)

JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key")
JWT_ALG = "HS256"
JWT_TTL_SECONDS = int(os.getenv("JWT_TTL_SECONDS", "7200"))
DEFAULT_ROLES = {"admin", "developer", "leader", "delivery_manager"}
CACHE_TTL_SECONDS = 60
_cached_roles: Set[str] = set()
_cache_ts: Optional[datetime] = None


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(password, hashed)
    except (UnknownHashError, ValueError):  # handle legacy/invalid hashes gracefully
        return False


def create_access_token(user: User) -> tuple[str, datetime]:
    expires_at = datetime.utcnow() + timedelta(seconds=JWT_TTL_SECONDS)
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "exp": expires_at,
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)
    return token, expires_at


def _normalize_role(role: str) -> str:
    return (role or "").strip().lower().replace(" ", "_")


def _load_roles_from_db() -> Set[str]:
    roles: Set[str] = set()
    try:
        with SessionLocal() as db:
            existing = {_normalize_role(r.name) for r in db.query(Role).all() if r.name}
            if "admin" not in existing:
                db.merge(Role(name="admin"))
                db.commit()
                existing = {_normalize_role(r.name) for r in db.query(Role).all() if r.name}
            roles = {r for r in existing if r}
    except Exception:
        # Fall back to defaults if the roles table is unavailable for any reason.
        roles = set(DEFAULT_ROLES)
    return roles or set(DEFAULT_ROLES)


def get_known_roles(force_refresh: bool = False) -> Set[str]:
    global _cached_roles, _cache_ts
    if not force_refresh and _cached_roles and _cache_ts:
        if datetime.utcnow() - _cache_ts < timedelta(seconds=CACHE_TTL_SECONDS):
            return _cached_roles
    _cached_roles = _load_roles_from_db()
    _cache_ts = datetime.utcnow()
    return _cached_roles


def refresh_role_cache() -> Set[str]:
    return get_known_roles(force_refresh=True)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError as exc:  # pragma: no cover
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from exc
    except jwt.PyJWTError as exc:  # pragma: no cover
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


def optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if credentials is None:
        return None
    token = credentials.credentials
    data = _decode_token(token)
    user = db.query(User).filter(User.id == data.get("sub")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=True)),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    data = _decode_token(token)
    user = db.query(User).filter(User.id == data.get("sub")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_user(user: User = Depends(get_current_user)) -> User:
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return user


def require_admin_or_developer(user: User = Depends(get_current_user)) -> User:
    if user.role not in {"admin", "developer"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or developer role required")
    return user


def ensure_allowed_role(role: str) -> str:
    normalized = _normalize_role(role)
    roles = get_known_roles()
    if normalized not in roles:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
    return normalized


def normalize_role_value(role: str) -> str:
    return ensure_allowed_role(role)
