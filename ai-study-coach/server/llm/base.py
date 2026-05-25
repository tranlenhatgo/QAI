"""LLM provider abstraction layer — base interfaces and data shapes."""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


# ─── Data Shapes ─────────────────────────────────────────────────────────────


class Role(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


@dataclass
class Message:
    role: Role
    content: str
    tool_calls: list["ToolCall"] | None = None
    tool_call_id: str | None = None
    name: str | None = None


@dataclass
class ToolCall:
    """A tool call requested by the LLM."""

    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class ToolDefinition:
    """Tool schema passed to the LLM for function calling."""

    name: str
    description: str
    parameters: dict[str, Any]  # JSON Schema object


class ChunkType(str, Enum):
    CONTENT = "content"
    TOOL_CALL = "tool_call"
    FINISH = "finish"


@dataclass
class StreamChunk:
    type: ChunkType
    content: str = ""
    tool_call: dict[str, Any] | None = None  # Single tool call dict (for TOOL_CALL chunks)
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: str = ""


@dataclass
class CompletionResult:
    """Non-streaming completion result."""

    content: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: str = ""
    usage: dict[str, int] = field(default_factory=dict)


# ─── Abstract Provider ───────────────────────────────────────────────────────


class LLMService(ABC):
    """Abstract LLM provider interface."""

    @abstractmethod
    async def complete(
        self,
        messages: list[Message],
        tools: list[ToolDefinition] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncIterator[StreamChunk]:
        """Stream a completion response."""
        ...

    async def complete_sync(
        self,
        messages: list[Message],
        tools: list[ToolDefinition] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> CompletionResult:
        """Non-streaming completion (collects all chunks)."""
        content = ""
        tool_calls: list[ToolCall] = []
        finish_reason = ""

        async for chunk in self.complete(messages, tools, temperature, max_tokens):
            if chunk.type == ChunkType.CONTENT:
                content += chunk.content
            elif chunk.type == ChunkType.TOOL_CALL:
                tool_calls.extend(chunk.tool_calls)
            elif chunk.type == ChunkType.FINISH:
                finish_reason = chunk.finish_reason

        return CompletionResult(
            content=content,
            tool_calls=tool_calls,
            finish_reason=finish_reason,
        )
