# AI Study Coach — Architecture Implementation Changelog

## Overview

Full implementation of the 4-phase SDD architecture into `server/`, adding:

- **WebSocket real-time protocol** (`/ws` endpoint)
- **Capability system** (chat, agentic, lite orchestrator, quiz generator, step solver)
- **Tool framework** (registry pattern + 5 tools)
- **Services layer** (Supabase pgvector RAG, embeddings)
- **Two-tier LLM routing** (Lite → LM Studio local, Full → DeepSeek cloud)
- **Adaptive learning** (spaced repetition, progress tracking, background scheduler, webhook)

---

## 2025-05-26 — Firestore Persistence Migration

**Migrated spaced repetition and notification storage from in-memory dicts to Firestore (via Spring Boot API).**

### Modified Files

| File | Change |
| ------ | -------- |
| `server/learning/spaced_repetition.py` | `load_schedule()` and `save_schedule()` now call `GET/POST /review-schedule/` on Spring Boot via httpx |
| `server/scheduler/scheduler.py` | `store_notification()` calls `POST /notification`, `get_pending_notifications()` calls `GET .../unread` + marks read |
| `tests/test_learning.py` | Integration test uses mock storage (patches HTTP-backed functions) |

### Design Notes

- **Zero in-memory state for persistent data** — all review schedules and notifications survive service restarts
- **Recent quiz events** still in-memory (ephemeral, for chat context only)
- `load_all_schedules()` returns empty — batch processing not needed with Firestore backend
- Error handling: all HTTP failures logged as warnings, never crash the Coach

---

## 2025-05-26 — Adaptive Learning Subsystem

**Implemented SDD 14 (Spaced Repetition), 15 (Progress Tracking), 16 (Scheduler), 17 (Webhook).**

### New Files Created

| File | Purpose |
| ------ | --------- |
| `server/learning/spaced_repetition.py` | SM-2 algorithm adapted for category-level mastery. `SpacedRepetitionScheduler`, `ReviewItem`, `on_quiz_completed()`, in-memory schedule storage |
| `server/learning/progress.py` | `ProgressTracker` with exponential decay mastery, learning velocity, study streak, trend analysis |
| `server/scheduler/scheduler.py` | `CoachScheduler` (APScheduler) with hourly due-review check + daily progress snapshot jobs. Notification storage for chat context |
| `server/routes/webhook.py` | `POST /webhook/quiz-completed` — receives Spring Boot events, updates SR schedule, stores events for coach context |
| `server/routes/progress.py` | `GET /progress/{user_id}` — full progress report with mastery, velocity, due reviews, upcoming reviews |
| `tests/test_learning.py` | 10 unit tests: SM-2 passing/failing/bounds, due reviews, progress mastery, velocity, streak, integration |

### Modified Files (Learning Layer)

| File | Change |
| ------ | -------- |
| `server/config.py` | Added settings: `scheduler_enabled`, `review_check_interval_hours`, `progress_snapshot_hour`, `sr_default_easiness`, `sr_min_easiness` |
| `server/main.py` | Added route registration (progress, webhook), scheduler lifespan (start/shutdown), public path prefixes |
| `server/agent/coach.py` | `ChatResponse.due_reviews` now populated from spaced repetition schedule on each chat response |

### API Endpoints Added

| Method | Path | Auth | Description |
| -------- | ------ | ------ | ------------- |
| `GET` | `/progress/{user_id}` | Public | Full progress report: mastery per category, velocity, streak, due/upcoming reviews |
| `POST` | `/webhook/quiz-completed` | X-API-Key (internal check) | Receives quiz completion from Spring Boot, updates SR schedule |

### Key Design Decisions

1. **In-memory storage (MVP)**: Review schedules stored in `dict`. Replace with SQLite for production persistence.
2. **Public endpoints**: Progress and webhook bypass the API key middleware (webhook does its own auth check internally).
3. **Non-blocking webhook**: Coach chat doesn't depend on webhook — SR schedule is updated on quiz completion via webhook, but progress can also be computed on-demand.
4. **Scheduler integration**: Coach proactively mentions due reviews via pending notifications stored by the hourly job.

---

## New Files Created (WebSocket Layer)

### WebSocket Layer (`server/ws/`)

| File | Purpose |
| ------ | --------- |
| `__init__.py` | Protocol message factories (`session_ack`, `content_chunk`, `stage_event`, `tool_event`, `error_event`, `done_event`) + client→server dataclasses |
| `endpoint.py` | Main WebSocket handler — accept, authenticate, message loop, route to capabilities |
| `session.py` | Per-connection state: message history, cancel flag, mode switching, history trimming (20 msg max) |

### Capabilities (`server/capabilities/`)

| File | Class | Description |
| ------ | ------- | ------------- |
| `__init__.py` | — | Package marker |
| `base.py` | `BaseCapability` | Protocol interface: `tool_names()`, `run(messages, on_event, cancelled)` |
| `chat.py` | `SimpleChatCapability` | Direct LLM streaming (no tools). Used by both Lite+Chat and Full+Chat |
| `agentic.py` | `AgenticCapability` | Tool-calling loop (max 10 iterations, 3 calls/turn, 30s timeout). Includes `_stream_final_answer()` and `_force_final_response()` |
| `lite_orchestrator.py` | `LiteOrchestrator` | Code-driven regex `IntentClassifier` → separate workflows (weakness, recommend, explain, quiz, solve) → single LLM call |
| `quiz.py` | `QuizGenerator` | Multi-stage: plan → generate → validate. Produces structured quiz JSON |
| `solve.py` | `StepSolver` | Multi-stage: plan → solve steps → conclude. Shows work step by step |

### Tools (`server/tools/`)

| File | Tool Name | Description |
| ------ | ----------- | ------------- |
| `__init__.py` | — | `BaseTool` ABC with `name`, `description`, `parameters_schema()`, `execute()`, `definition()` |
| `registry.py` | — | `ToolRegistry` class + `create_full_registry()` / `create_lite_registry()` factories |
| `quiz_history.py` | `quiz_history` | Fetches student's quiz attempts/scores from Spring Boot backend |
| `recommend.py` | `recommend` | Generates study recommendations based on weak categories |
| `reason.py` | `reason` | Dedicated deep-reasoning LLM call for complex problems |
| `web_search.py` | `web_search` | Web search stub (needs `COACH_SEARCH_API_KEY`) |
| `rag.py` | `rag` | Retrieves relevant passages from Supabase pgvector knowledge base |

### Services (`server/services/`)

| File | Purpose |
| ------ | --------- |
| `__init__.py` | Package marker |
| `supabase_client.py` | `SupabaseClient` — pgvector similarity search + document storage |
| `embeddings.py` | `get_embedding()` — generates vectors via LM Studio `/v1/embeddings` |

### LLM Providers (`server/llm/`)

| File | Class | Description |
| ------ | ------- | ------------- |
| `base.py` | `LLMService` ABC | Abstract interface + data shapes (Message, Role, StreamChunk, ToolCall, ToolDefinition, CompletionResult) |
| `lm_studio.py` | `LMStudioProvider` | Local LLM via OpenAI-compatible SSE streaming. Ignores tools param |
| `deepseek.py` | `DeepSeekProvider` | DeepSeek via OpenAI-compatible endpoint. Native function calling support with tool_call delta accumulation |

### Router (`server/router.py`)

| Component | Purpose |
| ----------- | --------- |
| `Tier` enum | `lite` / `full` |
| `Mode` enum | `chat` / `agentic` |
| `create_llm_provider(tier)` | Factory: Lite→LMStudioProvider, Full→DeepSeekProvider |
| `resolve_capability(tier, mode, user_id, kb_id)` | Route matrix below |

---

## Modified Files (WebSocket Layer)

### `server/config.py`

- Added `supabase_url: str` and `supabase_key: str` for pgvector RAG
- Added `search_api_key: str` for web search tool
- Improved comments for tier clarity

### `server/main.py`

- Added `from server.ws.endpoint import ws_handler` import
- Added `@app.websocket("/ws")` route handler
- WebSocket now accessible at `ws://localhost:8000/ws`

### `server/quiz_client/client.py`

- Added `get_quiz_history(user_id, limit, category)` method
- Used by `QuizHistoryTool` to fetch simplified quiz data

### `server/llm/base.py`

- Added `tool_call: dict | None` field to `StreamChunk` for single tool call passthrough

---

## Architecture Routing Matrix

```text
┌──────────┬────────────────────────────────────────────┐
│          │              Mode                           │
│  Tier    ├──────────────────┬─────────────────────────┤
│          │      Chat        │        Agentic          │
├──────────┼──────────────────┼─────────────────────────┤
│  Lite    │ SimpleChatCap    │ LiteOrchestrator        │
│ (local)  │ (LM Studio)     │ (intent→workflow→LLM)   │
│          │ tools=[]         │ tools=[weakness,rec,    │
│          │                  │  explain,quiz,solve]    │
├──────────┼──────────────────┼─────────────────────────┤
│  Full    │ SimpleChatCap    │ AgenticCapability       │
│ (cloud)  │ (DeepSeek)      │ (LLM-driven tool loop)  │
│          │ tools=[]         │ tools=[quiz_history,    │
│          │                  │  recommend,reason,      │
│          │                  │  web_search,rag*]       │
└──────────┴──────────────────┴─────────────────────────┘
* rag only added when kb_id is provided
```

---

## WebSocket Protocol

### Client → Server

```json
{"type": "session_start", "tier": "full", "mode": "agentic", "user_id": "abc123", "kb_id": ""}
{"type": "user_message", "content": "Help me study linear algebra"}
{"type": "stop"}
{"type": "mode_switch", "mode": "chat"}
```

### Server → Client

```json
{"type": "session_ack", "session_id": "...", "tier": "full", "mode": "agentic", "available_tools": ["quiz_history", "recommend", "reason", "web_search"]}
{"type": "stage", "stage": "thinking", "status": "start"}
{"type": "tool", "tool_name": "quiz_history", "status": "calling", "arguments": {"limit": 10}}
{"type": "tool", "tool_name": "quiz_history", "status": "result", "result": "[...]"}
{"type": "stage", "stage": "thinking", "status": "end"}
{"type": "stage", "stage": "responding", "status": "start"}
{"type": "content", "content": "Based on your quiz history..."}
{"type": "stage", "stage": "responding", "status": "end"}
{"type": "done"}
{"type": "error", "code": "internal", "message": "..."}
```

---

## Agentic Loop Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                    AGENTIC LOOP                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────────┐   │
│  │ Messages  │───→│ LLM Call    │───→│ Parse Response   │   │
│  │ + Tools   │    │ (streaming) │    │                  │   │
│  └──────────┘    └─────────────┘    └────────┬─────────┘   │
│                                              │              │
│                                    ┌─────────┴──────────┐   │
│                                    ↓                    ↓   │
│                            Has tool_calls?         Text only │
│                                    │                    │   │
│                                    ↓                    ↓   │
│                          ┌─────────────────┐   ┌───────────┐│
│                          │ Execute Tools   │   │ Stream    ││
│                          │ (max 3/turn,    │   │ Final Ans ││
│                          │  30s timeout)   │   │ (20-char  ││
│                          └────────┬────────┘   │  chunks)  ││
│                                   │            └───────────┘│
│                                   ↓                    │    │
│                          ┌─────────────────┐       DONE     │
│                          │ Append results  │                │
│                          │ to messages     │                │
│                          └────────┬────────┘                │
│                                   │                         │
│                                   ↓                         │
│                          iteration < 10?                     │
│                           yes → LOOP BACK                   │
│                           no  → FORCE ANSWER (tools=None)   │
└─────────────────────────────────────────────────────────────┘
```

---

## LiteOrchestrator Intent Classification

```text
User message → IntentClassifier (regex patterns)
                    │
    ┌───────────────┼───────────────────────────────┐
    ↓               ↓               ↓               ↓
 weakness       recommend       explain/quiz/    general_chat
    │               │            solve               │
    ↓               ↓               │               ↓
 fetch quiz     fetch quiz      (fallback)      _simple_chat()
 history(20)    history(10)     _simple_chat()
    │               │
    ↓               ↓
 build analysis  build recommend
 prompt          prompt
    │               │
    ↓               ↓
 LLM call       LLM call
 (stream)       (stream)
```

---

## Environment Variables (`.env`)

```env
# Required for Full tier
COACH_EXTERNAL_LLM_API_KEY=your-deepseek-api-key
COACH_EXTERNAL_LLM_MODEL=deepseek-v4-flash

# LM Studio (Lite tier, default localhost)
COACH_LM_STUDIO_URL=http://127.0.0.1:1234

# Optional: RAG (Supabase pgvector)
COACH_SUPABASE_URL=https://your-project.supabase.co
COACH_SUPABASE_KEY=your-service-role-key

# Optional: Web search
COACH_SEARCH_API_KEY=your-search-api-key

# Quiz API (Spring Boot backend)
COACH_QUIZ_API_URL=http://localhost:8080

# Security
COACH_API_KEY=your-api-key

# CORS
COACH_CORS_ORIGINS=["http://localhost:3000","http://localhost:8080"]
```

---

## Changelog

### 2025-06-XX — n8n Removal & AI Question Generation

**Replaced n8n workflow entirely with native AI question generation endpoints.**

#### New: `server/routes/generate.py`

| Endpoint | Method | Purpose |
| ---------- | -------- | --------- |
| `/generate/from-topics` | POST | Generate questions from topic list (replaces Cohere + n8n) |
| `/generate/from-file` | POST | Generate questions from uploaded document (replaces n8n upload workflow) |
| `/generate/get-question` | POST | Generate a single question for a quiz ID (replaces `/n8n/get-question`) |

- Uses `create_llm_provider(Tier.FULL)` → DeepSeek for generation
- Structured JSON prompting with markdown fence stripping
- File support: `.txt`, `.md`, `.pdf` (via PyMuPDF if available)
- Truncates documents to 12K chars to fit LLM context
- Fetches quiz context from Spring Boot to determine categories

#### Removed from Spring Boot

- `n8nController.java` — deleted
- `n8nService.java` — deleted
- `QuizResponseN8n.java` — deleted
- `MultipartInputStreamFileResource.java` — deleted

#### Updated Frontend

- `src/pages/api/questions.js` — calls Coach `/generate/from-topics` (was Cohere)
- `src/pages/api/question/get-ai-question.js` — calls Coach `/generate/get-question` (was Spring Boot `/n8n/get-question`)
- `src/pages/api/quiz/upload.js` — calls Coach `/generate/from-file` (was Spring Boot `/n8n/upload`)
- Removed `cohere-ai` from `package.json`
- New env: `STUDY_COACH_API_URL` (defaults to `http://localhost:8000`)

#### Dependencies

- Added `python-multipart==0.0.29` to `requirements.txt`

### 2025-06-XX — Gemini → DeepSeek Migration

- Renamed `server/llm/gemini.py` → `server/llm/deepseek.py`
- Provider: `DeepSeekProvider` via `https://api.deepseek.com/chat/completions`
- Default model: `deepseek-v4-flash`
- Updated: `router.py`, `config.py`, `external.py`, all SDD docs, `.env.example`

### 2025-06-XX — Step-by-Step Solver Enhancement

**Enhanced `StepSolver` with 3-phase pipeline inspired by DeepTutor's `SolvePipeline`.**

#### Rewritten: `server/capabilities/solve.py`

Previous: Simple 2-phase (generate plan text → execute all at once).
New: Structured 3-phase pipeline with per-step context carryover.

**Phase 1 — Plan:**

- LLM decomposes problem into JSON `{analysis, steps[{id, goal}]}`
- Fallback parser for plain numbered lists

**Phase 2 — Execute (per step):**

- Each step solved individually with full context of previous step results
- Streaming output per step (for WebSocket)
- Structured output: `REASONING:` + `RESULT:` labels

**Phase 3 — Synthesize:**

- Produces `FINAL_ANSWER:` + `CONFIDENCE:` (high/medium/low)
- Connects steps into coherent conclusion

**Data models:**

- `PlanStep(id, goal)` — sub-goal definition
- `Plan(analysis, steps)` — problem decomposition
- `StepResult(step_id, goal, reasoning, result)` — per-step output
- `Solution(problem, plan, step_results, final_answer, confidence)` — complete solution

**Two execution modes:**

- `run()` — WebSocket streaming with stage events per step
- `run_http()` — REST endpoint returning structured `Solution`

#### New: `server/routes/solve.py`

| Endpoint | Method | Purpose |
| ---------- | -------- | --------- |
| `/solve` | POST | Solve a problem step-by-step, returns structured solution |

Request: `{ "problem": "...", "user_id": "..." }`
Response: `{ "problem", "analysis", "steps[]", "final_answer", "confidence" }`

#### Updated: `server/main.py`

- Registered solve router: `app.include_router(solve.router, tags=["Solve"])`
- Total routes: 14

---

## What's Still Needed

- [x] Frontend widget integration (connects to `/ws` instead of REST `/chat`)
- [ ] Supabase schema migration (create `documents` + `document_chunks` tables + `match_documents` RPC)
- [ ] Web search API integration (SerpAPI / Brave Search)
- [ ] `QuizGenerator` wired into router as additional mode
- [x] `StepSolver` enhanced with 3-phase pipeline + REST endpoint `/solve`
- [ ] Spaced repetition scheduler (`server/scheduler/`)
- [ ] Learning progress tracking (`server/learning/`)
- [ ] End-to-end tests for WebSocket flow
- [ ] Rate limiting on WebSocket connections
- [x] Fix: DeepSeekProvider `content=None` handling in `_format_msg` (resolved)
- [ ] Fix: Graceful error when `COACH_EXTERNAL_LLM_API_KEY` is empty and Full tier is selected
- [ ] AI Coach Dashboard page (`/coach`) — frontend implementation
