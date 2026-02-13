from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Integer, String

from app.db import engine
from app.models.dataset import Base


class DashboardWidget(Base):
    __tablename__ = "dashboard_widgets"

    id = Column(String(36), primary_key=True, index=True)
    title = Column(String, nullable=False)
    widget_type = Column(String, nullable=True)
    role = Column(String, nullable=True)
    order_index = Column(Integer, nullable=True)
    config_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


Base.metadata.create_all(bind=engine)
