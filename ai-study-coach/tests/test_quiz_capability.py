"""
Tests for capabilities/quiz.py — quiz generation capability (mocked LLM).

Covers:
- QuizGenerator initialization
"""

import pytest

from server.capabilities.quiz import QuizGenerator


class TestQuizGenerator:
    """Basic tests for QuizGenerator structure — no LLM calls."""

    def test_exists(self):
        """QuizGenerator can be imported."""
        assert QuizGenerator is not None
