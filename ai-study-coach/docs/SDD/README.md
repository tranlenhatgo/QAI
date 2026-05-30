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
                              (Quiz, Users)   or DeepSeek API (Full)
                                     │
                                     ↓
                              PostgreSQL / Supabase (pgvector for RAG)
```

**Two Tiers × Two Modes**:

| | Chat Mode | Agentic Mode |
| --- | --- | --- |
| **Lite** (local LM Studio) | Direct LLM response, no tools | Code-driven orchestration (code picks actions, LLM analyzes) |
| **Full** (cloud DeepSeek) | Direct LLM response, no tools | LLM-driven tool calling (LLM picks tools via function calling) |

---

## File Index

| # | File | What It Specifies |
| --- | ------ | ------------------- |
| 01 | [ARCHITECTURE.md](./01-ARCHITECTURE.md) | System topology, mode routing, config schema |
| 02 | [LLM-SERVICE.md](./02-LLM-SERVICE.md) | Provider abstraction (LM Studio + DeepSeek), streaming |
| 03 | [WEBSOCKET-API.md](./03-WEBSOCKET-API.md) | WebSocket protocol, message shapes, lifecycle |
| 04 | [CHAT-CAPABILITY.md](./04-CHAT-CAPABILITY.md) | Simple chat (both tiers, both modes) |
| 05 | [AGENTIC-LOOP.md](./05-AGENTIC-LOOP.md) | Tool-calling orchestration engine (Full Agentic) |
| 06 | [TOOLS-REGISTRY.md](./06-TOOLS-REGISTRY.md) | Tool protocol, registry, definitions |
| 07 | [RAG-TOOL.md](./07-RAG-TOOL.md) | Supabase pgvector RAG implementation |
| 08 | [QUIZ-GENERATION.md](./08-QUIZ-GENERATION.md) | Quiz generation capability |
| 09 | [STEP-SOLVE.md](./09-STEP-SOLVE.md) | Step-by-step problem solving |
| 10 | [LITE-ORCHESTRATOR.md](./10-LITE-ORCHESTRATOR.md) | Code-driven orchestration for Lite Agentic |
| 11 | [DATA-FLOW-SCENARIOS.md](./11-DATA-FLOW-SCENARIOS.md) | End-to-end data flows for every major user scenario |
| 12 | [TESTING-STRATEGY.md](./12-TESTING-STRATEGY.md) | Test scenarios, prompts, and acceptance checklist |
| 13 | [WEB-SEARCH.md](./13-WEB-SEARCH.md) | Web search tool (DuckDuckGo, no API key) |
| 14 | [SPACED-REPETITION.md](./14-SPACED-REPETITION.md) | SM-2 spaced repetition scheduling |
| 15 | [PROGRESS-TRACKING.md](./15-PROGRESS-TRACKING.md) | Learning metrics, mastery, velocity, streaks |
| 16 | [SCHEDULER.md](./16-SCHEDULER.md) | Background task scheduler (APScheduler) |
| 17 | [QUIZ-WEBHOOK.md](./17-QUIZ-WEBHOOK.md) | Quiz completion webhook (Spring Boot → Coach) |

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

Phase 5: Adaptive Learning
  13 WEB-SEARCH (partial) → 14 SPACED-REPETITION ✓ → 15 PROGRESS-TRACKING ✓
  16 SCHEDULER ✓ → 17 QUIZ-WEBHOOK ✓
```

Each phase is independently testable and deployable.

---
