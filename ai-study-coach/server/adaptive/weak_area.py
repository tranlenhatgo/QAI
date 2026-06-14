"""Weak-area coverage planner for Adaptive Infinity Quiz.

The planner mirrors DeepTutor's explore -> plan split: it converts prior quiz
history into deterministic templates before the LLM writes questions.
"""

import re
from collections import defaultdict

from server.adaptive.schemas import (
    AdaptiveBatchPlan,
    AdaptiveQuestionTemplate,
    AdaptiveQuestionsRequest,
    WeakAreaCoveragePlan,
    WeakAreaScore,
    adaptive_context_limit_for_tier,
)
from server.router import Tier


def clean_text(value: object, limit: int = 140) -> str:
    text = " ".join(str(value or "").strip().split())
    return text[:limit].strip()


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _normalize_key(value: object) -> str:
    return " ".join(str(value or "").lower().strip().split())


def _slug(value: str) -> str:
    return "_".join(part for part in re.split(r"[^a-z0-9]+", value.lower()) if part)


def _is_generic_subskill(value: str, category: str) -> bool:
    normalized = _normalize_key(value)
    return not normalized or normalized in {
        category,
        "literature",
        "math",
        "mathematics",
        "general",
    }


def _looks_like_question(value: str) -> bool:
    normalized = _normalize_key(value)
    return normalized.endswith("?") or normalized.startswith((
        "what ",
        "who ",
        "which ",
        "how ",
        "in what ",
    ))


def stable_subskill_label(category: str, value: object, fallback: str | None = None) -> str:
    text = _normalize_key(value)
    fallback_text = clean_text(fallback or "", limit=70)

    if category == "literature":
        if any(term in text for term in ("simile", "metaphor", "like' or 'as", "like or as", "figurative", "comparison")):
            return "figurative_language_comparison"
        if "personification" in text or "human qualities" in text:
            return "personification"
        if "theme" in text or "underlying message" in text:
            return "theme_identification"
        if "conflict" in text:
            return "literary_conflict"
        if "plot" in text or "climax" in text:
            return "plot_structure"

    if category == "math":
        if re.search(r"\d+\s*\+\s*\d+", text):
            return "single_digit_addition"
        if re.search(r"\d+\s*-\s*\d+", text):
            return "single_digit_subtraction"
        if "square root" in text:
            return "square_roots"
        if "%" in text or "percent" in text:
            return "percentage_calculation"
        if "pi" in text:
            return "pi_precision"
        if "x" in text or "*" in text or "multiply" in text:
            return "multiplication_facts"

    if fallback_text and not _is_generic_subskill(fallback_text, category):
        return _slug(fallback_text) if _looks_like_question(fallback_text) else fallback_text
    return category


def _signal_key(item: object, category: str) -> str:
    return stable_subskill_label(
        category,
        getattr(item, "question", None) or getattr(item, "generatedFromQuestion", None),
        fallback=getattr(item, "subskill", None),
    )


def _signal_label(item: object, category: str) -> str:
    for field_name in ("subskill", "generatedFromQuestion", "question"):
        value = clean_text(getattr(item, field_name, ""), limit=90)
        if value:
            return value
    return category


def _signal_subskill(item: object, category: str) -> str:
    subskill = clean_text(getattr(item, "subskill", ""), limit=70)
    question = clean_text(getattr(item, "question", ""), limit=140)
    generated_from = clean_text(getattr(item, "generatedFromQuestion", ""), limit=140)
    if subskill and not _is_generic_subskill(subskill, category) and not _looks_like_question(subskill):
        return subskill
    return stable_subskill_label(category, question or generated_from or subskill, fallback=subskill)


def _evidence_line(item: object, correct: bool | None) -> str:
    question = clean_text(getattr(item, "question", ""), limit=110)
    if not question:
        return ""
    if correct is True:
        return f"Correct: {question}"
    if correct is False:
        return f"Wrong: {question}"
    return question


def score_weak_areas(
    history: list[object],
    wrong_questions: list[object],
    category: str,
) -> list[WeakAreaScore]:
    scores: dict[str, WeakAreaScore] = {}
    history_len = max(len(history), 1)

    def ensure(item: object) -> WeakAreaScore:
        key = _signal_key(item, category)
        if key not in scores:
            scores[key] = WeakAreaScore(
                key=key,
                label=_signal_label(item, category),
                category=category,
                subskill=_signal_subskill(item, category),
                generated_from_question=clean_text(
                    getattr(item, "generatedFromQuestion", ""), limit=110
                )
                or None,
            )
        return scores[key]

    for index, item in enumerate(history):
        score = ensure(item)
        was_correct = bool(getattr(item, "wasCorrect", False))
        recency = (index + 1) / history_len
        score.recent_weight += recency
        if was_correct:
            score.correct_count += 1
        else:
            score.wrong_count += 1
        evidence = _evidence_line(item, was_correct)
        if evidence and len(score.evidence) < 4:
            score.evidence.append(evidence)

    for item in wrong_questions:
        score = ensure(item)
        wrong_count = getattr(item, "wrongCount", None)
        score.active_wrong_count += max(int(wrong_count or 1), 1)
        score.wrong_count += 1
        evidence = _evidence_line(item, False)
        if evidence and len(score.evidence) < 4:
            score.evidence.append(evidence)

    if not scores:
        return [
            WeakAreaScore(
                key=category,
                label=category,
                category=category,
                subskill=category,
                score=0.6,
                mastery_estimate=0.5,
                evidence=["No prior adaptive history; start with diagnostic coverage."],
            )
        ]

    for score in scores.values():
        raw = (
            score.wrong_count * 2.0
            + score.active_wrong_count * 1.35
            + score.recent_weight * 0.45
            - score.correct_count * 1.05
        )
        score.score = max(0.05, raw)
        score.mastery_estimate = clamp(0.82 - (score.score * 0.08), 0.12, 0.9)

    ranked = sorted(
        scores.values(),
        key=lambda item: (item.score, item.active_wrong_count, item.wrong_count),
        reverse=True,
    )
    return ranked[:6]


def intent_sequence(count: int, has_active_weakness: bool) -> list[str]:
    if has_active_weakness:
        base = [
            "remedial",
            "prerequisite",
            "remedial",
            "transfer",
            "challenge",
            "consolidation",
            "remedial",
            "transfer",
            "challenge",
            "retrieval",
        ]
    else:
        base = [
            "diagnostic",
            "retrieval",
            "transfer",
            "challenge",
            "consolidation",
            "diagnostic",
            "transfer",
            "challenge",
            "retrieval",
            "consolidation",
        ]
    return base[:count]


def difficulty_for_intent(intent: str, mastery: float, subskill: str | None = None) -> str:
    if subskill in {"single_digit_addition", "single_digit_subtraction"}:
        return "medium" if intent == "challenge" else "easy"
    if intent in {"remedial", "prerequisite"}:
        return "foundation" if mastery < 0.35 else "easy"
    if intent in {"diagnostic", "retrieval", "consolidation"}:
        return "easy" if mastery < 0.55 else "medium"
    if intent == "transfer":
        return "medium"
    if intent == "challenge":
        return "hard" if mastery >= 0.62 else "medium"
    return "medium"


def projected_mastery_after(intent: str, mastery: float) -> float:
    gain_by_intent = {
        "remedial": 0.10,
        "prerequisite": 0.08,
        "diagnostic": 0.04,
        "retrieval": 0.05,
        "transfer": 0.06,
        "challenge": 0.04,
        "consolidation": 0.07,
    }
    return round(clamp(mastery + gain_by_intent.get(intent, 0.05), 0.0, 0.95), 2)


def adaptation_reason(intent: str, weak_area: WeakAreaScore) -> str:
    if intent == "remedial":
        return (
            "Targets a recently missed or repeated concept before advancing difficulty."
        )
    if intent == "prerequisite":
        return "Checks a prerequisite needed for the weak area."
    if intent == "transfer":
        return "Tests whether the learner can apply the weak area in a nearby case."
    if intent == "challenge":
        return "Raises difficulty after focused coverage of the weak area."
    if intent == "diagnostic":
        return "Samples the category to establish an initial adaptive signal."
    if intent == "retrieval":
        return "Reinforces recall for a category concept already seen in the session."
    return "Consolidates weak-area coverage without repeating the original question."


def build_coverage_plan(
    category: str,
    history: list[object],
    wrong_questions: list[object],
    count: int,
) -> WeakAreaCoveragePlan:
    weak_areas = score_weak_areas(history, wrong_questions, category)
    has_active_weakness = any(
        area.wrong_count > area.correct_count or area.active_wrong_count > 0
        for area in weak_areas
    )
    intents = intent_sequence(count, has_active_weakness)
    top_area = weak_areas[0]
    summary = (
        f"Top weak area: {top_area.subskill or top_area.label}; "
        f"wrong={top_area.wrong_count}, correct={top_area.correct_count}, "
        f"active_wrong={top_area.active_wrong_count}."
    )
    return WeakAreaCoveragePlan(
        category=category,
        weak_areas=weak_areas,
        intent_sequence=intents,
        diagnosis_summary=summary,
    )


def build_templates(coverage: WeakAreaCoveragePlan, count: int) -> list[AdaptiveQuestionTemplate]:
    templates: list[AdaptiveQuestionTemplate] = []
    usage_by_key: dict[str, int] = defaultdict(int)
    weak_areas = coverage.weak_areas or [
        WeakAreaScore(
            key=coverage.category,
            label=coverage.category,
            category=coverage.category,
            subskill=coverage.category,
            mastery_estimate=0.5,
        )
    ]
    active_focus = next(
        (area for area in weak_areas if area.active_wrong_count > 0),
        None,
    )

    for index in range(count):
        intent = coverage.intent_sequence[index]
        if active_focus and intent in {"remedial", "prerequisite"}:
            weak_area = active_focus
        else:
            weak_area = weak_areas[index % len(weak_areas)]
        usage_by_key[weak_area.key] += 1
        mastery_before = round(weak_area.mastery_estimate, 2)
        templates.append(
            AdaptiveQuestionTemplate(
                template_id=f"adaptive-{index + 1:02d}",
                category=coverage.category,
                subskill=weak_area.subskill or weak_area.label,
                difficulty=difficulty_for_intent(
                    intent,
                    mastery_before,
                    weak_area.subskill or weak_area.label,
                ),
                planning_intent=intent,
                generated_from_question=weak_area.generated_from_question
                or weak_area.label
                if weak_area.label != coverage.category
                else None,
                adaptation_reason=adaptation_reason(intent, weak_area),
                mastery_before=mastery_before,
                mastery_after=projected_mastery_after(intent, mastery_before),
                evidence=weak_area.evidence[:3],
            )
        )

    return templates


def build_adaptive_batch_plan(req: AdaptiveQuestionsRequest, tier: Tier) -> AdaptiveBatchPlan:
    category = clean_text(req.category, limit=80).lower()
    context_limit = adaptive_context_limit_for_tier(tier)
    history = req.history[-context_limit:]
    wrong_questions = req.wrong_questions[-context_limit:]
    recent_questions = [clean_text(text, limit=220) for text in req.recent_questions[-context_limit:] if text]
    coverage = build_coverage_plan(category, history, wrong_questions, req.count)
    templates = build_templates(coverage, req.count)

    return AdaptiveBatchPlan(
        category=category,
        tier=tier,
        count=req.count,
        context_limit=context_limit,
        history=history,
        wrong_questions=wrong_questions,
        recent_questions=recent_questions,
        coverage=coverage,
        templates=templates,
    )
