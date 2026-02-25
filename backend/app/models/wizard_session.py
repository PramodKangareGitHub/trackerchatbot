from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base
import uuid
from datetime import datetime

class WizardSession(Base):
    __tablename__ = "wizard_sessions"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    status = Column(String(16), nullable=False, default="Draft")
    current_step = Column(Integer, nullable=False, default=1)
    is_deleted = Column(Boolean, nullable=False, default=False)
    job_posting_unique_id = Column(String, ForeignKey("job_postings.unique_job_posting_id"), nullable=True)
    demand_id = Column(String, ForeignKey("demands.id"), nullable=True)
    candidate_application_id = Column(String, ForeignKey("candidate_applications.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships (to be filled in as models are created)
    job_posting = relationship("JobPosting", back_populates="wizard_sessions")
    demand = relationship("Demand", back_populates="wizard_sessions")
    candidate_application = relationship("CandidateApplication", back_populates="wizard_sessions")
