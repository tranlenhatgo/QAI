# 14 — Spaced Repetition

## Purpose

Implement a spaced repetition scheduling system that determines when students should review specific topics based on their quiz performance history. Uses the SM-2 algorithm adapted for category-level mastery tracking.

**Status: ✅ Implemented** — `server/learning/spaced_repetition.py` with SM-2 algorithm. Storage persisted to Firestore `review_schedule` collection via Spring Boot REST API (`/review-schedule/`). Tests in `tests/test_learning.py`.

**Design constraint**: Each quiz has exactly 1 category (enforced by frontend and backend validation). This means each quiz completion maps unambiguously to one category for SM-2 scheduling — no multi-category splitting of scores. Categories are always lowercase strings (e.g., `"math"`, `"science"`).

**Reference**: DeepTutor's `deeptutor/knowledge/progress_tracker.py` demonstrates stage-based progress tracking with callbacks and persistence. The event bus pattern (`deeptutor/events/event_bus.py`) provides the publish/subscribe model for triggering reviews.

---

## Interface Contract

```python
# server/learning/spaced_repetition.py

from dataclasses import dataclass
from datetime import datetime, timedelta

@dataclass
class ReviewItem:
    """A single item scheduled for review."""
    category: str
    next_review: datetime
    interval_days: float
    easiness: float          # SM-2 easiness factor (1.3 – 2.5)
    repetitions: int         # Consecutive correct reviews
    last_score: float        # Last quiz accuracy (0.0 – 1.0)

class SpacedRepetitionScheduler:
    """SM-2 based scheduler adapted for category-level quiz mastery."""
    
    def compute_next_review(
        self,
        category: str,
        score: float,           # Latest quiz accuracy (0.0 – 1.0)
        current_item: ReviewItem | None = None,
    ) -> ReviewItem:
        """
        Compute next review date using SM-2 algorithm.
        
        Args:
            category: Quiz category name
            score: Latest quiz accuracy (0.0 = all wrong, 1.0 = all correct)
            current_item: Existing review item (None for first attempt)
            
        Returns:
            Updated ReviewItem with next_review date
        """
    
    def get_due_reviews(
        self,
        items: list[ReviewItem],
        as_of: datetime | None = None,
    ) -> list[ReviewItem]:
        """
        Get all review items that are due (next_review <= now).
        
        Returns items sorted by urgency (most overdue first).
        """
    
    def update_after_quiz(
        self,
        items: list[ReviewItem],
        category: str,
        score: float,
    ) -> list[ReviewItem]:
        """
        Update the review schedule after a quiz completion.
        
        Returns full list with the updated item.
        """
```

---

## Data Shapes

```python
from pydantic import BaseModel
from datetime import datetime

class ReviewSchedule(BaseModel):
    """Persistent review schedule for a user."""
    user_id: str
    items: list[ReviewItemModel]
    last_updated: datetime

class ReviewItemModel(BaseModel):
    """Pydantic model for API serialization."""
    category: str
    next_review: datetime
    interval_days: float
    easiness: float
    repetitions: int
    last_score: float

class DueReviewsResponse(BaseModel):
    """Response from the due reviews check."""
    due: list[ReviewItemModel]
    upcoming: list[ReviewItemModel]    # Due within next 24h
    total_items: int
```

---

## Behavior Specification

### SM-2 Algorithm (Adapted for Quiz Categories)

```python
def compute_next_review(self, category: str, score: float, 
                        current_item: ReviewItem | None = None) -> ReviewItem:
    """
    SM-2 algorithm adapted for category mastery:
    
    quality = score mapped to 0-5 scale:
        score >= 0.9  → quality = 5 (perfect)
        score >= 0.8  → quality = 4 (good)
        score >= 0.6  → quality = 3 (acceptable)
        score >= 0.4  → quality = 2 (difficult)
        score >= 0.2  → quality = 1 (very difficult)
        score < 0.2   → quality = 0 (complete failure)
    
    If quality >= 3 (passing):
        repetitions += 1
        interval:
            rep 1 → 1 day
            rep 2 → 3 days
            rep 3+ → previous_interval * easiness
        easiness = max(1.3, easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
    
    If quality < 3 (failing):
        repetitions = 0
        interval = 0.5 days (review again in 12 hours)
        easiness unchanged
    """
    
    if current_item is None:
        current_item = ReviewItem(
            category=category,
            next_review=datetime.now(),
            interval_days=0,
            easiness=2.5,        # SM-2 default
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
        interval = 0.5    # 12 hours
        easiness = current_item.easiness
    
    return ReviewItem(
        category=category,
        next_review=datetime.now() + timedelta(days=interval),
        interval_days=interval,
        easiness=easiness,
        repetitions=reps,
        last_score=score,
    )

def _score_to_quality(self, score: float) -> int:
    """Map quiz accuracy (0.0-1.0) to SM-2 quality (0-5)."""
    if score >= 0.9: return 5
    if score >= 0.8: return 4
    if score >= 0.6: return 3
    if score >= 0.4: return 2
    if score >= 0.2: return 1
    return 0
```

### Integration with Quiz Completion

```python
# Called when a quiz is completed (from webhook or post-quiz analysis)
async def on_quiz_completed(user_id: str, category: str, score: str):
    """
    Update spaced repetition schedule after quiz completion.
    
    Args:
        user_id: Student identifier
        category: Quiz category (e.g., "math", "science")
        score: Score string in "correct/total" format
    """
    correct, total = _parse_score(score)
    accuracy = correct / total if total > 0 else 0.0
    
    # Load user's current schedule
    schedule = await load_schedule(user_id)
    
    # Find or create review item for this category
    item = next((i for i in schedule.items if i.category == category), None)
    
    # Compute next review
    scheduler = SpacedRepetitionScheduler()
    updated_item = scheduler.compute_next_review(category, accuracy, item)
    
    # Save updated schedule
    schedule.items = scheduler.update_after_quiz(schedule.items, category, accuracy)
    await save_schedule(user_id, schedule)
    
    return updated_item
```

### Storage

```python
# Storage options (choose one):

# Option A: SQLite (simple, local)
# Table: review_schedules
# Columns: user_id, category, next_review, interval_days, easiness, repetitions, last_score, updated_at

# Option B: In-memory dict (dev/MVP)
_schedules: dict[str, ReviewSchedule] = {}

# Option C: Firestore (if sharing with Spring Boot)
# Collection: review_schedule
# Document: {user_id}_{category}
```

---

## Integration Points

### 1. ChatResponse.due_reviews (already exists, never populated)

```python
# In agent/coach.py — after weakness analysis
scheduler = SpacedRepetitionScheduler()
schedule = await load_schedule(request.user_id)
due = scheduler.get_due_reviews(schedule.items)

return ChatResponse(
    content=response_content,
    weaknesses=weakness_report.weakest_categories,
    due_reviews=[item.category for item in due],  # ← NOW POPULATED
)
```

### 2. Agentic Tool Integration

```python
# New tool: check_review_schedule
{
    "name": "check_review_schedule",
    "description": "Check which topics the student should review today based on spaced repetition scheduling.",
    "parameters": {
        "type": "object",
        "properties": {},
        "required": []
    }
}
```

---

## Configuration

```python
class Settings(BaseSettings):
    # ... existing ...
    
    # Spaced Repetition
    sr_default_easiness: float = 2.5
    sr_min_easiness: float = 1.3
    sr_passing_threshold: float = 0.6   # Score >= 60% counts as "passing"
```

---

## Acceptance Criteria

- [ ] SM-2 algorithm correctly computes next review date
- [ ] Passing quiz (≥ 60%) increases interval and repetitions
- [ ] Failing quiz (< 60%) resets repetitions to 0, interval to 12h
- [ ] Easiness factor stays within [1.3, 2.5] range
- [ ] `get_due_reviews()` returns overdue items sorted by urgency
- [ ] `ChatResponse.due_reviews` field is populated with due category names
- [ ] Schedule persists across server restarts (SQLite or file-based)
- [ ] New categories are automatically added on first quiz attempt
- [ ] Integration with quiz completion flow (manual or webhook-triggered)
