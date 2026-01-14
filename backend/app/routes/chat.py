from __future__ import annotations

import re
from typing import Any, Dict, List, Sequence

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import engine, get_db
from app.services.dataset_registry import get_dataset
from app.services.filter_discovery import fetch_distinct_values, identify_candidate_columns
from app.services.langchain_intent import IntentResult, generate_intent, intent_provider
from app.utils.sql_safety import SQLValidationError, execute_safe_sql, validate_sql
from app.services.auth_utils import require_user
from app.models.dataset_column_preference import DatasetColumnPreference
from app.models.user import User

router = APIRouter(prefix="/api", tags=["chat"], dependencies=[Depends(require_user)])

FILTER_SKIP = {"sl_no", "slno", "serial_no", "serialno"}
DATE_BUCKET_CANONICAL = {"jp_posting_date_to_hcl"}


def _canon_column(col: str | None) -> str:
    if not col:
        return ""
    return re.sub(r"[^a-z0-9]+", "_", col.strip().lower()).strip("_")


class FilterInput(BaseModel):
    column: str
    values: List[str]


class ChatRequest(BaseModel):
    dataset_id: str = Field(..., description="Dataset identifier")
    question: str = Field(..., description="User question in natural language")
    applied_filters: List[FilterInput] | None = Field(
        default=None,
        description="Optional filters to apply: list of {column: str, values: list[str]}"
    )


class DrillRequest(BaseModel):
    dataset_id: str = Field(..., description="Dataset identifier")
    filters: List[FilterInput] | None = Field(
        default=None,
        description="Filters to slice the drill report"
    )
    limit: int | None = Field(default=500, description="Maximum rows to return")


def _get_sample_rows(table_name: str, limit: int = 5) -> list[dict[str, Any]]:
    stmt = text(f'SELECT * FROM "{table_name}" LIMIT {limit}')
    with engine.connect() as conn:
        rows = conn.execute(stmt).mappings().all()
    return [dict(row) for row in rows]


def _normalize_filters(
    filters: Sequence[FilterInput] | None,
    allowed_columns: Sequence[str],
) -> list[dict[str, Any]]:
    if not filters:
        return []
    # Build maps so we can accept canonicalized column names (e.g., "div2" vs "Div 2")
    allowed_lower_map = {c.lower(): c for c in allowed_columns}
    allowed_canon_map = {_canon_column(c): c for c in allowed_columns}
    normalized: list[dict[str, Any]] = []
    for item in filters:
        column = str(item.column or "").strip()
        values = item.values or []
        if not column:
            continue
        if column.lower() in FILTER_SKIP:
            continue
        col_lower = column.lower()
        col_canon = _canon_column(column)
        if col_lower in allowed_lower_map:
            column = allowed_lower_map[col_lower]
        elif col_canon in allowed_canon_map:
            column = allowed_canon_map[col_canon]
        else:
            raise HTTPException(status_code=400, detail=f"Filter column '{column}' is not allowed")
        if not isinstance(values, list):
            raise HTTPException(status_code=400, detail="Filter values must be a list")

        cleaned_values = [str(v).strip() for v in values if str(v).strip()]
        if not cleaned_values:
            continue
        normalized.append({"column": column, "values": cleaned_values})

    return normalized


def _result_filter_groups(rows: list[dict[str, Any]], columns: Sequence[str]) -> list[dict[str, Any]]:
    if not rows:
        return []
    groups: list[dict[str, Any]] = []
    for col in columns:
        if col.strip().lower() in FILTER_SKIP:
            continue
        seen: set[str] = set()
        values: list[str] = []
        for row in rows:
            if col not in row:
                continue
            val = row[col]
            if val is None:
                continue
            s = str(val).strip()
            if not s or s in seen:
                continue
            seen.add(s)
            values.append(s)
            if len(values) >= 20:
                break
        if values:
            groups.append({"column": col, "values": values})
    return groups


def _merge_filter_groups(primary: list[dict[str, Any]], fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for grp in primary:
        col = grp.get("column")
        if not col or col in seen:
            continue
        seen.add(col)
        merged.append(grp)
    for grp in fallback:
        col = grp.get("column")
        if not col or col in seen:
            continue
        seen.add(col)
        merged.append(grp)
    return merged


def _filter_allowed_groups(groups: list[dict[str, Any]], allowed: Sequence[str]) -> list[dict[str, Any]]:
    allowed_set = {c.lower() for c in allowed}
    return [g for g in groups if str(g.get("column", "")).lower() in allowed_set]


def _inject_filters(sql: str, filters: list[dict[str, Any]]) -> tuple[str, Dict[str, Any]]:
    if not filters:
        return sql, {}

    clauses: list[str] = []
    params: Dict[str, Any] = {}

    for f_idx, filt in enumerate(filters):
        column = filt["column"]
        values = filt["values"]
        col_lower = column.lower()
        col_canon = _canon_column(column)
        # Special handling: skill_set filters use substring match and must satisfy all provided tokens
        if col_lower == "skill_set":
            and_parts: list[str] = []
            for v_idx, value in enumerate(values):
                trimmed_value = str(value).strip()
                if not trimmed_value:
                    continue
                param_key = f"f_{f_idx}_{v_idx}"
                and_parts.append(
                    f"LOWER(COALESCE(\"{column}\", \"\")) LIKE '%' || LOWER(:{param_key}) || '%'"
                )
                params[param_key] = trimmed_value
            if and_parts:
                clauses.append(f"({' AND '.join(and_parts)})")
            continue

        if col_lower == "business":
            or_parts: list[str] = []
            for v_idx, value in enumerate(values):
                trimmed_value = str(value).strip()
                if not trimmed_value:
                    continue
                param_key = f"f_{f_idx}_{v_idx}"
                or_parts.append(
                    f"LOWER(COALESCE(\"{column}\", \"\")) LIKE '%' || LOWER(:{param_key}) || '%'"
                )
                params[param_key] = trimmed_value
            if or_parts:
                clauses.append(f"({' OR '.join(or_parts)})")
            continue

        or_parts: list[str] = []
        for v_idx, value in enumerate(values):
            trimmed_value = str(value).strip()
            if not trimmed_value:
                continue
            param_key = f"f_{f_idx}_{v_idx}"

            # General range support (e.g., "range:1-5", "range:10+"), casting column to NUMERIC
            range_match_any = re.match(r"^range:(-?\d+(?:\.\d+)?)(?:-?(-?\d+(?:\.\d+)?|\+))?$", trimmed_value)
            if range_match_any:
                start_str, end_str = range_match_any.groups()
                start_num = float(start_str)
                if end_str is None or end_str == "+":
                    clause = f'CAST(COALESCE("{column}", 0) AS NUMERIC) >= :{param_key}'
                    params[param_key] = start_num
                else:
                    end_num = float(end_str)
                    clause = (
                        f'CAST(COALESCE("{column}", 0) AS NUMERIC) >= :{param_key}_a '
                        f'AND CAST(COALESCE("{column}", 0) AS NUMERIC) <= :{param_key}_b'
                    )
                    params[f"{param_key}_a"] = start_num
                    params[f"{param_key}_b"] = end_num
                clauses.append(f"({clause})")
                continue

            # Support range buckets for ageing_as_on_today (e.g., "range:0-30", "range:90+", "range:90-+")
            if col_canon == "ageing_as_on_today":
                range_match = re.match(r"^range:(\d+)(?:-?(\d+|\+))?$", trimmed_value)
                if range_match:
                    start_str, end_str = range_match.groups()
                    start_num = float(start_str)
                    if end_str is None:
                        clause = f'CAST(COALESCE("{column}", 0) AS NUMERIC) >= :{param_key}'
                        params[param_key] = start_num
                    elif end_str == "+":
                        clause = f'CAST(COALESCE("{column}", 0) AS NUMERIC) >= :{param_key}'
                        params[param_key] = start_num
                    else:
                        end_num = float(end_str)
                        clause = (
                            f'CAST(COALESCE("{column}", 0) AS NUMERIC) >= :{param_key}_a '
                            f'AND CAST(COALESCE("{column}", 0) AS NUMERIC) <= :{param_key}_b'
                        )
                        params[f"{param_key}_a"] = start_num
                        params[f"{param_key}_b"] = end_num
                    # Use a single clause for the range
                    clauses.append(f"({clause})")
                    continue

            # Support date ranges (e.g., "date:2024-01-01..2024-01-31", "date:2024-01-01..")
            date_range_match = re.match(r"^date:(\d{4}-\d{2}-\d{2})?\.\.(\d{4}-\d{2}-\d{2})?$", trimmed_value)
            if date_range_match:
                start_date, end_date = date_range_match.groups()
                date_parts: list[str] = []
                col_text = f'CAST("{column}" AS TEXT)'
                col_expr = (
                    "DATE(CASE "
                    "WHEN {col} GLOB '[0-9][0-9]/[0-9][0-9]/[0-9][0-9][0-9][0-9]' "
                    "THEN substr({col},7,4)||'-'||substr({col},1,2)||'-'||substr({col},4,2) "
                    "WHEN {col} GLOB '[0-9]/[0-9]/[0-9][0-9][0-9][0-9]' "
                    "THEN substr({col},5,4)||'-0'||substr({col},1,1)||'-0'||substr({col},3,1) "
                    "WHEN {col} GLOB '[0-9]/[0-9][0-9]/[0-9][0-9][0-9][0-9]' "
                    "THEN substr({col},6,4)||'-0'||substr({col},1,1)||'-'||substr({col},3,2) "
                    "WHEN {col} GLOB '[0-9][0-9]/[0-9]/[0-9][0-9][0-9][0-9]' "
                    "THEN substr({col},6,4)||'-'||substr({col},1,2)||'-0'||substr({col},4,1) "
                    "ELSE {col} END)".format(col=col_text)
                )
                if start_date:
                    date_parts.append(f"{col_expr} >= DATE(:{param_key}_start)")
                    params[f"{param_key}_start"] = start_date
                if end_date:
                    date_parts.append(f"{col_expr} <= DATE(:{param_key}_end)")
                    params[f"{param_key}_end"] = end_date
                if date_parts:
                    clauses.append(f"({' AND '.join(date_parts)})")
                continue

            # Support numeric comparisons for ageing_as_on_today (e.g., ">30", "<= 10", "=5")
            comp_match = re.match(r"^(<=|>=|<|>|=)\s*(-?\d+(?:\.\d+)?)$", trimmed_value)
            if col_canon == "ageing_as_on_today" and comp_match:
                op, num_str = comp_match.groups()
                param_key = f"f_{f_idx}_{v_idx}"
                or_parts.append(
                    f'CAST(COALESCE("{column}", 0) AS NUMERIC) {op} :{param_key}'
                )
                params[param_key] = float(num_str)
                continue

            # Match exact trimmed value to avoid wildcard surprises on symbolic buckets
            or_parts.append(
                f'LOWER(TRIM(CAST("{column}" AS TEXT))) = LOWER(:{param_key})'
            )
            params[param_key] = trimmed_value
        if or_parts:
            clauses.append(f"({' OR '.join(or_parts)})")

    if not clauses:
        return sql, {}

    where_part = " AND ".join(clauses)

    # Place WHERE before GROUP BY / ORDER BY / LIMIT
    group_match = re.search(r"\bgroup\s+by\b", sql, flags=re.IGNORECASE)
    order_match = re.search(r"\border\s+by\b", sql, flags=re.IGNORECASE)
    limit_match = re.search(r"\blimit\b", sql, flags=re.IGNORECASE)

    cut_points = [m.start() for m in [group_match, order_match, limit_match] if m]
    cut_at = min(cut_points) if cut_points else len(sql)

    head = sql[:cut_at].strip()
    tail = sql[cut_at:].strip()

    if re.search(r"\bwhere\b", head, flags=re.IGNORECASE):
        filtered_sql = f"{head} AND {where_part}"
    else:
        filtered_sql = f"{head} WHERE {where_part}"

    if tail:
        filtered_sql = f"{filtered_sql} {tail}".strip()

    return filtered_sql, params


@router.post("/drill")
async def drill_endpoint(
    payload: DrillRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> Dict[str, Any]:
    dataset = get_dataset(payload.dataset_id, db)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    columns: List[str] = list(dataset.columns_json or [])
    if not columns:
        raise HTTPException(status_code=400, detail="Dataset has no columns to query")

    normalized_filters = _normalize_filters(payload.filters, columns)

    def _dataset_filter_groups() -> list[dict[str, Any]]:
        def _should_skip(column: str | None) -> bool:
            return str(column or "").strip().lower() in FILTER_SKIP

        def _bucket_for(column: str) -> str | None:
            if _canon_column(column) in DATE_BUCKET_CANONICAL:
                return "month"
            return None

        groups: list[dict[str, Any]] = []
        for col in columns:
            if _should_skip(col):
                continue
            try:
                bucket = _bucket_for(col)
                values = fetch_distinct_values(
                    dataset.table_name,
                    col,
                    engine=engine,
                    bucket=bucket,
                )
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(status_code=500, detail=f"Failed to fetch filter values for {col}: {exc}") from exc
            group = {"column": col, "values": values}
            if bucket:
                group["bucket"] = bucket
            groups.append(group)
        return groups

    base_sql = f'SELECT * FROM {dataset.table_name}'
    try:
        filtered_sql, params = _inject_filters(base_sql, normalized_filters)
        # Apply explicit LIMIT only if caller hasn't added one
        limit = payload.limit or 500
        if not re.search(r"\blimit\b", filtered_sql, flags=re.IGNORECASE):
            filtered_sql = f"{filtered_sql} LIMIT {limit}"

        validated_sql = validate_sql(
            filtered_sql,
            allowed_table=dataset.table_name,
            allowed_columns=columns,
        )
        rows = execute_safe_sql(
            engine,
            validated_sql,
            params=params,
            allowed_table=dataset.table_name,
            allowed_columns=columns,
        )
    except SQLValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to execute SQL: {exc}") from exc

    result_columns = list(rows[0].keys()) if rows else list(columns)
    # Apply per-user column preferences for drill results
    pref = (
        db.query(DatasetColumnPreference)
        .filter(
            DatasetColumnPreference.dataset_id == dataset.id,
            DatasetColumnPreference.user_id == current_user.id,
        )
        .first()
    )
    if pref and pref.columns_json:
        selected_columns = [c for c in pref.columns_json if c in result_columns]
    else:
        selected_columns = list(result_columns)
    if not selected_columns:
        selected_columns = list(result_columns)

    filtered_rows = [
        {col: row[col] for col in selected_columns if col in row}
        for row in rows
    ]

    result_columns = selected_columns
    result_filter_groups = _result_filter_groups(filtered_rows, result_columns)
    filtered_result_groups = _filter_allowed_groups(result_filter_groups, columns)

    if filtered_result_groups:
        filter_groups_out = filtered_result_groups
    else:
        fallback_groups = _dataset_filter_groups()
        filter_groups_out = _filter_allowed_groups(fallback_groups, columns)

    # Preserve caller-applied filters (e.g., status for open demands) in filter groups so the UI keeps them during drills
    if payload.filters:
        merged = list(filter_groups_out)
        seen = {str(g.get("column", "")).lower() for g in merged}
        for f in payload.filters:
            col = str(f.column or "").strip()
            if not col or col.lower() in seen:
                continue
            merged.append({"column": col, "values": f.values or []})
            seen.add(col.lower())
        filter_groups_out = merged
    return {
        "status": "ready",
        "sql": validated_sql,
        "filter_groups": filter_groups_out,
        "result": {
            "rows": filtered_rows,
            "row_count": len(rows),
            "columns": result_columns,
        },
    }


@router.post("/chat")
async def chat_endpoint(payload: ChatRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    dataset = get_dataset(payload.dataset_id, db)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    llm_provider = intent_provider()

    columns: List[str] = list(dataset.columns_json or [])
    if not columns:
        raise HTTPException(status_code=400, detail="Dataset has no columns to query")

    normalized_filters = _normalize_filters(payload.applied_filters, columns)

    def _bucket_for(column: str) -> str | None:
        if _canon_column(column) in DATE_BUCKET_CANONICAL:
            return "month"
        return None

    # If there's no question but filters are provided, run a simple filtered query
    if not (payload.question or "").strip() and normalized_filters:
        def _dataset_filter_groups() -> list[dict[str, Any]]:
            def _should_skip(column: str | None) -> bool:
                return str(column or "").strip().lower() in FILTER_SKIP

            groups: list[dict[str, Any]] = []
            for col in columns:
                if _should_skip(col):
                    continue
                try:
                    bucket = _bucket_for(col)
                    values = fetch_distinct_values(
                        dataset.table_name,
                        col,
                        engine=engine,
                        bucket=bucket,
                    )
                except Exception as exc:  # noqa: BLE001
                    raise HTTPException(status_code=500, detail=f"Failed to fetch filter values for {col}: {exc}") from exc
                group = {"column": col, "values": values}
                if bucket:
                    group["bucket"] = bucket
                groups.append(group)
            return groups

        base_sql = f'SELECT * FROM {dataset.table_name}'
        try:
            filtered_sql, params = _inject_filters(base_sql, normalized_filters)
            if not re.search(r"\blimit\b", filtered_sql, flags=re.IGNORECASE):
                filtered_sql = f"{filtered_sql} LIMIT 500"

            validated_sql = validate_sql(
                filtered_sql,
                allowed_table=dataset.table_name,
                allowed_columns=columns,
            )
            rows = execute_safe_sql(
                engine,
                validated_sql,
                params=params,
                allowed_table=dataset.table_name,
                allowed_columns=columns,
            )
        except SQLValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"Failed to execute SQL: {exc}") from exc

        result_columns = list(rows[0].keys()) if rows else list(columns)
        result_filter_groups = _result_filter_groups(rows, result_columns)
        filtered_result_groups = _filter_allowed_groups(result_filter_groups, columns)

        if filtered_result_groups:
            filter_groups_out = filtered_result_groups
        else:
            filter_groups_out = _filter_allowed_groups(_dataset_filter_groups(), columns)

        return {
            "status": "ready",
            "sql": validated_sql,
            "filter_groups": filter_groups_out,
            "result": {
                "rows": rows,
                "row_count": len(rows),
                "columns": result_columns,
            },
        }

    if not (payload.question or "").strip():
        def _initial_filter_groups() -> list[dict[str, Any]]:
            groups: list[dict[str, Any]] = []
            for col in columns:
                if str(col or "").strip().lower() in FILTER_SKIP:
                    continue
                try:
                    bucket = _bucket_for(col)
                    values = fetch_distinct_values(
                        dataset.table_name,
                        col,
                        engine=engine,
                        bucket=bucket,
                    )
                except Exception as exc:  # noqa: BLE001
                    raise HTTPException(status_code=500, detail=f"Failed to fetch filter values for {col}: {exc}") from exc
                group = {"column": col, "values": values}
                if bucket:
                    group["bucket"] = bucket
                groups.append(group)
            return groups

        return {
            "status": "needs_filter",
            "llm_provider": intent_provider(),
            "filter_groups": _initial_filter_groups(),
        }

    def _auto_filter_status() -> None:
        question_lower = (payload.question or "").lower()
        status_value: str | None = None
        if "open position" in question_lower or "open demand" in question_lower or "open demands" in question_lower or "inprogress" in question_lower or "in-progress" in question_lower:
            status_value = "In-Progress"
        elif "halted" in question_lower:
            status_value = "Halted"
        if not status_value:
            return
        status_col = next((c for c in columns if c.lower() == "status"), None)
        if not status_col:
            return
        already = any(f["column"].lower() == status_col.lower() for f in normalized_filters)
        if already:
            return
        normalized_filters.append({"column": status_col, "values": [status_value]})

    _auto_filter_status()

    def _status_override_sql() -> tuple[str, str, str | None] | None:
        question_lower = (payload.question or "").lower()
        status_value: str | None = None
        if "open position" in question_lower or "open demand" in question_lower or "open demands" in question_lower or "inprogress" in question_lower or "in-progress" in question_lower:
            status_value = "in-progress"
        elif "halted" in question_lower:
            status_value = "halted"
        if not status_value:
            return None
        status_col = next((c for c in columns if c.lower() == "status"), None)
        if not status_col:
            return None
        sql = (
            f"SELECT COUNT(*) AS matched_positions FROM {dataset.table_name} "
            f"WHERE LOWER(COALESCE(\"{status_col}\", \"\")) LIKE '%{status_value}%'"
        )
        return sql, "status", None

    def _ageing_override_sql() -> tuple[str, str, str | None] | None:
        question_text = payload.question or ""
        qlower = question_text.lower()
        if "ageing" not in qlower and "aging" not in qlower:
            return None
        match = re.search(r">\s*(\d+)", qlower)
        if not match:
            match = re.search(r"(?:more than|greater than|over)\s*(\d+)", qlower)
        if not match:
            return None
        threshold = match.group(1)
        ageing_col = next((c for c in columns if c.lower() == "ageing_as_on_today"), None)
        position_col = next((c for c in columns if c.lower() == "position"), None)
        location_requested = "location" in qlower or "location-wise" in qlower or "location wise" in qlower
        location_col = next(
            (
                c
                for c in columns
                if c
                and c.strip().lower()
                in {
                    "location",
                    "locations",
                    "job_location",
                    "joblocation",
                    "work_location",
                    "country",
                }
            ),
            None,
        )
        # Detect explicit grouping column via "by <col>" syntax
        group_col: str | None = None
        by_match = re.search(r"by\s+([a-z0-9_ \-/,&]+)", qlower)
        if by_match:
            raw = by_match.group(1)
            tokens = [t.strip() for t in re.split(r"[\/,&]|\band\b", raw) if t.strip()]
            for tok in tokens:
                tok_clean = tok.replace("-", " ").strip().lower()
                group_col = next(
                    (
                        c
                        for c in columns
                        if c
                        and tok_clean in c.strip().lower()
                        and c.lower() not in {"ageing_as_on_today", "status"}
                    ),
                    None,
                )
                if group_col:
                    break
        if not group_col and location_requested and location_col:
            group_col = location_col
        if not group_col:
            group_col = position_col or location_col

        if not ageing_col or not group_col:
            return None
        is_open_demand = "open demand" in qlower or "open demands" in qlower or "open position" in qlower or "inprogress" in qlower or "in-progress" in qlower
        status_col = next((c for c in columns if c.lower() == "status"), None)
        where_parts = [f"CAST(COALESCE(\"{ageing_col}\", 0) AS NUMERIC) > {threshold}"]
        if is_open_demand and status_col:
            where_parts.append(f"LOWER(COALESCE(\"{status_col}\", '' )) LIKE '%in-progress%'")
        where_sql = " AND ".join(where_parts)
        sql = (
            f"SELECT \"{group_col}\", COUNT(*) AS count FROM {dataset.table_name} "
            f"WHERE {where_sql} "
            f"GROUP BY \"{group_col}\" ORDER BY count DESC"
        )
        return sql, "ageing", None

    ageing_bucket_vp_col: str | None = None

    def _ageing_bucket_override_sql() -> tuple[str, str, str | None] | None:
        nonlocal ageing_bucket_vp_col
        question_lower = (payload.question or "").lower()
        if "ageing" not in question_lower and "aging" not in question_lower:
            return None
        if "bucket" not in question_lower and not re.search(r"0\s*-\s*30|31\s*-\s*60|61\s*-\s*90|90\+", question_lower):
            return None

        ageing_col = next((c for c in columns if c.lower() == "ageing_as_on_today"), None)
        status_col = next((c for c in columns if c.lower() == "status"), None)
        if not ageing_col:
            return None

        is_open_demand = "open demand" in question_lower or "open demands" in question_lower or "open position" in question_lower or "in-progress" in question_lower or "inprogress" in question_lower

        # Capture VP column when request is VP-wise
        if "vp" in question_lower:
            ageing_bucket_vp_col = next(
                (
                    c
                    for c in columns
                    if c
                    and c.strip().lower()
                    in {"vp", "vp_name", "vpname", "vp_", "vice_president", "vp head", "vphead"}
                ),
                None,
            )
            if not ageing_bucket_vp_col:
                ageing_bucket_vp_col = next((c for c in columns if "vp" in (c or "").lower()), None)

        where_clauses = []
        if is_open_demand and status_col:
            where_clauses.append(f"LOWER(COALESCE(\"{status_col}\", '')) LIKE '%in-progress%'")

        where_sql = ""
        if where_clauses:
            where_sql = " WHERE " + " AND ".join(where_clauses)

        select_cols = f'"{ageing_col}"'
        if ageing_bucket_vp_col:
            select_cols += f', "{ageing_bucket_vp_col}"'
        if status_col:
            select_cols += f', "{status_col}"'
        sql = f"SELECT {select_cols} FROM {dataset.table_name}{where_sql}"
        return sql, "ageing_bucket", status_col if is_open_demand and status_col else None

    def _business_override_sql() -> tuple[str, str, str | None] | None:
        question_lower = (payload.question or "").lower()
        if "business" not in question_lower:
            return None
        business_col = next((c for c in columns if c.lower() == "business"), None)
        if not business_col:
            return None
        filters: list[str] = []
        match_values = re.findall(r"business\s*(?:=|is)\s*[\"']?([a-z0-9 _-]+)[\"']?", question_lower)
        if match_values:
            for val in match_values:
                trimmed = val.strip().lower()
                if trimmed:
                    filters.append(trimmed)
        base_where = [f"TRIM(COALESCE(\"{business_col}\", '')) <> ''"]
        if filters:
            # Apply explicit business filters from the question text
            in_list = ", ".join([f"'{val}'" for val in filters])
            base_where.append(f"LOWER(COALESCE(\"{business_col}\", '')) IN ({in_list})")
        where_sql = " AND ".join(base_where)
        sql = (
            f"SELECT \"{business_col}\", COUNT(*) AS count FROM {dataset.table_name} "
            f"WHERE {where_sql} "
            f"GROUP BY \"{business_col}\" ORDER BY count DESC"
        )
        return sql, "business", business_col

    open_demand_filter: tuple[str, str] | None = None

    def _vp_override_sql() -> tuple[str, str, str | None] | None:
        question_lower = (payload.question or "").lower()
        if "vp-wise" not in question_lower and "vp wise" not in question_lower and "vp breakdown" not in question_lower and "vp" not in question_lower:
            return None

        is_open_demand = "open demand" in question_lower or "open demands" in question_lower or "open position" in question_lower or "inprogress" in question_lower or "in-progress" in question_lower

        vp_col = next(
            (
                c
                for c in columns
                if c
                and c.strip().lower()
                in {"vp", "vp_name", "vpname", "vp_", "vice_president", "vp head", "vphead"}
            ),
            None,
        )
        if not vp_col:
            # Fallback: pick first column that contains 'vp'
            vp_col = next((c for c in columns if "vp" in (c or "").lower()), None)
        if not vp_col:
            return None

        def _match_col_for(keyword: str, synonyms: set[str]) -> str | None:
            lower_cols = [(c, (c or "").strip().lower()) for c in columns]
            for col, low in lower_cols:
                if not col:
                    continue
                if any(syn in low for syn in synonyms):
                    return col
            return None

        extras: list[str] = []
        by_match = re.search(r"by\s+([a-z0-9_\-/,& ]+)", question_lower)
        if by_match:
            raw = by_match.group(1)
            tokens = [t.strip() for t in re.split(r"[\/,&]|\band\b", raw) if t.strip()]
            for tok in tokens:
                if len(extras) >= 2:
                    break
                norm_tok = tok.replace("-", " ").strip().lower()
                if "portfolio" in norm_tok:
                    col = _match_col_for("portfolio", {"portfolio"})
                    if col and col not in extras and col != vp_col:
                        extras.append(col)
                        continue
                if "skill" in norm_tok:
                    col = _match_col_for("skill", {"skill", "skill_set"})
                    if col and col not in extras and col != vp_col:
                        extras.append(col)
                        continue
                # Generic fallback: match token text against columns
                col = next(
                    (c for c in columns if c and norm_tok in c.strip().lower() and c != vp_col and c not in extras),
                    None,
                )
                if col:
                    extras.append(col)

        group_cols = [vp_col] + extras
        select_cols = ", ".join([f'"{c}"' for c in group_cols])
        group_by_cols = ", ".join([f'"{c}"' for c in group_cols])

        where_clauses = [f"TRIM(COALESCE(\"{vp_col}\", '')) <> ''"]
        status_col = next((c for c in columns if c and c.strip().lower() == "status"), None)
        if is_open_demand and status_col:
            where_clauses.append(f"LOWER(COALESCE(\"{status_col}\", '')) LIKE '%in-progress%'")
            open_demand_filter = (status_col, "In-Progress")

        where_sql = " AND ".join(where_clauses)

        sql = (
            f"SELECT {select_cols}, COUNT(*) AS count FROM {dataset.table_name} "
            f"WHERE {where_sql} "
            f"GROUP BY {group_by_cols} ORDER BY \"{vp_col}\" ASC, count DESC"
        )
        return sql, "vp", vp_col

    def _skill_override_sql() -> tuple[str, str, str | None] | None:
        question_lower = (payload.question or "").lower()
        if "aws" not in question_lower and "devops" not in question_lower:
            return None
        skill_col = next((c for c in columns if c.lower() == "skill_set"), None)
        if not skill_col:
            return None
        tokens: list[str] = []
        if "aws" in question_lower:
            tokens.append("aws")
        if "devops" in question_lower:
            tokens.append("devops")
        if not tokens:
            return None
        conditions = [f"LOWER(COALESCE(\"{skill_col}\", \"\")) LIKE '%{t}%'" for t in tokens]
        where_clause = " AND ".join(conditions)
        sql = (
            f"SELECT COUNT(*) AS matched_skillset FROM {dataset.table_name} "
            f"WHERE {where_clause}"
        )
        return sql, "skill", None

    def _location_override_sql() -> tuple[str, str, str | None] | None:
        question_lower = (payload.question or "").lower()
        tokens: list[str] = []
        if "india" in question_lower:
            tokens.append("india")
        if "usa" in question_lower or "u.s.a" in question_lower or "u.s." in question_lower:
            tokens.append("usa")
        if "united states" in question_lower:
            tokens.append("usa")
        if not tokens:
            return None

        location_col = next(
            (
                c
                for c in columns
                if c and c.strip().lower() in {"location", "locations", "job_location", "joblocation", "work_location", "country"}
            ),
            None,
        )
        if not location_col:
            return None

        normalized_tokens = sorted({t.strip().lower() for t in tokens if t.strip()})
        if not normalized_tokens:
            return None

        in_list = ", ".join([f"'{t}'" for t in normalized_tokens])
        sql = (
            f"SELECT \"{location_col}\", COUNT(*) AS count FROM {dataset.table_name} "
            f"WHERE LOWER(COALESCE(\"{location_col}\", '')) IN ({in_list}) "
            f"GROUP BY \"{location_col}\" ORDER BY count DESC"
        )
        return sql, "location", None

    def build_filter_groups() -> list[dict[str, Any]]:
        def _should_skip(column: str | None) -> bool:
            return str(column or "").strip().lower() in FILTER_SKIP

        def _bucket_for(column: str) -> str | None:
            if _canon_column(column) in DATE_BUCKET_CANONICAL:
                return "month"
            return None

        allowed_set = {c for c in columns if not _should_skip(c)}

        reason_map = {
            item.column: item.reason
            for item in intent.filter_columns or []
            if not _should_skip(item.column) and item.column in allowed_set
        }

        candidate_set = set()
        for item in intent.filter_columns or []:
            if _should_skip(item.column):
                continue
            if item.column not in allowed_set:
                continue
            candidate_set.add(item.column)
        # Include all allowed columns to expose every Excel column as a filter
        for col in allowed_set:
            if _should_skip(col):
                continue
            candidate_set.add(col)

        # Preserve the dataset's column order for default selection (first four) in the UI
        ordered_candidates: List[str] = [col for col in columns if col in candidate_set]

        filter_groups_local = []
        for col in ordered_candidates:
            try:
                bucket = _bucket_for(col)
                values = fetch_distinct_values(
                    dataset.table_name,
                    col,
                    engine=engine,
                    bucket=bucket,
                )
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(status_code=500, detail=f"Failed to fetch filter values for {col}: {exc}") from exc
            group = {"column": col, "values": values}
            reason = reason_map.get(col)
            if reason:
                group["reason"] = reason
            bucket = _bucket_for(col)
            if bucket:
                group["bucket"] = bucket
            filter_groups_local.append(group)

        return filter_groups_local
    try:
        sample_rows = await run_in_threadpool(_get_sample_rows, dataset.table_name, 5)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to fetch sample rows: {exc}") from exc

    try:
        intent: IntentResult = await run_in_threadpool(
            generate_intent,
            payload.question,
            dataset.table_name,
            columns,
            sample_rows,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to generate intent: {exc}") from exc

    override = (
        _location_override_sql()
        or _skill_override_sql()
        or _ageing_bucket_override_sql()
        or _ageing_override_sql()
        or _business_override_sql()
        or _vp_override_sql()
        or _status_override_sql()
    )

    _cached_filter_groups: list[dict[str, Any]] | None = None

    def _dataset_filter_groups() -> list[dict[str, Any]]:
        # Lazily fetch full-dataset filter values only when result-derived filters are empty
        nonlocal _cached_filter_groups
        if _cached_filter_groups is None:
            _cached_filter_groups = build_filter_groups()
        return _cached_filter_groups

    if override:
        override_sql, override_kind, override_col = override
        try:
            filtered_sql, filter_params = _inject_filters(override_sql, normalized_filters)
            validated_sql = validate_sql(
                filtered_sql,
                allowed_table=dataset.table_name,
                allowed_columns=columns,
            )
            rows = execute_safe_sql(
                engine,
                validated_sql,
                params=filter_params,
                allowed_table=dataset.table_name,
                allowed_columns=columns,
            )
        except SQLValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"Failed to execute SQL: {exc}") from exc

        # Post-process buckets for business override
        if override_kind == "business" and override_col:
            buckets: dict[str, int] = {}
            for row in rows:
                raw = str(row.get(override_col, "")).strip()
                low = raw.lower()
                label = "Other"
                if "replacement" in low:
                    label = "Replacement"
                elif "existing" in low:
                    label = "Existing"
                elif "new" in low:
                    label = "New"
                elif raw:
                    label = raw
                cnt_val = row.get("count", 0)
                try:
                    cnt_num = int(cnt_val)
                except Exception:
                    cnt_num = 0
                buckets[label] = buckets.get(label, 0) + cnt_num
            rows = [{"business": k, "count": v} for k, v in buckets.items()]
            result_columns = ["business", "count"]
        elif override_kind == "ageing_bucket":
            bucket_order = ["0-30", "31-60", "61-90", "90+"]
            ageing_col = next((c for c in columns if c.lower() == "ageing_as_on_today"), None)
            if ageing_bucket_vp_col:
                buckets_by_vp: dict[str, dict[str, int]] = {}
                totals_by_vp: dict[str, int] = {}
                for row in rows:
                    try:
                        age_val = float(row.get(ageing_col, 0)) if ageing_col else 0
                    except Exception:
                        age_val = 0
                    label = "90+"
                    if 0 <= age_val <= 30:
                        label = "0-30"
                    elif 31 <= age_val <= 60:
                        label = "31-60"
                    elif 61 <= age_val <= 90:
                        label = "61-90"

                    vp_val_raw = row.get(ageing_bucket_vp_col)
                    vp_val = str(vp_val_raw).strip() if vp_val_raw is not None else "Unknown"
                    buckets_by_vp.setdefault(vp_val, {lbl: 0 for lbl in bucket_order})
                    buckets_by_vp[vp_val][label] = buckets_by_vp[vp_val].get(label, 0) + 1
                    totals_by_vp[vp_val] = totals_by_vp.get(vp_val, 0) + 1

                rows = []
                for vp_val, bucket_counts in buckets_by_vp.items():
                    for label in bucket_order:
                        total_open = bucket_counts.get(label, 0)
                        if total_open <= 0:
                            continue
                        rows.append(
                            {
                                ageing_bucket_vp_col: vp_val,
                                "ageing_bucket": label,
                                "total_open": total_open,
                            }
                        )
                result_columns = [ageing_bucket_vp_col, "ageing_bucket", "total_open"]
            else:
                buckets: dict[str, int] = {label: 0 for label in bucket_order}
                for row in rows:
                    try:
                        age_val = float(row.get(ageing_col, 0)) if ageing_col else 0
                    except Exception:
                        age_val = 0
                    label = "90+"
                    if 0 <= age_val <= 30:
                        label = "0-30"
                    elif 31 <= age_val <= 60:
                        label = "31-60"
                    elif 61 <= age_val <= 90:
                        label = "61-90"
                    buckets[label] = buckets.get(label, 0) + 1
                rows = [{"ageing_bucket": label, "count": buckets[label]} for label in bucket_order if buckets.get(label, 0) > 0]
                result_columns = ["ageing_bucket", "count"]
        else:
            result_columns = list(rows[0].keys()) if rows else ["matched_positions"]

        result_filter_groups = _result_filter_groups(rows, result_columns)
        # Preserve implied status filter for open-demand VP requests and ageing buckets so drill sees it
        if open_demand_filter:
            col_name, val = open_demand_filter
            result_filter_groups.append({"column": col_name, "values": [val]})
        if override_kind == "ageing_bucket":
            # Expose the underlying ageing column with bucket labels for drill
            ageing_col = next((c for c in columns if c.lower() == "ageing_as_on_today"), None)
            if ageing_col:
                bucket_labels = [row.get("ageing_bucket") for row in rows if row.get("ageing_bucket")]
                dedup = []
                seen = set()
                for lbl in bucket_labels:
                    if lbl in seen:
                        continue
                    seen.add(lbl)
                    dedup.append(f"range:{lbl}")
                if dedup:
                    result_filter_groups.append({"column": ageing_col, "values": dedup})
            if ageing_bucket_vp_col:
                vp_values = [row.get(ageing_bucket_vp_col) for row in rows if row.get(ageing_bucket_vp_col)]
                vp_dedup = []
                seen_vp = set()
                for vp_val in vp_values:
                    if vp_val in seen_vp:
                        continue
                    seen_vp.add(vp_val)
                    vp_dedup.append(str(vp_val))
                if vp_dedup:
                    result_filter_groups.append({"column": ageing_bucket_vp_col, "values": vp_dedup})
            if override_col:
                result_filter_groups.append({"column": override_col, "values": ["In-Progress"]})
        filtered_result_groups = _filter_allowed_groups(result_filter_groups, columns)

        if filtered_result_groups:
            filter_groups_out = filtered_result_groups
        else:
            fallback_groups = _dataset_filter_groups()
            filter_groups_out = _filter_allowed_groups(fallback_groups, columns)

        return {
            "status": "ready",
            "llm_provider": llm_provider,
            "sql": validated_sql,
            "filter_groups": filter_groups_out,
            "result": {
                "rows": rows,
                "row_count": len(rows),
                "columns": result_columns,
            },
        }

    if intent.status == "needs_filter" and not normalized_filters:
        return {"status": "needs_filter", "llm_provider": llm_provider, "filter_groups": _dataset_filter_groups()}

    if intent.sql is None:
        if intent.status == "needs_filter":
            return {"status": "needs_filter", "llm_provider": llm_provider, "filter_groups": _dataset_filter_groups()}
        raise HTTPException(status_code=500, detail="Intent did not return SQL")

    try:
        filtered_sql, filter_params = _inject_filters(intent.sql, normalized_filters)
        validated_sql = validate_sql(filtered_sql, allowed_table=dataset.table_name, allowed_columns=columns)
    except SQLValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        rows = execute_safe_sql(
            engine,
            validated_sql,
            params=filter_params,
            allowed_table=dataset.table_name,
            allowed_columns=columns,
        )
    except SQLValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to execute SQL: {exc}") from exc

    result_columns = list(rows[0].keys()) if rows else list(columns)
    result_filter_groups = _result_filter_groups(rows, result_columns)
    filtered_result_groups = _filter_allowed_groups(result_filter_groups, columns)

    if filtered_result_groups:
        filter_groups_out = filtered_result_groups
    else:
        fallback_groups = _dataset_filter_groups()
        filter_groups_out = _filter_allowed_groups(fallback_groups, columns)

    return {
        "status": "ready",
        "llm_provider": llm_provider,
        "sql": validated_sql,
        "filter_groups": filter_groups_out,
        "result": {
            "rows": rows,
            "row_count": len(rows),
            "columns": result_columns,
        },
    }
