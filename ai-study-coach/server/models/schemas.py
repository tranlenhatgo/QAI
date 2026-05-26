from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from enum import Enum
from datetime import datetime


# ─── Chat ────────────────────────────────────────────────────────────────────


class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    role: ChatRole
    content: str


class ChatRequest(BaseModel):
    user_id: str
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    role: ChatRole = ChatRole.ASSISTANT
    content: str
    weaknesses: list[str] | None = None
    due_reviews: list[str] | None = None
    actions: list["AgentAction"] | None = None


# ─── Agent / Tool Use ────────────────────────────────────────────────────────


class AgentAction(BaseModel):
    """An action the coach wants the frontend to execute."""

    action: str  # e.g., "navigate", "start_quiz", "generate_questions"
    params: dict = {}  # action-specific parameters
    label: str = ""  # human-readable description for the UI


class ToolCall(BaseModel):
    """Represents a tool call from the LLM."""

    id: str
    name: str
    arguments: dict


class LLMResponse(BaseModel):
    """Parsed LLM response — either text content or tool calls (or both)."""

    content: str | None = None
    tool_calls: list[ToolCall] | None = None


# ─── Quiz API Response Models ────────────────────────────────────────────────


class QuizResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = Field(default=None, validation_alias=AliasChoices("id", "quiz_id", "quizId"))
    hostId: str | None = Field(default=None, validation_alias=AliasChoices("hostId", "host_id"))
    title: str | None = None
    description: str | None = None
    status: str | None = None
    categories: list[str] | None = None
    startTime: str | None = Field(default=None, validation_alias=AliasChoices("startTime", "start_time"))
    endTime: str | None = Field(default=None, validation_alias=AliasChoices("endTime", "end_time"))


class TakeQuizResponse(BaseModel):
    quizId: str
    quizTitle: str
    score: str  # format: "correct/total"
    status: str
    updatedAt: str


class QuestionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = None
    quizId: str | None = Field(default=None, validation_alias=AliasChoices("quizId", "quiz_id"))
    content: str | None = Field(default=None, validation_alias=AliasChoices("content", "question"))
    answers: list[str] | None = None
    correctAnswer: str | None = Field(default=None, validation_alias=AliasChoices("correctAnswer", "correct_answer"))


class UserQuizProfile(BaseModel):
    quizzesCreated: list[QuizResponse] = []
    quizzesTaken: list[TakeQuizResponse] = []


# ─── Weakness & Study Plan ───────────────────────────────────────────────────


class CategoryAccuracy(BaseModel):
    category: str
    accuracy: float  # 0.0 to 1.0
    total_questions: int
    correct_questions: int


class WeaknessReport(BaseModel):
    weakest_categories: list[str]
    accuracy_by_category: dict[str, float]
    declining: list[str]  # categories getting worse over time


class ReviewSchedule(BaseModel):
    quiz_id: str
    quiz_title: str
    category: str
    next_review: datetime
    interval_days: float
    ease_factor: float


# ─── Webhook ─────────────────────────────────────────────────────────────────


class QuizCompletedWebhook(BaseModel):
    player_id: str
    quiz_id: str
    take_id: str
    score: str  # "correct/total"
