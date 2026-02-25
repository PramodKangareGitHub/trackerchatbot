from sqlalchemy import Column, String, Integer
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class JobPostingSequence(Base):
    __tablename__ = "job_posting_sequences"
    job_posting_id = Column(String, primary_key=True)
    last_number = Column(Integer, nullable=False, default=0)
