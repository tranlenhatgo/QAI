# Frontend — Specification-Driven Development Guide

> SDD for the QAI Next.js frontend — quiz platform UI with AI coaching integration.

---

## Project Context

**Product**: QAI Frontend — a Next.js Pages Router application for quiz creation, gameplay, user profiles, and AI study coaching.

**Architecture**:
```
Browser (Next.js :3000)
  ├─→ Spring Boot (:8080) — Quiz CRUD, take-quiz, user profile
  └─→ AI Study Coach (:8000) — WebSocket chat, LLM coaching, question generation
```

---

## File Index

| # | File | What It Specifies |
|---|------|-------------------|
| 01 | [ARCHITECTURE.md](./01-ARCHITECTURE.md) | System topology, tech stack, page routes |
| 02 | [COMPONENTS.md](./02-COMPONENTS.md) | Component tree and responsibilities |
| 03 | [STATE-MANAGEMENT.md](./03-STATE-MANAGEMENT.md) | Zustand store slices, chat store details |
| 04 | [API-LAYER.md](./04-API-LAYER.md) | BFF pattern, API routes, helper functions |
| 05 | [AUTHENTICATION.md](./05-AUTHENTICATION.md) | Firebase auth flow, token management |
| 06 | [DATA-FLOWS.md](./06-DATA-FLOWS.md) | End-to-end data flows for all features |
| 07 | [ENVIRONMENT-SECURITY.md](./07-ENVIRONMENT-SECURITY.md) | Env vars, security measures, conventions |
| 08 | [PWA.md](./08-PWA.md) | Service worker, offline caching, manifest |
| 09 | [BUILD-SECURITY-HEADERS.md](./09-BUILD-SECURITY-HEADERS.md) | Build config, security headers, linting |
| 10 | [GLOBAL-LAYOUT.md](./10-GLOBAL-LAYOUT.md) | App bootstrap, auth sync, modal composition |
| 11 | [UI-INTERACTION.md](./11-UI-INTERACTION.md) | Screens, user interactions, gamification, animations |
| 12 | [AI-COACH-DASHBOARD.md](./12-AI-COACH-DASHBOARD.md) | AI Coach hub page: all AI features in one dashboard |

---

## Quick Start

```bash
cd frontend
npm install
cp .env.example .env.local   # Set REST_API_URL, ANSWER_ENCRYPTION_KEY, etc.
npm run dev                   # → http://localhost:3000
```

## Dependencies

- Spring Boot backend running on `:8080`
- AI Study Coach running on `:8000` (for AI features)
- Firebase project configured (auth)
