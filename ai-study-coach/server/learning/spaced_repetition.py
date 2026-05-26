"""Spaced repetition scheduler — SM-2 algorithm adapted for category-level mastery."""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict

import httpx

from server.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ReviewItem:
    """A single item scheduled for review."""

    category: str
    next_review: datetime
    interval_days: float
    easiness: float = 2.5  # SM-2 easiness factor (1.3 – 2.5)
    repetitions: int = 0  # Consecutive correct reviews
    last_score: float = 0.0  # Last quiz accuracy (0.0 – 1.0)


class SpacedRepetitionScheduler:
    """SM-2 based scheduler adapted for category-level quiz mastery."""

    def _score_to_quality(self, score: float) -> int:
        """Map quiz accuracy (0.0-1.0) to SM-2 quality (0-5)."""
        if score >= 0.9:
            return 5
        if score >= 0.8:
            return 4
        if score >= 0.6:
            return 3
        if score >= 0.4:
            return 2
        if score >= 0.2:
            return 1
        return 0

    def compute_next_review(
        self,
        category: str,
        score: float,
        current_item: ReviewItem | None = None,
    ) -> ReviewItem:
        """
        Compute next review date using SM-2 algorithm.

        If quality >= 3 (passing): increase interval and repetitions.
        If quality < 3 (failing): reset repetitions, set interval to 12 hours.
        """
        if current_item is None:
            current_item = ReviewItem(
                category=category,
                next_review=datetime.now(),
                interval_days=0,
                easiness=2.5,
                repetitions=0,
                last_score=0.0,
            )

        quality = self._score_to_quality(score)

        if quality >= 3:
            reps = current_item.repetitions + 1
            if reps == 1:
                interval = 1.0
            elif reps == 2:
                interval = 3.0
            else:
                interval = current_item.interval_days * current_item.easiness

            easiness = current_item.easiness + (
                0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
            )
            easiness = max(1.3, easiness)
        else:
            reps = 0
            interval = 0.5  # 12 hours
            easiness = current_item.easiness

        return ReviewItem(
            category=category,
            next_review=datetime.now() + timedelta(days=interval),
            interval_days=interval,
            easiness=easiness,
            repetitions=reps,
            last_score=score,
        )

    def get_due_reviews(
        self,
        items: list[ReviewItem],
        as_of: datetime | None = None,
    ) -> list[ReviewItem]:
        """Get all review items that are due (next_review <= now), sorted by urgency."""
        now = as_of or datetime.now()
        due = [item for item in items if item.next_review <= now]
        due.sort(key=lambda x: x.next_review)
        return due

    def get_upcoming_reviews(
        self,
        items: list[ReviewItem],
        within_hours: int = 24,
        as_of: datetime | None = None,
    ) -> list[ReviewItem]:
        """Get items due within the next N hours (but not yet due)."""
        now = as_of or datetime.now()
        cutoff = now + timedelta(hours=within_hours)
        upcoming = [item for item in items if now < item.next_review <= cutoff]
        upcoming.sort(key=lambda x: x.next_review)
        return upcoming

    def update_after_quiz(
        self,
        items: list[ReviewItem],
        category: str,
        score: float,
    ) -> list[ReviewItem]:
        """Update the review schedule after a quiz completion. Returns full list."""
        existing = next((i for i in items if i.category == category), None)
        updated_item = self.compute_next_review(category, score, existing)

        result = [i for i in items if i.category != category]
        result.append(updated_item)
        return result


# ─── Firestore-Backed Storage (via Spring Boot API) ──────────────────────────

_BASE_URL = settings.quiz_api_url


def _response_to_item(data: dict) -> ReviewItem:
    """Convert Spring Boot ReviewScheduleResponseDto to ReviewItem."""
    next_review = datetime.now()
    if data.get("next_review"):
        try:
            next_review = datetime.fromisoformat(data["next_review"].replace("Z", "+00:00")).replace(tzinfo=None)
        except (ValueError, TypeError):
            pass

    return ReviewItem(
        category=data.get("category", ""),
        next_review=next_review,
        interval_days=data.get("interval_days", 0),
        easiness=data.get("easiness", 2.5),
        repetitions=data.get("repetitions", 0),
        last_score=data.get("last_score", 0.0) if isinstance(data.get("last_score"), (int, float)) else 0.0,
    )


def _item_to_upsert(user_id: str, item: ReviewItem) -> dict:
    """Convert ReviewItem to Spring Boot ReviewScheduleUpsertDto payload."""
    return {
        "user_id": user_id,
        "category": item.category,
        "easiness": item.easiness,
        "interval_days": int(item.interval_days) if item.interval_days >= 1 else 1,
        "repetitions": item.repetitions,
        "next_review": item.next_review.isoformat() + "Z",
        "last_reviewed": datetime.now().isoformat() + "Z",
        "last_score": str(item.last_score) if isinstance(item.last_score, (int, float)) else "0.0",
    }


async def load_schedule(user_id: str) -> list[ReviewItem]:
    """Load user's review schedule from Spring Boot Firestore."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{_BASE_URL}/review-schedule/user/{user_id}")
            if resp.status_code == 200:
                data = resp.json()
                return [_response_to_item(d) for d in data]
            return []
    except httpx.HTTPError as e:
        logger.warning("Failed to load schedule for user=%s: %s", user_id, e)
        return []


async def save_schedule(user_id: str, items: list[ReviewItem]) -> None:
    """Save user's review schedule to Spring Boot Firestore (upsert each item)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            for item in items:
                payload = _item_to_upsert(user_id, item)
                await client.post(f"{_BASE_URL}/review-schedule", json=payload)
    except httpx.HTTPError as e:
        logger.warning("Failed to save schedule for user=%s: %s", user_id, e)


async def load_all_schedules() -> dict[str, list[ReviewItem]]:
    """Load all user schedules — not supported via REST, returns empty for batch."""
    logger.warning("load_all_schedules() not supported with Firestore backend")
    return {}


def _parse_score(score: str) -> tuple[int, int]:
    """Parse score string like '3/5' into (correct, total)."""
    try:
        parts = score.split("/")
        return int(parts[0]), int(parts[1])
    except (ValueError, IndexError):
        return 0, 0


async def on_quiz_completed(user_id: str, category: str, score: str) -> ReviewItem:
    """
    Update spaced repetition schedule after quiz completion.

    Args:
        user_id: Student identifier
        category: Quiz category
        score: Score string in "correct/total" format

    Returns:
        Updated ReviewItem with next review date
    """
    correct, total = _parse_score(score)
    accuracy = correct / total if total > 0 else 0.0

    items = await load_schedule(user_id)

    scheduler = SpacedRepetitionScheduler()
    updated_items = scheduler.update_after_quiz(items, category, accuracy)

    await save_schedule(user_id, updated_items)

    return next(i for i in updated_items if i.category == category)
