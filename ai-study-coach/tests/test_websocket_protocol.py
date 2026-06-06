"""
Tests for ws/ — WebSocket message protocol (parsing and serialization).

Covers:
- Client→Server message dataclasses
- Server→Client event builders
- Message shape validation
"""

import pytest

from server.ws import (
    SessionStartMessage,
    UserMessage,
    StopMessage,
    ModeSwitch,
    session_ack,
    content_chunk,
    stage_event,
    tool_event,
    error_event,
    done_event,
)


# ─── Client → Server Messages ───────────────────────────────────────────────


class TestClientMessages:
    def test_session_start_defaults(self):
        msg = SessionStartMessage()
        assert msg.type == "session_start"
        assert msg.tier == "lite"
        assert msg.mode == "chat"
        assert msg.user_id == ""
        assert msg.kb_id == ""
        assert msg.conversation_id == ""

    def test_session_start_custom(self):
        msg = SessionStartMessage(
            tier="full", mode="agentic", user_id="u1", kb_id="kb1"
        )
        assert msg.tier == "full"
        assert msg.mode == "agentic"
        assert msg.user_id == "u1"
        assert msg.kb_id == "kb1"

    def test_user_message_defaults(self):
        msg = UserMessage()
        assert msg.type == "user_message"
        assert msg.content == ""

    def test_user_message_with_content(self):
        msg = UserMessage(content="Hello coach!")
        assert msg.content == "Hello coach!"

    def test_stop_message(self):
        msg = StopMessage()
        assert msg.type == "stop"

    def test_mode_switch_defaults(self):
        msg = ModeSwitch()
        assert msg.type == "mode_switch"
        assert msg.mode == "chat"

    def test_mode_switch_agentic(self):
        msg = ModeSwitch(mode="agentic")
        assert msg.mode == "agentic"


# ─── Server → Client Events ─────────────────────────────────────────────────


class TestServerEvents:
    def test_session_ack(self):
        event = session_ack("sess-123", "full", "agentic", ["quiz_history", "recommend"])
        assert event["type"] == "session_ack"
        assert event["session_id"] == "sess-123"
        assert event["tier"] == "full"
        assert event["mode"] == "agentic"
        assert event["available_tools"] == ["quiz_history", "recommend"]

    def test_content_chunk(self):
        event = content_chunk("Hello, how can I help?")
        assert event["type"] == "content"
        assert event["content"] == "Hello, how can I help?"

    def test_content_chunk_empty(self):
        event = content_chunk("")
        assert event["type"] == "content"
        assert event["content"] == ""

    def test_stage_event(self):
        event = stage_event("analyzing", "start")
        assert event["type"] == "stage"
        assert event["stage"] == "analyzing"
        assert event["status"] == "start"

    def test_stage_event_end(self):
        event = stage_event("fetching_data", "end")
        assert event["stage"] == "fetching_data"
        assert event["status"] == "end"

    def test_tool_event_basic(self):
        event = tool_event("quiz_history", "running")
        assert event["type"] == "tool"
        assert event["tool_name"] == "quiz_history"
        assert event["status"] == "running"
        assert "arguments" not in event
        assert "result" not in event

    def test_tool_event_with_arguments(self):
        event = tool_event("search_quizzes", "running", arguments={"category": "math"})
        assert event["arguments"] == {"category": "math"}

    def test_tool_event_with_result(self):
        event = tool_event("quiz_history", "done", result="Found 5 quizzes")
        assert event["result"] == "Found 5 quizzes"

    def test_tool_event_full(self):
        event = tool_event(
            "recommend", "done",
            arguments={"user_id": "u1"},
            result="Study math next"
        )
        assert event["type"] == "tool"
        assert event["tool_name"] == "recommend"
        assert event["status"] == "done"
        assert event["arguments"] == {"user_id": "u1"}
        assert event["result"] == "Study math next"

    def test_error_event(self):
        event = error_event("auth_failed", "Invalid API key")
        assert event["type"] == "error"
        assert event["code"] == "auth_failed"
        assert event["message"] == "Invalid API key"

    def test_done_event_normal(self):
        event = done_event()
        assert event["type"] == "done"
        assert "cancelled" not in event

    def test_done_event_cancelled(self):
        event = done_event(cancelled=True)
        assert event["type"] == "done"
        assert event["cancelled"] is True

    def test_done_event_not_cancelled(self):
        event = done_event(cancelled=False)
        assert event["type"] == "done"
        assert "cancelled" not in event  # False means don't include key
