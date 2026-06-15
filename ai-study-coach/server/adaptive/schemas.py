"""Schemas and internal planning types for Adaptive Infinity Quiz."""

from dataclasses import dataclass, field

from pydantic import BaseModel, Field

from server.router import Tier


ADAPTIVE_LITE_BATCH_SIZE = 5
ADAPTIVE_LITE_CONTEXT_LIMIT = 5
ADAPTIVE_LITE_CATEGORY_LIMIT = 2
ADAPTIVE_FULL_BATCH_SIZE = 10
ADAPTIVE_FULL_CONTEXT_LIMIT = 20
ADAPTIVE_FULL_CATEGORY_LIMIT = 3


class AdaptiveQuestionMetadata(BaseModel):
    """Optional metadata carried across generation, UI state, and persistence."""

    templateId: str | None = None
    subskill: str | None = None
    difficulty: str | None = None
    explanation: str | None = None
    adaptationReason: str | None = None
    planningIntent: str | None = None
    validationStatus: str | None = None
    masteryBefore: float | None = None
    masteryAfter: float | None = None
    attemptIndex: int | None = None


class AdaptiveAnswerHistoryItem(AdaptiveQuestionMetadata):
    question: str
    answers: list[str] = Field(default_factory=list)
    correctAnswer: str
    selectedAnswer: str | None = None
    wasCorrect: bool
    source: str | None = None


class AdaptiveWrongQuestion(AdaptiveQuestionMetadata):
    question: str
    answers: list[str] = Field(default_factory=list)
    correctAnswer: str
    selectedAnswer: str | None = None
    source: str | None = None
    wrongCount: int | None = None


class AdaptiveCategoryContext(BaseModel):
    category: str
    requestedCount: int
    history: list[AdaptiveAnswerHistoryItem] = Field(default_factory=list)
    wrong_questions: list[AdaptiveWrongQuestion] = Field(default_factory=list)
    recent_questions: list[str] = Field(default_factory=list)


class AdaptiveQuestionsRequest(BaseModel):
    category: str | None = None
    categories: list[str] = Field(default_factory=list)
    count: int = ADAPTIVE_LITE_BATCH_SIZE
    history: list[AdaptiveAnswerHistoryItem] = Field(default_factory=list)
    wrong_questions: list[AdaptiveWrongQuestion] = Field(default_factory=list)
    recent_questions: list[str] = Field(default_factory=list)
    category_contexts: list[AdaptiveCategoryContext] = Field(default_factory=list)
    tier: str | None = None


class AdaptiveGeneratedQuestion(AdaptiveQuestionMetadata):
    question: str
    answers: list[str]
    correctAnswer: str
    topic: str
    source: str = "adaptive_ai"
    generatedFromQuestion: str | None = None


class AdaptiveQuestionsResponse(BaseModel):
    questions: list[AdaptiveGeneratedQuestion]


@dataclass(slots=True)
class WeakAreaScore:
    key: str
    label: str
    category: str
    subskill: str | None = None
    generated_from_question: str | None = None
    wrong_count: int = 0
    correct_count: int = 0
    active_wrong_count: int = 0
    recent_weight: float = 0.0
    score: float = 0.0
    mastery_estimate: float = 0.5
    evidence: list[str] = field(default_factory=list)


@dataclass(slots=True)
class AdaptiveQuestionTemplate:
    template_id: str
    category: str
    subskill: str
    difficulty: str
    planning_intent: str
    generated_from_question: str | None
    adaptation_reason: str
    mastery_before: float
    mastery_after: float
    evidence: list[str] = field(default_factory=list)


@dataclass(slots=True)
class WeakAreaCoveragePlan:
    category: str
    weak_areas: list[WeakAreaScore]
    intent_sequence: list[str]
    diagnosis_summary: str


@dataclass(slots=True)
class AdaptiveBatchPlan:
    category: str
    tier: Tier
    count: int
    context_limit: int
    history: list[AdaptiveAnswerHistoryItem]
    wrong_questions: list[AdaptiveWrongQuestion]
    recent_questions: list[str]
    coverage: WeakAreaCoveragePlan
    templates: list[AdaptiveQuestionTemplate]


@dataclass(slots=True)
class AdaptivePipelineResult:
    questions: list[AdaptiveGeneratedQuestion]
    plan: AdaptiveBatchPlan


def adaptive_batch_size_for_tier(tier: Tier) -> int:
    return ADAPTIVE_FULL_BATCH_SIZE if tier == Tier.FULL else ADAPTIVE_LITE_BATCH_SIZE


def adaptive_context_limit_for_tier(tier: Tier) -> int:
    return ADAPTIVE_FULL_CONTEXT_LIMIT if tier == Tier.FULL else ADAPTIVE_LITE_CONTEXT_LIMIT


def adaptive_category_limit_for_tier(tier: Tier) -> int:
    return ADAPTIVE_FULL_CATEGORY_LIMIT if tier == Tier.FULL else ADAPTIVE_LITE_CATEGORY_LIMIT
