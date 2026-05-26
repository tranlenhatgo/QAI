"""Background scheduler — periodic jobs for review checks and progress snapshots."""

import logging
from datetime import datetime, timedelta
from collections import defaultdict

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from server.config import settings

logger = logging.getLogger(__name__)


class CoachScheduler:
    """Background task scheduler for recurring AI Coach jobs."""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self._register_jobs()

    def start(self) -> None:
        """Start the scheduler (called during app lifespan startup)."""
        if not settings.scheduler_enabled:
            logger.info("📅 Scheduler disabled via config")
            return
        self.scheduler.start()
        logger.info("📅 Scheduler started — jobs registered")

    def shutdown(self) -> None:
        """Graceful shutdown (called during app lifespan shutdown)."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("📅 Scheduler shut down")

    def _register_jobs(self) -> None:
        """Register all periodic jobs."""
        self.scheduler.add_job(
            check_due_reviews,
            trigger="interval",
            hours=settings.review_check_interval_hours,
            id="check_due_reviews",
            replace_existing=True,
        )

        self.scheduler.add_job(
            compute_daily_progress,
            trigger="cron",
            hour=settings.progress_snapshot_hour,
            id="daily_progress_snapshot",
            replace_existing=True,
        )


# ─── Notification Storage (Firestore-backed via Spring Boot) ─────────────────

_BASE_URL = settings.quiz_api_url


async def store_notification(user_id: str, notification: dict) -> None:
    """Store notification to Firestore via Spring Boot API."""
    try:
        payload = {
            "user_id": user_id,
            "type": notification.get("type", "REVIEW_DUE"),
            "title": notification.get("type", "Review Due").replace("_", " ").title(),
            "message": notification.get("message", ""),
            "expires_at": (datetime.now() + timedelta(days=7)).isoformat() + "Z",
        }
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(f"{_BASE_URL}/notification", json=payload)
    except httpx.HTTPError as e:
        logger.warning("Failed to store notification for user=%s: %s", user_id, e)


async def get_pending_notifications(user_id: str) -> list[dict]:
    """Get unread notifications for a user from Firestore."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{_BASE_URL}/notification/user/{user_id}/unread")
            if resp.status_code == 200:
                notifications = resp.json()
                # Mark them as read
                for n in notifications:
                    if n.get("id"):
                        await client.patch(f"{_BASE_URL}/notification/{n['id']}/read")
                return notifications
            return []
    except httpx.HTTPError as e:
        logger.warning("Failed to get notifications for user=%s: %s", user_id, e)
        return []


# ─── Job Implementations ─────────────────────────────────────────────────────


async def check_due_reviews() -> None:
    """
    Periodic job: check all users for due spaced repetition reviews.
    Runs every hour. Stores notifications for users with due items.
    """
    from server.learning.spaced_repetition import (
        SpacedRepetitionScheduler,
        load_all_schedules,
    )

    try:
        scheduler = SpacedRepetitionScheduler()
        all_schedules = await load_all_schedules()

        for user_id, items in all_schedules.items():
            due_items = scheduler.get_due_reviews(items)

            if due_items:
                due_categories = [item.category for item in due_items]
                overdue = any(
                    (datetime.now() - item.next_review).days > 1 for item in due_items
                )
                notification = {
                    "type": "due_reviews",
                    "due_categories": due_categories,
                    "message": f"You have {len(due_items)} topic(s) due for review: {', '.join(due_categories)}",
                    "priority": "high" if overdue else "normal",
                    "timestamp": datetime.now().isoformat(),
                }
                await store_notification(user_id, notification)

        logger.info(f"📅 Due review check complete — {len(all_schedules)} users scanned")
    except Exception as e:
        logger.error(f"📅 Due review check failed: {e}")


async def compute_daily_progress() -> None:
    """
    Daily job: compute and store progress snapshots for analytics.
    Runs at configured hour (default 2 AM).
    """
    from server.learning.spaced_repetition import load_all_schedules

    try:
        all_schedules = await load_all_schedules()
        active_users = list(all_schedules.keys())

        logger.info(
            f"📅 Daily progress snapshot — {len(active_users)} active users"
        )
        # In MVP, progress is computed on-demand via the /progress endpoint.
        # This job serves as a placeholder for future persistent snapshots.
    except Exception as e:
        logger.error(f"📅 Daily progress snapshot failed: {e}")
