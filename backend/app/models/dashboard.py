from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.db import engine
from app.models.dataset import Base


class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    order_index = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


Base.metadata.create_all(bind=engine)
