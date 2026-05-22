# AGENTS.md

## Codex Startup Instructions

Before working on any task, read `CLAUDE.md` and follow it together with this file.


## Project: QAI — AI-Assisted Quiz Platform

Three-component system: Spring Boot backend, Next.js frontend, FastAPI AI Study Coach.

## Component Map

```
Browser → Next.js (Pages Router, :3000)
            ├─→ Spring Boot (:8080) — quiz CRUD, take-quiz, user profile
            │     └─→ Firestore — quiz, question, take_quiz, take_question
            │     └─→ n8n (:5678) — AI question generation webhooks
            └─→ AI Study Coach (:8000) — WebSocket chat, LLM coaching
                  └─→ Spring Boot quiz API — fetch history, quiz details
                  └─→ LM Studio (:1234) — local LLM via OpenAI-compatible API
```

## Per-Component Reference

| Component | Stack | AGENTS.md |
|-----------|-------|-----------|
| spring-backend | Spring Boot 3.4, Java 17+, Firestore | [spring-backend/AGENTS.md](spring-backend/AGENTS.md) |
| frontend | Next.js Pages Router, Zustand | [frontend/AGENTS.md](frontend/AGENTS.md) |
| ai-study-coach | FastAPI Python 3.12+, LLM agent | [ai-study-coach/AGENTS.md](ai-study-coach/AGENTS.md) |

## Cross-Cutting Conventions

- **IDs**: 8-char UUID slices (`IdUtil.generateId()` in backend, matched by coach quiz client)
- **Score format**: `"correct/total"` string everywhere (parse with `_parse_score`)
- **Categories**: lowercase in Firestore, enum in Java, string lists in Python
- **API error shape**: `{ message, statusCode }` from Spring Boot, consumed by both frontend and coach
- **Auth**: Firebase client-side (frontend) + FirebaseAdmin server-side (Spring Boot); coach uses `X-API-Key`
- **n8n**: `http://localhost:5678/webhook` — AI question generation pipeline, called by both frontend and backend

## Data Flow: Quiz Completion → Coach

1. Frontend submits answers via `take-quiz/end` → Spring Boot computes score
2. (Planned) Spring Boot fires webhook → Coach receives `QuizCompletedWebhook`
3. Coach analyzes weaknesses, schedules spaced repetition review
4. Student sees coach insights in chat widget

## What's Incomplete

- `ai-study-coach/server/learning/spaced_repetition.py` — not implemented
- `ai-study-coach/server/learning/progress.py` — not implemented
- `ai-study-coach/server/scheduler/` — placeholder only
- `QuizCompletedWebhook` model exists but no webhook endpoint in coach
- `ChatResponse.due_reviews` field exists but never populated
- Frontend widget not embedded in Next.js pages yet
- No end-to-end tests across components

## Developer Workflow

```bash
# Spring Boot
cd spring-backend && .\mvnw.cmd -q -DskipTests package && .\mvnw.cmd spring-boot:run

# Frontend
cd frontend && npm install && npm run dev

# AI Coach
cd ai-study-coach && pip install -r requirements.txt && copy .env.example .env
python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
```
