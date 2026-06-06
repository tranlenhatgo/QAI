"""
Tests for spaced repetition, progress tracking, and scheduler.

Usage:
    python -m tests.test_learning

No external dependencies required (no LLM, no Spring Boot).
"""

import asyncio
import sys
from datetime import datetime, timedelta

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def test_sm2_passing_score():
    """SM-2: passing quiz (>=60%) increases interval and repetitions."""
    from server.learning.spaced_repetition import SpacedRepetitionScheduler, ReviewItem

    scheduler = SpacedRepetitionScheduler()

    # First attempt: 80% accuracy (quality 4)
    item = scheduler.compute_next_review("math", 0.8)
    assert item.repetitions == 1, f"Expected 1 rep, got {item.repetitions}"
    assert item.interval_days == 1.0, f"Expected 1 day interval, got {item.interval_days}"
    assert item.easiness >= 1.3

    # Second attempt: 90% accuracy (quality 5)
    item2 = scheduler.compute_next_review("math", 0.9, item)
    assert item2.repetitions == 2, f"Expected 2 reps, got {item2.repetitions}"
    assert item2.interval_days == 3.0, f"Expected 3 day interval, got {item2.interval_days}"

    # Third attempt: 80% accuracy
    item3 = scheduler.compute_next_review("math", 0.8, item2)
    assert item3.repetitions == 3
    assert item3.interval_days > 3.0  # Should be 3 * easiness
    print("  ✅ SM-2 passing score: intervals increase correctly")


def test_sm2_failing_score():
    """SM-2: failing quiz (<60%) resets repetitions and sets 12h interval."""
    from server.learning.spaced_repetition import SpacedRepetitionScheduler, ReviewItem

    scheduler = SpacedRepetitionScheduler()

    # Build up a history
    item = scheduler.compute_next_review("physics", 0.9)
    item = scheduler.compute_next_review("physics", 0.8, item)
    assert item.repetitions == 2

    # Fail: 30% accuracy (quality 1)
    failed = scheduler.compute_next_review("physics", 0.3, item)
    assert failed.repetitions == 0, f"Expected 0 reps after fail, got {failed.repetitions}"
    assert failed.interval_days == 0.5, f"Expected 0.5 day interval, got {failed.interval_days}"
    assert failed.easiness == item.easiness, "Easiness should not change on failure"
    print("  ✅ SM-2 failing score: repetitions reset, interval = 12h")


def test_sm2_easiness_bounds():
    """SM-2: easiness factor stays within [1.3, 2.5] range."""
    from server.learning.spaced_repetition import SpacedRepetitionScheduler

    scheduler = SpacedRepetitionScheduler()

    # Repeated low-passing scores should decrease easiness but not below 1.3
    item = None
    for _ in range(20):
        item = scheduler.compute_next_review("hard_topic", 0.6, item)

    assert item.easiness >= 1.3, f"Easiness below minimum: {item.easiness}"
    print("  ✅ SM-2 easiness bounds: stays >= 1.3")


def test_get_due_reviews():
    """get_due_reviews returns overdue items sorted by urgency."""
    from server.learning.spaced_repetition import SpacedRepetitionScheduler, ReviewItem

    scheduler = SpacedRepetitionScheduler()
    now = datetime.now()

    items = [
        ReviewItem("math", now - timedelta(days=3), 1.0, 2.5, 1, 0.7),  # 3 days overdue
        ReviewItem("physics", now + timedelta(days=2), 3.0, 2.5, 2, 0.8),  # not due
        ReviewItem("chemistry", now - timedelta(hours=6), 0.5, 2.5, 0, 0.4),  # 6h overdue
    ]

    due = scheduler.get_due_reviews(items, as_of=now)
    assert len(due) == 2, f"Expected 2 due items, got {len(due)}"
    assert due[0].category == "math"  # Most overdue first
    assert due[1].category == "chemistry"
    print("  ✅ get_due_reviews: returns overdue items sorted by urgency")


def test_update_after_quiz():
    """update_after_quiz correctly updates or adds items."""
    from server.learning.spaced_repetition import SpacedRepetitionScheduler, ReviewItem

    scheduler = SpacedRepetitionScheduler()
    now = datetime.now()

    items = [
        ReviewItem("math", now, 1.0, 2.5, 1, 0.7),
        ReviewItem("physics", now, 3.0, 2.5, 2, 0.8),
    ]

    # Update existing category
    updated = scheduler.update_after_quiz(items, "math", 0.9)
    assert len(updated) == 2
    math_item = next(i for i in updated if i.category == "math")
    assert math_item.repetitions == 2

    # Add new category
    updated2 = scheduler.update_after_quiz(updated, "biology", 0.7)
    assert len(updated2) == 3
    bio_item = next(i for i in updated2 if i.category == "biology")
    assert bio_item.repetitions == 1
    print("  ✅ update_after_quiz: updates existing, adds new categories")


def test_progress_mastery_weighted():
    """Mastery uses exponential decay weighting (recent scores count more)."""
    from server.learning.progress import ProgressTracker

    tracker = ProgressTracker()
    now = datetime.now()

    # Old score: 50%, recent score: 100%
    attempts = [
        (0.5, now - timedelta(days=30)),
        (1.0, now - timedelta(days=1)),
    ]

    mastery = tracker.compute_category_mastery("math", attempts)
    # Recent should dominate: mastery should be closer to 1.0 than 0.5
    assert mastery.mastery_level > 0.75, f"Expected > 0.75, got {mastery.mastery_level}"
    assert mastery.trend == "improving"
    print(f"  ✅ Progress mastery: weighted = {mastery.mastery_level} (recent-biased)")


def test_progress_velocity():
    """Velocity correctly identifies improving/declining trends."""
    from server.learning.progress import ProgressTracker

    tracker = ProgressTracker()
    now = datetime.now()

    # Improving trend
    attempts = [
        (0.4, now - timedelta(days=21)),
        (0.5, now - timedelta(days=14)),
        (0.7, now - timedelta(days=7)),
        (0.9, now - timedelta(days=1)),
    ]

    velocity = tracker.compute_velocity(attempts)
    assert velocity.direction == "accelerating", f"Expected accelerating, got {velocity.direction}"

    # Declining trend
    declining = [
        (0.9, now - timedelta(days=21)),
        (0.8, now - timedelta(days=14)),
        (0.5, now - timedelta(days=7)),
        (0.3, now - timedelta(days=1)),
    ]

    vel2 = tracker.compute_velocity(declining)
    assert vel2.direction == "decelerating", f"Expected decelerating, got {vel2.direction}"
    print("  ✅ Progress velocity: correctly identifies trends")


def test_progress_study_streak():
    """Study streak counts consecutive active days from today."""
    from server.learning.progress import ProgressTracker
    from server.models.schemas import TakeQuizResponse

    tracker = ProgressTracker()
    now = datetime.now()

    history = [
        TakeQuizResponse(quizId="q1", quizTitle="Quiz 1", score="5/5", status="ACTIVE", updatedAt=(now - timedelta(days=0)).isoformat()),
        TakeQuizResponse(quizId="q2", quizTitle="Quiz 2", score="3/5", status="ACTIVE", updatedAt=(now - timedelta(days=1)).isoformat()),
        TakeQuizResponse(quizId="q3", quizTitle="Quiz 3", score="4/5", status="ACTIVE", updatedAt=(now - timedelta(days=2)).isoformat()),
        # Gap on day 3
        TakeQuizResponse(quizId="q4", quizTitle="Quiz 4", score="2/5", status="ACTIVE", updatedAt=(now - timedelta(days=4)).isoformat()),
    ]

    streak = tracker.compute_study_streak(history)
    assert streak == 3, f"Expected streak = 3, got {streak}"
    print("  ✅ Progress study streak: counts consecutive days correctly")


def test_on_quiz_completed_integration():
    """on_quiz_completed updates schedule and returns ReviewItem (with mocked storage)."""
    from unittest.mock import patch, AsyncMock
    from server.learning.spaced_repetition import on_quiz_completed, ReviewItem

    # Use in-memory mock storage for this test
    _test_store: dict[str, list] = {}

    async def mock_load(user_id):
        return _test_store.get(user_id, [])

    async def mock_save(user_id, items):
        _test_store[user_id] = items

    async def _run():
        with patch("server.learning.spaced_repetition.load_schedule", side_effect=mock_load), \
             patch("server.learning.spaced_repetition.save_schedule", side_effect=mock_save):
            item = await on_quiz_completed("test_user", "algebra", "8/10")
            assert item.category == "algebra"
            assert item.repetitions == 1
            assert item.interval_days == 1.0

            # Second quiz in same category
            item2 = await on_quiz_completed("test_user", "algebra", "9/10")
            assert item2.repetitions == 2
            assert item2.interval_days == 3.0

            # Verify schedule persisted in mock
            schedule = _test_store.get("test_user", [])
            assert len(schedule) == 1
            assert schedule[0].category == "algebra"

            # New category
            await on_quiz_completed("test_user", "geometry", "4/10")
            schedule = _test_store.get("test_user", [])
            assert len(schedule) == 2
            print("  ✅ on_quiz_completed: integration flow works")

    asyncio.run(_run())


def test_score_to_quality_mapping():
    """Score to quality mapping follows SM-2 specification."""
    from server.learning.spaced_repetition import SpacedRepetitionScheduler

    scheduler = SpacedRepetitionScheduler()

    assert scheduler._score_to_quality(1.0) == 5
    assert scheduler._score_to_quality(0.9) == 5
    assert scheduler._score_to_quality(0.85) == 4
    assert scheduler._score_to_quality(0.6) == 3
    assert scheduler._score_to_quality(0.4) == 2
    assert scheduler._score_to_quality(0.2) == 1
    assert scheduler._score_to_quality(0.1) == 0
    print("  ✅ Score to quality mapping: correct")


if __name__ == "__main__":
    print("\n🧪 Running learning module tests...\n")

    tests = [
        test_sm2_passing_score,
        test_sm2_failing_score,
        test_sm2_easiness_bounds,
        test_get_due_reviews,
        test_update_after_quiz,
        test_score_to_quality_mapping,
        test_progress_mastery_weighted,
        test_progress_velocity,
        test_progress_study_streak,
        test_on_quiz_completed_integration,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  ❌ {test.__name__}: {e}")
            failed += 1

    print(f"\n{'='*50}")
    print(f"Results: {passed} passed, {failed} failed, {passed + failed} total")
    if failed:
        sys.exit(1)
    print("✅ All tests passed!")
