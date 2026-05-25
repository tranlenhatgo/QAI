"""WebSocket message protocol — data shapes for client↔server communication."""

from dataclasses import dataclass, field
from typing import Any, Literal


# === CLIENT → SERVER ===


@dataclass
class SessionStartMessage:
    type: Literal["session_start"] = "session_start"
    tier: Literal["lite", "full"] = "full"
    mode: Literal["chat", "agentic"] = "chat"
    user_id: str = ""
    kb_id: str = ""
    conversation_id: str = ""


@dataclass
class UserMessage:
    type: Literal["user_message"] = "user_message"
    content: str = ""


@dataclass
class StopMessage:
    type: Literal["stop"] = "stop"


@dataclass
class ModeSwitch:
    type: Literal["mode_switch"] = "mode_switch"
    mode: Literal["chat", "agentic"] = "chat"


# === SERVER → CLIENT ===


def session_ack(session_id: str, tier: str, mode: str, tools: list[str]) -> dict:
    return {
        "type": "session_ack",
        "session_id": session_id,
        "tier": tier,
        "mode": mode,
        "available_tools": tools,
    }


def content_chunk(content: str) -> dict:
    return {"type": "content", "content": content}


def stage_event(stage: str, status: str) -> dict:
    return {"type": "stage", "stage": stage, "status": status}


def tool_event(
    tool_name: str, status: str, arguments: dict | None = None, result: str = ""
) -> dict:
    d: dict[str, Any] = {"type": "tool", "tool_name": tool_name, "status": status}
    if arguments is not None:
        d["arguments"] = arguments
    if result:
        d["result"] = result
    return d


def error_event(code: str, message: str) -> dict:
    return {"type": "error", "code": code, "message": message}


def done_event(cancelled: bool = False) -> dict:
    d: dict[str, Any] = {"type": "done"}
    if cancelled:
        d["cancelled"] = True
    return d
