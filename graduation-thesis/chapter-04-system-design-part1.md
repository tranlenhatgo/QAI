# Chapter 4: System Design — Part 1: Architecture

## 4.1 Architectural Overview

QAI employs a **microservices architecture** consisting of three independently deployable services that communicate via REST, WebSocket, and webhook patterns:

| Service | Technology | Port | Responsibility |
|---------|-----------|------|----------------|
| Spring Backend | Spring Boot 3.4 / Java 21 | 8080 | Quiz CRUD, user management, spaced repetition, notifications |
| Frontend | Next.js 15 (Pages Router) | 3000 | UI rendering, BFF API routes, state management, PWA |
| AI Study Coach | FastAPI / Python 3.12+ | 8000 | LLM inference, RAG pipeline, question generation, coaching |

```text
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  Next.js Pages • React Components • Zustand Store • PWA SW      │
└───────────────┬──────────────────┬──────────────────────────────┘
                │ HTTP              │ WebSocket
    ┌───────────▼─────────┐   ┌────▼─────────────────────────┐
    │  Next.js BFF Routes │   │  AI Study Coach (FastAPI)     │
    │  /api/coach/*       │   │  /ws/coach                    │
    │  /api/quiz/*        │   │  /ingest, /generate, /webhook │
    └───────────┬─────────┘   └────┬────────┬────────────────┘
                │ HTTP              │ HTTP   │ Embedding API
    ┌───────────▼─────────┐   ┌────▼────┐  ┌▼────────────────┐
    │  Spring Boot API    │   │Supabase │  │   LM Studio     │
    │  /quiz, /question,  │   │pgvector │  │   (local LLM)   │
    │  /take-quiz, etc.   │   └─────────┘  └─────────────────┘
    └───────────┬─────────┘                        │
                │ Firestore SDK                    ┌▼──────────┐
    ┌───────────▼─────────┐                       │ DeepSeek  │
    │  Google Firestore   │                       │ (cloud)   │
    │  (NoSQL Database)   │                       └───────────┘
    └─────────────────────┘
```

## 4.2 Service Responsibilities

### 4.2.1 Spring Boot Backend

The Spring Boot service is the **system of record** for quiz data and user accounts:

- **Quiz lifecycle**: Create, read, update, delete quizzes and questions.
- **Quiz gameplay**: Record attempts (`TakeQuiz`), validate answers, compute scores.
- **Review scheduling**: Store and query `ReviewSchedule` documents per user per category.
- **Notifications**: Generate review reminders and milestone notifications.
- **Webhook dispatch**: After quiz completion, notify the AI Coach for spaced repetition processing.

The service uses the **Firebase Admin SDK** for Firestore access and does not use a relational database.

### 4.2.2 Next.js Frontend

The frontend serves dual roles as a **UI layer** and **Backend-for-Frontend (BFF)**:

**UI Layer**:
- Server-side rendered pages with React components.
- Client-side state management via Zustand (bound store pattern).
- Real-time AI chat via direct WebSocket connection to AI Coach.
- PWA capabilities: service worker, web app manifest, offline caching.

**BFF API Routes** (`/api/*`):
- Proxy requests to Spring Boot with authentication token forwarding.
- Proxy requests to AI Coach with API key injection (secrets stay server-side).
- Token verification via Firebase Admin SDK on each request.

### 4.2.3 AI Study Coach

The Python service handles all AI/ML workloads:

- **WebSocket chat**: Streaming conversation with agentic tool-calling loop.
- **Question generation**: From topics, from uploaded files, from RAG-indexed materials.
- **Document ingestion**: Text extraction → chunking → embedding → Supabase storage.
- **Spaced repetition engine**: SM-2 algorithm execution triggered by quiz webhooks.
- **Progress analysis**: Computes mastery metrics, velocity, streaks from quiz history.
- **Scheduler**: Background tasks for review checks and progress snapshots.

## 4.3 Communication Patterns

### 4.3.1 REST (Synchronous)

Standard HTTP REST is used for CRUD operations and request-response workflows:

```text
Frontend BFF  ──HTTP/JSON──►  Spring Boot   (quiz CRUD, user ops)
Frontend BFF  ──HTTP/JSON──►  AI Coach      (generate, ingest)
Spring Boot   ──HTTP/JSON──►  AI Coach      (webhook: quiz completed)
AI Coach      ──HTTP/JSON──►  Spring Boot   (fetch quiz history)
AI Coach      ──HTTP/JSON──►  LM Studio     (embedding generation)
AI Coach      ──HTTP/JSON──►  DeepSeek API  (cloud LLM inference)
AI Coach      ──HTTP/JSON──►  Supabase      (vector storage/search)
```

### 4.3.2 WebSocket (Bidirectional Streaming)

Used exclusively for the AI chat interface, enabling token-by-token streaming:

**Client → Server Messages**:
- `session_start`: Initialize session with tier, mode, user_id, kb_id.
- `user_message`: Send a chat message.
- `stop`: Cancel current generation.
- `mode_switch`: Change between chat and agentic modes.

**Server → Client Messages**:
- `session_ack`: Confirm session with available tools list.
- `content`: Single token or text chunk.
- `stage`: Processing stage updates (thinking start/end).
- `tool`: Tool invocation status (calling, result, error).
- `done`: Generation complete.
- `error`: Error with code and message.

### 4.3.3 Webhook (Event-Driven)

The webhook pattern decouples quiz completion from AI processing:

```text
Student completes quiz
    → Spring Boot records score
    → Spring Boot POSTs to /webhook/quiz-completed
    → AI Coach processes:
        1. Updates SM-2 schedule for category
        2. Stores per-question results
        3. Generates notification if review due
```

This design ensures quiz completion is never blocked by AI processing failures.

## 4.4 Tier and Mode System

The AI Coach supports a 2×2 matrix of capabilities:

| | Chat Mode | Agentic Mode |
|---|---|---|
| **Lite Tier** (LM Studio) | Simple streaming chat | LiteOrchestrator (rule-based intent → code-driven workflows) |
| **Full Tier** (DeepSeek) | Simple streaming chat | Full agentic loop (LLM decides tools, 3 rounds × 9 tools) |

The **routing logic** in `server/router.py` resolves the correct capability:

```python
def resolve_capability(tier, mode, user_id, kb_id):
    provider = create_llm_provider(tier)  # LMStudio or DeepSeek
    
    if mode == Mode.CHAT:
        return SimpleChatCapability(provider)
    if tier == Tier.LITE:
        return LiteOrchestrator(provider, user_id)
    else:
        registry = create_full_registry(user_id, kb_id)
        return AgenticCapability(provider, registry.all_tools())
```

## 4.5 Security Architecture

### 4.5.1 Authentication Flow

```text
1. Client signs in via Firebase Auth (email/password or Google OAuth)
2. Client receives Firebase ID Token (JWT)
3. For Spring Boot calls: BFF forwards token in Authorization header
4. For AI Coach calls: BFF injects X-API-Key (server secret)
5. WebSocket: Client connects directly; session_start includes user_id
```

### 4.5.2 API Key Protection

Secrets are managed at the BFF layer:
- `COACH_API_KEY`: Shared between BFF → AI Coach (never exposed to client).
- `COACH_WEBHOOK_API_KEY`: Shared between Spring Boot → AI Coach.
- Firebase service account: Used by BFF and Spring Boot for Admin SDK.
- Supabase key: Used only by AI Coach for vector operations.

### 4.5.3 Data Isolation

- Firestore security rules enforce `request.auth.uid == resource.data.user_id`.
- Supabase RAG documents filtered by `kb_id = user_id` in all queries.
- Quiz history API filters by authenticated user's ID.
- Review schedules scoped to `user_id` field.

## 4.6 Deployment Architecture

```text
┌──────────────────────────────────────────────────┐
│                Development Environment            │
├──────────────────────────────────────────────────┤
│  LM Studio (GPU)     → localhost:1234            │
│  Spring Boot (JVM)   → localhost:8080            │
│  Next.js (Node.js)   → localhost:3000            │
│  AI Coach (uvicorn)  → localhost:8000            │
├──────────────────────────────────────────────────┤
│  External Services (Cloud):                      │
│  • Firebase Auth + Firestore (quizzai-bc49d)     │
│  • Supabase pgvector (ylynopxmmowneyofxcud)      │
│  • DeepSeek API (Full tier inference)            │
│  • DuckDuckGo (web_search tool via ddgs package) │
└──────────────────────────────────────────────────┘
```

## 4.7 Error Handling Strategy

Each service implements distinct error handling:

| Service | Strategy |
|---------|----------|
| Spring Boot | Global exception handler → standardized error DTOs |
| Next.js BFF | Try-catch per route → JSON error responses with HTTP codes |
| AI Coach WS | Structured `error` messages via WebSocket with error codes |
| AI Coach REST | FastAPI HTTPException with detail messages |
| Agentic Loop | Tool failure → append error to conversation → LLM adapts |

The agentic loop specifically handles tool failures gracefully: if a tool times out or errors, the result is appended as a tool response with the error message, allowing the LLM to acknowledge the failure and try an alternative approach.
