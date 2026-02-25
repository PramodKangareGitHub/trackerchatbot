from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db import Base

class JobPosting(Base):
    __tablename__ = "job_postings"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_posting_id = Column(String, nullable=False)
    unique_job_posting_id = Column(String, nullable=False, unique=True, index=True)
    portfolio = Column(String)
    sub_portfolio = Column(String)
    tower = Column(String)
    business_unit = Column(String)
    location = Column(String)
    sub_location = Column(String)
    number_of_positions = Column(Integer)
    requirement_type = Column(String)
    customer_job_posting_date = Column(DateTime)
    job_role = Column(String)
    skill_category = Column(String)
    primary_skills = Column(String)
    secondary_skills = Column(String)
    customer_cio = Column(String)
    customer_leader = Column(String)
    customer_vice_president = Column(String)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    wizard_sessions = relationship("WizardSession", back_populates="job_posting")

    __table_args__ = (
        UniqueConstraint("unique_job_posting_id", name="uq_job_postings_unique_id"),
    )
