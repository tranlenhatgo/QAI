"""Prompt construction for the adaptive question-writing stage."""

import json

from server.adaptive.schemas import AdaptiveBatchPlan, AdaptiveQuestionTemplate, WeakAreaScore
from server.llm.base import Message, Role


def _history_payload(plan: AdaptiveBatchPlan) -> list[dict]:
    return [item.model_dump(exclude_none=True) for item in plan.history]


def _wrong_payload(plan: AdaptiveBatchPlan) -> list[dict]:
    return [item.model_dump(exclude_none=True) for item in plan.wrong_questions]


def _weak_area_payload(area: WeakAreaScore) -> dict:
    return {
        "key": area.key,
        "subskill": area.subskill or area.label,
        "wrongCount": area.wrong_count,
        "correctCount": area.correct_count,
        "activeWrongCount": area.active_wrong_count,
        "masteryEstimate": round(area.mastery_estimate, 2),
        "evidence": area.evidence[:3],
    }


def _template_payload(template: AdaptiveQuestionTemplate) -> dict:
    return {
        "templateId": template.template_id,
        "category": template.category,
        "subskill": template.subskill,
        "difficulty": template.difficulty,
        "planningIntent": template.planning_intent,
        "generatedFromQuestion": template.generated_from_question,
        "adaptationReason": template.adaptation_reason,
        "masteryBefore": template.mastery_before,
        "masteryAfter": template.mastery_after,
        "evidence": template.evidence,
    }


def build_adaptive_generation_messages(
    plan: AdaptiveBatchPlan,
    retry_error: str | None = None,
    previous_response: list[dict] | None = None,
    repair_mode: str | None = None,
) -> list[Message]:
    retry_block = ""
    if retry_error:
        if repair_mode == "repair_response" and previous_response is not None:
            retry_block = (
                "\n\nYour previous JSON response was close, but it failed validation.\n"
                "Repair only the invalid questions. Keep valid questions unchanged unless needed "
                "to satisfy the rules. Return the full corrected JSON object, not a diff.\n\n"
                "Validation error:\n"
                f"{retry_error}\n\n"
                "Previous response:\n"
                f"{json.dumps({'questions': previous_response}, ensure_ascii=False, indent=2)}"
            )
        else:
            retry_block = (
                "\n\nThe previous response failed structural validation with this reason:\n"
                f"{retry_error}\n"
                "Return a completely new replacement JSON object."
            )

    categories = []
    category_counts: dict[str, int] = {}
    for template in plan.templates:
        if template.category not in categories:
            categories.append(template.category)
        category_counts[template.category] = category_counts.get(template.category, 0) + 1
    category_rule = (
        f'Every question must stay inside category "{plan.category}".'
        if len(categories) <= 1
        else (
            "Every question must set topic to its template category exactly. "
            "Required category counts: "
            + ", ".join(f"{category}={count}" for category, count in category_counts.items())
            + "."
        )
    )
    template_id_example = plan.templates[0].template_id if plan.templates else "adaptive-01"
    topic_example = categories[0] if categories else plan.category

    plan_payload = {
        "category": plan.category,
        "categories": categories,
        "categoryCounts": category_counts,
        "tier": plan.tier.value,
        "count": plan.count,
        "diagnosisSummary": plan.coverage.diagnosis_summary,
        "weakAreas": [_weak_area_payload(area) for area in plan.coverage.weak_areas],
        "templates": [_template_payload(template) for template in plan.templates],
        "recentHistoryOlderToNewer": _history_payload(plan),
        "activeWrongRepeatQueue": _wrong_payload(plan),
        "alreadySeenQuestionTexts": plan.recent_questions,
    }

    user_prompt = f"""Generate an Adaptive Infinity Quiz batch from this plan.

The app already completed the DeepTutor-style explore and plan phases. You are only writing questions for the templates below.

Plan JSON:
{json.dumps(plan_payload, ensure_ascii=False, indent=2)}

Rules:
- Return exactly {plan.count} questions.
- Return one question for each templateId, in the same order as templates.
- {category_rule}
- Do not repeat or closely paraphrase any alreadySeenQuestionTexts, evidence question, or same-batch question.
- For remedial/prerequisite templates, test the same weak area with a new surface form.
- For transfer/challenge templates, apply the weak area in a nearby or harder same-category case.
- Each question must have exactly 4 unique non-empty answer options.
- correctAnswer must be the exact answer text, not a letter.
- explanation must explain why the correct option is correct in one concise sentence.
- Preserve templateId, subskill, difficulty, planningIntent, adaptationReason, masteryBefore, and masteryAfter from the template.

Respond ONLY with valid JSON in this exact shape:
{{
  "questions": [
    {{
      "templateId": "{template_id_example}",
      "question": "Question text",
      "answers": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "topic": "{topic_example}",
      "source": "adaptive_ai",
      "generatedFromQuestion": "short source question text or null",
      "subskill": "specific skill being tested",
      "difficulty": "foundation|easy|medium|hard",
      "explanation": "One concise sentence.",
      "adaptationReason": "Why this question was selected.",
      "planningIntent": "remedial|prerequisite|diagnostic|retrieval|transfer|challenge|consolidation",
      "masteryBefore": 0.42,
      "masteryAfter": 0.50
    }}
  ]
}}{retry_block}"""

    return [
        Message(
            role=Role.SYSTEM,
            content=(
                "You are a precise adaptive quiz item writer. "
                "Follow the provided plan exactly and return valid JSON only."
            ),
        ),
        Message(role=Role.USER, content=user_prompt),
    ]
