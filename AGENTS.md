# AGENTS.md

## Codex Startup Instructions

Before working on any task, read `CLAUDE.md` and follow it together with this file.

## Rules

- **No subagents**: Do NOT use `runSubagent` or delegate work to sub-agents. All work must be done directly.

## Project: QAI — AI-Assisted Quiz Platform

Three-component system: Spring Boot backend, Next.js frontend, FastAPI AI Study Coach.

## Component Map

```text
Browser → Next.js (Pages Router, :3000)
            ├─→ Spring Boot (:8080) — quiz CRUD, take-quiz, user profile, review schedules, notifications
            │     └─→ Firestore — quiz, question, take_quiz, take_question, review_schedule, notification
            └─→ AI Study Coach (:8000) — WebSocket chat, LLM coaching, AI question generation,
                  │                       spaced repetition, progress tracking, background scheduler
                  ├─→ Spring Boot quiz API — fetch history, quiz details, persist schedules/notifications
                  ├─→ DeepSeek API — cloud LLM (Full tier)
                  └─→ LM Studio (:1234) — local LLM via OpenAI-compatible API
```

## Per-Component Reference

| Component | Stack | AGENTS.md |
| --- | --- | --- |
| spring-backend | Spring Boot 3.4, Java 17+, Firestore | [spring-backend/AGENTS.md](spring-backend/AGENTS.md) |
| frontend | Next.js Pages Router, Zustand | [frontend/AGENTS.md](frontend/AGENTS.md) |
| ai-study-coach | FastAPI Python 3.12+, LLM agent | [ai-study-coach/AGENTS.md](ai-study-coach/AGENTS.md) |

## Cross-Cutting Conventions

- **IDs**: 8-char UUID slices (`IdUtil.generateId()` in backend, matched by coach quiz client)
- **Score format**: `"correct/total"` string everywhere (parse with `_parse_score`)
- **Categories**: **always lowercase** in API responses, Firestore fields, and AI Coach storage. Java enum is UPPER_CASE internally; API serializes to lowercase. Frontend sends UPPER_CASE on create (for `Category.valueOf()`), receives lowercase on read. **A quiz must have exactly 1 category** — enforced by frontend (single-select radio buttons) and backend (`@Size(max = 1)` validation on `QuizCreationRequestDto.categories`). This constraint ensures AI features (weakness analysis, spaced repetition, progress tracking) attribute quiz results to the correct category.
- **API error shape**: `{ message, statusCode }` from Spring Boot, consumed by both frontend and coach
- **Auth**: Firebase client-side (frontend) + FirebaseAdmin server-side (Spring Boot); coach uses `X-API-Key`
- **AI Question Generation**: Handled by AI Study Coach `/generate/*` endpoints (DeepSeek LLM)
- **Spaced Repetition**: SM-2 algorithm in AI Coach, schedule persisted to Firestore `review_schedule` via Spring Boot
- **Notifications**: Created by AI Coach scheduler, stored in Firestore `notification` via Spring Boot

## Data Flow: Quiz Completion → Coach → Review Scheduling

1. Frontend submits answers via `take-quiz/end` → Spring Boot computes score
2. Spring Boot `WebhookService` fires `POST /webhook/quiz-completed` → AI Coach
3. Coach updates spaced repetition schedule (SM-2): new interval, easiness, next_review
4. Coach persists updated `ReviewSchedule` via Spring Boot `POST /review-schedule` upsert
5. Scheduler (hourly) checks due reviews → creates `Notification` documents
6. Frontend `NotificationBell` polls notifications → user sees review reminders
7. User clicks [Review] → plays review quiz → loop back to step 1

## What's Implemented

- ✅ Quiz CRUD (Spring Boot + Firestore)
- ✅ Quiz play with scoring and history
- ✅ AI question generation (from topics, files, single question)
- ✅ AI Chat (WebSocket primary, Lite/Full tiers, Chat/Agentic modes; REST endpoints kept for compatibility)
- ✅ Step-by-step problem solver
- ✅ RAG tool (Supabase pgvector)
- ✅ Spaced repetition (SM-2 algorithm, Firestore persistence)
- ✅ Progress tracking (mastery, velocity, streaks, trends)
- ✅ Background scheduler (APScheduler: hourly due-review check, daily progress snapshot)
- ✅ Quiz completion webhook (Spring Boot → AI Coach)
- ✅ Notifications (Firestore-backed, NotificationBell component)
- ✅ Coach Dashboard (tabbed: Overview, Generate, Solver, Materials, Weaknesses, Chat)
- ✅ Due Reviews UI (ReviewCard with [Review] button)
- ✅ PWA (service worker, offline manifest)

## What's Incomplete

- `[PARTIAL] 13-WEB-SEARCH.md` — web search tool stub exists but no real provider integrated
- `[PARTIAL] 12-TESTING-STRATEGY.md` — test strategy defined, not all scenarios automated
- Frontend floating chat widget not rendered on non-coach pages (only `/coach` has chat)
- No automated end-to-end tests yet (E2E test plan exists in `AGENTS-E2E-TEST.md`)

## Developer Workflow

```bash
# Spring Boot
cd spring-backend && .\mvnw.cmd -q -DskipTests package && .\mvnw.cmd spring-boot:run

# Frontend
cd frontend && npm install && npm run dev

# AI Coach
cd ai-study-coach
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
.\venv\Scripts\python.exe -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
```

## Testing

```bash
# AI Coach unit tests
cd ai-study-coach && python -m pytest tests/ -v

# Frontend lint
cd frontend && npm run lint

# Spring Boot compile check
cd spring-backend && .\mvnw.cmd -q -DskipTests compile

# E2E (manual via Playwright MCP — see AGENTS-E2E-TEST.md)
```
