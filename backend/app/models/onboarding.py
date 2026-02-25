from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db import Base

class Employee(Base):
    __tablename__ = "employees"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sap_employee_id = Column(String)
    employee_name = Column(String)
    employee_contact_number = Column(String)
    employee_hcl_email_id = Column(String)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

class HclOnboarding(Base):
    __tablename__ = "hcl_onboardings"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_posting_id = Column(String, ForeignKey("job_postings.id"), nullable=False)
    unique_job_posting_id = Column(String, ForeignKey("job_postings.unique_job_posting_id"), nullable=False)
    demand_id = Column(String, ForeignKey("demands.id"), nullable=True)
    tag_spoc = Column(String)
    hcl_fulfillment_spoc = Column(String)
    customer_leader = Column(String)
    customer_hiring_manager = Column(String)
    candidate_name = Column(String)
    candidate_contact_number = Column(String)
    candidate_email_id = Column(String)
    hcl_onboarding_status = Column(String)
    hire_loss_reason = Column(String)
    onboarded_date = Column(DateTime)
    employee_id = Column(String, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("Employee")

class CustomerOnboarding(Base):
    __tablename__ = "customer_onboardings"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_posting_id = Column(String, ForeignKey("job_postings.id"), nullable=False)
    unique_job_posting_id = Column(String, ForeignKey("job_postings.unique_job_posting_id"), nullable=False)
    hcl_fulfillment_spoc = Column(String)
    customer_leader = Column(String)
    customer_hiring_manager = Column(String)
    customer_onboarding_status = Column(String)
    customer_onboarded_date = Column(DateTime)
    customer_employee_id = Column(String)
    customer_employee_name = Column(String)
    customer_email_id = Column(String)
    customer_login_id = Column(String)
    customer_line_of_business = Column(String)
    billing_start_date = Column(DateTime)
    customer_laptop_required = Column(String)
    customer_laptop_status = Column(String)
    customer_laptop_serial_number = Column(String)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
