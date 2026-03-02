from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
from app.db import engine, Base


class InterviewedCandidateDetails(Base):
    __tablename__ = "interviewed_candidate_details"

    candidate_contact = Column(String(64), primary_key=True)
    candidate_name = Column(String(255))
    unique_job_posting_id = Column(
        String(128), ForeignKey("customer_requirements.unique_job_posting_id"), nullable=False, index=True
    )
    demand_id = Column(String(128), ForeignKey("hcl_demand.demand_id"), nullable=False, index=True)
    candidate_type = Column(String(128))
    tp_vendor_name = Column(String(255))
    candidate_email = Column(String(255))
    interview_status = Column(String(128))
    initial_screening_status = Column(String(128))
    initial_screening_rejected_reason = Column(String)
    tp1_interview_status = Column(String(128))
    tp1_rejected_reason = Column(String)
    tp2_interview_status = Column(String(128))
    tp2_skipped_rejected_reason = Column(String)
    manager_interview_status = Column(String(128))
    manager_skipped_rejected_reason = Column(String)
    customer_interview_status = Column(String(128))
    customer_interview_skipped_rejected_reason = Column(String)
    candidate_selected_date = Column(DateTime)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    modified_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(128))
    modified_by = Column(String(128))


Base.metadata.create_all(bind=engine)
