"""LLM question-writing stage for Adaptive Infinity Quiz."""

import inspect
import json
import logging
from typing import Any

from fastapi import HTTPException

from server.adaptive.prompts import build_adaptive_generation_messages
from server.adaptive.schemas import AdaptiveBatchPlan
from server.llm.base import ChunkType

logger = logging.getLogger(__name__)


def strip_json_fences(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = [line for line in lines if not line.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()
    return cleaned


async def _provider_available(provider: object) -> bool:
    is_available = getattr(provider, "is_available", None)
    if not is_available:
        return True
    result = is_available()
    if inspect.isawaitable(result):
        return bool(await result)
    return bool(result)


async def call_adaptive_question_writer(
    provider: object,
    plan: AdaptiveBatchPlan,
    retry_error: str | None = None,
) -> list[dict[str, Any]]:
    if not await _provider_available(provider):
        raise HTTPException(
            status_code=503,
            detail=f"{plan.tier.value} provider is unavailable",
        )

    messages = build_adaptive_generation_messages(plan, retry_error=retry_error)
    max_tokens = 2200 if plan.tier.value == "lite" else 6000
    result_parts: list[str] = []

    try:
        async for chunk in provider.complete(
            messages,
            tools=None,
            temperature=0.72,
            max_tokens=max_tokens,
        ):
            if chunk.type == ChunkType.CONTENT:
                result_parts.append(chunk.content)
    except HTTPException:
        raise
    except Exception as error:
        logger.warning("Adaptive question writer failed: %s", error)
        raise HTTPException(
            status_code=503,
            detail=f"{plan.tier.value} provider is unavailable",
        ) from error

    raw = strip_json_fences("".join(result_parts))
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        logger.warning(
            "Adaptive question writer returned invalid JSON: %s; raw=%s",
            error,
            raw[:500],
        )
        raise ValueError("LLM returned invalid adaptive question JSON") from error

    questions = data if isinstance(data, list) else data.get("questions", [])
    if not isinstance(questions, list):
        raise ValueError("LLM adaptive response must contain a questions list")
    return questions
