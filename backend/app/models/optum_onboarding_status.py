from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String

from app.db import Base


class OptumOnboardingStatus(Base):
    __tablename__ = "optum_onboarding_status"

    customer_employee_id = Column(String(128), nullable=True)
    unique_job_posting_id = Column(
        String(128), ForeignKey("customer_requirements.unique_job_posting_id"), nullable=False, index=True
    )
    sap_id = Column(
        String(128),
        ForeignKey("hcl_onboarding_status.sap_id"),
        nullable=False,
        index=True,
        primary_key=True,
    )
    customer_onboarding_status = Column(String(128))
    customer_onboarded_date = Column(DateTime)
    customer_employee_name = Column(String(255))
    customer_email = Column(String(255))
    customer_login_id = Column(String(255))
    customer_lob = Column(String(255))
    billing_start_date = Column(DateTime)
    customer_laptop_required = Column(String(64))
    customer_laptop_status = Column(String(128))
    customer_laptop_serial_no = Column(String(255))
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    modified_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(128))
    modified_by = Column(String(128))
