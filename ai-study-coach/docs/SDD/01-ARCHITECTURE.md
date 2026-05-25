# 01 — System Architecture

## Purpose

Define the system topology, service boundaries, configuration schema, and mode-routing logic for the AI Study Coach.

---

## System Topology

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS FRONTEND                             │
│  ┌───────────┐  ┌────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Chat UI   │  │ Quiz UI    │  │ Solve UI     │  │ Settings    │ │
│  └─────┬─────┘  └─────┬──────┘  └──────┬───────┘  └──────┬──────┘ │
│        └───────────────┴────────────────┴──────────────────┘        │
│                              WebSocket                                │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    FASTAPI AI SERVICE (Python)                         │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │ WS Endpoint  │→ │ Mode Router  │→ │ Capability (Chat/Agent)    │ │
│  └──────────────┘  └──────────────┘  └────────────────────────────┘ │
│                                              │                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────┴─────────────────────┐ │
│  │ LLM Service  │  │ Tool Registry│  │ Tools (RAG, Reason, etc.)  │ │
│  └──────┬───────┘  └──────────────┘  └────────────────────────────┘ │
│         │                                    │                        │
└─────────┼────────────────────────────────────┼────────────────────────┘
          │                                    │
          ↓                                    ↓
┌──────────────────┐              ┌────────────────────────┐
│ LLM Provider     │              │ Java Backend (REST)    │
│ - LM Studio      │              │ - Quiz CRUD            │
│   (localhost)     │              │ - User profiles        │
│ - DeepSeek API   │              │ - Quiz history         │
│   (cloud)        │              │ - Recommendations      │
└──────────────────┘              └──────────┬─────────────┘
                                             │
                                             ↓
                                  ┌────────────────────────┐
                                  │ PostgreSQL / Supabase   │
                                  │ - pgvector (embeddings) │
                                  │ - User data             │
                                  │ - Quiz data             │
                                  └────────────────────────┘
```

---

## Service Boundaries

| Service | Responsibility | Port |
| --------- | --------------- | ------ |
| Next.js Frontend | UI, WebSocket client, session state | 3000 |
| FastAPI AI Service | LLM orchestration, tool execution, streaming | 8000 |
| Java Backend | Quiz CRUD, user management, business logic | 8080 |
| LM Studio | Local LLM inference (Lite mode) | 1234 |
| Supabase | Vector DB + auth + storage (Full mode) | 54321 (local) or cloud |

---

## Mode Routing

### Mode Selection Flow

```text
Client connects WebSocket with:
{
  "type": "session_start",
  "tier": "lite" | "full",
  "mode": "chat" | "agentic"
}

Server resolves:
  tier=lite  + mode=chat    → SimpleChatCapability(provider=lm_studio)
  tier=lite  + mode=agentic → LiteOrchestrator(provider=lm_studio)
  tier=full  + mode=chat    → SimpleChatCapability(provider=deepseek)
  tier=full  + mode=agentic → AgenticCapability(provider=deepseek, tools=ALL)
```

### Mode Router Implementation

```python
# server/router.py

from enum import Enum

class Tier(str, Enum):
    LITE = "lite"
    FULL = "full"

class Mode(str, Enum):
    CHAT = "chat"
    AGENTIC = "agentic"

def resolve_capability(tier: Tier, mode: Mode) -> BaseCapability:
    """Route to the correct capability based on tier and mode."""
    if mode == Mode.CHAT:
        provider = "lm_studio" if tier == Tier.LITE else "deepseek"
        return SimpleChatCapability(provider=provider)
    
    if tier == Tier.LITE:
        return LiteOrchestrator(provider="lm_studio")
    else:
        return AgenticCapability(provider="deepseek", tools=FULL_TOOL_SET)
```

---

## Configuration Schema

```python
# server/config.py

from pydantic_settings import BaseSettings
from pydantic import Field

class LLMConfig(BaseSettings):
    """LLM provider configuration."""
    
    # Lite (local)
    lm_studio_base_url: str = "http://localhost:1234/v1"
    lm_studio_model: str = "gemma-4-e2b"  # or user-selected
    
    # Full (cloud)
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-v4-flash"
    
    # Shared
    max_tokens: int = 2048
    temperature: float = 0.7
    stream: bool = True

class RAGConfig(BaseSettings):
    """RAG / vector search configuration."""
    supabase_url: str = ""
    supabase_key: str = ""
    embedding_model: str = "text-embedding-004"
    similarity_threshold: float = 0.7
    max_results: int = 5

class JavaBackendConfig(BaseSettings):
    """Java backend connection."""
    base_url: str = "http://localhost:8080/api"
    timeout: int = 10

class AppConfig(BaseSettings):
    """Root application configuration."""
    llm: LLMConfig = Field(default_factory=LLMConfig)
    rag: RAGConfig = Field(default_factory=RAGConfig)
    java_backend: JavaBackendConfig = Field(default_factory=JavaBackendConfig)
    
    # Mode defaults
    default_tier: str = "full"
    default_mode: str = "chat"
    
    # Agentic limits
    max_iterations: int = 10
    max_tool_calls_per_turn: int = 5
    
    class Config:
        env_prefix = "AI_COACH_"
        env_nested_delimiter = "__"
```

---

## Directory Structure

```text
ai-study-coach/
├── server/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # AppConfig (Pydantic Settings)
│   ├── router.py                # Mode routing logic
│   ├── ws/
│   │   ├── __init__.py
│   │   ├── endpoint.py          # WebSocket endpoint handler
│   │   ├── protocol.py          # Message shapes & serialization
│   │   └── session.py           # Session state per connection
│   ├── llm/
│   │   ├── __init__.py
│   │   ├── base.py              # Abstract LLM provider
│   │   ├── lm_studio.py         # LM Studio provider
│   │   └── deepseek.py          # DeepSeek cloud provider
│   ├── capabilities/
│   │   ├── __init__.py
│   │   ├── base.py              # BaseCapability protocol
│   │   ├── chat.py              # SimpleChatCapability
│   │   ├── agentic.py           # AgenticCapability (Full)
│   │   ├── lite_orchestrator.py # LiteOrchestrator (code-driven)
│   │   ├── quiz.py              # Quiz generation logic
│   │   └── solve.py             # Step-by-step solving logic
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── base.py              # BaseTool protocol
│   │   ├── registry.py          # ToolRegistry
│   │   ├── rag.py               # RAG tool (Supabase)
│   │   ├── reason.py            # Reason tool (deep thinking)
│   │   ├── quiz_history.py      # Quiz history tool (Java BE)
│   │   ├── recommend.py         # Recommendation tool (Java BE)
│   │   └── web_search.py        # Web search tool
│   └── services/
│       ├── __init__.py
│       ├── java_client.py       # HTTP client for Java BE
│       └── supabase_client.py   # Supabase/pgvector client
├── tests/
│   ├── test_chat.py
│   ├── test_agentic.py
│   ├── test_tools.py
│   └── test_ws.py
├── pyproject.toml
├── requirements.txt
└── .env.example
```

---

## Acceptance Criteria

- [ ] FastAPI app starts and accepts WebSocket connections on `/ws`
- [ ] Client can send `session_start` with tier+mode and receive acknowledgment
- [ ] Mode router correctly maps all 4 combinations to capabilities
- [ ] Config loads from environment variables with `AI_COACH_` prefix
- [ ] Health check endpoint (`GET /health`) returns service status
- [ ] LM Studio unreachable → Lite mode returns graceful error
- [ ] DeepSeek API key missing → Full mode returns graceful error

---

## Dependencies

```text
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
pydantic-settings>=2.0.0
websockets>=12.0
httpx>=0.25.0        # For Java BE calls
python-dotenv>=1.0.0
```

---

## DeepTutor Reference

| This Module | DeepTutor Equivalent | What Changed |
| ------------- | --------------------- | -------------- |
| `config.py` | `deeptutor/config/` | Simplified from 15+ config files to 1 |
| `router.py` | `deeptutor/runtime/orchestrator.py` | 4 fixed routes instead of dynamic capability discovery |
| Directory structure | `deeptutor/` (full tree) | Flat structure, no plugin system |
| Mode routing | `RunMode` enum + capability registry | Explicit if/else instead of registry pattern |
