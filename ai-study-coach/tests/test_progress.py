"""
Tests for progress.py — progress tracking logic.

Covers:
- Category mastery (exponential decay weighting)
- Trend detection (improving/stable/declining)
- Learning velocity computation
- Study streak calculation
- Full progress report generation
- Edge cases (empty history, zero scores, single attempt)
"""

import sys
from datetime import datetime, timedelta

import pytest

from server.learning.progress import (
    ProgressTracker,
    CategoryMastery,
    LearningVelocity,
    ProgressReport,
    _parse_score,
)
from server.models.schemas import TakeQuizResponse, QuizResponse


# ─── Category Mastery ────────────────────────────────────────────────────────


class TestCategoryMastery:
    def setup_method(self):
        self.tracker = ProgressTracker()
        self.now = datetime.now()

    def test_recent_scores_weighted_higher(self):
        """Recent scores dominate mastery (decay 0.85/week)."""
        attempts = [
            (0.3, self.now - timedelta(days=30)),  # Old, low
            (0.9, self.now - timedelta(days=1)),   # Recent, high
        ]
        mastery = self.tracker.compute_category_mastery("math", attempts)
        assert mastery.mastery_level > 0.6  # Should be closer to 0.9 than 0.3

    def test_old_scores_have_less_impact(self):
        """Old high scores don't inflate mastery if recent is low."""
        attempts = [
            (0.95, self.now - timedelta(days=60)),  # Very old, high
            (0.4, self.now - timedelta(days=1)),    # Recent, low
        ]
        mastery = self.tracker.compute_category_mastery("math", attempts)
        assert mastery.mastery_level < 0.6  # Should be closer to 0.4

    def test_single_attempt(self):
        """Single attempt: mastery equals score."""
        attempts = [(0.75, self.now)]
        mastery = self.tracker.compute_category_mastery("science", attempts)
        assert abs(mastery.mastery_level - 0.75) < 0.05
        assert mastery.total_attempts == 1

    def test_empty_attempts(self):
        """Empty list gives zero mastery."""
        mastery = self.tracker.compute_category_mastery("empty", [])
        assert mastery.mastery_level == 0.0
        assert mastery.total_attempts == 0
        assert mastery.trend == "stable"
        assert mastery.last_attempt is None

    def test_streak_counts_consecutive_passing(self):
        """Streak counts consecutive scores >= 60% from the end."""
        attempts = [
            (0.5, self.now - timedelta(days=4)),  # Fail
            (0.7, self.now - timedelta(days=3)),  # Pass
            (0.8, self.now - timedelta(days=2)),  # Pass
            (0.6, self.now - timedelta(days=1)),  # Pass
        ]
        mastery = self.tracker.compute_category_mastery("math", attempts)
        assert mastery.streak == 3

    def test_streak_broken_by_failure(self):
        """Streak stops at first failure going backwards."""
        attempts = [
            (0.8, self.now - timedelta(days=3)),
            (0.4, self.now - timedelta(days=2)),  # Breaks streak
            (0.9, self.now - timedelta(days=1)),
        ]
        mastery = self.tracker.compute_category_mastery("math", attempts)
        assert mastery.streak == 1  # Only the last one

    def test_all_failing_streak_is_zero(self):
        attempts = [
            (0.3, self.now - timedelta(days=2)),
            (0.4, self.now - timedelta(days=1)),
            (0.5, self.now),
        ]
        mastery = self.tracker.compute_category_mastery("hard", attempts)
        assert mastery.streak == 0

    def test_accuracy_is_simple_average(self):
        attempts = [
            (0.6, self.now - timedelta(days=2)),
            (0.8, self.now - timedelta(days=1)),
            (1.0, self.now),
        ]
        mastery = self.tracker.compute_category_mastery("math", attempts)
        assert abs(mastery.accuracy - 0.8) < 0.01

    def test_total_correct_counts_above_50_percent(self):
        """total_correct counts attempts with score >= 50%."""
        attempts = [
            (0.3, self.now - timedelta(days=3)),  # Below 50%
            (0.5, self.now - timedelta(days=2)),  # Exactly 50% → correct
            (0.8, self.now - timedelta(days=1)),  # Above → correct
        ]
        mastery = self.tracker.compute_category_mastery("math", attempts)
        assert mastery.total_correct == 2


# ─── Trend Detection ─────────────────────────────────────────────────────────


class TestTrendDetection:
    def setup_method(self):
        self.tracker = ProgressTracker()
        self.now = datetime.now()

    def test_improving_trend(self):
        attempts = [
            (0.4, self.now - timedelta(days=3)),
            (0.5, self.now - timedelta(days=2)),
            (0.7, self.now - timedelta(days=1)),
            (0.9, self.now),
        ]
        mastery = self.tracker.compute_category_mastery("math", attempts)
        assert mastery.trend == "improving"

    def test_declining_trend(self):
        attempts = [
            (0.9, self.now - timedelta(days=3)),
            (0.8, self.now - timedelta(days=2)),
            (0.5, self.now - timedelta(days=1)),
            (0.3, self.now),
        ]
        mastery = self.tracker.compute_category_mastery("math", attempts)
        assert mastery.trend == "declining"

    def test_stable_trend(self):
        attempts = [
            (0.7, self.now - timedelta(days=3)),
            (0.72, self.now - timedelta(days=2)),
            (0.71, self.now - timedelta(days=1)),
            (0.73, self.now),
        ]
        mastery = self.tracker.compute_category_mastery("math", attempts)
        assert mastery.trend == "stable"

    def test_two_attempts_minimum_for_trend(self):
        """With < 2 attempts, trend is 'stable'."""
        attempts = [(0.9, self.now)]
        mastery = self.tracker.compute_category_mastery("math", attempts)
        assert mastery.trend == "stable"


# ─── Learning Velocity ───────────────────────────────────────────────────────


class TestLearningVelocity:
    def setup_method(self):
        self.tracker = ProgressTracker()
        self.now = datetime.now()

    def test_accelerating(self):
        attempts = [
            (0.4, self.now - timedelta(days=21)),
            (0.5, self.now - timedelta(days=14)),
            (0.7, self.now - timedelta(days=7)),
            (0.9, self.now),
        ]
        velocity = self.tracker.compute_velocity(attempts)
        assert velocity.direction == "accelerating"
        assert velocity.velocity > 0

    def test_decelerating(self):
        attempts = [
            (0.9, self.now - timedelta(days=21)),
            (0.8, self.now - timedelta(days=14)),
            (0.5, self.now - timedelta(days=7)),
            (0.3, self.now),
        ]
        velocity = self.tracker.compute_velocity(attempts)
        assert velocity.direction == "decelerating"
        assert velocity.velocity < 0

    def test_steady(self):
        attempts = [
            (0.7, self.now - timedelta(days=21)),
            (0.72, self.now - timedelta(days=14)),
            (0.71, self.now - timedelta(days=7)),
            (0.7, self.now),
        ]
        velocity = self.tracker.compute_velocity(attempts)
        assert velocity.direction == "steady"

    def test_too_few_attempts(self):
        """With < 3 attempts, velocity is steady with 0."""
        attempts = [(0.5, self.now - timedelta(days=7)), (0.9, self.now)]
        velocity = self.tracker.compute_velocity(attempts)
        assert velocity.direction == "steady"
        assert velocity.velocity == 0.0

    def test_empty_attempts(self):
        velocity = self.tracker.compute_velocity([])
        assert velocity.direction == "steady"


# ─── Study Streak ────────────────────────────────────────────────────────────


class TestStudyStreak:
    def setup_method(self):
        self.tracker = ProgressTracker()
        self.now = datetime.now()

    def test_consecutive_days(self):
        history = [
            TakeQuizResponse(quizId="q1", quizTitle="Q1", score="5/5", status="ACTIVE",
                           updatedAt=(self.now - timedelta(days=0)).isoformat()),
            TakeQuizResponse(quizId="q2", quizTitle="Q2", score="3/5", status="ACTIVE",
                           updatedAt=(self.now - timedelta(days=1)).isoformat()),
            TakeQuizResponse(quizId="q3", quizTitle="Q3", score="4/5", status="ACTIVE",
                           updatedAt=(self.now - timedelta(days=2)).isoformat()),
        ]
        streak = self.tracker.compute_study_streak(history)
        assert streak == 3

    def test_gap_breaks_streak(self):
        history = [
            TakeQuizResponse(quizId="q1", quizTitle="Q1", score="5/5", status="ACTIVE",
                           updatedAt=(self.now - timedelta(days=0)).isoformat()),
            TakeQuizResponse(quizId="q2", quizTitle="Q2", score="3/5", status="ACTIVE",
                           updatedAt=(self.now - timedelta(days=1)).isoformat()),
            # Gap on day 2
            TakeQuizResponse(quizId="q3", quizTitle="Q3", score="4/5", status="ACTIVE",
                           updatedAt=(self.now - timedelta(days=3)).isoformat()),
        ]
        streak = self.tracker.compute_study_streak(history)
        assert streak == 2

    def test_no_activity_today(self):
        """If no quiz today, streak is 0 (must start from today)."""
        history = [
            TakeQuizResponse(quizId="q1", quizTitle="Q1", score="5/5", status="ACTIVE",
                           updatedAt=(self.now - timedelta(days=1)).isoformat()),
            TakeQuizResponse(quizId="q2", quizTitle="Q2", score="3/5", status="ACTIVE",
                           updatedAt=(self.now - timedelta(days=2)).isoformat()),
        ]
        streak = self.tracker.compute_study_streak(history)
        assert streak == 0

    def test_empty_history(self):
        assert self.tracker.compute_study_streak([]) == 0

    def test_multiple_quizzes_same_day(self):
        """Multiple quizzes on same day count as 1 day."""
        history = [
            TakeQuizResponse(quizId="q1", quizTitle="Q1", score="5/5", status="ACTIVE",
                           updatedAt=(self.now).isoformat()),
            TakeQuizResponse(quizId="q2", quizTitle="Q2", score="3/5", status="ACTIVE",
                           updatedAt=(self.now).isoformat()),
        ]
        streak = self.tracker.compute_study_streak(history)
        assert streak == 1


# ─── Full Progress Report ────────────────────────────────────────────────────


class TestProgressReport:
    def setup_method(self):
        self.tracker = ProgressTracker()
        self.now = datetime.now()

    def test_empty_history_returns_zero_report(self):
        report = self.tracker.compute_progress("user1", [], {})
        assert report.overall_mastery == 0.0
        assert report.categories == []
        assert report.study_streak == 0
        assert report.total_quizzes_taken == 0
        assert report.strongest_category is None
        assert report.weakest_category is None

    def test_single_category_report(self):
        history = [
            TakeQuizResponse(quizId="q1", quizTitle="Math Quiz", score="8/10",
                           status="ACTIVE", updatedAt=self.now.isoformat()),
        ]
        quiz_details = {
            "q1": QuizResponse(id="q1", title="Math Quiz", categories=["math"]),
        }
        report = self.tracker.compute_progress("user1", history, quiz_details)
        assert report.total_quizzes_taken == 1
        assert len(report.categories) == 1
        assert report.categories[0].category == "math"
        assert report.strongest_category == "math"
        assert report.weakest_category == "math"

    def test_multiple_categories_identifies_strongest_weakest(self):
        history = [
            TakeQuizResponse(quizId="q1", quizTitle="Math", score="9/10",
                           status="ACTIVE", updatedAt=self.now.isoformat()),
            TakeQuizResponse(quizId="q2", quizTitle="History", score="3/10",
                           status="ACTIVE", updatedAt=self.now.isoformat()),
        ]
        quiz_details = {
            "q1": QuizResponse(id="q1", title="Math", categories=["math"]),
            "q2": QuizResponse(id="q2", title="History", categories=["history"]),
        }
        report = self.tracker.compute_progress("user1", history, quiz_details)
        assert report.strongest_category == "math"
        assert report.weakest_category == "history"

    def test_overall_mastery_is_weighted_average(self):
        """Overall mastery weights by attempt count per category."""
        history = [
            TakeQuizResponse(quizId="q1", quizTitle="M1", score="10/10",
                           status="ACTIVE", updatedAt=self.now.isoformat()),
            TakeQuizResponse(quizId="q2", quizTitle="M2", score="10/10",
                           status="ACTIVE", updatedAt=self.now.isoformat()),
            TakeQuizResponse(quizId="q3", quizTitle="H1", score="5/10",
                           status="ACTIVE", updatedAt=self.now.isoformat()),
        ]
        quiz_details = {
            "q1": QuizResponse(id="q1", title="M1", categories=["math"]),
            "q2": QuizResponse(id="q2", title="M2", categories=["math"]),
            "q3": QuizResponse(id="q3", title="H1", categories=["history"]),
        }
        report = self.tracker.compute_progress("user1", history, quiz_details)
        # Math: 2 attempts (mastery ~1.0), History: 1 attempt (mastery ~0.5)
        # Weighted: (1.0*2 + 0.5*1) / 3 ≈ 0.833
        assert report.overall_mastery > 0.7

    def test_categories_lowercased(self):
        """Category names are normalized to lowercase."""
        history = [
            TakeQuizResponse(quizId="q1", quizTitle="Quiz", score="8/10",
                           status="ACTIVE", updatedAt=self.now.isoformat()),
        ]
        quiz_details = {
            "q1": QuizResponse(id="q1", title="Quiz", categories=["MATH"]),
        }
        report = self.tracker.compute_progress("user1", history, quiz_details)
        assert report.categories[0].category == "math"

    def test_missing_quiz_details_uses_general(self):
        """If quiz not found in details, category defaults to 'general'."""
        history = [
            TakeQuizResponse(quizId="q999", quizTitle="Unknown", score="5/10",
                           status="ACTIVE", updatedAt=self.now.isoformat()),
        ]
        report = self.tracker.compute_progress("user1", history, {})
        assert len(report.categories) == 1
        assert report.categories[0].category == "general"

    def test_zero_score_skipped(self):
        """Attempts with score "0/0" are skipped (total=0)."""
        history = [
            TakeQuizResponse(quizId="q1", quizTitle="Bad", score="0/0",
                           status="ACTIVE", updatedAt=self.now.isoformat()),
        ]
        quiz_details = {"q1": QuizResponse(id="q1", categories=["math"])}
        report = self.tracker.compute_progress("user1", history, quiz_details)
        assert report.categories == []  # Skipped


# ─── _parse_score helper ─────────────────────────────────────────────────────


class TestProgressParseScore:
    def test_valid(self):
        assert _parse_score("7/10") == (7, 10)

    def test_zero(self):
        assert _parse_score("0/5") == (0, 5)

    def test_invalid(self):
        assert _parse_score("bad") == (0, 0)

    def test_empty(self):
        assert _parse_score("") == (0, 0)
