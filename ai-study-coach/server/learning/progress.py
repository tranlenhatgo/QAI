"""Progress tracking — computes learning metrics from quiz history."""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from server.models.schemas import TakeQuizResponse, QuizResponse

logger = logging.getLogger(__name__)


@dataclass
class CategoryMastery:
    """Mastery metrics for a single category."""

    category: str
    mastery_level: float  # 0.0 – 1.0 weighted score
    total_attempts: int
    total_correct: int
    total_questions: int
    accuracy: float  # simple correct/total
    trend: str  # "improving", "stable", "declining"
    last_attempt: datetime | None
    streak: int  # Consecutive quizzes with accuracy >= 60%


@dataclass
class LearningVelocity:
    """Rate of improvement over time."""

    category: str
    velocity: float  # Change in accuracy per week
    direction: str  # "accelerating", "steady", "decelerating"


@dataclass
class ProgressReport:
    """Complete progress report for a student."""

    user_id: str
    overall_mastery: float
    categories: list[CategoryMastery]
    velocities: list[LearningVelocity]
    study_streak: int
    total_quizzes_taken: int
    total_time_active_days: int
    strongest_category: str | None
    weakest_category: str | None
    generated_at: datetime


def _parse_score(score: str) -> tuple[int, int]:
    """Parse score string like '3/5' into (correct, total)."""
    try:
        parts = score.split("/")
        return int(parts[0]), int(parts[1])
    except (ValueError, IndexError):
        return 0, 0


class ProgressTracker:
    """Computes learning progress metrics from quiz history."""

    def compute_progress(
        self,
        user_id: str,
        quiz_history: list[TakeQuizResponse],
        quiz_details: dict[str, QuizResponse],
    ) -> ProgressReport:
        """Compute complete progress report from quiz history."""
        if not quiz_history:
            return ProgressReport(
                user_id=user_id,
                overall_mastery=0.0,
                categories=[],
                velocities=[],
                study_streak=0,
                total_quizzes_taken=0,
                total_time_active_days=0,
                strongest_category=None,
                weakest_category=None,
                generated_at=datetime.now(),
            )

        # Group attempts by category: {category: [(accuracy, timestamp)]}
        category_attempts: dict[str, list[tuple[float, datetime]]] = {}

        for attempt in quiz_history:
            correct, total = _parse_score(attempt.score)
            if total == 0:
                continue

            accuracy = correct / total
            try:
                timestamp = datetime.fromisoformat(attempt.updatedAt.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                timestamp = datetime.now()

            # Get categories from quiz details
            quiz = quiz_details.get(attempt.quizId)
            categories = quiz.categories if quiz and quiz.categories else ["general"]

            for cat in categories:
                cat_lower = cat.lower()
                if cat_lower not in category_attempts:
                    category_attempts[cat_lower] = []
                category_attempts[cat_lower].append((accuracy, timestamp))

        # Compute mastery per category
        category_masteries: list[CategoryMastery] = []
        category_velocities: list[LearningVelocity] = []

        for cat, attempts in category_attempts.items():
            attempts.sort(key=lambda x: x[1])  # Sort by time
            mastery = self.compute_category_mastery(cat, attempts)
            category_masteries.append(mastery)

            velocity = self.compute_velocity(attempts)
            velocity.category = cat
            category_velocities.append(velocity)

        # Overall mastery (weighted average by attempt count)
        if category_masteries:
            total_weight = sum(m.total_attempts for m in category_masteries)
            if total_weight > 0:
                overall = sum(
                    m.mastery_level * m.total_attempts for m in category_masteries
                ) / total_weight
            else:
                overall = 0.0
        else:
            overall = 0.0

        # Strongest and weakest
        sorted_cats = sorted(category_masteries, key=lambda m: m.mastery_level)
        strongest = sorted_cats[-1].category if sorted_cats else None
        weakest = sorted_cats[0].category if sorted_cats else None

        # Study streak
        study_streak = self.compute_study_streak(quiz_history)

        # Active days
        dates = set()
        for attempt in quiz_history:
            try:
                dt = datetime.fromisoformat(attempt.updatedAt.replace("Z", "+00:00"))
                dates.add(dt.date())
            except (ValueError, AttributeError):
                pass

        return ProgressReport(
            user_id=user_id,
            overall_mastery=round(overall, 3),
            categories=category_masteries,
            velocities=category_velocities,
            study_streak=study_streak,
            total_quizzes_taken=len(quiz_history),
            total_time_active_days=len(dates),
            strongest_category=strongest,
            weakest_category=weakest,
            generated_at=datetime.now(),
        )

    def compute_category_mastery(
        self,
        category: str,
        attempts: list[tuple[float, datetime]],
    ) -> CategoryMastery:
        """Compute mastery using exponentially weighted recency (decay 0.85/week)."""
        if not attempts:
            return CategoryMastery(
                category=category,
                mastery_level=0.0,
                total_attempts=0,
                total_correct=0,
                total_questions=0,
                accuracy=0.0,
                trend="stable",
                last_attempt=None,
                streak=0,
            )

        now = datetime.now()
        decay_factor = 0.85

        weighted_sum = 0.0
        weight_total = 0.0

        for score, timestamp in attempts:
            days_ago = max((now - timestamp).total_seconds() / 86400, 0)
            weight = decay_factor ** (days_ago / 7)
            weighted_sum += score * weight
            weight_total += weight

        mastery = weighted_sum / weight_total if weight_total > 0 else 0.0

        # Compute trend from last 4 attempts
        trend = self._compute_trend(attempts[-4:]) if len(attempts) >= 2 else "stable"

        # Compute streak (consecutive passing attempts >= 60%)
        streak = 0
        for score, _ in reversed(attempts):
            if score >= 0.6:
                streak += 1
            else:
                break

        # Total correct (count attempts with >= 50% as "correct" for stats)
        total_correct = sum(1 for s, _ in attempts if s >= 0.5)

        return CategoryMastery(
            category=category,
            mastery_level=round(mastery, 3),
            total_attempts=len(attempts),
            total_correct=total_correct,
            total_questions=len(attempts),
            accuracy=round(sum(s for s, _ in attempts) / len(attempts), 3),
            trend=trend,
            last_attempt=attempts[-1][1],
            streak=streak,
        )

    def _compute_trend(self, recent_attempts: list[tuple[float, datetime]]) -> str:
        """Compute trend from recent attempts."""
        if len(recent_attempts) < 2:
            return "stable"

        mid = len(recent_attempts) // 2
        older_avg = sum(s for s, _ in recent_attempts[:mid]) / mid
        recent_avg = sum(s for s, _ in recent_attempts[mid:]) / (len(recent_attempts) - mid)

        diff = recent_avg - older_avg
        if diff > 0.05:
            return "improving"
        elif diff < -0.05:
            return "declining"
        return "stable"

    def compute_velocity(
        self,
        attempts: list[tuple[float, datetime]],
        window_weeks: int = 4,
    ) -> LearningVelocity:
        """Compute rate of improvement (velocity = change per week)."""
        if len(attempts) < 3:
            return LearningVelocity(category="", velocity=0.0, direction="steady")

        mid = len(attempts) // 2
        older = attempts[:mid]
        recent = attempts[mid:]

        older_avg = sum(s for s, _ in older) / len(older)
        recent_avg = sum(s for s, _ in recent) / len(recent)

        time_span = (recent[-1][1] - older[0][1]).total_seconds() / (7 * 86400)
        if time_span < 0.01:
            time_span = 1.0

        velocity = (recent_avg - older_avg) / time_span

        if velocity > 0.05:
            direction = "accelerating"
        elif velocity < -0.05:
            direction = "decelerating"
        else:
            direction = "steady"

        return LearningVelocity(
            category="",
            velocity=round(velocity, 4),
            direction=direction,
        )

    def compute_study_streak(self, quiz_history: list[TakeQuizResponse]) -> int:
        """Count consecutive days (backwards from today) with at least one attempt."""
        if not quiz_history:
            return 0

        dates = set()
        for h in quiz_history:
            try:
                dt = datetime.fromisoformat(h.updatedAt.replace("Z", "+00:00"))
                dates.add(dt.date())
            except (ValueError, AttributeError):
                continue

        if not dates:
            return 0

        sorted_dates = sorted(dates, reverse=True)
        today = datetime.now().date()
        streak = 0

        for i, date in enumerate(sorted_dates):
            expected_date = today - timedelta(days=i)
            if date == expected_date:
                streak += 1
            else:
                break

        return streak
