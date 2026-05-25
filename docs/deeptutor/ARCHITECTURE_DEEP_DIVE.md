# DeepTutor — Architecture Deep Dive

## Table of Contents

1. [Tool Call Flow (Example: `ask_user`)](#tool-call-flow)
2. [Agent / Capability Flow (Example: `deep_question`)](#agent--capability-flow)
3. [Can a 2B/4B Local Model Run This?](#local-model-feasibility)

---

## Tool Call Flow

### Overview

Tools are **Level 1** primitives — lightweight, single-function utilities that the LLM invokes on-demand during an agentic chat loop. The system uses OpenAI-compatible function-calling protocol.

### Architecture Layers

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         USER INPUT                                    │
└─────────────────────────────────┬────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│               ChatOrchestrator.handle(context)                        │
│   • Resolves active capability (defaults to "chat")                  │
│   • Creates StreamBus for event fan-out                              │
│   • Launches capability.run(context, stream)                         │
└─────────────────────────────────┬────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│            AgenticChatPipeline.run(context, stream)                    │
│   • Assembles system prompt + message history                        │
│   • Builds tool schemas from ToolRegistry                            │
│   • Enters the AGENTIC LOOP                                          │
└─────────────────────────────────┬────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│               AGENTIC LOOP (run_agentic_loop)                         │
│                                                                       │
│   Each iteration:                                                     │
│   1. Call LLM with messages + tool schemas                           │
│   2. Parse first-line protocol label:                                │
│      • FINISH → final answer, exit loop                              │
│      • TOOL   → extract tool_calls, dispatch them                    │
│      • THINK  → internal reasoning, continue loop                    │
│      • PAUSE  → visible reasoning, continue loop                     │
│   3. On TOOL label → dispatch_tool_calls() in parallel               │
│   4. Append tool results as role=tool messages                       │
│   5. Loop back to step 1                                             │
└──────────────────────────────────────────────────────────────────────┘
```

### Complete `ask_user` Tool Call Flow (Step by Step)

Here's the full lifecycle when the LLM decides it needs to ask the user a clarifying question:

#### Step 1: Tool Schema Registration

At startup, `ToolRegistry.load_builtins()` instantiates all tools in `BUILTIN_TOOL_TYPES`, including `AskUserTool`. Each tool provides its OpenAI function-calling schema:

```python
# deeptutor/tools/builtin/__init__.py
class AskUserTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="ask_user",
            description="Pause the conversation to ask 1-3 clarifying questions...",
            parameters=[
                ToolParameter(name="questions", type="array", ...),
                ToolParameter(name="intro", type="string", ...),
            ],
        )
```

The registry converts this to OpenAI format via `ToolDefinition.to_openai_schema()`:

```json
{
  "type": "function",
  "function": {
    "name": "ask_user",
    "description": "Pause the conversation to ask...",
    "parameters": {
      "type": "object",
      "properties": {
        "questions": { "type": "array", "items": { "type": "object", ... } },
        "intro": { "type": "string", ... }
      },
      "required": []
    }
  }
}
```

#### Step 2: LLM Decides to Call the Tool

During an iteration of the agentic loop, the LLM outputs a `TOOL` label followed by structured tool_calls in its response. The `run_labeled_step()` function streams the response and detects the label:

```text
``TOOL``
[tool_calls with ask_user arguments]
```

The loop recognizes `TOOL` and extracts the tool call:

```json
{
  "id": "call_abc123",
  "function": {
    "name": "ask_user",
    "arguments": "{\"questions\": [{\"prompt\": \"What difficulty level?\", \"options\": [\"Easy\", \"Medium\", \"Hard\"]}]}"
  }
}
```

#### Step 3: Tool Dispatch

`dispatch_tool_calls()` in `deeptutor/core/agentic/tool_dispatch.py` runs all tool calls in parallel (up to `MAX_PARALLEL_TOOL_CALLS = 8`):

1. Resolves the tool name through `ToolRegistry.get("ask_user")`
2. Parses JSON arguments
3. Calls `AskUserTool.execute(**kwargs)`

#### Step 4: Tool Execution

```python
# deeptutor/tools/builtin/__init__.py
class AskUserTool(BaseTool):
    async def execute(self, **kwargs) -> ToolResult:
        from deeptutor.tools.ask_user import build_ask_user_payload

        payload, err = build_ask_user_payload(
            questions=kwargs.get("questions"),
            intro=kwargs.get("intro"),
        )
        if payload is None:
            return ToolResult(content=err, success=False)

        return ToolResult(
            content="[awaiting user reply to: What difficulty level?]",
            metadata={"ask_user": payload.to_dict()},
            pause_for_user=payload.to_dict(),  # ← KEY SIGNAL
        )
```

The `build_ask_user_payload()` function in `deeptutor/tools/ask_user.py`:

- Validates/normalizes the questions (max 3 questions, max 8 options each)
- Enforces character limits (800 chars per question, 120 per option)
- Deduplicates option text
- Assigns stable question IDs
- Returns a structured `AskUserPayload` dataclass

#### Step 5: Pause Signal Propagation

Back in `dispatch_tool_calls()`, the `DispatchOutcome` is assembled:

```python
@dataclass(frozen=True)
class DispatchOutcome:
    tool_messages: list[dict]   # role=tool messages for next LLM call
    pause: bool = False         # ← True because pause_for_user was set
    pause_payload: dict = None  # ← The ask_user card data
    pause_tool_call_id: str     # ← Which tool_call to replace with answer
```

#### Step 6: Loop Pauses

The agentic loop's `LoopHost.resolve_pause()` is called. It:

1. Emits a `pending_user_input` StreamEvent through the StreamBus
2. Waits on an async reply queue for the user's answer
3. When the answer arrives, substitutes it into the matching `role=tool` message content (replacing the placeholder)
4. Returns `True` → the loop **resumes** from where it left off

#### Step 7: Frontend Rendering

The `StreamBus` fans out events to consumers:

- **WebSocket API** → pushes the `pending_user_input` event with the payload to the browser
- **Frontend** → `AskUserOptions.tsx` reads `tool_result.metadata.ask_user` and renders a card with tabs, option chips, and free-text fields
- **User submits** → answer travels back via WebSocket → injected into the reply queue

#### Step 8: Loop Resumes

The tool message content changes from:

```text
[awaiting user reply to: What difficulty level?]
```

to:

```text
User answered: Medium
```

The next LLM iteration sees this as the tool result and proceeds accordingly (e.g., generates medium-difficulty questions).

### Key Data Structures

| Structure | File | Purpose |
| --- | --- | --- |
| `ToolDefinition` | `core/tool_protocol.py` | Schema metadata for function calling |
| `ToolResult` | `core/tool_protocol.py` | Standardized return value with `pause_for_user` signal |
| `AskUserPayload` | `tools/ask_user.py` | Validated question card structure |
| `DispatchOutcome` | `core/agentic/tool_dispatch.py` | Aggregated tool execution results |
| `StreamEvent` | `core/stream.py` | Unified streaming event format |
| `StreamBus` | `core/stream_bus.py` | Async fan-out channel |

### Label Protocol (Chat)

The chat capability uses a 4-label protocol:

| Label | Meaning | Loop Behavior |
| --- | --- | --- |
| `FINISH` | Final answer ready | Terminal — exit loop, stream text to user |
| `TOOL` | Need to call tools | Dispatch tools → append results → next iteration |
| `THINK` | Internal reasoning | Append as context → next iteration (hidden from user) |
| `PAUSE` | Visible reasoning | Same as THINK but text streams into chat bubble |

---

## Agent / Capability Flow

<!-- markdownlint-disable-next-line MD024 -->
### Overview

Capabilities are **Level 2** primitives — multi-step agent pipelines that take over the conversation when the user selects a "deep mode." They orchestrate multiple LLM calls, tool invocations, and structured outputs.

### Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                  ChatOrchestrator.handle(context)                      │
│   context.active_capability = "deep_question"                         │
└─────────────────────────────────┬────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│           CapabilityRegistry.get("deep_question")                     │
│   → Returns DeepQuestionCapability instance                          │
└─────────────────────────────────┬────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│         DeepQuestionCapability.run(context, stream)                    │
│   Routes to one of:                                                   │
│   • Followup path (single question follow-up)                        │
│   • Custom mode (full QuestionPipeline)                              │
│   • Mimic mode (PDF exam paper → template extraction)                │
└─────────────────────────────────┬────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│              QuestionPipeline.run(context, ...)                        │
│                                                                       │
│   Phase 1: EXPLORE (agentic loop with tools)                         │
│   Phase 2: PLAN   (single labeled step, no tools)                    │
│   Phase 3: QUIZ   (per-question agentic loops)                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Complete `deep_question` Flow (Custom Mode)

#### Step 1: Capability Discovery & Registration

At startup, `CapabilityRegistry.load_builtins()` instantiates capabilities from `BUILTIN_CAPABILITY_CLASSES`. Each declares a manifest:

```python
# deeptutor/capabilities/deep_question.py
class DeepQuestionCapability(BaseCapability):
    manifest = CapabilityManifest(
        name="deep_question",
        description="Fast question generation (Template batches -> Generate).",
        stages=["ideation", "generation"],
        tools_used=["rag", "web_search", "code_execution"],
        cli_aliases=["quiz"],
    )
```

#### Step 2: Orchestrator Routing

When the user selects "Deep Question" mode in the UI, the `UnifiedContext` carries:

```python
context.active_capability = "deep_question"
context.config_overrides = {
    "mode": "custom",
    "topic": "Linear Algebra",
    "num_questions": 5,
    "difficulty": "medium",
    "question_types": ["multiple_choice", "short_answer"],
}
```

`ChatOrchestrator.handle()` looks up the capability and calls `capability.run(context, stream)`.

#### Step 3: Mode Routing Inside the Capability

`DeepQuestionCapability.run()` inspects the context:

1. **Followup mode** — If `context.metadata["question_followup_context"]` has a `question` field, delegates to `FollowupAgent` (single-call reply about a prior question).
2. **Custom mode** — Instantiates `QuestionPipeline` for the full explore → plan → quiz flow.
3. **Mimic mode** — Parses a PDF exam paper into templates, then runs the pipeline with `templates_override`.

#### Step 4: QuestionPipeline — Phase 1 (Explore)

Uses the same agentic loop engine as chat, with a 3-label protocol:

```python
_PROTOCOL_EXPLORE = LabelProtocol(
    allowed=("THINK", "TOOL", "FINISH"),
    terminal=frozenset({"FINISH"}),
    intermediate=frozenset({"THINK"}),
    final=frozenset({"FINISH"}),
    tool_label="TOOL",
)
```

The LLM:

- Calls tools (RAG to search knowledge bases, web_search, etc.)
- Builds understanding of the topic
- Emits `FINISH` with a brief user-facing preface ("I researched X; now generating questions")
- Prior quiz history is fed in so the model avoids duplicates

#### Step 5: QuestionPipeline — Phase 2 (Plan)

A single `run_labeled_step()` call with a `PLAN` label:

- No tools, no loop
- LLM outputs a JSON plan:

```json
[
  {"question_id": "q1", "topic": "Matrix multiplication", "question_type": "multiple_choice", "difficulty": "medium"},
  {"question_id": "q2", "topic": "Eigenvalues", "question_type": "short_answer", "difficulty": "medium"},
  ...
]
```

- Streams into the trace panel for developer visibility

#### Step 6: QuestionPipeline — Phase 3 (Quiz)

For **each template** in the plan, a separate agentic loop runs:

- Same `THINK / TOOL / FINISH` protocol
- `FINISH` must output strict JSON describing one question
- If JSON parsing fails → one-shot repair attempt (re-prompt with schema error)
- On success, emits a `quiz_question_emitted` StreamEvent
- Frontend renders each question card incrementally as it arrives

#### Step 7: Result Emission

After all questions are generated:

```python
await emit_capability_result(stream, {
    "questions": [...],
    "mode": "custom",
    "topic": "Linear Algebra",
}, source="deep_question", usage=usage_tracker)
```

This produces a `StreamEvent(type=RESULT)` consumed by the frontend to render the final quiz UI.

### StreamBus Event Flow (Timeline)

```text
Time →

STAGE_START("exploring")
  TOOL_CALL(rag, {query: "linear algebra"})
  TOOL_RESULT(rag, "Matrix multiplication is...")
  CONTENT("I've researched the topic...")
STAGE_END("exploring")

STAGE_START("planning")
  THINKING("Generating plan for 5 questions...")
STAGE_END("planning")

STAGE_START("quizzing")
  TOOL_CALL(code_execution, {intent: "verify answer"})
  TOOL_RESULT(code_execution, "x = 4")
  RESULT({question_id: "q1", ...})  ← quiz_question_emitted
  RESULT({question_id: "q2", ...})
  ...
STAGE_END("quizzing")

RESULT({questions: [...], mode: "custom"})  ← capability_result
DONE
```

### Key Differences: Tool vs Capability

| Aspect | Tool (Level 1) | Capability (Level 2) |
| --- | --- | --- |
| Complexity | Single function call | Multi-step pipeline with multiple LLM calls |
| Who calls it | The LLM during an agentic loop | The Orchestrator based on user selection |
| Control flow | Returns `ToolResult`, loop continues | Owns the entire turn lifecycle |
| Streaming | Minimal (progress events) | Full stage-based streaming protocol |
| Tools access | N/A (IS a tool) | Composes multiple tools inside sub-loops |
| State | Stateless | Can maintain state across phases |

---

## Local Model Feasibility

### Can a 2B or 4B Parameter Model Run DeepTutor?

**Short answer: Partially, with significant limitations.**

### Critical Requirements Analysis

DeepTutor's agentic architecture demands several LLM capabilities:

| Requirement | 2B Model | 4B Model | 7B+ Model |
| --- | --- | --- | --- |
| **Function calling (tool_calls)** | ❌ Unreliable | ⚠️ Marginal | ✅ Works |
| **Label protocol adherence** (FINISH/TOOL/THINK) | ❌ Poor | ⚠️ Inconsistent | ✅ Good |
| **JSON output compliance** | ⚠️ Fragile | ⚠️ Fragile | ✅ Reliable |
| **Multi-turn context coherence** | ❌ Degrades fast | ⚠️ Short window | ✅ Adequate |
| **Structured reasoning (planning)** | ❌ Too shallow | ⚠️ Basic only | ✅ Capable |
| **Context window size** | 2K-4K typical | 4K-8K | 8K-128K |

### What DeepTutor Already Does for Local Providers

The codebase already marks local providers as **not supporting tools**:

```python
# deeptutor/services/llm/capabilities.py
"ollama": {"supports_tools": False, ...},
"lm_studio": {"supports_tools": False, ...},
"vllm": {"supports_tools": False, ...},
"llama_cpp": {"supports_tools": False, ...},
```

When `supports_tools = False`, the system falls back to the **label-based protocol** — the LLM outputs `` ``FINISH`` ``, `` ``TOOL`` ``, etc. as text prefixes instead of using native function calling. This is how small models interact with the system.

### What Can Be Trimmed for 2B/4B Models

#### 1. Disable Multi-Tool Capabilities (High Impact)

Reduce the tool set to only `rag` (knowledge retrieval):

```python
# In config or per-request override:
enabled_tools = ["rag"]  # Remove web_search, code_execution, brainstorm, etc.
```

**Why:** Fewer tools = simpler system prompt = less confusion for small models.

#### 2. Disable Deep Capabilities (High Impact)

Lock the system to `chat` capability only. Remove:

- `deep_question` (multi-phase pipeline too complex)
- `deep_solve` (planning → reasoning → writing)
- `deep_research` (multi-agent orchestration)

```python
# Only register chat:
BUILTIN_CAPABILITY_CLASSES = {"chat": "deeptutor.capabilities.chat:ChatCapability"}
```

#### 3. Simplify the Label Protocol (High Impact)

Reduce from 4 labels to 2:

```python
# Simplified protocol for small models:
_SMALL_MODEL_PROTOCOL = LabelProtocol(
    allowed=("ANSWER", "TOOL"),
    terminal=frozenset({"ANSWER"}),
    intermediate=frozenset(),
    final=frozenset({"ANSWER"}),
    tool_label="TOOL",
)
```

**Why:** 2B/4B models can barely distinguish 4 protocol labels. Binary (answer vs. tool) is more reliable.

#### 4. Reduce System Prompt Size (Medium Impact)

The chat pipeline assembles large system prompts with:

- Memory context
- Skills instructions  
- Source manifests
- Tool prompt hints
- Language directives
- Protocol documentation

For small models, trim to essentials:

- Remove `memory_context` (saves ~500 tokens)
- Remove `skills_context` (saves ~200-1000 tokens)
- Remove verbose tool hints (saves ~300 tokens per tool)
- Simplify protocol docs to 2-3 lines

#### 5. Reduce Max Iterations (Medium Impact)

```python
# For 2B/4B models:
DEFAULT_MAX_ITERATIONS = 3  # Down from 20
```

**Why:** Small models degrade rapidly over multiple iterations. Better to force finalization early.

#### 6. Disable ask_user Tool (Low Impact)

Small models can't reliably generate structured question payloads. Remove `AskUserTool` from the registry for local providers.

#### 7. Simplify Context Window Guard (Low Impact)

```python
CONTEXT_WINDOW_GUARD_RATIO = 0.7  # More aggressive trimming (from 0.9)
```

### Recommended Minimum Viable Configuration

#### For 2B Models (e.g., Gemma 2B, Phi-2, Qwen2-1.5B)

```yaml
capability: chat only (no deep modes)
tools: none (pure conversational, or RAG only with simplified prompt)
protocol: single-label ANSWER (no tool calling at all)
max_iterations: 1 (single-shot response)
system_prompt: < 200 tokens
context_window: 2048 tokens max
```

**Realistic use:** Basic Q&A over a knowledge base, with RAG handled server-side (not via tool calls). Essentially a retrieval-augmented chatbot without agentic behavior.

#### For 4B Models (e.g., Phi-3-mini, Gemma-2 2B-IT, Qwen2-7B)

```yaml
capability: chat only
tools: [rag] (with simplified single-tool protocol)
protocol: 2-label (ANSWER / TOOL)
max_iterations: 3
system_prompt: < 500 tokens
context_window: 4096-8192 tokens
```

**Realistic use:** Conversational tutor with RAG retrieval. Can do 1-2 tool calls per turn. No multi-step pipelines.

### Architecture Changes Required

| Change | Effort | Impact |
| --- | --- | --- |
| Add `small_model` mode to `LabelProtocol` | Low | Reduces protocol complexity |
| Create minimal system prompt template | Low | Fits small context windows |
| Add `max_tools_per_turn` config | Low | Prevents multi-tool confusion |
| Skip tool schemas in prompt for no-tool mode | Low | Saves context budget |
| Implement single-shot RAG (bypass tool calling) | Medium | Most reliable path for 2B |
| Create lightweight `SimpleChatCapability` | Medium | Removes agentic loop overhead |
| Add model-size-aware config presets | Low | Auto-applies restrictions |

### Summary Table

| Feature | 2B | 4B | 7B+ |
| --- | --- | --- | --- |
| Basic chat (no tools) | ✅ | ✅ | ✅ |
| RAG via tool call | ❌ | ⚠️ | ✅ |
| Multi-tool agentic loop | ❌ | ❌ | ✅ |
| `ask_user` structured output | ❌ | ❌ | ⚠️ |
| Deep Question pipeline | ❌ | ❌ | ⚠️ |
| Deep Solve pipeline | ❌ | ❌ | ✅ |
| Deep Research (multi-agent) | ❌ | ❌ | ❌ (needs 13B+) |

### Bottom Line

- **2B models**: Can only serve as a basic chat responder with pre-fetched RAG context injected server-side. No agentic capabilities.
- **4B models**: Can handle simple single-tool calls (RAG) with a heavily simplified protocol. Multi-step pipelines will fail.
- **7B+ models**: Minimum viable for the agentic loop with 2-3 tools. Deep capabilities become usable at 13B+.
- **The project's architecture is designed for 7B+ models minimum** — the label protocol, multi-tool dispatch, and multi-phase capabilities assume a model that can reliably follow structured output formats.
