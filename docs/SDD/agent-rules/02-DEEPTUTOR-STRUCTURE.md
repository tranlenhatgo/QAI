# 02 — DeepTutor Project Structure

> Complete map of the DeepTutor codebase for AI agent reference.

---

## Top-Level Layout

```text
DeepTutor-main/
├── deeptutor/          ← Python source (the AI engine)
├── deeptutor_cli/      ← CLI entry point (Typer)
├── deeptutor_web/      ← Web app entry point (package marker)
├── web/                ← Next.js frontend source
├── tests/              ← Test suite (mirrors deeptutor/ structure)
├── scripts/            ← Build/deploy scripts
├── requirements/       ← Dependency groups (cli.txt, server.txt, dev.txt)
├── docs/               ← Documentation (including this SDD)
├── packaging/          ← Distribution packaging
├── assets/             ← Static assets, release notes, figures
├── pyproject.toml      ← Python project metadata + deps
├── docker-compose.yml  ← Container orchestration
└── AGENTS.md           ← Top-level agent architecture doc
```

---

## `deeptutor/` — Core Python Package

```text
deeptutor/
├── __init__.py
├── __main__.py              ← python -m deeptutor entry
├── __version__.py           ← Version string
│
├── core/                    ← 🔑 MOST IMPORTANT — core abstractions
│   ├── agentic/             ← Agentic loop engine
│   │   ├── iteration_scheduler.py  ← THE loop (label → action → repeat)
│   │   ├── labels.py               ← LabelProtocol definition
│   │   ├── tool_dispatcher.py      ← Execute tool calls
│   │   └── ...
│   ├── tool_protocol.py     ← BaseTool abstract class
│   ├── capability_protocol.py ← BaseCapability abstract class
│   ├── context.py           ← UnifiedContext dataclass
│   ├── stream.py            ← StreamEvent types
│   └── stream_bus.py        ← Async event fan-out
│
├── runtime/                 ← Orchestration & registry
│   ├── orchestrator.py      ← ChatOrchestrator (main entry)
│   ├── registry/
│   │   ├── tool_registry.py      ← Discovers & holds tools
│   │   └── capability_registry.py ← Discovers & holds capabilities
│   └── mode.py              ← RunMode enum (CLI vs SERVER)
│
├── capabilities/            ← Level 2 — multi-step pipelines
│   ├── chat/                ← Default chat (tool-augmented)
│   │   ├── capability.py
│   │   └── prompts/
│   ├── deep_solve/          ← Step-by-step problem solving
│   │   ├── capability.py
│   │   ├── planner.py
│   │   └── solver.py
│   ├── deep_question/       ← Quiz generation
│   │   ├── capability.py
│   │   ├── explore.py
│   │   ├── generate.py
│   │   └── strategies/
│   ├── auto/                ← Auto-routing (picks capability)
│   ├── visualize/           ← Diagram generation
│   └── deep_research/       ← Multi-agent research (plugin)
│
├── tools/                   ← Level 1 — single-function tools
│   ├── builtin/
│   │   ├── rag.py
│   │   ├── web_search.py
│   │   ├── code_execution.py
│   │   ├── reason.py
│   │   ├── brainstorm.py
│   │   ├── paper_search.py
│   │   ├── geogebra_analysis.py
│   │   ├── read_source.py
│   │   ├── read_memory.py
│   │   ├── write_memory.py
│   │   ├── web_fetch.py
│   │   ├── list_notebook.py
│   │   ├── write_note.py
│   │   ├── github.py
│   │   └── ask_user.py
│   └── __init__.py          ← BUILTIN_TOOL_TYPES tuple
│
├── services/                ← External service integrations
│   ├── llm_service.py       ← LLM abstraction layer
│   ├── provider_factory.py  ← Creates provider from config
│   ├── providers/           ← Per-provider implementations
│   │   ├── openai_provider.py
│   │   ├── anthropic_provider.py
│   │   ├── deepseek_provider.py
│   │   ├── groq_provider.py
│   │   ├── ollama_provider.py
│   │   ├── lm_studio_provider.py
│   │   └── ...
│   └── ...
│
├── knowledge/               ← RAG infrastructure
│   ├── ingestion/           ← Document parsing & chunking
│   ├── embedding/           ← Embedding generation
│   ├── retrieval/           ← Vector search
│   └── kb_manager.py        ← Knowledge base CRUD
│
├── config/                  ← Configuration management
│   ├── providers.py         ← Provider definitions (name, binding, supports_tools)
│   ├── models.py            ← Model configurations
│   └── settings.py          ← Global settings
│
├── api/                     ← FastAPI web server
│   ├── routers/
│   │   ├── unified_ws.py    ← WebSocket endpoint
│   │   └── ...
│   └── app.py              ← FastAPI app creation
│
├── plugins/                 ← Extended capabilities (playground)
│   ├── deep_research/
│   │   ├── manifest.yaml
│   │   └── capability.py
│   └── loader.py           ← Plugin discovery
│
├── logging/                 ← Structured logging
├── events/                  ← Event system
├── utils/                   ← Shared utilities
├── multi_user/              ← Multi-user session management
├── agents/                  ← Agent-specific code
├── tutorbot/                ← TutorBot channel integration
├── co_writer/               ← Co-writing feature
├── book/                    ← Book/textbook features
└── app/                     ← App-level initialization
```

---

## Key File Deep-Dives

### `deeptutor/core/tool_protocol.py`

```python
# This defines the interface ALL tools must implement
class BaseTool(ABC):
    @property
    def name(self) -> str: ...
    @property
    def description(self) -> str: ...
    def get_definition(self) -> ToolDefinition: ...
    async def execute(self, args: dict, context: UnifiedContext) -> ToolResult: ...

@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters: dict  # JSON Schema

@dataclass  
class ToolResult:
    content: str
    is_error: bool = False
```

### `deeptutor/core/capability_protocol.py`

```python
class BaseCapability(ABC):
    manifest: CapabilityManifest
    
    async def run(self, context: UnifiedContext, stream: StreamBus) -> None: ...

@dataclass
class CapabilityManifest:
    name: str
    description: str
    stages: list[str]
    tools_used: list[str] = field(default_factory=list)
```

### `deeptutor/core/agentic/labels.py`

```python
@dataclass(frozen=True)
class LabelProtocol:
    allowed: tuple[str, ...]        # All valid labels
    terminal: frozenset[str]        # Labels that end the loop
    intermediate: frozenset[str]    # Labels that continue thinking
    final: frozenset[str]           # Labels for final output
    tool_label: str                 # Which label means "call a tool"
```

### `deeptutor/core/context.py`

```python
@dataclass
class UnifiedContext:
    user_message: str
    conversation_history: list[Message]
    knowledge_bases: list[str]
    run_mode: RunMode
    provider: str
    model: str
    tools: list[str]
    config: dict
    # ... more fields
```

---

## Folder Purposes (Quick Reference)

| Folder | Study Coach Equivalent | Relevance |
| -------- | ---------------------- | ----------- |
| `core/agentic/` | `ai_coach/capabilities/agentic.py` | HIGH — the agentic loop |
| `core/tool_protocol.py` | `ai_coach/tools/base.py` | HIGH — tool interface |
| `core/stream.py` | WS protocol events | MEDIUM — event types |
| `capabilities/chat/` | `ai_coach/capabilities/chat.py` | HIGH — chat impl |
| `capabilities/deep_solve/` | `ai_coach/capabilities/solve.py` | HIGH — solving |
| `capabilities/deep_question/` | `ai_coach/capabilities/quiz.py` | HIGH — quiz gen |
| `tools/builtin/rag.py` | `ai_coach/tools/rag.py` | HIGH — RAG tool |
| `tools/builtin/reason.py` | `ai_coach/tools/reason.py` | HIGH — reason tool |
| `services/llm_service.py` | `ai_coach/llm/base.py` | HIGH — LLM abstraction |
| `services/providers/` | `ai_coach/llm/lm_studio.py`, `gemini.py` | MEDIUM — provider impl |
| `api/routers/unified_ws.py` | `ai_coach/ws/endpoint.py` | MEDIUM — WS handler |
| `config/` | `ai_coach/config.py` | LOW — different approach |
| `knowledge/` | `ai_coach/services/supabase_client.py` | MEDIUM — RAG infra |
| `plugins/` | N/A | SKIP — not needed |
| `tutorbot/` | N/A | SKIP — not needed |
| `co_writer/` | N/A | SKIP — not needed |
| `book/` | N/A | SKIP — not needed |
| `multi_user/` | N/A | SKIP — not needed |
| `agents/` | N/A | SKIP — not needed |

---

## What to SKIP in DeepTutor

These folders/files are NOT relevant to the AI Study Coach:

- `deeptutor/plugins/` — Plugin system (overkill)
- `deeptutor/tutorbot/` — Channel integrations (Telegram, Matrix)
- `deeptutor/co_writer/` — Co-writing feature
- `deeptutor/book/` — Book generation
- `deeptutor/multi_user/` — Multi-user session management
- `deeptutor/agents/` — Agent orchestration (different from your architecture)
- `deeptutor/tools/builtin/geogebra_analysis.py` — Vision pipeline
- `deeptutor/tools/builtin/paper_search.py` — arXiv
- `deeptutor/tools/builtin/github.py` — GitHub integration
- `deeptutor/capabilities/auto/` — Auto-routing
- `deeptutor/capabilities/visualize/` — Diagram generation
- `web/` — DeepTutor's Next.js frontend (yours is separate)
