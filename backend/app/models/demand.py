from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
import uuid
from datetime import datetime
from app.db import Base

class Demand(Base):
    __tablename__ = "demands"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_posting_id = Column(String, ForeignKey("job_postings.id"), nullable=False)
    unique_job_posting_id = Column(String, ForeignKey("job_postings.unique_job_posting_id"), nullable=False)
    tag_spoc = Column(String)
    tsc_spoc = Column(String)
    demand_id = Column(String)
    demand_created_date = Column(DateTime)
    demand_status = Column(String)
    demand_approved_date = Column(DateTime)
    number_of_positions = Column(Integer)
    tag_first_profile_sourced_date = Column(DateTime)
    tsc_first_profile_sourced_date = Column(DateTime)
    tp_profiles_requested = Column(Integer)
    tp_vendor_name = Column(String)
    tp_profiles_requested_date = Column(DateTime)
    tp_first_profile_sourced_date = Column(DateTime)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

