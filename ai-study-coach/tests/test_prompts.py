"""
Tests for prompts.py — prompt template rendering.

Covers:
- build_context_prompt with various data combinations
- build_messages with/without history, agentic mode
- System prompt selection (SYSTEM_PROMPT vs AGENTIC_SYSTEM_PROMPT)
"""

import pytest

from server.agent.prompts import (
    SYSTEM_PROMPT,
    AGENTIC_SYSTEM_PROMPT,
    build_context_prompt,
    build_messages,
)


# ─── build_context_prompt ────────────────────────────────────────────────────


class TestBuildContextPrompt:
    def test_with_quiz_history(self):
        history = [
            {"quizTitle": "Math Basics", "score": "8/10", "updatedAt": "2024-01-15"},
            {"quizTitle": "Physics 101", "score": "6/10", "updatedAt": "2024-01-16"},
        ]
        result = build_context_prompt(history)
        assert "Math Basics" in result
        assert "8/10" in result
        assert "Physics 101" in result
        assert "Quiz History" in result

    def test_empty_quiz_history(self):
        result = build_context_prompt([])
        assert "No quizzes taken yet" in result

    def test_with_weakness_report(self):
        history = [{"quizTitle": "Q1", "score": "5/10", "updatedAt": "2024-01-15"}]
        weakness = {
            "weakest_categories": ["physics", "chemistry"],
            "accuracy_by_category": {"physics": 0.4, "math": 0.9},
            "declining": ["physics"],
        }
        result = build_context_prompt(history, weakness_report=weakness)
        assert "Weakness Analysis" in result
        assert "physics" in result
        assert "chemistry" in result
        assert "Declining" in result

    def test_with_due_reviews(self):
        history = [{"quizTitle": "Q1", "score": "7/10", "updatedAt": "2024-01-15"}]
        due_reviews = [
            {"quiz_title": "Algebra Review", "category": "math", "next_review": "2024-01-20"},
        ]
        result = build_context_prompt(history, due_reviews=due_reviews)
        assert "Due for Review" in result
        assert "Algebra Review" in result
        assert "math" in result

    def test_no_weakness_no_reviews(self):
        history = [{"quizTitle": "Q1", "score": "5/5", "updatedAt": "2024-01-15"}]
        result = build_context_prompt(history, weakness_report=None, due_reviews=None)
        assert "Weakness" not in result
        assert "Due" not in result

    def test_all_data_combined(self):
        history = [{"quizTitle": "Q1", "score": "3/5", "updatedAt": "2024-01-15"}]
        weakness = {"weakest_categories": ["history"], "accuracy_by_category": {"history": 0.3}}
        due_reviews = [{"quiz_title": "History Quiz", "category": "history", "next_review": "tomorrow"}]

        result = build_context_prompt(history, weakness, due_reviews)
        assert "Quiz History" in result
        assert "Weakness Analysis" in result
        assert "Due for Review" in result

    def test_accuracy_bar_visualization(self):
        """accuracy_by_category renders bar chart with emojis."""
        history = [{"quizTitle": "Q1", "score": "5/5", "updatedAt": "2024-01-15"}]
        weakness = {"accuracy_by_category": {"math": 0.8}}
        result = build_context_prompt(history, weakness_report=weakness)
        assert "🟩" in result  # Green blocks for accuracy


# ─── build_messages ──────────────────────────────────────────────────────────


class TestBuildMessages:
    def test_basic_message_structure(self):
        messages = build_messages("Hello", "Student data here")
        assert messages[0]["role"] == "system"
        assert messages[-1]["role"] == "user"
        assert messages[-1]["content"] == "Hello"

    def test_includes_context_as_system_message(self):
        messages = build_messages("Hi", "Some context data")
        system_messages = [m for m in messages if m["role"] == "system"]
        assert len(system_messages) == 2  # System prompt + context
        assert "Some context data" in system_messages[1]["content"]

    def test_empty_context_excluded(self):
        messages = build_messages("Hi", "")
        system_messages = [m for m in messages if m["role"] == "system"]
        assert len(system_messages) == 1  # Only system prompt

    def test_non_agentic_uses_system_prompt(self):
        messages = build_messages("Hi", "ctx", agentic=False)
        assert SYSTEM_PROMPT in messages[0]["content"]

    def test_agentic_uses_agentic_prompt(self):
        messages = build_messages("Hi", "ctx", agentic=True)
        assert AGENTIC_SYSTEM_PROMPT in messages[0]["content"]

    def test_with_conversation_history(self):
        history = [
            {"role": "user", "content": "Previous question"},
            {"role": "assistant", "content": "Previous answer"},
        ]
        messages = build_messages("New question", "ctx", history=history)
        # Should have: system + context + 2 history + user message
        assert len(messages) == 5
        assert messages[2]["content"] == "Previous question"
        assert messages[3]["content"] == "Previous answer"
        assert messages[4]["content"] == "New question"

    def test_no_history_no_extra_messages(self):
        messages = build_messages("Hi", "ctx", history=None)
        assert len(messages) == 3  # system + context + user

    def test_empty_history(self):
        messages = build_messages("Hi", "ctx", history=[])
        assert len(messages) == 3  # system + context + user


# ─── System Prompt Content ───────────────────────────────────────────────────


class TestSystemPrompts:
    def test_system_prompt_mentions_data_driven(self):
        assert "data-driven" in SYSTEM_PROMPT

    def test_agentic_prompt_mentions_tools(self):
        assert "TOOLS" in AGENTIC_SYSTEM_PROMPT

    def test_agentic_prompt_lists_triggers(self):
        """Agentic prompt includes tool trigger examples."""
        assert "show_weakness_report" in AGENTIC_SYSTEM_PROMPT
        assert "search_quizzes" in AGENTIC_SYSTEM_PROMPT
        assert "navigate_to_page" in AGENTIC_SYSTEM_PROMPT

    def test_agentic_prompt_warns_no_tool_for_chat(self):
        """Agentic prompt says NOT to call tools for general questions."""
        assert "Do NOT call tools" in AGENTIC_SYSTEM_PROMPT
