# AGENTS.md

## Project Overview

AI Study Coach — a FastAPI microservice (Python 3.12+) providing personalized study guidance powered by LLM inference. Integrates with an external Spring Boot quiz platform via REST, streams coaching responses over WebSocket/HTTP, and uses algorithmic learning science (weakness detection, spaced repetition) alongside LLM-generated advice. The coach operates as an **agentic system** — it can take actions on the quiz platform (navigate pages, start quizzes, generate questions) via LLM function calling (tool use).

## Architecture & Data Flow

```
User → Chat Widget (WS) → FastAPI (:8000) → Quiz API (Spring Boot :8080) → Fetch history
                                           → learning/ (algorithmic analysis)
                                           → agent/prompts.py (build context)
                                           → llm/ (LM Studio via OpenAI-compatible API)
                                           ↕ tool-use loop (max 3 rounds):
                                             LLM → tool_call → tool_executor → result → LLM
                                           → Stream tokens + action commands back to client
```

**Key design principles:**

- Use LLMs for natural language generation **and agentic tool selection**. The LLM decides *when* to use tools based on conversation context.
- Weakness analysis, spaced repetition, and progress tracking are purely algorithmic (`server/learning/`). This is intentional — deterministic logic is faster, testable, and reliable.
- Tool execution happens server-side (data fetching) and client-side (UI actions). The backend decides *what* to do; the frontend executes navigation/UI changes via the `onAction` callback.

## Project Structure

- `server/main.py` — FastAPI app factory, lifespan, CORS, router registration
- `server/config.py` — All settings via `pydantic-settings`; env vars prefixed `COACH_`; loaded from `.env`
- `server/agent/coach.py` — **Main orchestrator**: `handle_chat()` (non-agentic) and `handle_chat_agentic()` (tool-use loop)
- `server/agent/prompts.py` — System prompts (`SYSTEM_PROMPT` + `AGENTIC_SYSTEM_PROMPT`) and context builder
- `server/agent/tools.py` — Tool definitions registry (7 tools in OpenAI function-calling format)
- `server/agent/tool_executor.py` — Executes tool calls; returns result text (for LLM) + `AgentAction` (for frontend)
- `server/llm/external.py` — LLM client (LM Studio / DeepSeek via OpenAI-compatible API)
- `server/llm/deepseek.py` — DeepSeekProvider for Full tier (streaming + function calling)
- `server/llm/lm_studio.py` — LMStudioProvider for Lite tier (local)
- `server/quiz_client/client.py` — HTTP client wrapping Spring Boot quiz API
- `server/learning/weakness.py` — Algorithmic weakness analyzer (no AI)
- `server/models/schemas.py` — All Pydantic v2 models (chat, quiz API responses, analysis, agent actions)
- `server/routes/chat.py` — `POST /chat` and `POST /chat/agentic` endpoints
- `server/routes/generate.py` — `POST /generate/from-topics`, `/generate/from-file`, `/generate/get-question` — AI question generation (replaces n8n)
- `server/routes/solve.py` — `POST /solve` — Step-by-step problem solving (structured 3-phase pipeline)
- `server/routes/health.py` — `GET /health` with LLM status
- `widget/` — Embeddable chat widget (JS/CSS) with action dispatch via `onAction` callback

## Running the Server

```bash
python -m venv venv && venv\Scripts\activate      # Windows
pip install -r requirements.txt
copy .env.example .env                             # then set COACH_LM_STUDIO_URL
python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
```

## Testing

Tests bypass the Spring Boot backend using mock quiz data:

```bash
python -m tests.test_ai_response
```

This runs 5 tests: LLM client connectivity, prompt builder, full agent flow with mock data, streaming, and HTTP endpoint (requires running server). Tests require LM Studio running with a model loaded. See `tests/test_ai_response.py` for mock data patterns.

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
- **API key auth**: Protected endpoints (`/chat`, `/chat/agentic`) require `X-API-Key` header when `COACH_API_KEY` is set. Public endpoints (`/`, `/health`, `/docs`) are always open.
- **Widget onAction**: The chat widget dispatches `AgentAction` objects to the host page via `window.STUDY_COACH_CONFIG.onAction` callback. The host app is responsible for executing UI actions (navigation, quiz starting, etc.).
- **Score format**: Quiz scores are strings like `"3/5"` — parsed by `_parse_score()` in `weakness.py`.

## Available Tools (Agentic)

| Tool | Description | Frontend Action |
|------|-------------|----------------|
| `navigate_to_page` | Navigate to a page (dashboard, quiz list, profile, etc.) | `window.location` / router push |
| `start_quiz` | Start a specific quiz (verifies existence via quiz API) | Call take-quiz API + navigate |
| `generate_questions` | Generate AI questions on given topics | Call questions API |
| `show_quiz_results` | Show results for a quiz attempt | Navigate to results page |
| `create_practice_quiz` | Create a new quiz targeting weak categories | Call save-quiz API + redirect |
| `show_weakness_report` | Display weakness analysis in chat | Render inline report |
| `search_quizzes` | Find quizzes by category from user profile | Filter + display quiz list |

## Planned/Incomplete Modules

`server/learning/spaced_repetition.py` and `server/learning/progress.py` are referenced in README but not yet implemented. `server/scheduler/` exists as a placeholder.
