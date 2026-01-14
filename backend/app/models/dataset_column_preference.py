from datetime import datetime
import uuid

from sqlalchemy import JSON, Column, DateTime, String, UniqueConstraint
from sqlalchemy.orm import declarative_base

from app.db import engine

Base = declarative_base()


class DatasetColumnPreference(Base):
    __tablename__ = "dataset_column_preferences"
    __table_args__ = (
        UniqueConstraint("dataset_id", "user_id", name="uq_dataset_user_pref"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    columns_json = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


Base.metadata.create_all(bind=engine)
