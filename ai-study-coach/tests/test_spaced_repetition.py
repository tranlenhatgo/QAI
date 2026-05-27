"""
Tests for spaced_repetition.py — SM-2 algorithm correctness.

Covers:
- Score-to-quality mapping
- Interval progression (passing scores)
- Reset on failure
- Easiness factor bounds
- Due/upcoming review filtering
- update_after_quiz
- _parse_score helper
- _parse_last_score helper
- _parse_datetime helper
- _response_to_item conversion
- on_quiz_completed integration (mocked storage)
"""

import asyncio
import sys
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock

import pytest

from server.learning.spaced_repetition import (
    ReviewItem,
    SpacedRepetitionScheduler,
    _parse_score,
    _parse_last_score,
    _parse_datetime,
    _response_to_item,
    _item_to_upsert,
    on_quiz_completed,
)


# ─── Score to Quality Mapping ────────────────────────────────────────────────


class TestScoreToQuality:
    def setup_method(self):
        self.scheduler = SpacedRepetitionScheduler()

    def test_perfect_score(self):
        assert self.scheduler._score_to_quality(1.0) == 5

    def test_ninety_percent(self):
        assert self.scheduler._score_to_quality(0.9) == 5

    def test_eighty_percent(self):
        assert self.scheduler._score_to_quality(0.8) == 4

    def test_seventy_percent(self):
        assert self.scheduler._score_to_quality(0.7) == 3

    def test_sixty_percent(self):
        assert self.scheduler._score_to_quality(0.6) == 3

    def test_fifty_percent(self):
        assert self.scheduler._score_to_quality(0.5) == 2

    def test_forty_percent(self):
        assert self.scheduler._score_to_quality(0.4) == 2

    def test_twenty_percent(self):
        assert self.scheduler._score_to_quality(0.2) == 1

    def test_ten_percent(self):
        assert self.scheduler._score_to_quality(0.1) == 0

    def test_zero(self):
        assert self.scheduler._score_to_quality(0.0) == 0

    def test_boundary_89(self):
        """0.89 should be quality 4 (not 5)."""
        assert self.scheduler._score_to_quality(0.89) == 4

    def test_boundary_59(self):
        """0.59 should be quality 2 (not 3)."""
        assert self.scheduler._score_to_quality(0.59) == 2


# ─── compute_next_review ─────────────────────────────────────────────────────


class TestComputeNextReview:
    def setup_method(self):
        self.scheduler = SpacedRepetitionScheduler()

    def test_first_passing_attempt(self):
        """First passing score: interval=1 day, reps=1."""
        item = self.scheduler.compute_next_review("math", 0.8)
        assert item.category == "math"
        assert item.repetitions == 1
        assert item.interval_days == 1.0
        assert item.last_score == 0.8
        assert item.easiness >= 1.3

    def test_second_passing_attempt(self):
        """Second passing score: interval=3 days, reps=2."""
        item1 = self.scheduler.compute_next_review("math", 0.8)
        item2 = self.scheduler.compute_next_review("math", 0.9, item1)
        assert item2.repetitions == 2
        assert item2.interval_days == 3.0

    def test_third_passing_uses_easiness(self):
        """Third pass: interval = previous_interval * easiness."""
        item1 = self.scheduler.compute_next_review("math", 0.9)
        item2 = self.scheduler.compute_next_review("math", 0.9, item1)
        item3 = self.scheduler.compute_next_review("math", 0.9, item2)
        assert item3.repetitions == 3
        expected_interval = 3.0 * item2.easiness
        assert abs(item3.interval_days - expected_interval) < 0.01

    def test_failing_resets_repetitions(self):
        """Score < 60% resets reps to 0 and interval to 0.5 (12h)."""
        item1 = self.scheduler.compute_next_review("math", 0.9)
        item2 = self.scheduler.compute_next_review("math", 0.9, item1)
        failed = self.scheduler.compute_next_review("math", 0.3, item2)
        assert failed.repetitions == 0
        assert failed.interval_days == 0.5

    def test_failing_preserves_easiness(self):
        """Failing does not change the easiness factor."""
        item1 = self.scheduler.compute_next_review("math", 0.9)
        easiness_before = item1.easiness
        failed = self.scheduler.compute_next_review("math", 0.2, item1)
        assert failed.easiness == easiness_before

    def test_next_review_is_in_future(self):
        """next_review should be > now."""
        before = datetime.now()
        item = self.scheduler.compute_next_review("math", 0.8)
        assert item.next_review >= before

    def test_no_current_item_creates_fresh(self):
        """None current_item starts from defaults."""
        item = self.scheduler.compute_next_review("new_topic", 0.7)
        assert item.category == "new_topic"
        assert item.repetitions == 1
        assert item.interval_days == 1.0

    def test_easiness_increases_with_high_quality(self):
        """Quality 5 (score >= 0.9) increases easiness."""
        item = self.scheduler.compute_next_review("math", 0.95)
        assert item.easiness > 2.5  # Default is 2.5, should increase

    def test_easiness_decreases_with_borderline_pass(self):
        """Quality 3 (score ~0.6) decreases easiness."""
        item = self.scheduler.compute_next_review("math", 0.6)
        assert item.easiness < 2.5

    def test_easiness_never_below_1_3(self):
        """Even with many borderline passes, easiness stays >= 1.3."""
        item = None
        for _ in range(30):
            item = self.scheduler.compute_next_review("hard", 0.6, item)
        assert item.easiness >= 1.3

    def test_intervals_grow_monotonically_with_passing(self):
        """Consecutive passing scores produce growing intervals."""
        intervals = []
        item = None
        for _ in range(5):
            item = self.scheduler.compute_next_review("math", 0.85, item)
            intervals.append(item.interval_days)
        # After first two fixed intervals (1, 3), should grow
        assert intervals[2] > intervals[1]
        assert intervals[3] > intervals[2]
        assert intervals[4] > intervals[3]


# ─── get_due_reviews ─────────────────────────────────────────────────────────


class TestGetDueReviews:
    def setup_method(self):
        self.scheduler = SpacedRepetitionScheduler()
        self.now = datetime.now()

    def test_returns_overdue_items(self):
        items = [
            ReviewItem("math", self.now - timedelta(days=2), 1.0),
            ReviewItem("physics", self.now + timedelta(days=1), 3.0),
        ]
        due = self.scheduler.get_due_reviews(items, as_of=self.now)
        assert len(due) == 1
        assert due[0].category == "math"

    def test_sorts_by_urgency(self):
        """Most overdue first."""
        items = [
            ReviewItem("recent", self.now - timedelta(hours=1), 0.5),
            ReviewItem("old", self.now - timedelta(days=5), 1.0),
        ]
        due = self.scheduler.get_due_reviews(items, as_of=self.now)
        assert due[0].category == "old"
        assert due[1].category == "recent"

    def test_empty_list(self):
        due = self.scheduler.get_due_reviews([], as_of=self.now)
        assert due == []

    def test_nothing_due(self):
        items = [
            ReviewItem("math", self.now + timedelta(days=1), 1.0),
            ReviewItem("physics", self.now + timedelta(days=3), 3.0),
        ]
        due = self.scheduler.get_due_reviews(items, as_of=self.now)
        assert due == []

    def test_exactly_now_is_due(self):
        """Item with next_review == now should be due."""
        items = [ReviewItem("math", self.now, 1.0)]
        due = self.scheduler.get_due_reviews(items, as_of=self.now)
        assert len(due) == 1


# ─── get_upcoming_reviews ────────────────────────────────────────────────────


class TestGetUpcomingReviews:
    def setup_method(self):
        self.scheduler = SpacedRepetitionScheduler()
        self.now = datetime.now()

    def test_returns_upcoming_within_window(self):
        items = [
            ReviewItem("soon", self.now + timedelta(hours=12), 1.0),
            ReviewItem("later", self.now + timedelta(hours=30), 3.0),
            ReviewItem("overdue", self.now - timedelta(hours=1), 0.5),
        ]
        upcoming = self.scheduler.get_upcoming_reviews(items, within_hours=24, as_of=self.now)
        assert len(upcoming) == 1
        assert upcoming[0].category == "soon"

    def test_empty_when_none_upcoming(self):
        items = [ReviewItem("far", self.now + timedelta(days=10), 5.0)]
        upcoming = self.scheduler.get_upcoming_reviews(items, within_hours=24, as_of=self.now)
        assert upcoming == []

    def test_overdue_not_included(self):
        """Items already overdue are NOT upcoming."""
        items = [ReviewItem("overdue", self.now - timedelta(days=1), 1.0)]
        upcoming = self.scheduler.get_upcoming_reviews(items, within_hours=48, as_of=self.now)
        assert upcoming == []


# ─── update_after_quiz ───────────────────────────────────────────────────────


class TestUpdateAfterQuiz:
    def setup_method(self):
        self.scheduler = SpacedRepetitionScheduler()
        self.now = datetime.now()

    def test_updates_existing_category(self):
        items = [
            ReviewItem("math", self.now, 1.0, 2.5, 1, 0.7),
            ReviewItem("physics", self.now, 3.0, 2.5, 2, 0.8),
        ]
        updated = self.scheduler.update_after_quiz(items, "math", 0.9)
        assert len(updated) == 2
        math = next(i for i in updated if i.category == "math")
        assert math.repetitions == 2

    def test_adds_new_category(self):
        items = [ReviewItem("math", self.now, 1.0, 2.5, 1, 0.7)]
        updated = self.scheduler.update_after_quiz(items, "biology", 0.8)
        assert len(updated) == 2
        bio = next(i for i in updated if i.category == "biology")
        assert bio.repetitions == 1

    def test_empty_list_adds_category(self):
        updated = self.scheduler.update_after_quiz([], "chemistry", 0.7)
        assert len(updated) == 1
        assert updated[0].category == "chemistry"
        assert updated[0].repetitions == 1


# ─── Helper Functions ────────────────────────────────────────────────────────


class TestParseScore:
    def test_valid_score(self):
        assert _parse_score("3/5") == (3, 5)

    def test_perfect_score(self):
        assert _parse_score("10/10") == (10, 10)

    def test_zero_score(self):
        assert _parse_score("0/5") == (0, 5)

    def test_invalid_format(self):
        assert _parse_score("abc") == (0, 0)

    def test_empty_string(self):
        assert _parse_score("") == (0, 0)

    def test_single_number(self):
        assert _parse_score("5") == (0, 0)

    def test_non_numeric(self):
        assert _parse_score("a/b") == (0, 0)


class TestParseLastScore:
    def test_float_value(self):
        assert _parse_last_score(0.85) == 0.85

    def test_int_value(self):
        assert _parse_last_score(1) == 1.0

    def test_float_string(self):
        assert _parse_last_score("0.75") == 0.75

    def test_score_string(self):
        assert _parse_last_score("4/5") == 0.8

    def test_empty_string(self):
        assert _parse_last_score("") == 0.0

    def test_none(self):
        assert _parse_last_score(None) == 0.0

    def test_invalid_string(self):
        assert _parse_last_score("abc") == 0.0

    def test_zero_total_score(self):
        assert _parse_last_score("0/0") == 0.0


class TestParseDatetime:
    def test_iso_format(self):
        result = _parse_datetime("2024-01-15T10:30:00")
        assert result is not None
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15

    def test_iso_with_z(self):
        result = _parse_datetime("2024-06-01T12:00:00Z")
        assert result is not None
        assert result.hour == 12

    def test_none_input(self):
        assert _parse_datetime(None) is None

    def test_empty_string(self):
        assert _parse_datetime("") is None

    def test_invalid_format(self):
        assert _parse_datetime("not-a-date") is None


class TestResponseToItem:
    def test_complete_data(self):
        data = {
            "category": "math",
            "next_review": "2024-06-01T12:00:00Z",
            "interval_days": 3.0,
            "easiness": 2.3,
            "repetitions": 2,
            "last_score": "0.8",
        }
        item = _response_to_item(data)
        assert item.category == "math"
        assert item.interval_days == 3.0
        assert item.easiness == 2.3
        assert item.repetitions == 2
        assert item.last_score == 0.8

    def test_missing_fields_use_defaults(self):
        data = {"category": "science"}
        item = _response_to_item(data)
        assert item.category == "science"
        assert item.easiness == 2.5
        assert item.repetitions == 0
        assert item.interval_days == 0

    def test_legacy_score_format(self):
        data = {"category": "english", "last_score": "4/5"}
        item = _response_to_item(data)
        assert item.last_score == 0.8


class TestItemToUpsert:
    def test_produces_valid_payload(self):
        item = ReviewItem(
            category="math",
            next_review=datetime(2024, 6, 1, 12, 0, 0),
            interval_days=3.0,
            easiness=2.4,
            repetitions=2,
            last_score=0.85,
        )
        payload = _item_to_upsert("user123", item)
        assert payload["user_id"] == "user123"
        assert payload["category"] == "math"
        assert payload["easiness"] == 2.4
        assert payload["interval_days"] == 3.0
        assert payload["repetitions"] == 2
        assert "Z" in payload["next_review"]
        assert payload["last_score"] == "0.85"


# ─── on_quiz_completed Integration ──────────────────────────────────────────


class TestOnQuizCompleted:
    def test_first_quiz_creates_schedule(self):
        store: dict[str, list] = {}

        async def mock_load(user_id):
            return store.get(user_id, [])

        async def mock_save(user_id, items):
            store[user_id] = items

        async def _run():
            with patch("server.learning.spaced_repetition.load_schedule", side_effect=mock_load), \
                 patch("server.learning.spaced_repetition.save_schedule", side_effect=mock_save):
                item = await on_quiz_completed("user1", "algebra", "8/10")
                assert item.category == "algebra"
                assert item.repetitions == 1
                assert item.interval_days == 1.0

        asyncio.run(_run())

    def test_second_quiz_advances_schedule(self):
        store: dict[str, list] = {}

        async def mock_load(user_id):
            return store.get(user_id, [])

        async def mock_save(user_id, items):
            store[user_id] = items

        async def _run():
            with patch("server.learning.spaced_repetition.load_schedule", side_effect=mock_load), \
                 patch("server.learning.spaced_repetition.save_schedule", side_effect=mock_save):
                await on_quiz_completed("user1", "algebra", "8/10")
                item2 = await on_quiz_completed("user1", "algebra", "9/10")
                assert item2.repetitions == 2
                assert item2.interval_days == 3.0

        asyncio.run(_run())

    def test_failing_quiz_resets(self):
        store: dict[str, list] = {}

        async def mock_load(user_id):
            return store.get(user_id, [])

        async def mock_save(user_id, items):
            store[user_id] = items

        async def _run():
            with patch("server.learning.spaced_repetition.load_schedule", side_effect=mock_load), \
                 patch("server.learning.spaced_repetition.save_schedule", side_effect=mock_save):
                await on_quiz_completed("user1", "math", "9/10")
                item = await on_quiz_completed("user1", "math", "2/10")
                assert item.repetitions == 0
                assert item.interval_days == 0.5

        asyncio.run(_run())

    def test_multiple_categories(self):
        store: dict[str, list] = {}

        async def mock_load(user_id):
            return store.get(user_id, [])

        async def mock_save(user_id, items):
            store[user_id] = items

        async def _run():
            with patch("server.learning.spaced_repetition.load_schedule", side_effect=mock_load), \
                 patch("server.learning.spaced_repetition.save_schedule", side_effect=mock_save):
                await on_quiz_completed("user1", "math", "8/10")
                await on_quiz_completed("user1", "physics", "7/10")
                assert len(store["user1"]) == 2

        asyncio.run(_run())

    def test_zero_total_score(self):
        """Score "0/0" should result in accuracy 0.0."""
        store: dict[str, list] = {}

        async def mock_load(user_id):
            return store.get(user_id, [])

        async def mock_save(user_id, items):
            store[user_id] = items

        async def _run():
            with patch("server.learning.spaced_repetition.load_schedule", side_effect=mock_load), \
                 patch("server.learning.spaced_repetition.save_schedule", side_effect=mock_save):
                item = await on_quiz_completed("user1", "math", "0/0")
                assert item.repetitions == 0  # 0% maps to quality 0 → fail

        asyncio.run(_run())
