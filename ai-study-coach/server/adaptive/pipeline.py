"""Three-stage adaptive generation pipeline."""

import logging

from fastapi import HTTPException

from server.adaptive.question_writer import call_adaptive_question_writer
from server.adaptive.schemas import (
    AdaptivePipelineResult,
    AdaptiveQuestionsRequest,
    adaptive_batch_size_for_tier,
)
from server.adaptive.validation import validate_adaptive_questions_for_plan
from server.adaptive.weak_area import build_adaptive_batch_plan
from server.router import Tier

logger = logging.getLogger(__name__)


def validate_request_shape(req: AdaptiveQuestionsRequest, tier: Tier) -> str:
    category = (req.category or "").strip().lower()
    if not category:
        raise HTTPException(status_code=400, detail="category is required")

    expected_count = adaptive_batch_size_for_tier(tier)
    if req.count != expected_count:
        raise HTTPException(
            status_code=400,
            detail=f"{tier.value} count must be {expected_count}",
        )
    return category


async def generate_adaptive_pipeline(
    req: AdaptiveQuestionsRequest,
    tier: Tier,
    provider: object,
) -> AdaptivePipelineResult:
    validate_request_shape(req, tier)
    plan = build_adaptive_batch_plan(req, tier)
    last_error: Exception | None = None

    for attempt in range(2):
        try:
            raw_questions = await call_adaptive_question_writer(
                provider,
                plan,
                retry_error=str(last_error) if attempt > 0 and last_error else None,
            )
            questions = validate_adaptive_questions_for_plan(raw_questions, plan)
            logger.info(
                "Adaptive pipeline generated %s %s questions; diagnosis=%s",
                len(questions),
                tier.value,
                plan.coverage.diagnosis_summary,
            )
            return AdaptivePipelineResult(questions=questions, plan=plan)
        except HTTPException:
            raise
        except Exception as error:
            last_error = error
            logger.warning(
                "Adaptive pipeline validation failed on attempt %s: %s",
                attempt + 1,
                error,
            )

    raise HTTPException(
        status_code=502,
        detail=str(last_error) if last_error else "Invalid adaptive question batch",
    )
