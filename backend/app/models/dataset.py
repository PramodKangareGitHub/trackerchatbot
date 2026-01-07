from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Integer, String
from sqlalchemy.orm import declarative_base

from app.db import engine

Base = declarative_base()


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String(36), primary_key=True, index=True)
    original_file_name = Column(String, nullable=False)
    table_name = Column(String, nullable=False)
    row_count = Column(Integer, nullable=False, default=0)
    columns_json = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)
