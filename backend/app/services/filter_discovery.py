from __future__ import annotations

import re
from typing import Iterable, List, Mapping, Sequence

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db import engine as default_engine

_PREFERRED = ["position", "portfolio", "department", "location", "country", "city"]
_TEXT_HINTS = ["char", "text", "string", "varchar"]
_NON_TEXT_HINTS = ["int", "float", "double", "decimal", "numeric", "bool", "date", "time"]
_IDENTIFIER_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def _is_text_type(type_hint: str | None) -> bool:
    if not type_hint:
        return True
    lowered = type_hint.lower()
    if any(h in lowered for h in _TEXT_HINTS):
        return True
    if any(h in lowered for h in _NON_TEXT_HINTS):
        return False
    return True


def _extract_name_and_type(col: str | Mapping[str, object]) -> tuple[str, str | None]:
    if isinstance(col, str):
        return col, None
    name = str(col.get("name")) if "name" in col else None
    if not name:
        raise ValueError("Column entries must provide a name")
    type_hint = str(col.get("type")) if col.get("type") is not None else None
    return name, type_hint


def identify_candidate_columns(columns: Iterable[str | Mapping[str, object]]) -> List[str]:
    candidates: list[tuple[int, int, str]] = []  # (priority, index, name)
    for idx, col in enumerate(columns):
        name, type_hint = _extract_name_and_type(col)
        if not _is_text_type(type_hint):
            continue
        lowered = name.lower()
        priority = _PREFERRED.index(lowered) if lowered in _PREFERRED else len(_PREFERRED) + 1
        candidates.append((priority, idx, name))

    candidates.sort(key=lambda tup: (tup[0], tup[1]))
    return [name for _, _, name in candidates[:5]]


def _validate_identifier(identifier: str) -> str:
    if not _IDENTIFIER_RE.fullmatch(identifier):
        raise ValueError("Invalid identifier")
    return identifier


def fetch_distinct_values(
    table: str,
    column: str,
    *,
    engine: Engine | None = None,
    bucket: str | None = None,
) -> Sequence[object]:
    engine = engine or default_engine
    table_safe = _validate_identifier(table)
    column_safe = _validate_identifier(column)

    if bucket == "month":
        stmt = text(
            f"""
            SELECT DISTINCT strftime('%Y-%m', "{column_safe}") AS value
            FROM "{table_safe}"
            WHERE "{column_safe}" IS NOT NULL
              AND TRIM(CAST("{column_safe}" AS TEXT)) != ''
            ORDER BY value ASC
            LIMIT 24
            """
        )
    else:
        stmt = text(
            f"""
            SELECT DISTINCT TRIM(CAST("{column_safe}" AS TEXT)) AS value
            FROM "{table_safe}"
            WHERE "{column_safe}" IS NOT NULL
              AND TRIM(CAST("{column_safe}" AS TEXT)) != ''
            ORDER BY value ASC
            LIMIT 20
            """
        )

    with engine.connect() as conn:
        result = conn.execute(stmt)
        values = [row[0] for row in result]

    return values
