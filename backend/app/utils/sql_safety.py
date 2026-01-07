from __future__ import annotations

import re
from typing import Iterable, Mapping, Sequence

from sqlalchemy import text
from sqlalchemy.engine import Engine

FORBIDDEN_KEYWORDS = {"DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "PRAGMA"}


class SQLValidationError(ValueError):
    """Raised when a candidate SQL statement fails safety validation."""


def _strip_comments(sql: str) -> str:
    # Remove simple line comments to reduce surface for bypass; not a full SQL parser
    no_line = re.sub(r"--.*?$", "", sql, flags=re.MULTILINE)
    no_block = re.sub(r"/\*.*?\*/", "", no_line, flags=re.DOTALL)
    return no_block.strip()


def _ensure_single_statement(sql: str) -> None:
    # Allow a single statement with optional trailing semicolons; reject others
    trimmed = sql.strip()
    # If there's any semicolon not at the very end (after stripping), reject
    core = trimmed.rstrip(";").strip()
    if ";" in core:
        raise SQLValidationError("Only a single statement is allowed")


def _ensure_select_only(sql_upper: str) -> None:
    if not sql_upper.startswith("SELECT"):
        raise SQLValidationError("Only SELECT statements are allowed")
    for keyword in FORBIDDEN_KEYWORDS:
        if re.search(rf"\b{keyword}\b", sql_upper):
            raise SQLValidationError(f"Keyword '{keyword}' is not allowed")


def _extract_table(sql_upper: str) -> str:
    match = re.search(r"\bFROM\s+([a-zA-Z0-9_\.]+)", sql_upper)
    if not match:
        raise SQLValidationError("FROM clause with a single table is required")
    return match.group(1)


def _extract_selected_columns(sql: str) -> Sequence[str]:
    select_match = re.search(r"select\s+(.*?)\s+from\s", sql, flags=re.IGNORECASE | re.DOTALL)
    if not select_match:
        raise SQLValidationError("Failed to parse selected columns")
    raw_columns = select_match.group(1)
    # Split by commas not caring about nested functions; acceptable for simple use-cases
    cols = [c.strip() for c in raw_columns.split(",") if c.strip()]
    return cols


def _enforce_columns(columns: Sequence[str], allowed_columns: Iterable[str]) -> None:
    allowed = {c.lower() for c in allowed_columns}
    for col in columns:
        col_core = col.strip()
        col_core = re.sub(r"\s+AS\s+[`\"\[]?[A-Za-z0-9_]+[`\"\]]?$", "", col_core, flags=re.IGNORECASE)
        # Allow DISTINCT/ALL prefix (e.g., SELECT DISTINCT col)
        col_core = re.sub(r"(?i)^distinct\s+", "", col_core).strip()
        col_core = re.sub(r"(?i)^all\s+", "", col_core).strip()
        if " " in col_core:
            col_core = col_core.split(" ", 1)[0]

        # Permit '*' only if explicitly allowed
        if col_core == "*":
            # Allow wildcard when caller provided a concrete allowed column list
            if allowed:
                continue
            if "*" in allowed:
                continue
            raise SQLValidationError("Wildcard selection is not allowed")

        # Allow basic aggregates when their inner column is allowed
        agg_match = re.match(r"(?i)^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(.*?)\s*\)$", col_core)
        if agg_match:
            func = agg_match.group(1).upper()
            inner = agg_match.group(2)
            if func == "COUNT" and inner in {"*", "1"}:
                continue
            normalized_inner = re.sub(
                r'^[`\["]?(?:[A-Za-z0-9_]+\.)?([A-Za-z0-9_]+)[`\]"]?',
                r"\1",
                inner,
            )
            if normalized_inner.lower() not in allowed:
                raise SQLValidationError(f"Column '{normalized_inner}' is not allowed in {func}()")
            continue

        # Strip optional table prefixes and quotes
        normalized = re.sub(
            r'^[`\["]?(?:[A-Za-z0-9_]+\.)?([A-Za-z0-9_]+)[`\]"]?',
            r"\1",
            col,
        )
        normalized = re.sub(r"(?i)^distinct\s+", "", normalized).strip()
        if normalized.lower() not in allowed:
            raise SQLValidationError(f"Column '{normalized}' is not allowed")


def _enforce_limit(sql: str) -> str:
    limit_match = re.search(r"\blimit\s+(\d+)", sql, flags=re.IGNORECASE)
    if limit_match:
        value = int(limit_match.group(1))
        if value > 1000:
            sql = re.sub(r"\blimit\s+\d+", "LIMIT 1000", sql, flags=re.IGNORECASE)
    return sql


def validate_sql(sql: str, allowed_table: str, allowed_columns: Iterable[str]) -> str:
    if not sql:
        raise SQLValidationError("SQL must not be empty")
    if not allowed_table:
        raise SQLValidationError("Allowed table must be specified")
    if not allowed_columns:
        raise SQLValidationError("Allowed columns must be specified")

    cleaned = _strip_comments(sql)
    cleaned = re.sub(r";+", " ", cleaned)  # remove all semicolons
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    _ensure_single_statement(cleaned)

    sql_upper = cleaned.upper()
    _ensure_select_only(sql_upper)

    table = _extract_table(sql_upper)
    if table != allowed_table.upper():
        raise SQLValidationError("Querying this table is not allowed")

    selected_columns = _extract_selected_columns(cleaned)
    _enforce_columns(selected_columns, allowed_columns)

    return _enforce_limit(cleaned)


def execute_safe_sql(
    engine: Engine,
    sql: str,
    params: Mapping[str, object] | None,
    *,
    allowed_table: str,
    allowed_columns: Iterable[str],
) -> list[dict[str, object]]:
    if params is None:
        params = {}
    if not isinstance(params, Mapping):
        raise SQLValidationError("Params must be a mapping for parameterized execution")

    validated_sql = validate_sql(sql, allowed_table=allowed_table, allowed_columns=allowed_columns)

    stmt = text(validated_sql)
    with engine.connect() as conn:
        result = conn.execute(stmt, params)
        rows = result.mappings().all()
    return [dict(row) for row in rows]
