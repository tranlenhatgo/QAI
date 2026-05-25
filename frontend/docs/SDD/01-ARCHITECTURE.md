# 01 — Frontend Architecture

## Overview

The QAI frontend is a **Next.js Pages Router** application serving as the primary user interface for quiz creation, gameplay, user profiles, and AI study coaching. It communicates with two backend services:

- **Spring Boot** (`:8080`) — Quiz CRUD, take-quiz, user profile
- **AI Study Coach** (`:8000`) — WebSocket chat, LLM-based coaching

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js :3000)                       │
├─────────────────────────────────────────────────────────────────────┤
│  Pages:  /  /play  /create  /profile  /chat                        │
│  State:  Zustand (6 merged slices)                                  │
│  Auth:   Firebase client-side (signIn/signUp/token)                 │
│  PWA:    @ducanh2912/next-pwa (offline support)                     │
├────────────────────┬────────────────────┬───────────────────────────┤
│  API Routes        │  Direct Client     │  WebSocket                │
│  /api/auth/*       │  Calls (helpers)   │  ws://localhost:8000/ws   │
│  /api/quiz/*       │                    │                           │
│  /api/question/*   │                    │                           │
│  /api/take/*       │                    │                           │
│  /api/coach/chat   │                    │                           │
│  /api/questions    │                    │                           │
└────────┬───────────┴────────────────────┴───────────┬───────────────┘
         │                                            │
         ▼                                            ▼
┌─────────────────┐                          ┌────────────────────┐
│ Spring Boot     │                          │ AI Study Coach     │
│ :8080           │                          │ :8000              │
│ Quiz CRUD API   │                          │ FastAPI + LLM      │
│                 │                          │ + Question Gen     │
└─────────────────┘                          └────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (Pages Router) | 15.3.2 |
| UI Library | React | 18.2.0 |
| State Management | Zustand | 4.3.8 |
| Styling | Tailwind CSS | 3.2.4 |
| Authentication | Firebase | 11.7.1 |
| Encryption | crypto-js | 4.2.0 |
| Sanitization | DOMPurify | 3.4.1 |
| PWA | @ducanh2912/next-pwa | 10.2.9 |
| Animations | react-canvas-confetti | 1.3.0 |
| Icons | react-icons | 4.7.1 |

---

## Page Routes

| Route | File | Purpose |
|-------|------|---------|
| `/` | `src/pages/index.js` | Home — category grid + game mode selection |
| `/play` | `src/pages/play/index.js` | Quiz gameplay (questions, timer, wildcards) |
| `/create` | `src/pages/create/index.js` | Quiz creation interface |
| `/profile` | `src/pages/profile/index.js` | User profile, quiz history, leaderboard |
| `/chat` | `src/pages/chat/index.js` | AI Study Coach chat interface |
