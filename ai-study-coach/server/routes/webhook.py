"""Webhook endpoint — receives quiz completion notifications from Spring Boot."""

import logging
from datetime import datetime

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, field_validator

from server.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["Webhook"])


# ─── Request/Response Models ─────────────────────────────────────────────────


class QuestionResult(BaseModel):
    question_id: str
    correct: bool
    time_spent_seconds: int | None = None


class QuizCompletedPayload(BaseModel):
    """Payload received from Spring Boot on quiz completion."""

    user_id: str
    quiz_id: str
    score: str  # Format: "correct/total"
    category: str
    completed_at: str
    questions: list[QuestionResult] = []

    @field_validator("score")
    @classmethod
    def validate_score_format(cls, v: str) -> str:
        parts = v.split("/")
        if len(parts) != 2:
            raise ValueError("Score must be in 'correct/total' format")
        correct, total = int(parts[0]), int(parts[1])
        if correct < 0 or total <= 0 or correct > total:
            raise ValueError("Invalid score values")
        return v

    @property
    def accuracy(self) -> float:
        correct, total = self.score.split("/")
        return int(correct) / int(total)


class WebhookResponse(BaseModel):
    status: str = "processed"
    next_review: str | None = None
    mastery_update: dict | None = None


# ─── Event Storage ───────────────────────────────────────────────────────────

from collections import defaultdict

_recent_events: dict[str, list[dict]] = defaultdict(list)


async def store_quiz_event(payload: QuizCompletedPayload) -> None:
    """Store recent quiz events for Coach context."""
    event = {
        "quiz_id": payload.quiz_id,
        "category": payload.category,
        "score": payload.score,
        "completed_at": payload.completed_at,
    }
    _recent_events[payload.user_id].append(event)
    if len(_recent_events[payload.user_id]) > 10:
        _recent_events[payload.user_id] = _recent_events[payload.user_id][-10:]


async def get_recent_quiz_events(user_id: str) -> list[dict]:
    """Get recent quiz events (read only, not cleared)."""
    return _recent_events.get(user_id, [])


# ─── Endpoint ────────────────────────────────────────────────────────────────


@router.post("/quiz-completed", response_model=WebhookResponse)
async def handle_quiz_completed(
    payload: QuizCompletedPayload,
    x_api_key: str = Header(default=""),
):
    """
    Receive quiz completion notification from Spring Boot.

    Flow:
    1. Validate API key
    2. Update spaced repetition schedule
    3. Store event for Coach context
    4. Return processing result
    """
    # Auth check (skip if no API key configured — dev mode)
    if settings.api_key and x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    logger.info(
        f"📩 Webhook received: user={payload.user_id}, "
        f"quiz={payload.quiz_id}, score={payload.score}, cat={payload.category}"
    )

    # Update spaced repetition schedule
    from server.learning.spaced_repetition import on_quiz_completed

    review_item = await on_quiz_completed(
        user_id=payload.user_id,
        category=payload.category,
        score=payload.score,
    )

    # Store event for chat context
    await store_quiz_event(payload)

    return WebhookResponse(
        status="processed",
        next_review=review_item.next_review.isoformat(),
        mastery_update={
            "category": payload.category,
            "next_interval_days": review_item.interval_days,
            "easiness": review_item.easiness,
        },
    )
