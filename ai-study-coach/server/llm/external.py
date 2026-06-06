import httpx
import json
import logging
from collections.abc import AsyncGenerator

from server.config import settings
from server.models.schemas import LLMResponse, ToolCall

logger = logging.getLogger(__name__)

# Provider configs
PROVIDERS = {
    "deepseek": {
        "base_url": "https://api.deepseek.com/chat/completions",
        "default_model": "deepseek-v4-flash",
        "requires_auth": True,
    },
    "lm_studio": {
        "base_url": "",  # constructed dynamically from settings.lm_studio_url
        "default_model": "default",
        "requires_auth": False,
    },
}


class ExternalLLMClient:
    """Client for external LLM APIs using OpenAI-compatible format."""

    def __init__(
        self,
        provider: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
    ):
        self.provider = provider or settings.external_llm_provider
        self.api_key = api_key if api_key is not None else settings.external_llm_api_key
        self.model = model or settings.external_llm_model

        self._provider_config = PROVIDERS.get(self.provider, PROVIDERS["deepseek"])
        if self.provider == "lm_studio":
            self.base_url = f"{settings.lm_studio_url.rstrip('/')}/v1/chat/completions"
        else:
            self.base_url = self._provider_config["base_url"]
        if not self.model:
            self.model = self._provider_config["default_model"]

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self._provider_config.get("requires_auth", True):
            if not self.api_key:
                raise RuntimeError(
                    f"{self.provider} requires COACH_EXTERNAL_LLM_API_KEY."
                )
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _uses_deepseek(self) -> bool:
        return self.provider == "deepseek"

    def _apply_stream_usage_options(self, payload: dict) -> dict:
        if self._uses_deepseek() and payload.get("stream") is True:
            payload["stream_options"] = {"include_usage": True}
        return payload

    def _format_usage(self, usage: dict | None) -> dict[str, int]:
        if not isinstance(usage, dict):
            return {}
        return {
            key: value
            for key, value in usage.items()
            if isinstance(key, str) and isinstance(value, int)
        }

    def _log_cache_usage(self, usage: dict[str, int]) -> None:
        if not self._uses_deepseek():
            return

        cache_hit = usage.get("prompt_cache_hit_tokens")
        cache_miss = usage.get("prompt_cache_miss_tokens")
        if cache_hit is None and cache_miss is None:
            return

        hit_tokens = cache_hit or 0
        miss_tokens = cache_miss or 0
        total_cached_prompt = hit_tokens + miss_tokens
        hit_rate = hit_tokens / total_cached_prompt if total_cached_prompt else 0

        logger.info(
            "DeepSeek prompt cache usage: hit=%s miss=%s hit_rate=%.1f%%",
            hit_tokens,
            miss_tokens,
            hit_rate * 100,
        )

    async def chat(
        self,
        messages: list[dict],
        temperature: float = 0.7,
    ) -> str:
        """Send a chat request and return the full response."""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            resp = await client.post(
                self.base_url,
                json=payload,
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            self._log_cache_usage(self._format_usage(data.get("usage")))
            return data["choices"][0]["message"]["content"]

    async def chat_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        temperature: float = 0.7,
        tool_choice: str = "auto",
    ) -> LLMResponse:
        """Send a chat request with tool definitions, return structured response."""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": False,
            "tools": tools,
            "tool_choice": tool_choice,
        }

        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            resp = await client.post(
                self.base_url,
                json=payload,
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()

        self._log_cache_usage(self._format_usage(data.get("usage")))
        message = data["choices"][0]["message"]
        content = message.get("content")

        # Parse tool calls if present
        raw_tool_calls = message.get("tool_calls")
        tool_calls = None
        if raw_tool_calls:
            tool_calls = []
            for tc in raw_tool_calls:
                func = tc.get("function", {})
                args = func.get("arguments", "{}")
                if isinstance(args, str):
                    args = json.loads(args)
                tool_calls.append(
                    ToolCall(
                        id=tc.get("id", ""),
                        name=func.get("name", ""),
                        arguments=args,
                    )
                )

        return LLMResponse(content=content, tool_calls=tool_calls)

    async def chat_stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """Stream the response token by token."""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        payload = self._apply_stream_usage_options(payload)
        usage: dict[str, int] = {}

        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            async with client.stream(
                "POST",
                self.base_url,
                json=payload,
                headers=self._headers(),
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        chunk = json.loads(data_str)
                        chunk_usage = self._format_usage(chunk.get("usage"))
                        if chunk_usage:
                            usage = chunk_usage

                        choices = chunk.get("choices") or []
                        if not choices:
                            continue

                        delta = choices[0].get("delta", {})
                        token = delta.get("content", "")
                        if token:
                            yield token

        self._log_cache_usage(usage)

    async def chat_stream_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        temperature: float = 0.7,
        tool_choice: str = "auto",
    ) -> LLMResponse | AsyncGenerator[str, None]:
        """Chat with tools support.

        First makes a non-streaming request to check for tool calls.
        If the LLM returns tool calls, returns an LLMResponse.
        If the LLM returns text, re-requests with streaming and returns a generator.
        """
        response = await self.chat_with_tools(
            messages, tools, temperature, tool_choice
        )

        if response.tool_calls:
            return response

        async def _stream():
            async for token in self.chat_stream(messages, temperature):
                yield token

        return _stream()

    async def is_available(self) -> bool:
        """Check if the LLM is available."""
        if self._provider_config.get("requires_auth", True):
            return bool(self.api_key)

        # No-auth provider (LM Studio): check server connectivity
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{settings.lm_studio_url.rstrip('/')}/v1/models")
                return resp.status_code == 200
        except (httpx.ConnectError, httpx.TimeoutException):
            return False


# Singleton
external_client = ExternalLLMClient()
