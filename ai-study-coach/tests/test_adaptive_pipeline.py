"""Tests for the Adaptive Infinity Quiz generation pipeline."""

import asyncio
import json
from collections import Counter

import pytest
from fastapi import HTTPException

from server.adaptive.pipeline import generate_adaptive_pipeline
from server.adaptive.schemas import AdaptiveQuestionsRequest
from server.adaptive.validation import validate_adaptive_questions_for_plan
from server.adaptive.weak_area import build_adaptive_batch_plan
from server.llm.base import ChunkType, StreamChunk
from server.router import Tier


class FakeProvider:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0
        self.messages = []

    async def is_available(self):
        return True

    async def complete(self, messages, tools=None, temperature=0.7, max_tokens=2048):
        self.calls += 1
        self.messages.append(messages)
        response = self.responses.pop(0)
        yield StreamChunk(
            type=ChunkType.CONTENT,
            content=json.dumps({"questions": response}),
        )
        yield StreamChunk(type=ChunkType.FINISH, finish_reason="stop")


def make_valid_questions(count):
    return [
        {
            "templateId": f"adaptive-{index + 1:02d}",
            "question": f"Which science statement is true for adaptive test {index + 1}?",
            "answers": [
                f"Correct option {index + 1}",
                f"Distractor A {index + 1}",
                f"Distractor B {index + 1}",
                f"Distractor C {index + 1}",
            ],
            "correctAnswer": f"Correct option {index + 1}",
            "topic": "science",
            "source": "adaptive_ai",
            "generatedFromQuestion": "Which organelle produces energy?",
            "subskill": "cell energy",
            "difficulty": "medium",
            "explanation": "The correct option matches the targeted concept.",
            "adaptationReason": "Targets the repeated weak area.",
            "planningIntent": "remedial",
            "masteryBefore": 0.4,
            "masteryAfter": 0.5,
        }
        for index in range(count)
    ]


def make_multi_category_questions(categories):
    questions = []
    index = 1
    for category, count in categories.items():
        for category_index in range(count):
            question_text = (
                f"What is {category_index + 2} x 3?"
                if category == "math"
                else f"Which {category} statement is true for adaptive test {category_index + 1}?"
            )
            questions.append(
                {
                    "templateId": f"{category}-adaptive-{category_index + 1:02d}",
                    "question": question_text,
                    "answers": [
                        f"{category} correct {category_index + 1}",
                        f"{category} distractor A {category_index + 1}",
                        f"{category} distractor B {category_index + 1}",
                        f"{category} distractor C {category_index + 1}",
                    ],
                    "correctAnswer": f"{category} correct {category_index + 1}",
                    "topic": category,
                    "source": "adaptive_ai",
                    "subskill": category,
                    "difficulty": "easy",
                    "explanation": "The correct option matches the targeted concept.",
                    "adaptationReason": "Matches the planned category allocation.",
                    "planningIntent": "diagnostic",
                    "masteryBefore": 0.5,
                    "masteryAfter": 0.55,
                }
            )
            index += 1
    return questions


def sample_request():
    return AdaptiveQuestionsRequest(
        category="Science",
        count=5,
        tier="lite",
        history=[
            {
                "question": "Which organelle produces energy?",
                "answers": ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"],
                "correctAnswer": "Mitochondria",
                "selectedAnswer": "Nucleus",
                "wasCorrect": False,
                "source": "adaptive_ai",
                "subskill": "cell energy",
                "difficulty": "easy",
            },
            {
                "question": "What does chlorophyll absorb?",
                "answers": ["Light", "Sound", "Heat", "Gravity"],
                "correctAnswer": "Light",
                "selectedAnswer": "Light",
                "wasCorrect": True,
                "source": "static_json",
                "subskill": "photosynthesis",
            },
        ],
        wrong_questions=[
            {
                "question": "Which organelle produces energy?",
                "answers": ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"],
                "correctAnswer": "Mitochondria",
                "selectedAnswer": "Nucleus",
                "source": "adaptive_ai",
                "wrongCount": 2,
                "subskill": "cell energy",
            }
        ],
        recent_questions=["Which organelle produces energy?"],
    )


def literature_weak_area_request():
    return AdaptiveQuestionsRequest(
        category="Literature",
        count=10,
        tier="full",
        history=[
            {
                "question": "Who wrote Romeo and Juliet?",
                "answers": ["William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain"],
                "correctAnswer": "William Shakespeare",
                "selectedAnswer": "William Shakespeare",
                "wasCorrect": True,
                "source": "static_json",
            },
            {
                "question": "What is the first book of the Harry Potter series?",
                "answers": ["The Philosopher's Stone", "The Chamber of Secrets", "The Prisoner of Azkaban", "The Goblet of Fire"],
                "correctAnswer": "The Philosopher's Stone",
                "selectedAnswer": "The Philosopher's Stone",
                "wasCorrect": True,
                "source": "static_json",
            },
            {
                "question": "What literary device gives human qualities to non-human things?",
                "answers": ["Personification", "Metaphor", "Simile", "Hyperbole"],
                "correctAnswer": "Personification",
                "selectedAnswer": "Personification",
                "wasCorrect": True,
                "source": "static_json",
                "subskill": "figurative language",
            },
            {
                "question": "What is the term for a comparison using 'like' or 'as'?",
                "answers": ["simile", "metaphor", "hyperbole", "personification"],
                "correctAnswer": "simile",
                "selectedAnswer": "hyperbole",
                "wasCorrect": False,
                "source": "repeat",
                "subskill": "literature",
            },
        ],
        wrong_questions=[
            {
                "question": "What is the term for a comparison using 'like' or 'as'?",
                "answers": ["simile", "metaphor", "hyperbole", "personification"],
                "correctAnswer": "simile",
                "selectedAnswer": "hyperbole",
                "source": "repeat",
                "wrongCount": 2,
                "subskill": "literature",
                "difficulty": "easy",
                "planningIntent": "diagnostic",
            }
        ],
        recent_questions=[
            "What is the term for a comparison using 'like' or 'as'?",
            "Who wrote Romeo and Juliet?",
            "What is the first book of the Harry Potter series?",
        ],
    )


def math_warm_history_request():
    return AdaptiveQuestionsRequest(
        category="Math",
        count=5,
        tier="lite",
        history=[
            {
                "question": "What is 2 + 2?",
                "answers": ["4", "3", "5", "6"],
                "correctAnswer": "4",
                "selectedAnswer": "4",
                "wasCorrect": True,
                "source": "static_json",
            },
            {
                "question": "What is the square root of 144?",
                "answers": ["12", "14", "11", "13"],
                "correctAnswer": "12",
                "selectedAnswer": "12",
                "wasCorrect": True,
                "source": "static_json",
            },
        ],
        recent_questions=["What is 2 + 2?", "What is the square root of 144?"],
    )


def literature_question(index, question, correct, intent, subskill="figurative_language_comparison"):
    answers = [correct, f"Distractor A {index}", f"Distractor B {index}", f"Distractor C {index}"]
    return {
        "templateId": f"adaptive-{index:02d}",
        "question": question,
        "answers": answers,
        "correctAnswer": correct,
        "topic": "literature",
        "source": "adaptive_ai",
        "generatedFromQuestion": "What is the term for a comparison using 'like' or 'as'?",
        "subskill": subskill,
        "difficulty": "easy",
        "explanation": "The correct option matches the targeted literature concept.",
        "adaptationReason": "Targets the repeated weak area.",
        "planningIntent": intent,
        "masteryBefore": 0.4,
        "masteryAfter": 0.5,
    }


def drifting_literature_batch():
    return [
        literature_question(1, "What literary device makes a direct comparison without using like or as?", "metaphor", "remedial"),
        literature_question(2, "Which Shakespeare tragedy features Macbeth and Lady Macbeth?", "Macbeth", "prerequisite", "author_text_recall"),
        literature_question(3, "Which Harry Potter book features the Chamber of Secrets?", "The Chamber of Secrets", "remedial", "novel_detail_recall"),
        literature_question(4, "What is an allegory?", "A story with symbolic meaning", "transfer"),
        literature_question(5, "What is an extended metaphor?", "A sustained comparison", "challenge"),
        literature_question(6, "Who wrote Tender Is the Night?", "F. Scott Fitzgerald", "consolidation", "author_text_recall"),
        literature_question(7, "What is the underlying message of a story called?", "theme", "remedial", "theme_identification"),
        literature_question(8, "In which play does Shylock appear?", "The Merchant of Venice", "transfer", "character_recall"),
        literature_question(9, "What guards the trapdoor in Philosopher's Stone?", "Fluffy", "challenge", "novel_detail_recall"),
        literature_question(10, "Which Orwell novel depicts totalitarian surveillance?", "1984", "retrieval", "author_text_recall"),
    ]


def anchored_literature_batch():
    return [
        literature_question(1, "Which sentence uses a simile?", "The moon was like a silver coin.", "remedial"),
        literature_question(2, "Which word most often signals a simile?", "like", "prerequisite"),
        literature_question(3, "Which option contrasts a simile with a metaphor?", "A simile uses like or as; a metaphor does not.", "remedial"),
        literature_question(4, "Which comparison is figurative rather than literal?", "Her voice was as soft as rain.", "transfer"),
        literature_question(5, "Which sentence is an extended metaphor?", "The classroom was a ship crossing a stormy sea.", "challenge"),
        literature_question(6, "What is the literary term for comparing two unlike things?", "figurative comparison", "consolidation"),
        literature_question(7, "Which sentence uses as to make a comparison?", "The answer was as clear as glass.", "remedial"),
        literature_question(8, "Which option changes a simile into a metaphor?", "Her smile was sunshine.", "transfer"),
        literature_question(9, "Which interpretation best explains the simile 'quiet as a shadow'?", "It emphasizes silence through comparison.", "challenge"),
        literature_question(10, "Which device compares two unlike things using explicit comparison words?", "simile", "retrieval"),
    ]


def test_weak_area_plan_targets_active_wrong_subskill():
    plan = build_adaptive_batch_plan(sample_request(), Tier.LITE)

    assert plan.category == "science"
    assert len(plan.templates) == 5
    assert plan.coverage.weak_areas[0].subskill == "cell energy"
    assert plan.templates[0].planning_intent == "remedial"
    assert plan.templates[0].difficulty in {"foundation", "easy", "medium"}


def test_pipeline_retries_weak_area_batch_that_drifts_from_repeated_wrong_concept():
    provider = FakeProvider([drifting_literature_batch(), anchored_literature_batch()])

    result = asyncio.run(
        generate_adaptive_pipeline(literature_weak_area_request(), Tier.FULL, provider)
    )

    assert provider.calls == 2
    questions = [question.question.lower() for question in result.questions]
    assert not any("macbeth" in question or "chamber of secrets" in question for question in questions)
    focused = [
        question
        for question in result.questions
        if question.planningIntent in {"remedial", "prerequisite"}
    ]
    assert focused
    assert all(question.subskill == "figurative_language_comparison" for question in focused)


def test_warm_math_plan_uses_stable_subskill_and_easy_difficulty_for_simple_addition():
    plan = build_adaptive_batch_plan(math_warm_history_request(), Tier.LITE)

    addition_template = next(
        template for template in plan.templates if template.subskill == "single_digit_addition"
    )

    assert addition_template.subskill == "single_digit_addition"
    assert addition_template.difficulty in {"foundation", "easy"}


def test_validation_preserves_metadata_and_coerces_letter_correct_answer():
    plan = build_adaptive_batch_plan(sample_request(), Tier.LITE)
    raw_questions = make_valid_questions(5)
    raw_questions[0]["correctAnswer"] = "A"
    raw_questions[0]["difficulty"] = "hard"
    raw_questions[0]["planningIntent"] = "challenge"

    validated = validate_adaptive_questions_for_plan(raw_questions, plan)

    assert validated[0].correctAnswer == "Correct option 1"
    assert validated[0].topic == "science"
    assert validated[0].templateId == "adaptive-01"
    assert validated[0].difficulty == "hard"
    assert validated[0].planningIntent == "challenge"
    assert validated[0].validationStatus == "validated"


def test_pipeline_retries_invalid_batch_then_returns_metadata():
    invalid_first_batch = make_valid_questions(5)
    invalid_first_batch[0]["question"] = "Which organelle produces energy?"
    provider = FakeProvider([invalid_first_batch, make_valid_questions(5)])

    result = asyncio.run(
        generate_adaptive_pipeline(sample_request(), Tier.LITE, provider)
    )

    assert provider.calls == 2
    assert len(result.questions) == 5
    assert result.questions[0].templateId == "adaptive-01"
    assert result.questions[0].subskill
    assert result.questions[0].validationStatus == "validated"


def test_multi_category_pipeline_returns_exact_lite_allocation():
    request = AdaptiveQuestionsRequest(
        categories=["math", "science"],
        count=5,
        tier="lite",
        category_contexts=[
            {
                "category": "math",
                "requestedCount": 4,
                "history": [
                    {
                        "question": "What is 6 x 7?",
                        "answers": ["42", "36", "48", "40"],
                        "correctAnswer": "42",
                        "selectedAnswer": "36",
                        "wasCorrect": False,
                        "source": "static_json",
                    }
                ],
                "wrong_questions": [],
                "recent_questions": ["What is 6 x 7?"],
            },
            {
                "category": "science",
                "requestedCount": 1,
                "history": [],
                "wrong_questions": [],
                "recent_questions": [],
            },
        ],
    )
    provider = FakeProvider([make_multi_category_questions({"math": 4, "science": 1})])

    result = asyncio.run(generate_adaptive_pipeline(request, Tier.LITE, provider))

    assert len(result.questions) == 5
    assert Counter(question.topic for question in result.questions) == {
        "math": 4,
        "science": 1,
    }


def test_lite_multi_category_pipeline_rejects_more_than_two_categories():
    request = AdaptiveQuestionsRequest(
        categories=["math", "science", "literature"],
        count=5,
        tier="lite",
        category_contexts=[
            {"category": "math", "requestedCount": 3},
            {"category": "science", "requestedCount": 1},
            {"category": "literature", "requestedCount": 1},
        ],
    )
    provider = FakeProvider([make_multi_category_questions({"math": 3, "science": 1, "literature": 1})])

    with pytest.raises(HTTPException) as error:
        asyncio.run(generate_adaptive_pipeline(request, Tier.LITE, provider))

    assert error.value.status_code == 400
    assert "lite supports at most 2 categories" in error.value.detail


def test_multi_category_pipeline_retries_wrong_category_mix():
    request = AdaptiveQuestionsRequest(
        categories=["math", "science"],
        count=5,
        tier="lite",
        category_contexts=[
            {"category": "math", "requestedCount": 4},
            {"category": "science", "requestedCount": 1},
        ],
    )
    provider = FakeProvider([
        make_multi_category_questions({"math": 2, "science": 3}),
        make_multi_category_questions({"math": 4, "science": 1}),
    ])

    result = asyncio.run(generate_adaptive_pipeline(request, Tier.LITE, provider))

    assert provider.calls == 2
    assert Counter(question.topic for question in result.questions) == {
        "math": 4,
        "science": 1,
    }


def test_multi_category_pipeline_auto_fixes_letter_correct_answer_without_retry():
    request = AdaptiveQuestionsRequest(
        categories=["math", "science"],
        count=5,
        tier="lite",
        category_contexts=[
            {"category": "math", "requestedCount": 4},
            {"category": "science", "requestedCount": 1},
        ],
    )
    questions = make_multi_category_questions({"math": 4, "science": 1})
    questions[0]["correctAnswer"] = "A"
    provider = FakeProvider([questions])

    result = asyncio.run(generate_adaptive_pipeline(request, Tier.LITE, provider))

    assert provider.calls == 1
    assert result.questions[0].correctAnswer == "math correct 1"


def test_multi_category_pipeline_uses_previous_response_for_small_repair_prompt():
    request = AdaptiveQuestionsRequest(
        categories=["math", "science"],
        count=5,
        tier="lite",
        category_contexts=[
            {"category": "math", "requestedCount": 4},
            {"category": "science", "requestedCount": 1},
        ],
    )
    invalid_questions = make_multi_category_questions({"math": 4, "science": 1})
    invalid_questions[0]["answers"][1] = invalid_questions[0]["answers"][0]
    provider = FakeProvider([
        invalid_questions,
        make_multi_category_questions({"math": 4, "science": 1}),
    ])

    result = asyncio.run(generate_adaptive_pipeline(request, Tier.LITE, provider))

    assert provider.calls == 2
    retry_prompt = provider.messages[1][1].content
    assert "Previous response:" in retry_prompt
    assert "Repair only the invalid questions" in retry_prompt
    assert "full original history" not in retry_prompt
    assert Counter(question.topic for question in result.questions) == {
        "math": 4,
        "science": 1,
    }
