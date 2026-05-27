"""
Tests for tool_executor.py — tool dispatch and error handling.

Covers:
- Valid tool dispatch (all 7 tools)
- Unknown tool returns error message
- Tool execution failure handling
- Argument validation (missing required args)
"""

import asyncio
import sys
from unittest.mock import patch, AsyncMock, MagicMock

import pytest

from server.agent.tool_executor import execute_tool
from server.models.schemas import AgentAction, ToolCall


# ─── Tool Dispatch ───────────────────────────────────────────────────────────


class TestToolDispatch:
    def _run(self, coro):
        return asyncio.run(coro)

    def test_navigate_to_page(self):
        tool_call = ToolCall(id="1", name="navigate_to_page", arguments={"page": "dashboard"})

        result_text, action = self._run(execute_tool(tool_call, "user1"))

        assert "dashboard" in result_text.lower()
        assert action is not None
        assert action.action == "navigate"
        assert action.params["page"] == "dashboard"

    def test_navigate_to_page_default(self):
        """No page arg defaults to 'dashboard'."""
        tool_call = ToolCall(id="1", name="navigate_to_page", arguments={})

        result_text, action = self._run(execute_tool(tool_call, "user1"))

        assert action is not None
        assert action.params["page"] == "dashboard"

    def test_start_quiz_no_id(self):
        """Missing quiz_id returns error, no action."""
        tool_call = ToolCall(id="2", name="start_quiz", arguments={})

        result_text, action = self._run(execute_tool(tool_call, "user1"))

        assert "no quiz_id" in result_text.lower()
        assert action is None

    @patch("server.agent.tool_executor.quiz_client")
    def test_start_quiz_valid(self, mock_client):
        """Valid quiz_id starts quiz."""
        mock_quiz = MagicMock()
        mock_quiz.title = "Math Quiz"
        mock_client.get_quiz_details = AsyncMock(return_value=mock_quiz)

        tool_call = ToolCall(id="2", name="start_quiz", arguments={"quiz_id": "abc123"})
        result_text, action = self._run(execute_tool(tool_call, "user1"))

        assert "Math Quiz" in result_text
        assert action is not None
        assert action.action == "start_quiz"
        assert action.params["quiz_id"] == "abc123"

    @patch("server.agent.tool_executor.quiz_client")
    def test_start_quiz_not_found(self, mock_client):
        """Quiz not found returns error message."""
        mock_client.get_quiz_details = AsyncMock(return_value=None)

        tool_call = ToolCall(id="2", name="start_quiz", arguments={"quiz_id": "missing"})
        result_text, action = self._run(execute_tool(tool_call, "user1"))

        assert "not found" in result_text.lower()
        assert action is None

    def test_generate_questions_valid(self):
        tool_call = ToolCall(id="3", name="generate_questions", arguments={"topics": ["algebra", "geometry"]})

        result_text, action = self._run(execute_tool(tool_call, "user1"))

        assert "algebra" in result_text
        assert "geometry" in result_text
        assert action is not None
        assert action.action == "generate_questions"
        assert action.params["topics"] == ["algebra", "geometry"]

    def test_generate_questions_empty_topics(self):
        tool_call = ToolCall(id="3", name="generate_questions", arguments={"topics": []})

        result_text, action = self._run(execute_tool(tool_call, "user1"))

        assert "no topics" in result_text.lower()
        assert action is None

    def test_show_quiz_results_valid(self):
        tool_call = ToolCall(id="4", name="show_quiz_results", arguments={"quiz_id": "q123"})

        result_text, action = self._run(execute_tool(tool_call, "user1"))

        assert "q123" in result_text
        assert action is not None
        assert action.action == "show_quiz_results"

    def test_show_quiz_results_no_id(self):
        tool_call = ToolCall(id="4", name="show_quiz_results", arguments={})

        result_text, action = self._run(execute_tool(tool_call, "user1"))

        assert "no quiz_id" in result_text.lower()
        assert action is None

    def test_create_practice_quiz_valid(self):
        tool_call = ToolCall(id="5", name="create_practice_quiz",
                           arguments={"title": "Weak Areas", "categories": ["math", "physics"]})

        result_text, action = self._run(execute_tool(tool_call, "user1"))

        assert "Weak Areas" in result_text
        assert action is not None
        assert action.action == "create_practice_quiz"
        assert "math" in action.params["categories"]

    def test_create_practice_quiz_no_categories(self):
        tool_call = ToolCall(id="5", name="create_practice_quiz",
                           arguments={"title": "Test", "categories": []})

        result_text, action = self._run(execute_tool(tool_call, "user1"))

        assert "no categories" in result_text.lower()
        assert action is None

    def test_show_weakness_report_with_data(self):
        weakness_data = {
            "weakest_categories": ["physics", "chemistry"],
            "accuracy_by_category": {"physics": 0.4, "chemistry": 0.5, "math": 0.9},
            "declining": ["physics"],
        }
        tool_call = ToolCall(id="6", name="show_weakness_report", arguments={})

        result_text, action = self._run(execute_tool(tool_call, "user1", weakness_data))

        assert "physics" in result_text
        assert "chemistry" in result_text
        assert action is not None
        assert action.action == "show_weakness_report"

    def test_show_weakness_report_no_data(self):
        tool_call = ToolCall(id="6", name="show_weakness_report", arguments={})

        result_text, action = self._run(execute_tool(tool_call, "user1", None))

        assert "no weakness data" in result_text.lower()
        assert action is None

    @patch("server.agent.tool_executor.quiz_client")
    def test_search_quizzes_valid(self, mock_client):
        mock_profile = MagicMock()
        mock_profile.quizzesCreated = [
            MagicMock(id="q1", title="Algebra Basics", categories=["math"]),
            MagicMock(id="q2", title="World War II", categories=["history"]),
        ]
        mock_client.get_quiz_profile = AsyncMock(return_value=mock_profile)

        tool_call = ToolCall(id="7", name="search_quizzes", arguments={"category": "math"})
        result_text, action = self._run(execute_tool(tool_call, "user1"))

        assert "Algebra Basics" in result_text
        assert action is not None
        assert action.action == "search_quizzes"

    def test_search_quizzes_no_category(self):
        tool_call = ToolCall(id="7", name="search_quizzes", arguments={})

        result_text, action = self._run(execute_tool(tool_call, "user1"))

        assert "no category" in result_text.lower()
        assert action is None


# ─── Unknown Tool ────────────────────────────────────────────────────────────


class TestUnknownTool:
    def test_unknown_tool_returns_error(self):
        tool_call = ToolCall(id="99", name="nonexistent_tool", arguments={})

        result_text, action = asyncio.run(execute_tool(tool_call, "user1"))

        assert "unknown tool" in result_text.lower()
        assert action is None


# ─── Error Handling ──────────────────────────────────────────────────────────


class TestToolErrors:
    @patch("server.agent.tool_executor.quiz_client")
    def test_exception_returns_error_message(self, mock_client):
        """If a tool raises an exception, it returns an error string, no action."""
        mock_client.get_quiz_details = AsyncMock(side_effect=Exception("Connection timeout"))

        tool_call = ToolCall(id="1", name="start_quiz", arguments={"quiz_id": "abc"})
        result_text, action = asyncio.run(execute_tool(tool_call, "user1"))

        # start_quiz catches exceptions and says "Could not verify" — still no action
        assert "could not verify" in result_text.lower() or "failed" in result_text.lower()
        assert action is None
