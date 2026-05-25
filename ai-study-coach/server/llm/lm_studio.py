"""LM Studio provider — OpenAI-compatible local LLM."""

import json
import logging
from collections.abc import AsyncIterator

import httpx

from server.config import settings
from server.llm.base import (
    ChunkType,
    LLMService,
    Message,
    StreamChunk,
    ToolDefinition,
)

logger = logging.getLogger(__name__)


class LMStudioProvider(LLMService):
    """OpenAI-compatible API client for LM Studio (local)."""

    def __init__(self, base_url: str = "http://localhost:1234/v1", model: str = ""):
        self.base_url = base_url.rstrip("/")
        self.model = model or "default"

    async def complete(
        self,
        messages: list[Message],
        tools: list[ToolDefinition] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncIterator[StreamChunk]:
        """Stream tokens from LM Studio. Ignores tools (local models can't handle them)."""
        payload = {
            "model": self.model,
            "messages": [self._format_msg(m) for m in messages],
            "stream": True,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        try:
            async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    json=payload,
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
                        token = delta.get("content", "")
                        if token:
                            yield StreamChunk(type=ChunkType.CONTENT, content=token)

            yield StreamChunk(type=ChunkType.FINISH, finish_reason="stop")

        except httpx.ConnectError:
            raise ConnectionError(
                "LM Studio is not running. Start LM Studio and load a model."
            )

    def _format_msg(self, msg: Message) -> dict:
        """Convert Message to OpenAI dict format."""
        return {"role": msg.role.value, "content": msg.content}

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self.base_url}/models")
                return resp.status_code == 200
        except (httpx.ConnectError, httpx.TimeoutException):
            return False
