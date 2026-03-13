from datetime import datetime
import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from app.db import engine, Base


class CustomerRequirement(Base):
    __tablename__ = "customer_requirements"

    unique_job_posting_id = Column(String(128), primary_key=True, default=lambda: str(uuid.uuid4()))
    portfolio = Column(String)
    sub_portfolio = Column(String)
    tower = Column(String)
    customer_cio = Column(String)
    customer_leader = Column(String)
    customer_vice_president = Column(String)
    customer_senior_director = Column(String)
    customer_director = Column(String)
    customer_hiring_manager = Column(String)
    customer_band = Column(String)
    hcl_leader = Column(String)
    hcl_deliver_spoc = Column(String)
    job_posting_id = Column(String, index=True)
    location = Column(String)
    sub_location = Column(String)
    requirement_type = Column(String)
    business_unit = Column(String)
    customer_job_posting_date = Column(DateTime)
    first_profile_submitted = Column(Boolean, default=False)
    first_profile_submitted_date = Column(DateTime)
    number_of_positions = Column(Integer)
    sell_rate = Column(Float)
    job_posting_status = Column(String)
    job_role = Column(String)
    skill_category = Column(String)
    primary_skills = Column(String)
    secondary_skills = Column(String)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String)
    modified_by = Column(String)


Base.metadata.create_all(bind=engine)
