from datetime import datetime
import uuid

from sqlalchemy import Column, DateTime, String, UniqueConstraint
from sqlalchemy.orm import declarative_base

from app.db import engine

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)
