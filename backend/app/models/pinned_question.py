from datetime import datetime

from sqlalchemy import Column, DateTime, String, UniqueConstraint

from app.db import engine
from app.models.dataset import Base


class PinnedQuestion(Base):
    __tablename__ = "pinned_questions"
    __table_args__ = (
        UniqueConstraint("dataset_id", "user_id", "question", name="uq_pins_dataset_user_question"),
    )

    id = Column(String(36), primary_key=True, index=True)
    dataset_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    question = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)