# AGENTS.md

## Project Overview

AI Study Coach — a FastAPI microservice (Python 3.12+) providing personalized study guidance powered by LLM inference. Integrates with an external Spring Boot quiz platform via REST, streams coaching responses over WebSocket, and uses algorithmic learning science (weakness detection, spaced repetition) alongside LLM-generated advice. The coach operates as an **agentic system** — it can use tools for retrieval, reasoning, recommendations, and quiz-history analysis.

## Architecture & Data Flow

```text
User → Chat Widget (WS) → FastAPI (:8000) → Quiz API (Spring Boot :8080) → Fetch history
                                           → learning/ (algorithmic analysis)
                                           → agent/prompts.py (build context)
                                           → llm/ (LM Studio via OpenAI-compatible API)
                                           ↕ tool-use loop (max 3 rounds):
                                             LLM → tool_call → tool_executor → result → LLM
                                           → Stream tokens + action commands back to client

Spring Boot → POST /webhook/quiz-completed → Update SR schedule → Persist via Spring Boot
                                           → Trigger weakness re-analysis

Scheduler (APScheduler) → hourly: check due reviews → create notifications via Spring Boot
                        → daily: compute progress snapshots
```

**Key design principles:**

- Use LLMs for natural language generation **and agentic tool selection**. The LLM decides *when* to use tools based on conversation context.
- Weakness analysis, spaced repetition, and progress tracking are purely algorithmic (`server/learning/`). This is intentional — deterministic logic is faster, testable, and reliable.
- Tool execution happens server-side (data fetching) and client-side (UI actions). The backend decides *what* to do; the frontend executes navigation/UI changes via the `onAction` callback.

## Project Structure

- `server/main.py` — FastAPI app factory, lifespan (starts scheduler), CORS, router registration
- `server/config.py` — All settings via `pydantic-settings`; env vars prefixed `COACH_`; loaded from `.env`
- `server/agent/coach.py` — **Main orchestrator**: `handle_chat()` (non-agentic) and `handle_chat_agentic()` (tool-use loop)
- `server/agent/prompts.py` — System prompts (`SYSTEM_PROMPT` + `AGENTIC_SYSTEM_PROMPT`) and context builder
- `server/agent/tools.py` — Tool definitions registry (8 tools in OpenAI function-calling format)
- `server/agent/tool_executor.py` — Executes tool calls; returns result text (for LLM) + `AgentAction` (for frontend)
- `server/llm/external.py` — LLM client (LM Studio / DeepSeek via OpenAI-compatible API)
- `server/llm/deepseek.py` — DeepSeekProvider for Full tier (streaming + function calling)
- `server/llm/lm_studio.py` — LMStudioProvider for Lite tier (local)
- `server/quiz_client/client.py` — HTTP client wrapping Spring Boot quiz API
- `server/learning/weakness.py` — Algorithmic weakness analyzer (no AI)
- `server/learning/spaced_repetition.py` — SM-2 algorithm, ReviewItem, schedule CRUD (Firestore via Spring Boot)
- `server/learning/progress.py` — ProgressTracker: mastery, velocity, streaks, trends
- `server/scheduler/scheduler.py` — APScheduler: hourly due-review check + daily progress snapshot
- `server/models/schemas.py` — All Pydantic v2 models (chat, quiz API responses, analysis, agent actions, webhook, notifications)
- `server/routes/chat.py` — compatibility `POST /chat` and `POST /chat/agentic` endpoints
- `server/routes/generate.py` — `POST /generate/from-topics`, `/generate/from-file`, `/generate/get-question` — AI question generation
- `server/routes/solve.py` — `POST /solve` — Step-by-step problem solving (structured 3-phase pipeline)
- `server/routes/progress.py` — `GET /progress/{user_id}` — Progress metrics + due reviews
- `server/routes/webhook.py` — `POST /webhook/quiz-completed` — Receives quiz completion, updates SR schedule
- `server/routes/explain.py` — `POST /explain-answer` — AI explanation of quiz answers (streams via DeepSeek, Lite fallback)
- `server/routes/health.py` — `GET /health` with LLM status
- `server/tools/web_search.py` — `WebSearchTool` — DuckDuckGo web search via `ddgs` library (no API key required)

## Running the Server

```bash
python -m venv venv                                # first time only
.\venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env                             # then set COACH_LM_STUDIO_URL
.\venv\Scripts\python.exe -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
```

## Testing

Unit tests for learning modules (no external dependencies):

```bash
python -m pytest tests/ -v
```

Key test files:

- `tests/test_learning.py` — SM-2 spaced repetition + progress tracker tests (10 cases)
- `tests/test_ai_response.py` — LLM client connectivity, prompt builder, agent flow (requires LM Studio)

Integration tests require LM Studio running with a model loaded.

## Conventions & Patterns

- **Singleton clients**: `external_client`, `quiz_client` are module-level singletons — import and use directly, do not reinstantiate.
- **LLM**: Uses LM Studio (local) via OpenAI-compatible API. Can also use Google AI Studio as an alternative. See `_get_llm_client()` in `server/agent/coach.py`.
- **LLM interface contract**: `ExternalLLMClient` exposes `chat()`, `chat_with_tools()`, `chat_stream()`, and `is_available()`. New LLM providers should follow the same OpenAI-compatible pattern.
- **Agentic loop**: `handle_chat_agentic()` runs up to `MAX_TOOL_ROUNDS` (3) iterations of: send messages+tools to LLM → if tool_calls returned, execute via `tool_executor.py` → append results → repeat. Falls back to `handle_chat()` on error.
- **Tool definitions**: All tools defined in `server/agent/tools.py` using OpenAI function-calling JSON schema. To add a new tool: (1) add definition to `TOOL_DEFINITIONS`, (2) add executor case in `tool_executor.py`.
- **Tool executor pattern**: Each tool returns `tuple[str, AgentAction | None]` — the string is fed back to the LLM as the tool result; the `AgentAction` (if any) is sent to the frontend for execution.
- **Pydantic v2**: All models in `server/models/schemas.py`. Use `model_dump()` (not `.dict()`). Quiz API response models use camelCase fields to match the Spring Boot API.
- **Config**: All env vars use `COACH_` prefix. Add new settings to `server/config.py` `Settings` class. Access via `from server.config import settings`.
- **Async everywhere**: All HTTP calls use `httpx.AsyncClient`. All route handlers and client methods are `async`.
- **Error handling**: Quiz client returns empty list or `None` on 404 — never raises for missing data. LLM errors in `handle_chat()` return user-friendly `ChatResponse` with error message rather than raising. Agentic flow falls back to non-agentic on error.
- **Lazy imports**: `analyze_weaknesses` and `execute_tool` are imported inside handler functions to avoid circular imports at startup — preserve this pattern.
- **API key auth**: Protected HTTP endpoints (`/chat`, `/chat/agentic`) require `X-API-Key` when `COACH_API_KEY` is set. WebSocket clients pass the same key as `?api_key=...` because browsers cannot set custom WebSocket headers. Public endpoints (`/`, `/health`, `/docs`) are always open.
- **AgentAction dispatch**: The WebSocket handler sends `AgentAction` objects to the frontend. The frontend is responsible for executing UI actions (navigation, quiz starting, etc.) via the `onAction` handler in the chat store.
- **Score format**: Quiz scores are strings like `"3/5"` — parsed by `_parse_score()` in `weakness.py`.
- **Categories**: Always **lowercase** strings (e.g., `"math"`, `"general_culture"`). Quizzes have exactly 1 category. Weakness analysis and progress tracking aggregate scores per category. Fallback category when lookup fails is `"general"`.

## Available Tools (Agentic)

| Tool | Description | Frontend Action |
| --- | --- | --- |
| `navigate_to_page` | Navigate to a page (dashboard, quiz list, profile, etc.) | `window.location` / router push |
| `start_quiz` | Start a specific quiz (verifies existence via quiz API) | Call take-quiz API + navigate |
| `generate_questions` | Generate AI questions on given topics | Call questions API |
| `show_quiz_results` | Show results for a quiz attempt | Navigate to results page |
| `create_practice_quiz` | Create a new quiz targeting weak categories | Call save-quiz API + redirect |
| `show_weakness_report` | Display weakness analysis in chat | Render inline report |
| `search_quizzes` | Find quizzes by category from user profile | Filter + display quiz list |
| `web_search` | Search the web via DuckDuckGo (ddgs library) | None (result fed back to LLM) |

## REST Endpoints

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/health` | GET | Public | Health check + LLM status |
| `/ws` | WebSocket | `api_key` query | Streaming chat (session_start, user_message, mode_switch) |
| `/chat/{mode}` | POST | X-API-Key | Compatibility chat (mode: chat/agentic) |
| `/generate/from-topics` | POST | X-API-Key | Generate questions from topic list |
| `/generate/from-file` | POST | X-API-Key | Generate questions from uploaded file |
| `/generate/get-question` | POST | X-API-Key | Generate single question |
| `/solve` | POST | X-API-Key | Step-by-step problem solving |
| `/progress/{user_id}` | GET | X-API-Key | Progress metrics + due reviews |
| `/webhook/quiz-completed` | POST | X-API-Key | Quiz completion webhook (from Spring Boot) |
| `/explain-answer` | POST | X-API-Key | AI explanation of a quiz answer (2-4 sentences) |

## Learning Modules (server/learning/)

| Module | Algorithm | Storage |
| --- | --- | --- |
| `spaced_repetition.py` | SM-2 (easiness, interval, repetitions) | Firestore `review_schedule` via Spring Boot |
| `progress.py` | Exponential-decay mastery, velocity, streaks | Computed from quiz history (Spring Boot) |
| `weakness.py` | Score aggregation per category | Computed on-demand (no persistence) |

## Scheduler (server/scheduler/)

Uses APScheduler `AsyncIOScheduler`, started during FastAPI lifespan:

| Job | Schedule | Action |
| --- | --- | --- |
| `check_due_reviews` | Every hour | Fetch due reviews → create notifications in Firestore |
| `daily_progress_snapshot` | Daily at 2 AM | Compute progress for active users |

## Planned/Incomplete

- Full automated test coverage (test strategy defined in SDD 12, not all automated)
