# 04 — Implementation Rules

> Coding rules and constraints for AI agents implementing the AI Study Coach.

---

## Rule 1: Follow the SDD Spec

The SDD files (`01-ARCHITECTURE.md` through `10-LITE-ORCHESTRATOR.md`) are the **source of truth**. If you're unsure how something should work, the SDD spec defines it.

Implementation order:

```text
Phase 1: 01-ARCHITECTURE → 02-LLM-SERVICE → 03-WEBSOCKET-API
Phase 2: 04-CHAT-CAPABILITY
Phase 3: 05-AGENTIC-LOOP → 06-TOOLS-REGISTRY → 07-RAG-TOOL
Phase 4: 08-QUIZ-GENERATION → 09-STEP-SOLVE → 10-LITE-ORCHESTRATOR
```

---

## Rule 2: 600-Line File Limit

**No single Python file should exceed 600 lines.**

When approaching the limit, split into a package:

```python
# Before (one file getting too big):
server/capabilities/agentic.py  # 750 lines ❌

# After (split into package):
server/capabilities/agentic/
├── __init__.py              # Re-exports: from .capability import AgenticCapability
├── capability.py            # Main class with run() method
├── tool_executor.py         # _execute_tool() and related logic  
└── prompts.py               # System prompts as constants
```

---

## Rule 3: Naming Conventions

```python
# Files: snake_case
server/tools/quiz_history.py
server/capabilities/lite_orchestrator.py

# Classes: PascalCase
class QuizHistoryTool(BaseTool): ...
class LiteOrchestrator: ...
class DeepSeekProvider(LLMService): ...

# Functions/methods: snake_case
async def execute(self, arguments: dict) -> str: ...
def _format_results(self, results: list) -> str: ...

# Constants: UPPER_SNAKE_CASE
MAX_ITERATIONS = 10
AGENTIC_SYSTEM_PROMPT = """..."""

# Private methods: leading underscore
def _parse_quiz_response(self, response: str) -> Quiz: ...
async def _execute_step(self, ...) -> SolveStep: ...
```

---

## Rule 4: Type Hints Everywhere

```python
# Always type function signatures:
async def execute(self, arguments: dict[str, Any]) -> str: ...

# Use dataclasses for data shapes:
@dataclass
class StreamChunk:
    type: ChunkType
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)

# Use | for unions (Python 3.10+):
tools: list[ToolDefinition] | None = None
```

---

## Rule 5: Async by Default

Everything that touches I/O should be async:

```python
# ✅ Correct:
async def execute(self, arguments: dict) -> str:
    response = await self.client.get(f"/take-quiz/player/{user_id}")
    return self._format(response.json())

# ❌ Wrong:
def execute(self, arguments: dict) -> str:
    response = requests.get(f"/take-quiz/player/{user_id}")  # Blocks event loop!
    return self._format(response.json())
```

Use `httpx.AsyncClient` (not `requests`). Use `asyncio` for concurrency.

---

## Rule 6: Error Handling Strategy

```python
# Layer 1: Tool execution — catch and return as string
async def _execute_tool(self, tool_call, on_event):
    try:
        result = await tool.execute(arguments)
        return result
    except Exception as e:
        return f"Error: {str(e)}"  # LLM sees this, adapts

# Layer 2: Capability — catch and emit error event
async def run(self, messages, on_event, cancelled):
    try:
        await self._do_work(...)
    except ProviderUnavailableError as e:
        await on_event({"type": "error", "code": "provider_unavailable", "message": str(e)})
    except Exception as e:
        await on_event({"type": "error", "code": "internal", "message": str(e)})

# Layer 3: WebSocket handler — never crash the connection
async def handle_user_message(websocket, session, content):
    try:
        await session.capability.run(...)
    except Exception as e:
        await websocket.send_json({"type": "error", "code": "internal", "message": str(e)})
```

**Never** let an unhandled exception kill the WebSocket connection.

---

## Rule 7: Don't Over-Abstract

```python
# ❌ Over-engineered (DeepTutor-style):
class ToolRegistryFactory:
    def create_registry(self, config: RegistryConfig) -> ToolRegistry:
        registry = ToolRegistry()
        for tool_spec in config.tool_specs:
            tool_class = import_string(tool_spec.class_path)
            tool = tool_class(**tool_spec.kwargs)
            registry.register(tool)
        return registry

# ✅ Simple (Study Coach-style):
def create_full_registry(config: AppConfig) -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(RAGTool(config.rag))
    registry.register(ReasonTool(config.llm))
    registry.register(QuizHistoryTool(config.java_backend))
    registry.register(RecommendTool(config.java_backend))
    registry.register(WebSearchTool())
    return registry
```

---

## Rule 8: Configuration

```python
# Use pydantic-settings with environment variables:
class AppConfig(BaseSettings):
    deepseek_api_key: str = ""
    lm_studio_base_url: str = "http://localhost:1234/v1"
    
    class Config:
        env_prefix = "AI_COACH_"

# Access via dependency injection (FastAPI):
@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket, config: AppConfig = Depends(get_config)):
    ...
```

**Never** hardcode URLs, API keys, or model names in source code.

---

## Rule 9: Testing Strategy

```python
# Unit test each tool independently:
async def test_rag_tool_returns_results():
    tool = RAGTool(mock_config)
    result = await tool.execute({"query": "photosynthesis"})
    assert "relevant" in result or "No relevant" in result

# Integration test the agentic loop:
async def test_agentic_loop_calls_tool_and_responds():
    mock_llm = MockLLM(responses=[
        # First call: LLM requests a tool
        StreamChunk(type=ChunkType.TOOL_CALL, tool_calls=[...]),
        # Second call: LLM responds with text
        StreamChunk(type=ChunkType.CONTENT, content="Based on..."),
    ])
    capability = AgenticCapability(provider=mock_llm, tools=[mock_tool])
    events = []
    await capability.run(messages, on_event=events.append, cancelled=lambda: False)
    assert any(e["type"] == "content" for e in events)

# WebSocket test:
async def test_ws_chat_flow():
    async with websocket_connect("/ws") as ws:
        await ws.send_json({"type": "session_start", "tier": "full", "mode": "chat"})
        ack = await ws.receive_json()
        assert ack["type"] == "session_ack"
```

---

## Rule 10: Dependencies

Minimal dependency set. Don't add libraries for things you can do in 10 lines.

```text
# CORE (required):
fastapi
uvicorn[standard]
pydantic-settings
httpx
websockets
google-generativeai

# RAG (required for Full mode):
pymupdf
sentence-transformers  # OR use Google embeddings only

# OPTIONAL:
duckduckgo-search     # For web search tool
```

**Don't add**: LangChain, LlamaIndex, AutoGen, CrewAI, or any "framework" library. Raw SDK + your own abstractions = cleaner thesis code.

---

## Rule 11: Project Structure Convention

```text
ai-study-coach/
├── server/                    ← Main Python package
│   ├── __init__.py
│   ├── main.py                  ← FastAPI app + uvicorn entry
│   ├── config.py                ← Single config file (Pydantic Settings)
│   ├── router.py                ← Mode routing (tier + mode → capability)
│   ├── ws/                      ← WebSocket layer
│   ├── llm/                     ← LLM provider abstraction
│   ├── capabilities/            ← Business logic (chat, agentic, quiz, solve)
│   ├── tools/                   ← Tool implementations
│   └── services/                ← External service clients (Java BE, Supabase)
├── tests/                       ← Mirrors server/ structure
├── pyproject.toml
├── requirements.txt
├── .env.example
└── README.md
```

---

## Rule 12: Git Commit Convention

```text
feat: add RAG tool with Supabase pgvector
fix: handle DeepSeek rate limit with retry
refactor: split agentic capability into package
test: add integration tests for WebSocket flow
docs: update SDD with implementation notes
```

One logical change per commit. Don't mix feature + refactor in one commit.

---

## Rule 13: Security

```python
# Never log API keys:
logger.info(f"Using provider: {config.provider}")  # ✅
logger.info(f"API key: {config.deepseek_api_key}")    # ❌ NEVER

# Validate user input:
if len(content) > 10_000:
    await on_event({"type": "error", "message": "Message too long"})
    return

# Rate limit WebSocket messages:
# Max 10 messages per minute per connection

# Don't expose internal errors to client:
except Exception as e:
    logger.exception("Internal error")
    await on_event({"type": "error", "code": "internal", "message": "An error occurred"})
    # NOT: message=str(e) which might leak stack traces
```
