from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db import Base

class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String)
    contact_number = Column(String)
    email_id = Column(String)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

class CandidateApplication(Base):
    __tablename__ = "candidate_applications"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)
    job_posting_id = Column(String, ForeignKey("job_postings.id"), nullable=False)
    demand_id = Column(String, ForeignKey("demands.id"), nullable=True)
    candidate_source_type = Column(String)
    tp_vendor_name = Column(String)
    overall_interview_status = Column(String)
    initial_screening_status = Column(String)
    initial_screening_rejection_reason = Column(String)
    tp1_interview_status = Column(String)
    tp1_rejection_reason = Column(String)
    tp2_interview_status = Column(String)
    tp2_skip_rejection_reason = Column(String)
    manager_interview_status = Column(String)
    manager_skip_rejection_reason = Column(String)
    customer_interview_status = Column(String)
    customer_interview_skipped_rejected = Column(String)
    candidate_selected_date = Column(DateTime)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    candidate = relationship("Candidate")
    wizard_sessions = relationship("WizardSession", back_populates="candidate_application")

class InterviewStage(Base):
    __tablename__ = "interview_stages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)

class CandidateInterview(Base):
    __tablename__ = "candidate_interviews"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    candidate_application_id = Column(String, ForeignKey("candidate_applications.id"), nullable=False)
    stage_id = Column(Integer, ForeignKey("interview_stages.id"), nullable=False)
    status = Column(String)
    rejection_reason = Column(String)
    skipped = Column(String)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    candidate_application = relationship("CandidateApplication")
    stage = relationship("InterviewStage")
