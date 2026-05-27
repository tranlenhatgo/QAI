"""
Tests for lite_orchestrator.py — intent classification logic.

Covers:
- IntentClassifier.classify() for all intent types
- Confidence scoring
- Parameter extraction (topic, subject)
- Edge cases (empty input, mixed signals)
"""

import pytest

from server.capabilities.lite_orchestrator import (
    Intent,
    IntentClassifier,
    IntentResult,
)


class TestIntentClassifier:
    def setup_method(self):
        self.classifier = IntentClassifier()

    # ─── Weakness Analysis ───────────────────────────────────────────────

    def test_weakness_weak_points(self):
        result = self.classifier.classify("What are my weak points?")
        assert result.intent == Intent.WEAKNESS_ANALYSIS

    def test_weakness_struggle(self):
        result = self.classifier.classify("What subjects am I bad at?")
        assert result.intent == Intent.WEAKNESS_ANALYSIS

    def test_weakness_improve(self):
        result = self.classifier.classify("Where should I improve?")
        assert result.intent == Intent.WEAKNESS_ANALYSIS

    def test_weakness_analyze_performance(self):
        result = self.classifier.classify("Analyze my performance please")
        assert result.intent == Intent.WEAKNESS_ANALYSIS

    def test_weakness_mistakes(self):
        result = self.classifier.classify("What are my mistakes?")
        assert result.intent == Intent.WEAKNESS_ANALYSIS

    # ─── Quiz Recommend ──────────────────────────────────────────────────

    def test_recommend_what_should_study(self):
        result = self.classifier.classify("What should I study next?")
        assert result.intent == Intent.QUIZ_RECOMMEND

    def test_recommend_suggest_quiz(self):
        result = self.classifier.classify("Recommend a quiz for me")
        assert result.intent == Intent.QUIZ_RECOMMEND

    def test_recommend_next_topic(self):
        result = self.classifier.classify("Suggest next topic")
        assert result.intent == Intent.QUIZ_RECOMMEND

    def test_recommend_what_focus(self):
        result = self.classifier.classify("What should I focus on?")
        assert result.intent == Intent.QUIZ_RECOMMEND

    # ─── Explain Topic ───────────────────────────────────────────────────

    def test_explain_direct(self):
        result = self.classifier.classify("Explain photosynthesis")
        assert result.intent == Intent.EXPLAIN_TOPIC

    def test_explain_what_is(self):
        result = self.classifier.classify("What is quantum mechanics?")
        assert result.intent == Intent.EXPLAIN_TOPIC

    def test_explain_how_does(self):
        result = self.classifier.classify("How does gravity work?")
        assert result.intent == Intent.EXPLAIN_TOPIC

    def test_explain_tell_me_about(self):
        result = self.classifier.classify("Tell me about the French Revolution")
        assert result.intent == Intent.EXPLAIN_TOPIC

    def test_explain_define(self):
        result = self.classifier.classify("Define mitosis")
        assert result.intent == Intent.EXPLAIN_TOPIC

    # ─── Quiz Request ────────────────────────────────────────────────────

    def test_quiz_me(self):
        result = self.classifier.classify("Quiz me on biology")
        assert result.intent == Intent.QUIZ_REQUEST

    def test_quiz_test_my_knowledge(self):
        result = self.classifier.classify("Test my knowledge of history")
        assert result.intent == Intent.QUIZ_REQUEST

    def test_quiz_create(self):
        result = self.classifier.classify("Create a quiz about math")
        assert result.intent == Intent.QUIZ_REQUEST

    def test_quiz_generate_questions(self):
        result = self.classifier.classify("Generate practice questions on algebra")
        assert result.intent == Intent.QUIZ_REQUEST

    # ─── Solve Problem ───────────────────────────────────────────────────

    def test_solve_direct(self):
        result = self.classifier.classify("Solve 2x + 5 = 15")
        assert result.intent == Intent.SOLVE_PROBLEM

    def test_solve_calculate(self):
        result = self.classifier.classify("Calculate the area of a circle with radius 5")
        assert result.intent == Intent.SOLVE_PROBLEM

    def test_solve_step_by_step(self):
        result = self.classifier.classify("Show me step by step how to factor x^2 - 9")
        assert result.intent == Intent.SOLVE_PROBLEM

    def test_solve_help_work_out(self):
        result = self.classifier.classify("Help me work out this equation")
        assert result.intent == Intent.SOLVE_PROBLEM

    # ─── General Chat ────────────────────────────────────────────────────

    def test_general_greeting(self):
        result = self.classifier.classify("Hello!")
        assert result.intent == Intent.GENERAL_CHAT

    def test_general_thanks(self):
        result = self.classifier.classify("Thank you!")
        assert result.intent == Intent.GENERAL_CHAT

    def test_general_chitchat(self):
        result = self.classifier.classify("Good morning!")
        assert result.intent == Intent.GENERAL_CHAT

    def test_general_empty_string(self):
        result = self.classifier.classify("")
        assert result.intent == Intent.GENERAL_CHAT

    # ─── Confidence Scoring ──────────────────────────────────────────────

    def test_general_chat_has_zero_confidence(self):
        result = self.classifier.classify("Hello!")
        assert result.confidence == 0.0

    def test_single_pattern_match_confidence(self):
        result = self.classifier.classify("Explain gravity")
        assert result.confidence >= 0.5

    def test_multiple_pattern_matches_higher_confidence(self):
        """More pattern matches → higher confidence (capped at 0.95)."""
        result = self.classifier.classify("What am I struggling with? Where should I improve? My weak areas?")
        assert result.confidence > 0.65

    def test_confidence_capped_at_095(self):
        """Confidence never exceeds 0.95."""
        result = self.classifier.classify(
            "What are my weak points and mistakes? I'm struggling and failing. "
            "Where do I need to improve? Analyze my performance review."
        )
        assert result.confidence <= 0.95

    # ─── Parameter Extraction ────────────────────────────────────────────

    def test_extract_topic_from_explain(self):
        result = self.classifier.classify("Explain photosynthesis")
        assert result.extracted_params.get("topic") == "photosynthesis"

    def test_extract_topic_from_about(self):
        result = self.classifier.classify("Tell me about the solar system")
        assert "solar system" in result.extracted_params.get("topic", "")

    def test_extract_subject_math(self):
        result = self.classifier.classify("Quiz me on math problems")
        assert result.extracted_params.get("subject") == "math"

    def test_extract_subject_physics(self):
        result = self.classifier.classify("I need help with physics")
        assert result.extracted_params.get("subject") == "physics"

    def test_extract_subject_history(self):
        result = self.classifier.classify("Study plan for history")
        assert result.extracted_params.get("subject") == "history"

    def test_no_subject_extracted(self):
        """Non-standard subjects are not extracted."""
        result = self.classifier.classify("Help me with cooking")
        assert "subject" not in result.extracted_params
