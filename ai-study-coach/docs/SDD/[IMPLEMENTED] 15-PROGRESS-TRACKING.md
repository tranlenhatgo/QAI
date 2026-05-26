# 15 — Progress Tracking

## Purpose

Implement a progress tracking system that computes learning metrics (mastery level, learning velocity, improvement trends) from quiz performance history. Provides data for the AI Coach dashboard and coaching recommendations.

**Status: ✅ Implemented** — `server/learning/progress.py` with exponential-decay mastery, velocity, streak. Endpoint `GET /progress/{user_id}` integrates with quiz history from Spring Boot. Tests in `tests/test_learning.py`.

**Reference**: DeepTutor's `deeptutor/knowledge/progress_tracker.py` uses a stage-based tracker with percentage progress, callbacks, and WebSocket broadcasting. The `ProgressBroadcaster` pattern streams updates to connected clients.

---

## Interface Contract

```python
# server/learning/progress.py

from dataclasses import dataclass
from datetime import datetime

@dataclass
class CategoryMastery:
    """Mastery metrics for a single category."""
    category: str
    mastery_level: float       # 0.0 – 1.0 weighted score
    total_attempts: int
    total_correct: int
    total_questions: int
    accuracy: float            # simple correct/total
    trend: str                 # "improving", "stable", "declining"
    last_attempt: datetime | None
    streak: int                # Consecutive quizzes with accuracy >= 60%

@dataclass
class LearningVelocity:
    """Rate of improvement over time."""
    category: str
    velocity: float            # Change in accuracy per week
    direction: str             # "accelerating", "steady", "decelerating"

@dataclass
class ProgressReport:
    """Complete progress report for a student."""
    user_id: str
    overall_mastery: float     # Weighted average across categories
    categories: list[CategoryMastery]
    velocities: list[LearningVelocity]
    study_streak: int          # Consecutive days with activity
    total_quizzes_taken: int
    total_time_active_days: int
    strongest_category: str | None
    weakest_category: str | None
    generated_at: datetime

class ProgressTracker:
    """Computes learning progress metrics from quiz history."""
    
    def compute_progress(
        self,
        quiz_history: list[TakeQuizResponse],
        quiz_details: dict[str, QuizResponse],
    ) -> ProgressReport:
        """
        Compute complete progress report from quiz history.
        
        Args:
            quiz_history: All quiz attempts (from Spring Boot)
            quiz_details: Quiz metadata keyed by quiz_id
            
        Returns:
            ProgressReport with mastery, velocity, and trends
        """
    
    def compute_category_mastery(
        self,
        category: str,
        attempts: list[tuple[float, datetime]],  # (accuracy, timestamp)
    ) -> CategoryMastery:
        """Compute mastery for a single category using weighted scoring."""
    
    def compute_velocity(
        self,
        attempts: list[tuple[float, datetime]],
        window_weeks: int = 4,
    ) -> LearningVelocity:
        """Compute learning velocity (rate of improvement)."""
    
    def compute_study_streak(
        self,
        quiz_history: list[TakeQuizResponse],
    ) -> int:
        """Count consecutive days with at least one quiz attempt."""
```

---

## Data Shapes (Pydantic for API)

```python
from pydantic import BaseModel
from datetime import datetime

class CategoryMasteryResponse(BaseModel):
    category: str
    mastery_level: float
    accuracy: float
    trend: str
    total_attempts: int
    streak: int

class ProgressResponse(BaseModel):
    user_id: str
    overall_mastery: float
    categories: list[CategoryMasteryResponse]
    study_streak: int
    total_quizzes: int
    strongest: str | None
    weakest: str | None
    generated_at: datetime
```

---

## Behavior Specification

### Mastery Calculation (Weighted Recency)

```python
def compute_category_mastery(self, category: str, 
                             attempts: list[tuple[float, datetime]]) -> CategoryMastery:
    """
    Compute mastery using exponentially weighted recency.
    
    Recent quiz scores count more than older ones:
        weight = decay_factor ^ (days_since_attempt / 7)
        decay_factor = 0.85 (15% decay per week)
    
    mastery = sum(score * weight) / sum(weight)
    
    This ensures:
        - A student who scored 100% last week and 50% today ≈ 60% mastery
        - A student who scored 50% months ago but 100% recently ≈ 90% mastery
    """
    if not attempts:
        return CategoryMastery(
            category=category, mastery_level=0.0, total_attempts=0,
            total_correct=0, total_questions=0, accuracy=0.0,
            trend="stable", last_attempt=None, streak=0,
        )
    
    now = datetime.now()
    decay_factor = 0.85
    
    weighted_sum = 0.0
    weight_total = 0.0
    
    for score, timestamp in attempts:
        days_ago = (now - timestamp).days
        weight = decay_factor ** (days_ago / 7)
        weighted_sum += score * weight
        weight_total += weight
    
    mastery = weighted_sum / weight_total if weight_total > 0 else 0.0
    
    # Compute trend from last 4 attempts
    trend = self._compute_trend(attempts[-4:]) if len(attempts) >= 2 else "stable"
    
    # Compute streak (consecutive attempts with accuracy >= 60%)
    streak = 0
    for score, _ in reversed(attempts):
        if score >= 0.6:
            streak += 1
        else:
            break
    
    return CategoryMastery(
        category=category,
        mastery_level=round(mastery, 3),
        total_attempts=len(attempts),
        total_correct=sum(1 for s, _ in attempts if s >= 0.6),
        total_questions=len(attempts),
        accuracy=round(sum(s for s, _ in attempts) / len(attempts), 3),
        trend=trend,
        last_attempt=attempts[-1][1],
        streak=streak,
    )
```

### Learning Velocity

```python
def compute_velocity(self, attempts: list[tuple[float, datetime]], 
                     window_weeks: int = 4) -> LearningVelocity:
    """
    Compute rate of improvement.
    
    velocity = (recent_avg - older_avg) / time_span_weeks
    
    Positive velocity = improving
    Near-zero velocity = stable
    Negative velocity = declining
    """
    if len(attempts) < 3:
        return LearningVelocity(category="", velocity=0.0, direction="steady")
    
    # Split into recent half and older half
    mid = len(attempts) // 2
    older = attempts[:mid]
    recent = attempts[mid:]
    
    older_avg = sum(s for s, _ in older) / len(older)
    recent_avg = sum(s for s, _ in recent) / len(recent)
    
    # Time span in weeks
    time_span = (recent[-1][1] - older[0][1]).days / 7
    if time_span == 0:
        time_span = 1
    
    velocity = (recent_avg - older_avg) / time_span
    
    if velocity > 0.05:
        direction = "accelerating"
    elif velocity < -0.05:
        direction = "decelerating"
    else:
        direction = "steady"
    
    return LearningVelocity(
        category="",  # Set by caller
        velocity=round(velocity, 4),
        direction=direction,
    )
```

### Study Streak

```python
def compute_study_streak(self, quiz_history: list[TakeQuizResponse]) -> int:
    """
    Count consecutive days (backwards from today) with at least one attempt.
    
    Example:
        Today: 1 quiz → streak continues
        Yesterday: 2 quizzes → streak continues
        2 days ago: 0 quizzes → streak = 2
    """
    if not quiz_history:
        return 0
    
    # Get unique activity dates (sorted descending)
    dates = sorted(set(
        datetime.fromisoformat(h.updatedAt).date() 
        for h in quiz_history
    ), reverse=True)
    
    today = datetime.now().date()
    streak = 0
    
    for i, date in enumerate(dates):
        expected_date = today - timedelta(days=i)
        if date == expected_date:
            streak += 1
        else:
            break
    
    return streak
```

---

## REST Endpoint

```python
# server/routes/progress.py

@router.get("/progress/{user_id}")
async def get_progress(user_id: str) -> ProgressResponse:
    """Get complete progress report for a student."""
    
    # Fetch quiz history from Spring Boot
    history = await quiz_client.get_player_history(user_id)
    
    # Fetch quiz details for category mapping
    quiz_ids = set(h.quizId for h in history)
    details = {}
    for qid in quiz_ids:
        details[qid] = await quiz_client.get_quiz_details(qid)
    
    # Compute progress
    tracker = ProgressTracker()
    report = tracker.compute_progress(history, details)
    
    return ProgressResponse(
        user_id=report.user_id,
        overall_mastery=report.overall_mastery,
        categories=[CategoryMasteryResponse(...) for c in report.categories],
        study_streak=report.study_streak,
        total_quizzes=report.total_quizzes_taken,
        strongest=report.strongest_category,
        weakest=report.weakest_category,
        generated_at=report.generated_at,
    )
```

---

## Integration with AI Coach

The progress tracker feeds into coaching context:

```python
# In agent/prompts.py — context builder
def build_progress_context(progress: ProgressReport) -> str:
    """Format progress data for system prompt."""
    lines = [f"Student Progress (overall mastery: {progress.overall_mastery:.0%}):"]
    for cat in sorted(progress.categories, key=lambda c: c.mastery_level):
        emoji = "🟢" if cat.mastery_level >= 0.8 else "🟡" if cat.mastery_level >= 0.6 else "🔴"
        lines.append(f"  {emoji} {cat.category}: {cat.mastery_level:.0%} ({cat.trend})")
    if progress.study_streak > 0:
        lines.append(f"  📅 Study streak: {progress.study_streak} days")
    return "\n".join(lines)
```

---

## Acceptance Criteria

- [ ] Mastery calculation uses exponential decay weighting (recent scores matter more)
- [ ] Velocity correctly identifies improving/stable/declining trends
- [ ] Study streak counts consecutive active days correctly
- [ ] Overall mastery is weighted average across all attempted categories
- [ ] `GET /progress/{user_id}` returns structured ProgressResponse
- [ ] Categories without attempts are excluded from report
- [ ] Works with empty quiz history (returns zeros, no errors)
- [ ] Integrates with AI Coach context (system prompt includes progress summary)
- [ ] Strongest/weakest categories correctly identified
