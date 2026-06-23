"""Three-stage adaptive generation pipeline."""

import logging

from fastapi import HTTPException

from server.adaptive.question_writer import call_adaptive_question_writer
from server.adaptive.schemas import (
    AdaptiveBatchPlan,
    AdaptiveQuestionTemplate,
    AdaptivePipelineResult,
    AdaptiveQuestionsRequest,
    WeakAreaCoveragePlan,
    adaptive_category_limit_for_tier,
    adaptive_batch_size_for_tier,
    adaptive_context_limit_for_tier,
)
from server.adaptive.validation import validate_adaptive_questions_for_plan
from server.adaptive.weak_area import build_adaptive_batch_plan
from server.router import Tier

logger = logging.getLogger(__name__)


REPAIR_RESPONSE_MARKERS = (
    "duplicate answer",
    "blank answer",
    "correctAnswer is not",
    "must have exactly 4 answers",
    "duplicated a recent",
    "duplicated a recent or same-batch",
    "missing question text",
)


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


def _clean_category(value: object) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _is_multi_category_request(req: AdaptiveQuestionsRequest) -> bool:
    return bool(req.categories or req.category_contexts)


def _multi_categories(req: AdaptiveQuestionsRequest) -> list[str]:
    categories: list[str] = []
    for value in [*req.categories, *(context.category for context in req.category_contexts)]:
        category = _clean_category(value)
        if category and category not in categories:
            categories.append(category)
    return categories


def validate_multi_request_shape(req: AdaptiveQuestionsRequest, tier: Tier) -> list[str]:
    categories = _multi_categories(req)
    if not categories:
        raise HTTPException(status_code=400, detail="category is required")

    category_limit = adaptive_category_limit_for_tier(tier)
    if len(categories) > category_limit:
        raise HTTPException(
            status_code=400,
            detail=f"{tier.value} supports at most {category_limit} categories",
        )

    expected_count = adaptive_batch_size_for_tier(tier)
    if req.count != expected_count:
        raise HTTPException(
            status_code=400,
            detail=f"{tier.value} count must be {expected_count}",
        )

    contexts_by_category = {
        _clean_category(context.category): context for context in req.category_contexts
    }
    requested_total = 0
    for category in categories:
        context = contexts_by_category.get(category)
        if context is None:
            raise HTTPException(
                status_code=400,
                detail=f"missing category context for {category}",
            )
        if context.requestedCount < 1:
            raise HTTPException(
                status_code=400,
                detail="requestedCount must be positive",
            )
        requested_total += context.requestedCount

    if requested_total != expected_count:
        raise HTTPException(
            status_code=400,
            detail=f"requestedCount values must sum to {expected_count}",
        )
    return categories


def _copy_template(
    template: AdaptiveQuestionTemplate,
    template_id: str,
    category: str,
) -> AdaptiveQuestionTemplate:
    return AdaptiveQuestionTemplate(
        template_id=template_id,
        category=category,
        subskill=template.subskill,
        difficulty=template.difficulty,
        planning_intent=template.planning_intent,
        generated_from_question=template.generated_from_question,
        adaptation_reason=template.adaptation_reason,
        mastery_before=template.mastery_before,
        mastery_after=template.mastery_after,
        evidence=template.evidence,
    )


def build_multi_category_batch_plan(
    req: AdaptiveQuestionsRequest,
    tier: Tier,
) -> AdaptiveBatchPlan:
    categories = validate_multi_request_shape(req, tier)
    contexts_by_category = {
        _clean_category(context.category): context for context in req.category_contexts
    }
    context_limit = adaptive_context_limit_for_tier(tier)
    templates: list[AdaptiveQuestionTemplate] = []
    history = []
    wrong_questions = []
    recent_questions: list[str] = []
    weak_areas = []
    intents: list[str] = []
    summaries: list[str] = []

    for category in categories:
        context = contexts_by_category[category]
        category_request = AdaptiveQuestionsRequest(
            category=category,
            count=context.requestedCount,
            history=context.history[-context_limit:],
            wrong_questions=context.wrong_questions[-context_limit:],
            recent_questions=context.recent_questions[-context_limit:],
            tier=req.tier,
        )
        category_plan = build_adaptive_batch_plan(category_request, tier)
        for index, template in enumerate(category_plan.templates, start=1):
            templates.append(
                _copy_template(
                    template,
                    template_id=f"{category}-adaptive-{index:02d}",
                    category=category,
                )
            )
        history.extend(category_plan.history)
        wrong_questions.extend(category_plan.wrong_questions)
        recent_questions.extend(category_plan.recent_questions)
        weak_areas.extend(category_plan.coverage.weak_areas)
        intents.extend(category_plan.coverage.intent_sequence)
        summaries.append(f"{category}: {category_plan.coverage.diagnosis_summary}")

    return AdaptiveBatchPlan(
        category="multi_category",
        tier=tier,
        count=req.count,
        context_limit=context_limit,
        history=history,
        wrong_questions=wrong_questions,
        recent_questions=recent_questions,
        coverage=WeakAreaCoveragePlan(
            category="multi_category",
            weak_areas=weak_areas,
            intent_sequence=intents,
            diagnosis_summary=" | ".join(summaries),
        ),
        templates=templates,
    )


def repair_mode_for_validation_error(error: Exception) -> str:
    message = str(error)
    if any(marker in message for marker in REPAIR_RESPONSE_MARKERS):
        return "repair_response"
    return "replace_batch"


async def generate_adaptive_pipeline(
    req: AdaptiveQuestionsRequest,
    tier: Tier,
    provider: object,
) -> AdaptivePipelineResult:
    if _is_multi_category_request(req):
        plan = build_multi_category_batch_plan(req, tier)
    else:
        validate_request_shape(req, tier)
        plan = build_adaptive_batch_plan(req, tier)
    last_error: Exception | None = None
    last_raw_questions: list[dict] | None = None
    repair_mode: str | None = None

    for attempt in range(2):
        try:
            raw_questions = await call_adaptive_question_writer(
                provider,
                plan,
                retry_error=str(last_error) if attempt > 0 and last_error else None,
                previous_response=last_raw_questions if attempt > 0 else None,
                repair_mode=repair_mode if attempt > 0 else None,
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
            if "raw_questions" in locals():
                last_raw_questions = raw_questions
            repair_mode = repair_mode_for_validation_error(error)
            logger.warning(
                "Adaptive pipeline validation failed on attempt %s: %s",
                attempt + 1,
                error,
            )

    raise HTTPException(
        status_code=502,
        detail=str(last_error) if last_error else "Invalid adaptive question batch",
    )
