# 01 — How to Navigate & Search DeepTutor

> Guide for AI agents on how to efficiently find reference code in the DeepTutor codebase.

---

## Workspace Location

```text
c:\Users\GoTLN1\Documents\DeepTutor-main\
```

---

## Search Strategies

### Strategy 1: Find a Specific Pattern by Name

Use `grep_search` with the exact class/function name:

```text
grep_search("class ChatCapability", includePattern="deeptutor/**")
grep_search("class BaseTool", includePattern="deeptutor/core/**")
grep_search("async def run", includePattern="deeptutor/capabilities/**")
```

### Strategy 2: Find All Tools

```text
grep_search("class.*Tool.*BaseTool", isRegexp=true, includePattern="deeptutor/tools/**")
```

Or find the registry that lists them all:

```text
grep_search("BUILTIN_TOOL_TYPES", includePattern="deeptutor/tools/**")
```

### Strategy 3: Find All Capabilities

```text
grep_search("class.*Capability.*BaseCapability", isRegexp=true, includePattern="deeptutor/capabilities/**")
```

Or find the registry:

```text
grep_search("BUILTIN_CAPABILITY_CLASSES", includePattern="deeptutor/capabilities/**")
```

### Strategy 4: Find the Agentic Loop Logic

```text
grep_search("iteration_scheduler|IterationScheduler", isRegexp=true, includePattern="deeptutor/core/**")
grep_search("LabelProtocol", includePattern="deeptutor/core/**")
```

### Strategy 5: Find Provider Implementations

```text
file_search("deeptutor/services/providers/**")
grep_search("class.*Provider", includePattern="deeptutor/services/**")
```

### Strategy 6: Find Stream/Event Handling

```text
grep_search("StreamEvent|StreamBus", isRegexp=true, includePattern="deeptutor/core/**")
```

### Strategy 7: Find WebSocket API

```text
grep_search("websocket|WebSocket", isRegexp=true, includePattern="deeptutor/api/**")
```

### Strategy 8: Find Configuration

```text
file_search("deeptutor/config/**")
grep_search("class.*Config|class.*Settings", isRegexp=true, includePattern="deeptutor/config/**")
```

---

## Key Entry Points

When you need to understand "how does X work in DeepTutor", start from these files:

| Question | Start Here |
| ---------- | ----------- |
| How does a user message get processed? | `deeptutor/runtime/orchestrator.py` |
| How does the LLM get called? | `deeptutor/services/llm_service.py` |
| How does tool calling work? | `deeptutor/core/agentic/iteration_scheduler.py` |
| How are tools defined? | `deeptutor/core/tool_protocol.py` |
| How does streaming work? | `deeptutor/core/stream.py` + `stream_bus.py` |
| How does RAG work? | `deeptutor/tools/builtin/rag.py` + `deeptutor/knowledge/` |
| How does quiz generation work? | `deeptutor/capabilities/deep_question/` |
| How does step-by-step solving work? | `deeptutor/capabilities/deep_solve/` |
| How are providers configured? | `deeptutor/config/providers.py` |
| How does the WebSocket API work? | `deeptutor/api/routers/unified_ws.py` |

---

## Reading Order for Full Understanding

If you need to understand DeepTutor end-to-end:

```text
1. deeptutor/core/tool_protocol.py          — Tool interface
2. deeptutor/core/capability_protocol.py     — Capability interface
3. deeptutor/core/context.py                 — UnifiedContext (what gets passed around)
4. deeptutor/core/stream.py                  — StreamEvent (how data flows out)
5. deeptutor/core/stream_bus.py              — Event fan-out to subscribers
6. deeptutor/core/agentic/labels.py          — Label protocol definition
7. deeptutor/core/agentic/iteration_scheduler.py — The agentic loop
8. deeptutor/runtime/orchestrator.py         — Top-level routing
9. deeptutor/capabilities/chat/capability.py — Chat implementation
10. deeptutor/tools/builtin/rag.py           — RAG tool example
```

---

## Search Tips

1. **Don't read entire files** — Use `grep_search` first to find the relevant section, then `read_file` with a specific line range.
2. **Follow imports** — If you find a class usage, grep for its definition to understand the interface.
3. **Check `__init__.py` files** — They often re-export the key classes and reveal module structure.
4. **Look at tests** — `tests/` mirrors the source structure and shows how modules are used.
5. **Configuration files tell you what's available** — `deeptutor/config/` reveals all supported options.

---

## Common Pitfalls When Reading DeepTutor

1. **Label protocol is NOT function calling** — DeepTutor uses text labels (FINISH/TOOL/THINK/PAUSE) parsed from LLM output. The Study Coach uses native function calling (Gemini) instead.
2. **Multiple abstraction layers** — DeepTutor has Tool → ToolWrapper → BuiltinTool → ConcreteToolImpl. The Study Coach flattens to BaseTool → ConcreteToolImpl.
3. **Plugin system is overkill** — DeepTutor discovers plugins from `manifest.yaml`. The Study Coach uses direct imports.
4. **Provider factory is complex** — DeepTutor supports 13+ providers with dynamic loading. The Study Coach has 2 providers with a simple if/else factory.
