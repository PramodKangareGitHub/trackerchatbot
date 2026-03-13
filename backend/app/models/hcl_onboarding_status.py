from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
from app.db import engine, Base


class HclOnboardingStatus(Base):
    __tablename__ = "hcl_onboarding_status"

    sap_id = Column(String(128), nullable=True, unique=True)
    unique_job_posting_id = Column(
        String(128),
        ForeignKey("customer_requirements.unique_job_posting_id"),
        primary_key=True,
        nullable=False,
        index=True,
    )
    demand_id = Column(String(128), ForeignKey("hcl_demand.demand_id"), nullable=False, index=True)
    candidate_contact = Column(
        String(64), ForeignKey("interviewed_candidate_details.candidate_contact"), nullable=False, index=True
    )
    candidate_email = Column(String(255))
    hcl_onboarding_status = Column(String(128))
    hire_loss_reason = Column(String)
    onboarded_date = Column(DateTime)
    employee_name = Column(String(255))
    employee_hcl_email = Column(String(255))
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    modified_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(128))
    modified_by = Column(String(128))


Base.metadata.create_all(bind=engine)
