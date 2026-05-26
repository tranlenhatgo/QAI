# 02 — LLM Service

## Purpose

Provide a unified interface to call LLM providers (LM Studio local, DeepSeek cloud) with streaming support, abstracting provider differences behind a single async API.

---

## Interface Contract

```python
class LLMService(ABC):
    """Abstract LLM provider interface."""

    async def complete(
        self,
        messages: list[Message],
        tools: list[ToolDefinition] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncIterator[StreamChunk]:
        """
        Stream a completion response.
        
        Args:
            messages: Conversation history (system + user + assistant messages)
            tools: Tool definitions for function calling (None = no tools)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            
        Yields:
            StreamChunk objects (content tokens, tool calls, or finish signal)
        """
        ...

    async def complete_sync(
        self,
        messages: list[Message],
        tools: list[ToolDefinition] | None = None,
    ) -> CompletionResult:
        """Non-streaming completion (for internal tool calls like reason)."""
        ...
```

---

## Data Shapes

```python
# server/llm/base.py

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

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
    tool_call_id: str | None = None  # For tool result messages
    name: str | None = None          # Tool name for tool results

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
    CONTENT = "content"       # Text token
    TOOL_CALL = "tool_call"   # Function call request
    FINISH = "finish"         # Generation complete

@dataclass
class StreamChunk:
    type: ChunkType
    content: str = ""                    # For CONTENT chunks
    tool_calls: list[ToolCall] = field(default_factory=list)  # For TOOL_CALL chunks
    finish_reason: str = ""              # For FINISH chunks ("stop", "tool_calls")

@dataclass
class CompletionResult:
    """Non-streaming completion result."""
    content: str
    tool_calls: list[ToolCall]
    finish_reason: str
    usage: dict[str, int]  # {"prompt_tokens": N, "completion_tokens": M}
```

---

## Behavior Specification

### LM Studio Provider (Lite Mode)

```python
# server/llm/lm_studio.py

class LMStudioProvider(LLMService):
    """
    OpenAI-compatible API client for LM Studio.
    
    Key behaviors:
    1. Connects to localhost:1234/v1 (configurable)
    2. Uses OpenAI SDK format (chat/completions)
    3. Does NOT pass tools (local models can't handle them)
    4. Streams tokens via SSE
    """

    def __init__(self, config: LLMConfig):
        self.base_url = config.lm_studio_base_url
        self.model = config.lm_studio_model
        self.client = httpx.AsyncClient(base_url=self.base_url)

    async def complete(self, messages, tools=None, **kwargs):
        # IMPORTANT: Ignore `tools` parameter — local models don't support them
        payload = {
            "model": self.model,
            "messages": [self._format_msg(m) for m in messages],
            "stream": True,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 2048),
        }
        
        async with self.client.stream("POST", "/chat/completions", json=payload) as resp:
            async for line in resp.aiter_lines():
                if line.startswith("data: ") and line != "data: [DONE]":
                    chunk = json.loads(line[6:])
                    delta = chunk["choices"][0]["delta"]
                    if "content" in delta and delta["content"]:
                        yield StreamChunk(type=ChunkType.CONTENT, content=delta["content"])
            
            yield StreamChunk(type=ChunkType.FINISH, finish_reason="stop")
```

### DeepSeek Provider (Full Mode)

```python
# server/llm/deepseek.py

import httpx

class DeepSeekProvider(LLMService):
    """
    DeepSeek API client via OpenAI-compatible endpoint.
    
    Key behaviors:
    1. Uses httpx with SSE streaming to https://api.deepseek.com/chat/completions
    2. Converts ToolDefinition → OpenAI function format
    3. Handles tool_call deltas (accumulates across SSE chunks)
    4. Streams content tokens
    """

    def __init__(self, api_key: str, model: str = "deepseek-v4-flash"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.deepseek.com/chat/completions"
    
    async def complete(self, messages, tools=None, **kwargs):
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [self._format_msg(m) for m in messages],
            "stream": True,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 2048),
        }
        if tools:
            payload["tools"] = [self._convert_tool(t) for t in tools]

        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream("POST", self.base_url, headers=headers, json=payload) as resp:
                if resp.status_code == 401:
                    raise RuntimeError("DeepSeek API key invalid or missing")
                resp.raise_for_status()
                # Parse SSE lines, yield StreamChunk...
                ...

    def _convert_tool(self, tool: ToolDefinition) -> dict:
        """Convert our ToolDefinition to OpenAI function format."""
        return {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.parameters,
            },
        }
    
    def _format_msg(self, msg: Message) -> dict:
        """Convert Message to OpenAI chat format."""
        return {"role": msg.role.value, "content": msg.content or ""}
```

### Provider Factory

```python
# server/llm/__init__.py

def create_llm_provider(tier: str, config: LLMConfig) -> LLMService:
    """Factory: create the correct provider based on tier."""
    if tier == "lite":
        return LMStudioProvider(config)
    elif tier == "full":
        return DeepSeekProvider(
            api_key=config.deepseek_api_key,
            model=config.deepseek_model or "deepseek-v4-flash",
        )
    else:
        raise ValueError(f"Unknown tier: {tier}")
```

---

## Error Handling

```python
class LLMError(Exception):
    """Base LLM error."""
    pass

class ProviderUnavailableError(LLMError):
    """Provider is unreachable (LM Studio not running, API down)."""
    pass

class RateLimitError(LLMError):
    """Rate limit exceeded (DeepSeek free tier: limited RPM)."""
    retry_after: float  # seconds to wait

class InvalidResponseError(LLMError):
    """LLM returned unparseable response."""
    pass
```

Retry strategy:

- `ProviderUnavailableError` → retry 3× with exponential backoff (1s, 2s, 4s)
- `RateLimitError` → wait `retry_after` seconds, then retry once
- `InvalidResponseError` → no retry (log and return error to client)

---

## Acceptance Criteria

- [ ] `LMStudioProvider` streams tokens from a local LM Studio instance
- [ ] `DeepSeekProvider` streams tokens from DeepSeek API
- [ ] `DeepSeekProvider` correctly converts `ToolDefinition` to OpenAI function format
- [ ] `DeepSeekProvider` yields `TOOL_CALL` chunks when LLM requests function calls
- [ ] `LMStudioProvider` ignores `tools` parameter (never sends tool defs to local model)
- [ ] Provider factory returns correct provider for "lite" vs "full"
- [ ] `ProviderUnavailableError` raised within 5s when LM Studio is not running
- [ ] DeepSeek rate limit is handled with retry-after
- [ ] Both providers correctly handle multi-turn conversation history

---

## Dependencies

```text
httpx>=0.25.0                    # For LM Studio (OpenAI-compatible REST)
httpx>=0.27.0                    # For DeepSeek (already included)
```

---

## DeepTutor Reference

| This Module | DeepTutor Equivalent | What Changed |
| ------------- | --------------------- | -------------- |
| `LLMService` (ABC) | `deeptutor/services/llm_service.py` | 2 providers instead of 13 |
| `StreamChunk` | `deeptutor/core/stream.py` `StreamEvent` | Simplified to 3 chunk types |
| `Message` / `ToolCall` | `deeptutor/core/context.py` | Same concept, fewer fields |
| Provider factory | `deeptutor/services/provider_factory.py` | Direct if/else instead of plugin discovery |
| Tool definition format | `deeptutor/core/tool_protocol.py` `ToolDefinition` | Identical JSON Schema approach |
