# 05 — SDD Spec ↔ DeepTutor Source File Reference Map

> Exact mapping from each SDD spec section to the DeepTutor source files to study.

---

## How to Use This Map

When implementing an SDD spec, look up the corresponding DeepTutor files below. Read them for understanding, then implement the SIMPLIFIED version described in the SDD.

```text
1. Pick an SDD spec (e.g., 05-AGENTIC-LOOP.md)
2. Find it in this map
3. Read the listed DeepTutor files
4. Implement the Study Coach version from the SDD spec
```

---

## 01-ARCHITECTURE.md

| SDD Section | DeepTutor File | What to Study |
| ------------- | --------------- | --------------- |
| Mode routing | `deeptutor/runtime/orchestrator.py` | How `ChatOrchestrator` picks a capability |
| Config schema | `deeptutor/config/settings.py` | Pydantic settings pattern |
| App entry point | `deeptutor/api/app.py` | FastAPI app creation |
| Directory structure | `deeptutor/` (full tree) | How modules are organized |

**Key search**:

```text
grep_search("class ChatOrchestrator", includePattern="deeptutor/runtime/**")
grep_search("class.*Settings", includePattern="deeptutor/config/**")
```

---

## 02-LLM-SERVICE.md

| SDD Section | DeepTutor File | What to Study |
| ------------- | --------------- | --------------- |
| LLMService interface | `deeptutor/services/llm_service.py` | Abstract method signatures |
| LM Studio provider | `deeptutor/services/providers/lm_studio_provider.py` | OpenAI-compatible API call |
| Streaming | `deeptutor/services/providers/openai_provider.py` | SSE parsing pattern |
| Provider factory | `deeptutor/services/provider_factory.py` | How provider is selected |
| Error handling | `deeptutor/services/providers/` (any provider) | Retry logic |

**Key search**:

```text
grep_search("class LMStudio", includePattern="deeptutor/services/**")
grep_search("async.*stream|async.*complete", isRegexp=true, includePattern="deeptutor/services/llm_service.py")
```

---

## 03-WEBSOCKET-API.md

| SDD Section | DeepTutor File | What to Study |
| ------------- | --------------- | --------------- |
| WS endpoint | `deeptutor/api/routers/unified_ws.py` | WebSocket handler pattern |
| Message protocol | `deeptutor/core/stream.py` | Event types & shapes |
| Session state | `deeptutor/core/context.py` | What state is carried |
| Connection lifecycle | `deeptutor/api/routers/unified_ws.py` | Accept → loop → close |

**Key search**:

```text
grep_search("websocket|WebSocket", isRegexp=true, includePattern="deeptutor/api/**")
grep_search("class StreamEvent|class.*Event", isRegexp=true, includePattern="deeptutor/core/stream.py")
```

---

## 04-CHAT-CAPABILITY.md

| SDD Section | DeepTutor File | What to Study |
| ------------- | --------------- | --------------- |
| Chat capability | `deeptutor/capabilities/chat/capability.py` | `run()` method structure |
| System prompt | `deeptutor/capabilities/chat/prompts/` | How prompts are built |
| Tool-augmented chat | `deeptutor/capabilities/chat/capability.py` | How tools are passed to LLM |
| History management | `deeptutor/core/context.py` | Message windowing |

**Key search**:

```text
grep_search("class ChatCapability", includePattern="deeptutor/capabilities/**")
file_search("deeptutor/capabilities/chat/prompts/**")
```

---

## 05-AGENTIC-LOOP.md

| SDD Section | DeepTutor File | What to Study |
| ------------- | --------------- | --------------- |
| Iteration loop | `deeptutor/core/agentic/iteration_scheduler.py` | Main while loop logic |
| Label protocol | `deeptutor/core/agentic/labels.py` | How labels drive the loop |
| Tool dispatch | `deeptutor/core/agentic/tool_dispatcher.py` | Tool call execution |
| Force termination | `deeptutor/core/agentic/iteration_scheduler.py` | `_force_terminal_label()` |
| Max iterations | `deeptutor/core/agentic/iteration_scheduler.py` | Iteration counting |

**Key search**:

```text
grep_search("class IterationScheduler|async def run_loop", isRegexp=true, includePattern="deeptutor/core/agentic/**")
grep_search("_force_terminal", includePattern="deeptutor/core/agentic/**")
grep_search("max_iterations", includePattern="deeptutor/core/agentic/**")
```

**Note**: DeepTutor uses label-based parsing (text), Study Coach uses native function calling. The LOOP STRUCTURE is what to study, not the label parsing.

---

## 06-TOOLS-REGISTRY.md

| SDD Section | DeepTutor File | What to Study |
| ------------- | --------------- | --------------- |
| BaseTool interface | `deeptutor/core/tool_protocol.py` | Abstract class definition |
| ToolRegistry | `deeptutor/runtime/registry/tool_registry.py` | Registration pattern |
| Tool definitions | `deeptutor/tools/builtin/` (any tool) | `get_definition()` pattern |
| Tool list | `deeptutor/tools/__init__.py` | `BUILTIN_TOOL_TYPES` tuple |
| Argument augmentation | `deeptutor/core/agentic/tool_dispatcher.py` | Server-side arg injection |

**Key search**:

```text
grep_search("class BaseTool", includePattern="deeptutor/core/**")
grep_search("BUILTIN_TOOL_TYPES", includePattern="deeptutor/tools/**")
grep_search("class ToolRegistry", includePattern="deeptutor/runtime/**")
```

---

## 07-RAG-TOOL.md

| SDD Section | DeepTutor File | What to Study |
| ------------- | --------------- | --------------- |
| RAG tool impl | `deeptutor/tools/builtin/rag.py` | `execute()` method |
| Vector search | `deeptutor/knowledge/retrieval/` | Retrieval logic |
| Embedding | `deeptutor/knowledge/embedding/` | Embedding generation |
| Document ingestion | `deeptutor/knowledge/ingestion/` | Chunking + parsing |
| KB management | `deeptutor/knowledge/kb_manager.py` | KB CRUD operations |

**Key search**:

```text
grep_search("class RAGTool|class.*RAG", isRegexp=true, includePattern="deeptutor/tools/**")
grep_search("async def search|similarity_search", isRegexp=true, includePattern="deeptutor/knowledge/**")
file_search("deeptutor/knowledge/**/*.py")
```

**Note**: DeepTutor uses custom vector store. Study Coach uses Supabase pgvector. Study the FLOW (embed → search → format), not the specific vector store implementation.

---

## 08-QUIZ-GENERATION.md

| SDD Section | DeepTutor File | What to Study |
| ------------- | --------------- | --------------- |
| Quiz capability | `deeptutor/capabilities/deep_question/capability.py` | Overall flow |
| Question generation | `deeptutor/capabilities/deep_question/generate.py` | Prompt → JSON → validate |
| Question types | `deeptutor/capabilities/deep_question/` | Type definitions |
| Explore phase | `deeptutor/capabilities/deep_question/explore.py` | Context gathering |
| JSON parsing | `deeptutor/utils/` (look for json repair) | JSON repair utilities |

**Key search**:

```text
grep_search("class DeepQuestion|class.*Question.*Capability", isRegexp=true, includePattern="deeptutor/capabilities/**")
grep_search("question_type|QuestionType", isRegexp=true, includePattern="deeptutor/capabilities/deep_question/**")
file_search("deeptutor/capabilities/deep_question/**")
```

---

## 09-STEP-SOLVE.md

| SDD Section | DeepTutor File | What to Study |
| ------------- | --------------- | --------------- |
| Solve capability | `deeptutor/capabilities/deep_solve/capability.py` | Phase orchestration |
| Planning | `deeptutor/capabilities/deep_solve/planner.py` | Plan creation |
| Step execution | `deeptutor/capabilities/deep_solve/solver.py` | Per-step solving |
| Replanning | `deeptutor/capabilities/deep_solve/capability.py` | REPLAN back-edge |

**Key search**:

```text
grep_search("class DeepSolve|class.*Solve.*Capability", isRegexp=true, includePattern="deeptutor/capabilities/**")
grep_search("replan|REPLAN", isRegexp=true, includePattern="deeptutor/capabilities/deep_solve/**")
file_search("deeptutor/capabilities/deep_solve/**")
```

**Note**: Study Coach removes REPLAN. Study the forward-only flow (plan → execute steps → conclude).

---

## 10-LITE-ORCHESTRATOR.md

| SDD Section | DeepTutor File | What to Study |
| ------------- | --------------- | --------------- |
| Auto-routing concept | `deeptutor/capabilities/auto/` | How intent → capability works |
| N/A (new concept) | — | Lite Orchestrator has no direct equivalent |

**Key search**:

```text
grep_search("class Auto|auto.*capability", isRegexp=true, includePattern="deeptutor/capabilities/**")
```

**Note**: The Lite Orchestrator is a NEW concept not present in DeepTutor. DeepTutor's `auto` capability uses the LLM to route; Lite Orchestrator uses regex. Study `auto` for the concept, but implement from the SDD spec.

---

## Quick Lookup by Concept

| Concept | grep/file command |
| --------- | ------------------ |
| "How are tools registered?" | `grep_search("register.*tool\|tool.*register", isRegexp=true, includePattern="deeptutor/runtime/**")` |
| "How does streaming work?" | `grep_search("StreamEvent\|stream_bus\|StreamBus", isRegexp=true, includePattern="deeptutor/core/**")` |
| "What tools exist?" | `grep_search("BUILTIN_TOOL_TYPES", includePattern="deeptutor/tools/**")` |
| "How is the LLM called?" | `grep_search("stream_completion\|complete_async", isRegexp=true, includePattern="deeptutor/services/**")` |
| "How does the WS work?" | `read_file("deeptutor/api/routers/unified_ws.py", 1, 100)` |
| "What's in context?" | `grep_search("class UnifiedContext", includePattern="deeptutor/core/**")` |
| "How are errors handled?" | `grep_search("ToolResult.*is_error\|except.*Exception", isRegexp=true, includePattern="deeptutor/core/agentic/**")` |
| "How does RAG retrieve?" | `grep_search("async def.*search\|similarity", isRegexp=true, includePattern="deeptutor/knowledge/**")` |
| "What providers are supported?" | `read_file("deeptutor/config/providers.py", 1, 50)` |
| "How are messages formatted?" | `grep_search("class Message\|role.*content", isRegexp=true, includePattern="deeptutor/core/**")` |
