"""AgenticCapability — LLM + tool-calling loop (Full tier)."""

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from server.llm.base import ChunkType, LLMService, Message, Role, ToolDefinition
from server.tools import BaseTool
from server.ws import content_chunk, stage_event, tool_event

logger = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = 10
MAX_TOOL_CALLS_PER_TURN = 3
TOOL_TIMEOUT_SECONDS = 30.0

AGENTIC_SYSTEM_PROMPT = """You are an AI Study Coach with access to tools.

Your goal is to help students learn effectively by:
1. Analyzing their quiz history and identifying weak areas
2. Providing targeted explanations and practice
3. Creating personalized study recommendations
4. Performing deep reasoning on complex problems when needed

When a student asks a question:
- First consider if you need to look up their quiz history or performance data
- Use the 'reason' tool for complex multi-step problems
- Use 'recommend' after analyzing weaknesses
- Use 'web_search' only if the question requires very current information

Always be encouraging but honest. Show your reasoning process."""


class AgenticCapability:
    """Full-tier agentic: LLM decides which tools to call in a loop."""

    def __init__(
        self,
        provider: LLMService,
        tools: list[BaseTool],
        user_id: str = "",
        kb_id: str = "",
    ):
        self.llm = provider
        self.tools = {t.name: t for t in tools}
        self.user_id = user_id
        self.kb_id = kb_id

    def tool_names(self) -> list[str]:
        return list(self.tools.keys())

    async def run(
        self,
        messages: list[Message],
        on_event: Callable[[dict], Awaitable[None]],
        cancelled: Callable[[], bool],
    ) -> None:
        full_messages = self._ensure_system(messages)
        tool_defs = [t.definition() for t in self.tools.values()]

        for iteration in range(MAX_TOOL_ITERATIONS):
            if cancelled():
                break

            await on_event(stage_event("thinking", "start"))

            # Collect full response
            content_parts: list[str] = []
            tool_calls: list[dict[str, Any]] = []

            async for chunk in self.llm.complete(full_messages, tools=tool_defs):
                if cancelled():
                    break
                if chunk.type == ChunkType.CONTENT:
                    content_parts.append(chunk.content)
                elif chunk.type == ChunkType.TOOL_CALL:
                    for tc in chunk.tool_calls:
                        tool_calls.append({"id": tc.id, "name": tc.name, "arguments": tc.arguments})
                    if chunk.tool_call:
                        tool_calls.append(chunk.tool_call)

            await on_event(stage_event("thinking", "end"))

            # If no tool calls → stream final answer
            if not tool_calls:
                await self._stream_final_answer("".join(content_parts), on_event, cancelled)
                messages.append(Message(role=Role.ASSISTANT, content="".join(content_parts)))
                return

            # Record assistant message with tool calls
            assistant_text = "".join(content_parts)
            from server.llm.base import ToolCall as ToolCallObj
            full_messages.append(Message(
                role=Role.ASSISTANT,
                content=assistant_text or None,
                tool_calls=[
                    ToolCallObj(id=tc["id"], name=tc["name"], arguments=tc["arguments"])
                    for tc in tool_calls
                ],
            ))

            # Execute tools (capped at MAX_TOOL_CALLS_PER_TURN)
            for tc in tool_calls[:MAX_TOOL_CALLS_PER_TURN]:
                if cancelled():
                    break
                result = await self._execute_tool(tc, on_event)
                full_messages.append(Message(
                    role=Role.TOOL,
                    content=result,
                    tool_call_id=tc["id"],
                    name=tc["name"],
                ))

        # Max iterations exhausted → force final response
        if not cancelled():
            await self._force_final_response(full_messages, on_event, cancelled, messages)

    async def _execute_tool(self, tc: dict, on_event: Callable) -> str:
        """Execute a single tool call with timeout."""
        tool_name = tc["name"]
        arguments = tc["arguments"]

        await on_event(tool_event(tool_name, "calling", arguments))

        tool = self.tools.get(tool_name)
        if tool is None:
            error_msg = f"Unknown tool: {tool_name}"
            await on_event(tool_event(tool_name, "error", {"result": error_msg}))
            return error_msg

        try:
            result = await asyncio.wait_for(
                tool.execute(arguments),
                timeout=TOOL_TIMEOUT_SECONDS,
            )
            await on_event(tool_event(tool_name, "result", {"result": result[:500]}))
            return result
        except asyncio.TimeoutError:
            error_msg = f"Tool {tool_name} timed out after {TOOL_TIMEOUT_SECONDS}s"
            await on_event(tool_event(tool_name, "error", {"result": error_msg}))
            return error_msg
        except Exception as e:
            logger.error(f"Tool {tool_name} failed: {e}")
            error_msg = f"Tool error: {e}"
            await on_event(tool_event(tool_name, "error", {"result": error_msg}))
            return error_msg

    async def _stream_final_answer(
        self, content: str, on_event: Callable, cancelled: Callable[[], bool]
    ) -> None:
        """Stream the collected final answer to the client."""
        await on_event(stage_event("responding", "start"))
        # Stream in small chunks for real-time feel
        chunk_size = 20
        for i in range(0, len(content), chunk_size):
            if cancelled():
                break
            await on_event(content_chunk(content[i:i + chunk_size]))
        await on_event(stage_event("responding", "end"))

    async def _force_final_response(
        self, full_messages: list[Message], on_event: Callable, cancelled: Callable, messages: list[Message]
    ) -> None:
        """Force a final answer when max iterations reached."""
        full_messages.append(Message(
            role=Role.USER,
            content="[SYSTEM: Maximum iterations reached. Provide your final answer now based on information gathered so far.]",
        ))

        await on_event(stage_event("responding", "start"))
        final_content = ""
        async for chunk in self.llm.complete(full_messages, tools=None):
            if cancelled():
                break
            if chunk.type == ChunkType.CONTENT:
                final_content += chunk.content
                await on_event(content_chunk(chunk.content))
        await on_event(stage_event("responding", "end"))
        messages.append(Message(role=Role.ASSISTANT, content=final_content))

        # If we exhausted iterations, emit final stage end
        await on_event(stage_event("thinking", "end"))
        messages.append(Message(role=Role.ASSISTANT, content="".join(content_parts)))

    def _ensure_system(self, messages: list[Message]) -> list[Message]:
        if not messages or messages[0].role != Role.SYSTEM:
            return [Message(role=Role.SYSTEM, content=AGENTIC_SYSTEM_PROMPT)] + list(messages)
        return list(messages)
