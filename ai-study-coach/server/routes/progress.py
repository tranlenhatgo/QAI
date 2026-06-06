"""Progress endpoint — returns learning metrics for a student."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime

from server.quiz_client.client import quiz_client
from server.learning.progress import ProgressTracker
from server.learning.spaced_repetition import (
    SpacedRepetitionScheduler,
    load_schedule,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Progress"])


# ─── Response Models ─────────────────────────────────────────────────────────


class CategoryMasteryResponse(BaseModel):
    category: str
    mastery_level: float
    accuracy: float
    trend: str
    total_attempts: int
    streak: int


class VelocityResponse(BaseModel):
    category: str
    velocity: float
    direction: str


class DueReviewResponse(BaseModel):
    category: str
    days_overdue: float
    priority: str
    last_score: float


class ProgressResponse(BaseModel):
    user_id: str
    overall_mastery: float
    categories: list[CategoryMasteryResponse]
    velocities: list[VelocityResponse]
    due_reviews: list[DueReviewResponse]
    upcoming_reviews: list[DueReviewResponse]
    study_streak: int
    total_quizzes: int
    strongest: str | None
    weakest: str | None
    generated_at: str


# ─── Endpoint ────────────────────────────────────────────────────────────────


@router.get("/progress/{user_id}", response_model=ProgressResponse)
async def get_progress(user_id: str):
    """Get complete progress report for a student."""
    # Fetch quiz history from Spring Boot
    history = await quiz_client.get_player_history(user_id)

    if not history:
        return ProgressResponse(
            user_id=user_id,
            overall_mastery=0.0,
            categories=[],
            velocities=[],
            due_reviews=[],
            upcoming_reviews=[],
            study_streak=0,
            total_quizzes=0,
            strongest=None,
            weakest=None,
            generated_at=datetime.now().isoformat(),
        )

    # Fetch quiz details for category mapping
    quiz_ids = set(h.quizId for h in history)
    details = {}
    for qid in quiz_ids:
        quiz = await quiz_client.get_quiz_details(qid)
        if quiz:
            details[qid] = quiz

    # Compute progress
    tracker = ProgressTracker()
    report = tracker.compute_progress(user_id, history, details)

    # Get spaced repetition due reviews
    sr_scheduler = SpacedRepetitionScheduler()
    items = await load_schedule(user_id)
    now = datetime.now()

    due_items = sr_scheduler.get_due_reviews(items, as_of=now)
    upcoming_items = sr_scheduler.get_upcoming_reviews(items, within_hours=24, as_of=now)

    due_reviews = [
        DueReviewResponse(
            category=item.category,
            days_overdue=max(0, (now - item.next_review).total_seconds() / 86400),
            priority="high" if (now - item.next_review).days > 1 else "normal",
            last_score=item.last_score,
        )
        for item in due_items
    ]

    upcoming_reviews = [
        DueReviewResponse(
            category=item.category,
            days_overdue=0,
            priority="normal",
            last_score=item.last_score,
        )
        for item in upcoming_items
    ]

    return ProgressResponse(
        user_id=report.user_id,
        overall_mastery=report.overall_mastery,
        categories=[
            CategoryMasteryResponse(
                category=c.category,
                mastery_level=c.mastery_level,
                accuracy=c.accuracy,
                trend=c.trend,
                total_attempts=c.total_attempts,
                streak=c.streak,
            )
            for c in report.categories
        ],
        velocities=[
            VelocityResponse(
                category=v.category,
                velocity=v.velocity,
                direction=v.direction,
            )
            for v in report.velocities
        ],
        due_reviews=due_reviews,
        upcoming_reviews=upcoming_reviews,
        study_streak=report.study_streak,
        total_quizzes=report.total_quizzes_taken,
        strongest=report.strongest_category,
        weakest=report.weakest_category,
        generated_at=report.generated_at.isoformat(),
    )
