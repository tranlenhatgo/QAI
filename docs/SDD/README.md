# AI Study Coach — Specification-Driven Development Guide

> A complete SDD for an AI coding agent to implement the core functions of an AI Study Coach,
> inspired by DeepTutor's architecture but simplified for a graduation thesis.

---

## Project Context

**Product**: AI Study Coach — a microservice that provides intelligent tutoring via chat, quiz generation, step-by-step solving, and personalized recommendations.

**Architecture**:

```text
Next.js Frontend ──WebSocket──→ FastAPI AI Service (Python)
                                     │         │
                               REST  │    LLM  │
                                     ↓         ↓
                               Java Backend   LM Studio (Lite)
                              (Quiz, Users)   or Gemini API (Full)
                                     │
                                     ↓
                              PostgreSQL / Supabase (pgvector for RAG)
```

**Two Tiers × Two Modes**:

| | Chat Mode | Agentic Mode |
| --- | --- | --- |
| **Lite** (local LM Studio) | Direct LLM response, no tools | Code-driven orchestration (code picks actions, LLM analyzes) |
| **Full** (cloud Gemini) | Direct LLM response, no tools | LLM-driven tool calling (LLM picks tools via function calling) |

---

## File Index

| # | File | What It Specifies |
| --- | ------ | ------------------- |
| 01 | [ARCHITECTURE.md](./01-ARCHITECTURE.md) | System topology, mode routing, config schema |
| 02 | [LLM-SERVICE.md](./02-LLM-SERVICE.md) | Provider abstraction (LM Studio + Gemini), streaming |
| 03 | [WEBSOCKET-API.md](./03-WEBSOCKET-API.md) | WebSocket protocol, message shapes, lifecycle |
| 04 | [CHAT-CAPABILITY.md](./04-CHAT-CAPABILITY.md) | Simple chat (both tiers, both modes) |
| 05 | [AGENTIC-LOOP.md](./05-AGENTIC-LOOP.md) | Tool-calling orchestration engine (Full Agentic) |
| 06 | [TOOLS-REGISTRY.md](./06-TOOLS-REGISTRY.md) | Tool protocol, registry, definitions |
| 07 | [RAG-TOOL.md](./07-RAG-TOOL.md) | Supabase pgvector RAG implementation |
| 08 | [QUIZ-GENERATION.md](./08-QUIZ-GENERATION.md) | Quiz generation capability |
| 09 | [STEP-SOLVE.md](./09-STEP-SOLVE.md) | Step-by-step problem solving |
| 10 | [LITE-ORCHESTRATOR.md](./10-LITE-ORCHESTRATOR.md) | Code-driven orchestration for Lite Agentic |

---

## SDD Format (Each File Follows This)

```markdown
# [Module Name]

## Purpose
What this module does in one sentence.

## Interface Contract
- Inputs (parameters, messages, config)
- Outputs (return types, events emitted)

## Data Shapes
Pydantic models / TypedDict definitions.

## Behavior Specification
Step-by-step logic in pseudocode or numbered steps.

## Acceptance Criteria
Testable conditions that prove correct implementation.

## Dependencies
What this module imports/calls.

## DeepTutor Reference
Which DeepTutor files inspired this and what was simplified.
```

---

## Implementation Order

```text
Phase 1: Foundation
  01 ARCHITECTURE → 02 LLM-SERVICE → 03 WEBSOCKET-API

Phase 2: Core Chat
  04 CHAT-CAPABILITY (delivers working chat for both tiers)

Phase 3: Agentic Engine
  05 AGENTIC-LOOP → 06 TOOLS-REGISTRY → 07 RAG-TOOL

Phase 4: Learning Features
  08 QUIZ-GENERATION → 09 STEP-SOLVE → 10 LITE-ORCHESTRATOR
```

Each phase is independently testable and deployable.

---

## Tech Stack Summary

| Layer | Technology |
| ------- | --------- |
| AI Service Framework | FastAPI + uvicorn |
| WebSocket | FastAPI WebSocket + `websockets` |
| LLM (Lite) | LM Studio (OpenAI-compatible API, localhost) |
| LLM (Full) | Google Gemini 2.0 Flash (free tier, function calling) |
| Vector DB | Supabase pgvector (Full mode only) |
| Embeddings | Google `text-embedding-004` or `all-MiniLM-L6-v2` |
| Data Backend | Java REST API (quiz history, user data) |
| Config | Pydantic Settings + YAML/env vars |

---

## Key Design Decisions

1. **No LangChain/LlamaIndex** — raw provider SDKs for clarity and control
2. **Mode selection at connection time** — client sends tier+mode in WS handshake
3. **Lite Agentic = code-driven** — avoids unreliable tool calling on small models
4. **Full Agentic = LLM-driven** — leverages Gemini's native function calling
5. **Streaming everywhere** — WebSocket streams tokens as they arrive
6. **Stateless AI service** — session state lives in frontend + Java BE
