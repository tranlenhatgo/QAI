"""Validation and normalization for adaptive generated questions."""

from typing import Any

from server.adaptive.schemas import (
    AdaptiveBatchPlan,
    AdaptiveGeneratedQuestion,
    AdaptiveQuestionTemplate,
)
from server.adaptive.weak_area import stable_subskill_label

DIFFICULTIES = {"foundation", "easy", "medium", "hard"}
PLANNING_INTENTS = {
    "remedial",
    "prerequisite",
    "diagnostic",
    "retrieval",
    "transfer",
    "challenge",
    "consolidation",
}


def normalize_question_text(value: object) -> str:
    return " ".join(str(value or "").lower().strip().split())


def clean_optional(value: object, limit: int = 500) -> str | None:
    cleaned = " ".join(str(value or "").strip().split())
    if not cleaned:
        return None
    return cleaned[:limit].strip()


def coerce_float(value: object, fallback: float | None = None) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def coerce_int(value: object, fallback: int | None = None) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def normalize_enum(value: object, allowed: set[str], fallback: str) -> str:
    normalized = normalize_question_text(value)
    return normalized if normalized in allowed else fallback


def coerce_correct_answer(correct_answer: object, answers: list[str]) -> str:
    answer = str(correct_answer or "").strip()
    if answer in answers:
        return answer

    option_index = {"a": 0, "b": 1, "c": 2, "d": 3}.get(
        answer.lower().strip(").: ")
    )
    if option_index is None and answer.strip().isdigit():
        numeric_index = int(answer.strip()) - 1
        option_index = numeric_index if 0 <= numeric_index < 4 else None
    if option_index is not None:
        return answers[option_index]
    return answer


def _template_requires_weak_area_anchor(template: AdaptiveQuestionTemplate) -> bool:
    return template.planning_intent in {"remedial", "prerequisite"}


def _template_for_raw(
    raw_question: dict[str, Any],
    plan: AdaptiveBatchPlan,
    index: int,
    used_template_ids: set[str],
) -> AdaptiveQuestionTemplate:
    templates_by_id = {template.template_id: template for template in plan.templates}
    requested_id = clean_optional(raw_question.get("templateId"), limit=80)
    if requested_id and requested_id in templates_by_id and requested_id not in used_template_ids:
        return templates_by_id[requested_id]
    return plan.templates[index]


def validate_adaptive_questions_for_plan(
    raw_questions: list[dict[str, Any]],
    plan: AdaptiveBatchPlan,
) -> list[AdaptiveGeneratedQuestion]:
    if len(raw_questions) != plan.count:
        raise ValueError(f"Expected {plan.count} questions, received {len(raw_questions)}")

    recent = {normalize_question_text(text) for text in plan.recent_questions if text}
    seen: set[str] = set()
    used_template_ids: set[str] = set()
    validated: list[AdaptiveGeneratedQuestion] = []

    for index, raw_question in enumerate(raw_questions):
        if not isinstance(raw_question, dict):
            raise ValueError("Generated question entries must be JSON objects")

        template = _template_for_raw(raw_question, plan, index, used_template_ids)
        used_template_ids.add(template.template_id)

        question_text = clean_optional(raw_question.get("question"), limit=600)
        answers = raw_question.get("answers")
        correct_answer = raw_question.get("correctAnswer")

        if not question_text:
            raise ValueError(f"{template.template_id} is missing question text")
        if not isinstance(answers, list) or len(answers) != 4:
            raise ValueError(f"{template.template_id} must have exactly 4 answers")

        normalized_answers = [clean_optional(answer, limit=220) or "" for answer in answers]
        if not all(normalized_answers):
            raise ValueError(f"{template.template_id} has a blank answer option")
        if len({normalize_question_text(answer) for answer in normalized_answers}) != 4:
            raise ValueError(f"{template.template_id} has duplicate answer options")

        correct_answer_text = coerce_correct_answer(correct_answer, normalized_answers)
        if correct_answer_text not in normalized_answers:
            raise ValueError(f"{template.template_id} correctAnswer is not an option")

        normalized_question = normalize_question_text(question_text)
        if normalized_question in recent or normalized_question in seen:
            raise ValueError(
                f"{template.template_id} duplicated a recent or same-batch question"
            )
        source_text = normalize_question_text(template.generated_from_question)
        if source_text and normalized_question == source_text:
            raise ValueError(f"{template.template_id} repeats its source question")
        seen.add(normalized_question)

        difficulty = normalize_enum(
            raw_question.get("difficulty"),
            DIFFICULTIES,
            template.difficulty,
        )
        planning_intent = normalize_enum(
            raw_question.get("planningIntent"),
            PLANNING_INTENTS,
            template.planning_intent,
        )
        raw_subskill = clean_optional(raw_question.get("subskill"), limit=100)
        if _template_requires_weak_area_anchor(template):
            inferred_subskill = stable_subskill_label(
                plan.category,
                question_text,
                fallback=raw_subskill,
            )
            if inferred_subskill != template.subskill:
                raise ValueError(
                    f"{template.template_id} drifted from weak area {template.subskill}"
                )
            subskill = template.subskill
        else:
            subskill = raw_subskill or template.subskill

        validated.append(
            AdaptiveGeneratedQuestion(
                templateId=template.template_id,
                question=question_text,
                answers=normalized_answers,
                correctAnswer=correct_answer_text,
                topic=plan.category,
                source="adaptive_ai",
                generatedFromQuestion=clean_optional(
                    raw_question.get("generatedFromQuestion"), limit=220
                )
                or template.generated_from_question,
                subskill=subskill,
                difficulty=difficulty,
                explanation=clean_optional(raw_question.get("explanation"), limit=500)
                or f"Practices {template.subskill} in {plan.category}.",
                adaptationReason=clean_optional(
                    raw_question.get("adaptationReason"), limit=500
                )
                or template.adaptation_reason,
                planningIntent=planning_intent,
                validationStatus="validated",
                masteryBefore=coerce_float(
                    raw_question.get("masteryBefore"), template.mastery_before
                ),
                masteryAfter=coerce_float(
                    raw_question.get("masteryAfter"), template.mastery_after
                ),
                attemptIndex=coerce_int(raw_question.get("attemptIndex")),
            )
        )

    return validated
