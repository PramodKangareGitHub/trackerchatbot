from __future__ import annotations
import urllib3 

# Disable SSL warnings (for self-signed certs/testing only) 

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning) 

import json
import os
from typing import Any, Iterable, List, Literal, Optional

import requests

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field


class FilterColumn(BaseModel):
    column: str = Field(..., description="Column that requires an explicit filter or clarification")
    reason: str = Field(..., description="Why the column needs a filter")


class IntentResult(BaseModel):
    status: Literal["ready", "needs_filter"]
    sql: Optional[str] = Field(None, description="SQLite-compatible SQL when status is 'ready'")
    filter_columns: Optional[List[FilterColumn]] = Field(
        None, description="Columns needing user-provided filters when status is 'needs_filter'"
    )


def _build_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are a careful SQL intent generator for an Excel-to-SQL assistant.
You must respond with JSON only, following one of two shapes:
A) {{ "status": "ready", "sql": "..." }}
B) {{ "status": "needs_filter", "filter_columns": [{{"column": "c", "reason": "..."}}] }}
Rules:
- Target database is SQLite. Use only supported syntax.
- Only one table is available: {table_name}.
- Allowed columns: {columns}.
- Do NOT invent WHERE filters. If the question is ambiguous or needs filters, return needs_filter with the columns that require clarification.
- Do NOT add LIMIT.
- If the question requests a subset (like a date range or category) but does not provide values, mark those columns in needs_filter.
- Prefer simple SELECT statements.
- Never include additional text outside the JSON.""",
            ),
            (
                "user",
                "Question: {question}\n"
                "Table: {table_name}\n"
                "Columns: {columns}\n"
                "Sample rows (may be truncated): {sample_rows}"
            ),
        ]
    )


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _use_ai_cafe() -> bool:
    return _is_truthy(os.getenv("USE_AI_CAFE"))


def intent_provider() -> str:
    """Return the active intent provider identifier."""
    return "ai_cafe" if _use_ai_cafe() else "openai"


def _ai_cafe_invoke(messages: list[dict[str, str]]) -> str:
    endpoint = os.getenv("AI_CAFE_ENDPOINT")
    api_key = os.getenv("AI_CAFE_API_KEY")
    if not endpoint:
        raise ValueError("AI_CAFE_ENDPOINT is required when USE_AI_CAFE is true")
    if not api_key:
        raise ValueError("AI_CAFE_API_KEY is required when USE_AI_CAFE is true")

    model = os.getenv("AI_CAFE_MODEL", "gpt-4.1")
    temperature = float(os.getenv("INTENT_MODEL_TEMPERATURE", "0"))
    max_tokens = int(os.getenv("AI_CAFE_MAX_TOKENS", "400"))

    headers = {"Content-Type": "application/json", "api-key": api_key}
    payload = {
        "model": model,
        "messages": messages,
        "maxTokens": max_tokens,
        "temperature": temperature,
    }

    response = requests.post(endpoint, headers=headers, json=payload, timeout=30, verify=False)
    response.raise_for_status()
    data = response.json()

    content: Optional[str] = None
    if isinstance(data, dict):
        choices = data.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0] or {}
            message = first.get("message") if isinstance(first, dict) else None
            if isinstance(message, dict):
                content = message.get("content")
        if content is None:
            output_text = data.get("output_text")
            if isinstance(output_text, str):
                content = output_text

    if not content:
        raise ValueError("AI Cafe response did not include message content")

    return content


def _default_llm() -> ChatOpenAI:
    model = os.getenv("INTENT_MODEL", "gpt-4o-mini")
    temperature = float(os.getenv("INTENT_MODEL_TEMPERATURE", "0"))
    return ChatOpenAI(model=model, temperature=temperature)


parser = JsonOutputParser(pydantic_object=IntentResult)
prompt = _build_prompt()


def generate_intent(
    question: str,
    table_name: str,
    columns: Iterable[str],
    sample_rows: Iterable[dict[str, Any]] | None,
    *,
    llm: ChatOpenAI | None = None,
) -> IntentResult:
    if not question:
        raise ValueError("question is required")
    if not table_name:
        raise ValueError("table_name is required")

    columns_list = list(columns)
    sample_rows_list = list(sample_rows or [])

    variables = {
        "question": question,
        "table_name": table_name,
        "columns": ", ".join(columns_list),
        "sample_rows": json.dumps(sample_rows_list[:5]),
    }

    if _use_ai_cafe():
        formatted = prompt.format_prompt(**variables)
        messages = []
        for msg in formatted.to_messages():
            role = "system" if msg.type == "system" else "user"
            messages.append({"role": role, "content": msg.content})

        content = _ai_cafe_invoke(messages)
        rendered = json.loads(content)
    else:
        llm = llm or _default_llm()
        chain = prompt | llm | parser
        rendered = chain.invoke(variables)

    if isinstance(rendered, IntentResult):
        return rendered
    if isinstance(rendered, dict):
        return IntentResult.parse_obj(rendered)

    return IntentResult.parse_obj(rendered)  # fallback for any other JSON-like
