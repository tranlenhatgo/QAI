# 03 — Patterns to Follow from DeepTutor

> Design patterns worth replicating in the AI Study Coach, with examples from DeepTutor source.

---

## Pattern 1: Tool as Protocol (Interface)

**Where in DeepTutor**: `deeptutor/core/tool_protocol.py`

**Pattern**: Every tool implements the same abstract interface. The agentic loop doesn't know (or care) about specific tools — it just calls `execute()`.

```python
# DeepTutor pattern:
class BaseTool(ABC):
    @property
    def name(self) -> str: ...
    @property  
    def description(self) -> str: ...
    def get_definition(self) -> ToolDefinition: ...
    async def execute(self, args: dict, context: UnifiedContext) -> ToolResult: ...
```

**Study Coach equivalent** (simplified):

```python
class BaseTool(ABC):
    name: str
    description: str
    def parameters_schema(self) -> dict: ...
    async def execute(self, arguments: dict) -> str: ...
    def definition(self) -> ToolDefinition: ...
```

**Key insight**: Keep the tool interface minimal. `execute()` takes a dict, returns a string. The agentic loop doesn't need to know what the tool does internally.

---

## Pattern 2: Streaming via Callback

**Where in DeepTutor**: `deeptutor/core/stream_bus.py`

**Pattern**: Instead of returning a complete response, capabilities stream events through a bus/callback. This enables real-time UI updates.

```python
# DeepTutor pattern:
class StreamBus:
    async def content(self, text: str, source: str) -> None: ...
    async def stage(self, name: str, source: str) -> AsyncContextManager: ...
    async def result(self, data: dict, source: str) -> None: ...
```

**Study Coach equivalent** (simplified to a callback):

```python
# Instead of a StreamBus class, use a simple callback:
async def on_event(event: dict) -> None:
    await websocket.send_json(event)

# Capability calls it:
await on_event({"type": "content", "content": "Hello"})
await on_event({"type": "stage", "stage": "thinking", "status": "start"})
```

**Key insight**: DeepTutor's `StreamBus` is powerful but complex (fan-out, multiple subscribers). A simple async callback achieves the same result for a single WebSocket client.

---

## Pattern 3: Provider Abstraction

**Where in DeepTutor**: `deeptutor/services/llm_service.py` + `providers/`

**Pattern**: LLM providers are interchangeable behind a common interface. Switch provider by changing config, not code.

```python
# DeepTutor pattern:
class LLMService:
    async def stream_completion(self, messages, tools=None) -> AsyncIterator: ...
    async def complete(self, messages, tools=None) -> CompletionResult: ...

# Factory:
def create_provider(name: str, config: dict) -> LLMService: ...
```

**Study Coach equivalent**:

```python
class LLMService(ABC):
    async def complete(self, messages, tools=None) -> AsyncIterator[StreamChunk]: ...

def create_llm_provider(tier: str, config: LLMConfig) -> LLMService:
    if tier == "lite":
        return LMStudioProvider(config)
    else:
        return GeminiProvider(config)
```

**Key insight**: Even with only 2 providers, use an abstract interface. It makes testing easy (mock the interface) and future providers trivial to add.

---

## Pattern 4: Message History as List

**Where in DeepTutor**: `deeptutor/core/context.py`

**Pattern**: Conversation state is a list of `Message` objects passed through the system. Each component appends to it.

```python
# Standard pattern across all LLM frameworks:
messages = [
    Message(role="system", content="You are..."),
    Message(role="user", content="Hello"),
    Message(role="assistant", content="Hi!"),
    Message(role="user", content="Help me with..."),
]
```

**Key insight**: Don't invent a custom state format. Use the standard `messages[]` array that maps directly to the OpenAI/Gemini API format.

---

## Pattern 5: Stage Events for UX

**Where in DeepTutor**: `StreamBus.stage()` context manager

**Pattern**: Emit "stage" events so the frontend can show progress indicators (thinking..., searching..., generating...).

```python
# DeepTutor pattern:
async with stream.stage("planning", source=self.name):
    plan = await self._create_plan(context)

# Study Coach pattern:
await on_event({"type": "stage", "stage": "planning", "status": "start"})
plan = await self._create_plan(...)
await on_event({"type": "stage", "stage": "planning", "status": "end"})
```

**Key insight**: Stage events are cheap to emit and dramatically improve UX. The frontend shows a spinner with stage name.

---

## Pattern 6: Config-Driven Feature Gating

**Where in DeepTutor**: `deeptutor/config/` + capability/tool registries

**Pattern**: Features are enabled/disabled via configuration, not code changes.

```python
# DeepTutor pattern:
enabled_tools = config.get("tools.enabled", "all")
for tool_type in BUILTIN_TOOL_TYPES:
    if enabled_tools != "all" and tool.name not in enabled_tools:
        continue
    registry.register(tool)
```

**Study Coach equivalent**:

```python
# Mode determines available tools:
if mode == Mode.AGENTIC and tier == Tier.FULL:
    tools = create_full_registry(config)
elif mode == Mode.AGENTIC and tier == Tier.LITE:
    tools = None  # Lite orchestrator handles this differently
else:
    tools = None  # Chat mode has no tools
```

---

## Pattern 7: Argument Augmentation (Server-Side Injection)

**Where in DeepTutor**: `deeptutor/core/agentic/tool_dispatcher.py`

**Pattern**: Some tool arguments are injected by the server, not provided by the LLM. This prevents the LLM from needing to know session details.

```python
# DeepTutor pattern (in tool_dispatcher):
if tool.name == "rag" and "kb_name" not in args:
    args["kb_name"] = context.knowledge_bases[0]

# Study Coach pattern:
if tool_call.name == "quiz_history" and "user_id" not in arguments:
    arguments["user_id"] = session.user_id
```

**Key insight**: The LLM shouldn't need to know the user_id or kb_id. Inject these server-side before calling the tool.

---

## Pattern 8: Forced Termination

**Where in DeepTutor**: `iteration_scheduler.py` `_force_terminal_label()`

**Pattern**: If the agentic loop hits max iterations, force the LLM to produce a final answer by removing tool definitions.

```python
# DeepTutor pattern:
if iteration >= max_iterations:
    # Call LLM one more time WITHOUT tools
    response = await llm.complete(messages, tools=None)
    # LLM must answer directly since it can't call tools

# Study Coach uses the same approach (see 05-AGENTIC-LOOP.md)
```

**Key insight**: Always have an escape hatch. Never let the loop run forever.

---

## Pattern 9: Error as Tool Result (Not Exception)

**Where in DeepTutor**: `tool_dispatcher.py` error handling

**Pattern**: When a tool fails, return the error as a string result (not throw an exception). This lets the LLM see the error and adapt.

```python
# DeepTutor pattern:
try:
    result = await tool.execute(args, context)
except Exception as e:
    result = ToolResult(content=f"Error: {str(e)}", is_error=True)
# Result is fed back to LLM in the next iteration

# Study Coach:
try:
    result = await tool.execute(arguments)
except Exception as e:
    result = f"Tool {tool_name} failed: {str(e)}"
# LLM sees this and can try a different approach
```

**Key insight**: Don't crash on tool failures. The LLM is resilient — it can work around failed tools.

---

## Pattern 10: Separation of Concerns (Capability vs Tool)

**Where in DeepTutor**: Architecture split between `capabilities/` and `tools/`

**Pattern**:

- **Tool** = single atomic function (search, calculate, fetch)
- **Capability** = multi-step workflow that may use tools

```text
Tool:       "Search the knowledge base" → returns text
Capability: "Generate a quiz" → searches KB → plans questions → generates → validates
```

**Study Coach application**:

- `rag`, `reason`, `quiz_history`, `recommend`, `web_search` → Tools
- `chat`, `agentic`, `quiz_generation`, `step_solve` → Capabilities
- `LiteOrchestrator` → Capability that uses Java BE directly (no tools)

---

## Anti-Patterns to AVOID (from DeepTutor Complexity)

| DeepTutor Does This | Study Coach Should NOT |
| -------------------- | ----------------------- |
| Plugin discovery from manifest.yaml | Just import directly |
| 13+ provider implementations | 2 providers with if/else |
| Label-based text protocol parsing | Native function calling (Gemini) |
| Dynamic capability routing (auto) | Explicit mode selection by user |
| Multiple abstraction layers (Tool → Wrapper → Builtin → Impl) | Flat: BaseTool → Implementation |
| Complex event bus with multiple subscribers | Simple callback function |
| Custom vector store implementations | Supabase pgvector (hosted) |
| Runtime class loading from string paths | Direct imports |
