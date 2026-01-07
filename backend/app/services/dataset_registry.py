from __future__ import annotations

import re
import uuid
from typing import Iterable, Sequence

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import SessionLocal, engine
from app.models.dataset import Dataset

_DATA_TABLE_RE = re.compile(r"^data_[a-z0-9_]+$")


def _ensure_sequence(columns_json: Iterable[str] | dict | list | None) -> list | dict | None:
    # Normalize incoming columns payload to something JSON-serializable
    if columns_json is None:
        return []
    if isinstance(columns_json, dict):
        return columns_json
    if isinstance(columns_json, list):
        return columns_json
    return list(columns_json)


def create_dataset_entry(
    original_file_name: str,
    table_name: str,
    row_count: int,
    columns_json: Iterable[str] | dict | list | None = None,
    db: Session | None = None,
    dataset_id: str | None = None,
) -> Dataset:
    dataset_id = dataset_id or str(uuid.uuid4())

    def _create(session: Session) -> Dataset:
        dataset = Dataset(
            id=dataset_id,
            original_file_name=original_file_name,
            table_name=table_name,
            row_count=row_count,
            columns_json=_ensure_sequence(columns_json),
        )
        session.add(dataset)
        session.commit()
        session.refresh(dataset)
        return dataset

    if db is not None:
        return _create(db)

    with SessionLocal() as session:
        return _create(session)


def get_dataset(dataset_id: str, db: Session | None = None) -> Dataset | None:
    if db is not None:
        return db.get(Dataset, dataset_id)

    with SessionLocal() as session:
        return session.get(Dataset, dataset_id)


def list_datasets(db: Session | None = None) -> Sequence[Dataset]:
    if db is not None:
        return db.query(Dataset).order_by(Dataset.created_at.desc()).all()

    with SessionLocal() as session:
        return session.query(Dataset).order_by(Dataset.created_at.desc()).all()


def _drop_table(table_name: str) -> bool:
    if not _DATA_TABLE_RE.match(table_name):
        return False
    with engine.begin() as conn:
        conn.execute(text(f'DROP TABLE IF EXISTS "{table_name}"'))
    return True


def delete_dataset(dataset_id: str, db: Session | None = None, drop_table: bool = True) -> bool:
    def _delete(session: Session) -> bool:
        dataset = session.get(Dataset, dataset_id)
        if dataset is None:
            return False
        if drop_table:
            _drop_table(dataset.table_name)
        session.delete(dataset)
        session.commit()
        return True

    if db is not None:
        return _delete(db)

    with SessionLocal() as session:
        return _delete(session)


def delete_all_datasets(db: Session | None = None, drop_tables: bool = True) -> int:
    def _delete(session: Session) -> int:
        datasets = session.query(Dataset).all()
        for ds in datasets:
            if drop_tables:
                _drop_table(ds.table_name)
            session.delete(ds)
        session.commit()
        return len(datasets)

    if db is not None:
        return _delete(db)

    with SessionLocal() as session:
        return _delete(session)
