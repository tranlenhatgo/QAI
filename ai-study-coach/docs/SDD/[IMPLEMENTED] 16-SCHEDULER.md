# 16 — Background Scheduler

## Purpose

Implement a background task scheduler that runs periodic jobs: checking for due spaced repetition reviews, computing daily progress snapshots, and sending coaching nudges. Uses APScheduler (already in requirements.txt).

**Status: ✅ Implemented** — `server/scheduler/scheduler.py` with APScheduler AsyncIOScheduler. Hourly due-review check + daily progress snapshot (cron at 2 AM). Notifications stored to Firestore via Spring Boot `/notification/` API.

**Reference**: DeepTutor's `deeptutor/events/event_bus.py` provides async publish/subscribe for event-driven task triggering. The `KnowledgeTaskStreamManager` shows backlog + reconnection patterns for long-running tasks.

---

## Interface Contract

```python
# server/scheduler/scheduler.py

from apscheduler.schedulers.asyncio import AsyncIOScheduler

class CoachScheduler:
    """Background task scheduler for recurring AI Coach jobs."""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self._register_jobs()
    
    def start(self) -> None:
        """Start the scheduler (called during app lifespan startup)."""
        self.scheduler.start()
    
    def shutdown(self) -> None:
        """Graceful shutdown (called during app lifespan shutdown)."""
        self.scheduler.shutdown(wait=True)
    
    def _register_jobs(self) -> None:
        """Register all periodic jobs."""
        # Check due reviews every hour
        self.scheduler.add_job(
            check_due_reviews,
            trigger="interval",
            hours=1,
            id="check_due_reviews",
        )
        
        # Compute daily progress snapshot at 2 AM
        self.scheduler.add_job(
            compute_daily_progress,
            trigger="cron",
            hour=2,
            id="daily_progress_snapshot",
        )
```

---

## Data Shapes

```python
from pydantic import BaseModel
from datetime import datetime
from enum import Enum

class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class ScheduledJob(BaseModel):
    """Metadata about a scheduled job execution."""
    job_id: str
    job_name: str
    status: JobStatus
    started_at: datetime | None = None
    completed_at: datetime | None = None
    result: str | None = None
    error: str | None = None

class ReviewNotification(BaseModel):
    """Notification to send when reviews are due."""
    user_id: str
    due_categories: list[str]
    message: str
    priority: str            # "high" (overdue), "normal" (due today)
```

---

## Behavior Specification

### Job 1: Check Due Reviews

```python
# server/scheduler/jobs.py

async def check_due_reviews():
    """
    Periodic job: check all users for due spaced repetition reviews.
    
    Runs every hour. For each user with due reviews:
    1. Load their review schedule
    2. Identify overdue items
    3. Queue notification (for future WebSocket push or email)
    4. Log for Coach context (so next chat session mentions due reviews)
    """
    from server.learning.spaced_repetition import SpacedRepetitionScheduler, load_all_schedules
    
    scheduler = SpacedRepetitionScheduler()
    all_schedules = await load_all_schedules()
    
    for user_id, schedule in all_schedules.items():
        due_items = scheduler.get_due_reviews(schedule.items)
        
        if due_items:
            notification = ReviewNotification(
                user_id=user_id,
                due_categories=[item.category for item in due_items],
                message=f"You have {len(due_items)} topic(s) due for review: {', '.join(item.category for item in due_items)}",
                priority="high" if any(
                    (datetime.now() - item.next_review).days > 1 for item in due_items
                ) else "normal",
            )
            await store_notification(user_id, notification)
```

### Job 2: Daily Progress Snapshot

```python
async def compute_daily_progress():
    """
    Daily job: compute and store progress snapshots for analytics.
    
    Runs at 2 AM. For each active user (activity in last 7 days):
    1. Fetch quiz history
    2. Compute full progress report
    3. Store snapshot for historical comparison
    """
    from server.learning.progress import ProgressTracker
    from server.quiz_client.client import quiz_client
    
    tracker = ProgressTracker()
    active_users = await get_recently_active_users(days=7)
    
    for user_id in active_users:
        try:
            history = await quiz_client.get_player_history(user_id)
            if not history:
                continue
            
            quiz_details = await fetch_quiz_details_batch(history)
            report = tracker.compute_progress(history, quiz_details)
            
            await store_progress_snapshot(user_id, report)
        except Exception as e:
            logger.error(f"Progress snapshot failed for {user_id}: {e}")
```

### App Lifespan Integration

```python
# server/main.py — integrate with FastAPI lifespan

from server.scheduler.scheduler import CoachScheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    scheduler = CoachScheduler()
    scheduler.start()
    app.state.scheduler = scheduler
    yield
    # Shutdown
    scheduler.shutdown()
```

---

## Notification Storage (Simple)

```python
# server/scheduler/notifications.py

from collections import defaultdict
from datetime import datetime

# In-memory store (MVP) — replace with SQLite/Redis for production
_pending_notifications: dict[str, list[ReviewNotification]] = defaultdict(list)

async def store_notification(user_id: str, notification: ReviewNotification):
    """Store notification for retrieval during next chat session."""
    _pending_notifications[user_id].append(notification)

async def get_pending_notifications(user_id: str) -> list[ReviewNotification]:
    """Get and clear pending notifications for a user."""
    notifications = _pending_notifications.pop(user_id, [])
    return notifications
```

### Integration with Chat

```python
# In agent/coach.py — at start of handle_chat_agentic()
notifications = await get_pending_notifications(request.user_id)
if notifications:
    # Prepend to system context
    context += f"\n\n⚠️ PENDING REVIEWS: {notifications[0].message}"
    # This makes the Coach proactively mention due reviews
```

---

## Configuration

```python
class Settings(BaseSettings):
    # ... existing ...
    
    # Scheduler
    scheduler_enabled: bool = True           # Disable in tests
    review_check_interval_hours: int = 1     # How often to check due reviews
    progress_snapshot_hour: int = 2          # Hour (0-23) for daily snapshot
```

Environment variables:

```bash
COACH_SCHEDULER_ENABLED=true
COACH_REVIEW_CHECK_INTERVAL_HOURS=1
COACH_PROGRESS_SNAPSHOT_HOUR=2
```

---

## Dependencies

Already in `requirements.txt`:

```text
APScheduler>=3.11.0
```

---

## Acceptance Criteria

- [ ] Scheduler starts on app startup and stops on shutdown
- [ ] Due review check runs every hour (configurable)
- [ ] Daily progress snapshot runs at configured hour
- [ ] Jobs handle errors gracefully (log and continue, don't crash)
- [ ] Notifications stored and retrievable per user
- [ ] Coach mentions pending reviews at start of next conversation
- [ ] Scheduler can be disabled via config (for testing)
- [ ] Jobs don't block the main event loop (async)
- [ ] Multiple server instances don't duplicate job execution [TODO: needs confirmation — single instance assumed for MVP]
