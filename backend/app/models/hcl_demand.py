from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from app.db import engine, Base


class HclDemand(Base):
    __tablename__ = "hcl_demand"

    # demand_id is a unique business identifier, but the row is keyed by unique_job_posting_id
    demand_id = Column(String(128), unique=True, index=True)
    unique_job_posting_id = Column(
        String(128),
        ForeignKey("customer_requirements.unique_job_posting_id"),
        primary_key=True,
        nullable=False,
        index=True,
    )
    tag_spoc = Column(String(255))
    tsc_spoc = Column(String(255))
    demand_created_date = Column(DateTime)
    demand_status = Column(String(128))
    demand_approved_date = Column(DateTime)
    tag_first_profile_sourced_date = Column(DateTime)
    tsc_first_profile_sourced_date = Column(DateTime)
    tp_profiles_requested = Column(Integer)
    tp_vendor_name = Column(String(255))
    tp_profiles_requested_date = Column(DateTime)
    tp_first_profile_sourced_date = Column(DateTime)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    modified_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(128))
    modified_by = Column(String(128))


Base.metadata.create_all(bind=engine)
