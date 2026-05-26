"""DeepSeek provider with native function calling (OpenAI-compatible API)."""

import json
import logging
from collections.abc import AsyncIterator
from uuid import uuid4

import httpx

from server.config import settings
from server.llm.base import (
    ChunkType,
    LLMService,
    Message,
    Role,
    StreamChunk,
    ToolCall,
    ToolDefinition,
)

logger = logging.getLogger(__name__)


class DeepSeekProvider(LLMService):
    """DeepSeek via OpenAI-compatible endpoint (api.deepseek.com)."""

    def __init__(self, api_key: str, model: str = "deepseek-v4-flash"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.deepseek.com/chat/completions"

    async def complete(
        self,
        messages: list[Message],
        tools: list[ToolDefinition] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncIterator[StreamChunk]:
        """Stream from DeepSeek. Supports native function calling."""
        if not self.api_key:
            raise RuntimeError(
                "Full tier requires COACH_EXTERNAL_LLM_API_KEY. Use Lite tier for LM Studio."
            )

        payload: dict = {
            "model": self.model,
            "messages": [self._format_msg(m) for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        if tools:
            payload["tools"] = [self._format_tool(t) for t in tools]
            payload["tool_choice"] = "auto"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        tool_calls_buffer: list[dict] = []

        try:
            async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
                async with client.stream(
                    "POST", self.base_url, json=payload, headers=headers
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break

                        chunk = json.loads(data_str)
                        delta = chunk["choices"][0].get("delta", {})

                        # Content token
                        token = delta.get("content", "")
                        if token:
                            yield StreamChunk(type=ChunkType.CONTENT, content=token)

                        # Tool calls (accumulated across chunks)
                        if "tool_calls" in delta:
                            for tc_delta in delta["tool_calls"]:
                                idx = tc_delta.get("index", 0)
                                while len(tool_calls_buffer) <= idx:
                                    tool_calls_buffer.append(
                                        {"id": "", "name": "", "arguments": ""}
                                    )
                                if "id" in tc_delta:
                                    tool_calls_buffer[idx]["id"] = tc_delta["id"]
                                func = tc_delta.get("function", {})
                                if "name" in func:
                                    tool_calls_buffer[idx]["name"] = func["name"]
                                if "arguments" in func:
                                    tool_calls_buffer[idx]["arguments"] += func[
                                        "arguments"
                                    ]

            # Emit accumulated tool calls
            if tool_calls_buffer:
                parsed_calls = []
                for tc in tool_calls_buffer:
                    try:
                        args = json.loads(tc["arguments"]) if tc["arguments"] else {}
                    except json.JSONDecodeError:
                        args = {}
                    parsed_calls.append(
                        ToolCall(
                            id=tc["id"] or f"call_{uuid4().hex[:8]}",
                            name=tc["name"],
                            arguments=args,
                        )
                    )
                yield StreamChunk(type=ChunkType.TOOL_CALL, tool_calls=parsed_calls)

            yield StreamChunk(
                type=ChunkType.FINISH,
                finish_reason="tool_calls" if tool_calls_buffer else "stop",
            )

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise RuntimeError("DeepSeek rate limit exceeded. Please wait and retry.")
            if e.response.status_code == 401:
                raise RuntimeError("DeepSeek API key invalid. Check COACH_EXTERNAL_LLM_API_KEY.")
            raise

    def _format_msg(self, msg: Message) -> dict:
        """Convert Message to OpenAI-compatible dict."""
        d: dict = {"role": msg.role.value, "content": msg.content or ""}
        if msg.tool_calls:
            d["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.name, "arguments": json.dumps(tc.arguments)},
                }
                for tc in msg.tool_calls
            ]
        if msg.tool_call_id:
            d["tool_call_id"] = msg.tool_call_id
        if msg.name:
            d["name"] = msg.name
        return d

    def _format_tool(self, tool: ToolDefinition) -> dict:
        """Convert ToolDefinition to OpenAI function-calling format."""
        return {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.parameters,
            },
        }

    async def is_available(self) -> bool:
        return bool(self.api_key)
