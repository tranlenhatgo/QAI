# QAI — AI-Assisted Quiz Platform

An interactive quiz platform with AI-powered study coaching, spaced repetition, and personalized learning. Three-component architecture: Spring Boot backend, Next.js frontend, and FastAPI AI Study Coach.

## Features

- **Quiz Play** — Create, share, and take quizzes with real-time scoring
- **AI Question Generation** — Generate questions from topics or uploaded files via LLM
- **AI Study Coach** — WebSocket-based chat with agentic tool use (navigates, analyzes, recommends)
- **Spaced Repetition** — SM-2 algorithm tracks category mastery and schedules reviews
- **Progress Tracking** — Mastery scores, learning velocity, study streaks, trend analysis
- **Weakness Detection** — Algorithmic analysis of quiz history to identify weak areas
- **Step-by-Step Solver** — AI breaks down complex problems into guided steps
- **Notifications** — Review reminders and progress milestones
- **PWA** — Installable, offline-capable progressive web app

## Architecture

```text
Browser → Next.js (:3000) — Pages Router, Zustand state, BFF API routes
            ├─→ Spring Boot (:8080) — Quiz CRUD, scoring, history, review schedules, notifications
            │     └─→ Firestore — quiz, question, take_quiz, take_question, review_schedule, notification
            └─→ AI Study Coach (:8000) — WebSocket chat, LLM coaching, question generation,
                  │                       spaced repetition, progress tracking, background scheduler
                  ├─→ Spring Boot quiz API — fetch history, persist schedules/notifications
                  ├─→ DeepSeek API — cloud LLM (Full tier)
                  └─→ LM Studio (:1234) — local LLM via OpenAI-compatible API
```

## Quick Start

```powershell
# Terminal 1: Spring Boot backend
cd spring-backend
.\mvnw.cmd spring-boot:run

# Terminal 2: Next.js frontend
cd frontend
npm install && npm run dev

# Terminal 3: AI Study Coach
cd ai-study-coach
pip install -r requirements.txt
python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| AI Coach API | http://localhost:8000 |
| Coach Swagger | http://localhost:8000/docs |

See [GUIDE.md](GUIDE.md) for detailed setup instructions.

## Prerequisites

| Dependency | Version | Purpose |
|------------|---------|---------|
| Java JDK | 17+ | Spring Boot backend |
| Node.js | 18+ | Next.js frontend |
| Python | 3.12+ | AI Study Coach |
| Firebase service account | JSON key | Firestore access |
| LM Studio | latest | Local LLM inference (port 1234) |

## Project Structure

```
QAI/
├── spring-backend/    Spring Boot 3.4, Firestore, REST API
├── frontend/          Next.js Pages Router, Zustand, Tailwind
├── ai-study-coach/    FastAPI, SM-2, LLM agent, WebSocket
├── AGENTS.md          Project conventions for AI agents
├── CLAUDE.md          Behavioral guidelines
├── GUIDE.md           Detailed setup & run guide
└── README.md          This file
```

## Data Flow: Quiz → AI → Review

1. User completes quiz → Spring Boot computes score
2. Spring Boot fires webhook → AI Coach receives completion
3. AI Coach runs SM-2 algorithm → computes next review date
4. AI Coach persists schedule → Spring Boot → Firestore
5. Scheduler checks due reviews hourly → creates notifications
6. User sees notification → plays review quiz → cycle repeats

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Zustand, Tailwind CSS |
| Backend | Spring Boot 3.4, Java 17, Firestore |
| AI Coach | FastAPI, Python 3.12, httpx, APScheduler |
| LLM | LM Studio (local) / DeepSeek (cloud) |
| Database | Google Cloud Firestore |
| Auth | Firebase Authentication |
| Deployment | PWA-ready (service worker, manifest) |
