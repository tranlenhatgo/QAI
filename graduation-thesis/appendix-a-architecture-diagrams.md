# Appendix A: System Architecture Diagrams

## A.1 High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    Next.js Frontend (Port 3000)                      │   │
│   │                                                                     │   │
│   │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│   │   │  Pages   │  │Components│  │  Store   │  │  Service Worker  │   │   │
│   │   │(SSR/CSR) │  │ (React)  │  │(Zustand) │  │  (PWA Cache)     │   │   │
│   │   └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │   │
│   │                                                                     │   │
│   │   ┌─────────────────────────────────────────────────────────────┐   │   │
│   │   │              BFF API Routes (/api/*)                         │   │   │
│   │   │   Token verification │ Secret injection │ Request proxying   │   │   │
│   │   └─────────────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└───────────────────────┬──────────────────────┬──────────────────────────────┘
                        │ REST                  │ WebSocket
                        ▼                       ▼
┌─────────────────────────────────┐  ┌──────────────────────────────────────┐
│    SERVICE LAYER                │  │    AI SERVICE LAYER                   │
│                                 │  │                                      │
│  Spring Boot Backend (8080)     │  │  FastAPI AI Coach (8000)             │
│                                 │  │                                      │
│  ┌───────────────────────────┐  │  │  ┌──────────────────────────────┐   │
│  │ Controllers               │  │  │  │ WebSocket Handler            │   │
│  │ Quiz│Question│TakeQuiz    │  │  │  │ (Streaming Chat)             │   │
│  │ Review│Notification│User  │  │  │  └──────────────────────────────┘   │
│  └───────────────────────────┘  │  │                                      │
│  ┌───────────────────────────┐  │  │  ┌──────────────────────────────┐   │
│  │ Services                  │  │  │  │ Router → Capabilities        │   │
│  │ Business logic + Webhook  │  │  │  │ Chat│Agentic│LiteOrchestrator│   │
│  └───────────────────────────┘  │  │  └──────────────────────────────┘   │
│  ┌───────────────────────────┐  │  │  ┌──────────────────────────────┐   │
│  │ Models (Firestore)        │  │  │  │ Tools                        │   │
│  │ Quiz│Question│Review etc. │  │  │  │ History│RAG│Search│Reason    │   │
│  └───────────────────────────┘  │  │  └──────────────────────────────┘   │
│                                 │  │  ┌──────────────────────────────┐   │
│                                 │  │  │ Routes (REST)                │   │
│                                 │  │  │ /ingest │ /generate │/webhook│   │
│                                 │  │  └──────────────────────────────┘   │
│                                 │  │  ┌──────────────────────────────┐   │
│                                 │  │  │ Learning                     │   │
│                                 │  │  │ SM-2│Progress│Scheduler      │   │
│                                 │  │  └──────────────────────────────┘   │
└────────────────┬────────────────┘  └──────────┬────────────┬─────────────┘
                 │                               │            │
                 ▼                               ▼            ▼
┌─────────────────────────────────┐  ┌───────────────┐  ┌────────────────┐
│         DATA LAYER              │  │  VECTOR LAYER │  │   LLM LAYER    │
│                                 │  │               │  │                │
│  Google Cloud Firestore         │  │  Supabase     │  │  LM Studio     │
│  ├── quizzes                    │  │  pgvector     │  │  (Local, 1234) │
│  ├── questions                  │  │               │  │                │
│  ├── take_quizzes               │  │  ┌─────────┐ │  │  DeepSeek API  │
│  ├── take_questions             │  │  │documents│ │  │  (Cloud)       │
│  ├── review_schedule            │  │  │embedding│ │  │                │
│  ├── notifications              │  │  │kb_id    │ │  │  DuckDuckGo    │
│  ├── users                      │  │  └─────────┘ │  │  (Web Search)  │
│  └── users/{uid}/documents      │  │               │  │                │
│                                 │  │               │  │                │
│  Firebase Authentication        │  │               │  │                │
│  (JWT tokens, OAuth providers)  │  │               │  │                │
└─────────────────────────────────┘  └───────────────┘  └────────────────┘
```

## A.2 WebSocket Communication Sequence

```text
Client                    AI Coach (FastAPI)              LLM Provider
  │                            │                              │
  │─── WebSocket Connect ─────►│                              │
  │◄── Connection Accepted ────│                              │
  │                            │                              │
  │─── session_start ─────────►│                              │
  │    {tier, mode, user_id}   │                              │
  │◄── session_ack ───────────│                              │
  │    {tools, session_id}     │                              │
  │                            │                              │
  │─── user_message ──────────►│                              │
  │    "What are my weaknesses?"│                              │
  │                            │─── POST /chat/completions ──►│
  │◄── stage(thinking,start) ──│                              │
  │                            │◄── tool_call: quiz_history ──│
  │◄── tool(quiz_history,call)─│                              │
  │                            │── Execute tool ──►           │
  │◄── tool(quiz_history,ok) ──│                              │
  │                            │                              │
  │                            │─── POST (with tool result) ─►│
  │◄── stage(thinking,end) ───│                              │
  │◄── content("Based") ──────│◄── stream chunk ─────────────│
  │◄── content(" on") ────────│◄── stream chunk ─────────────│
  │◄── content(" your") ──────│◄── stream chunk ─────────────│
  │     ...                    │     ...                       │
  │◄── done ──────────────────│                              │
  │                            │                              │
```

## A.3 Quiz Completion Webhook Flow

```text
Student              Frontend           Spring Boot        AI Coach
  │                    │                    │                  │
  │── Submit Answer ──►│                    │                  │
  │                    │── POST answer ────►│                  │
  │                    │                    │── Validate ──►   │
  │                    │                    │── Save result    │
  │                    │                    │── Compute score  │
  │                    │◄── Score response ─│                  │
  │◄── Show results ──│                    │                  │
  │                    │                    │                  │
  │                    │                    │── POST webhook ─►│
  │                    │                    │   {user_id,      │
  │                    │                    │    category,     │
  │                    │                    │    score,        │
  │                    │                    │    questions}    │
  │                    │                    │                  │
  │                    │                    │                  │── Apply SM-2
  │                    │                    │                  │── Update schedule
  │                    │                    │◄── PUT schedule ─│
  │                    │                    │                  │── Check if review due
  │                    │                    │◄── POST notif ──│ (if due soon)
  │                    │                    │                  │
```

## A.4 RAG Pipeline Flow

```text
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Upload  │────►│ Extract  │────►│ Validate │────►│  Chunk   │────►│  Embed   │
│  (File)  │     │  (Text)  │     │(Quality) │     │(500/50)  │     │(768-dim) │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                       │                                   │
                                       │ FAIL                              ▼
                                       ▼                            ┌──────────┐
                                  HTTP 400                          │  Store   │
                                  "Image-only"                      │(Supabase)│
                                                                    └──────────┘

--- During Chat/Generation ---

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Query   │────►│  Embed   │────►│  Search  │────►│  Top-K   │────►│  Inject  │
│  (User)  │     │  Query   │     │(Cosine)  │     │ Results  │     │(Context) │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                                          │
                                                                          ▼
                                                                    ┌──────────┐
                                                                    │   LLM    │
                                                                    │(Generate)│
                                                                    └──────────┘
```

## A.5 Spaced Repetition State Machine

```text
                    ┌─────────────────┐
                    │   NEW CATEGORY  │
                    │   EF=2.5, R=0   │
                    └────────┬────────┘
                             │ First quiz completed
                             ▼
              ┌──────────────────────────────┐
              │                              │
         Pass (Q≥3)                     Fail (Q<3)
              │                              │
              ▼                              ▼
    ┌─────────────────┐          ┌─────────────────┐
    │   LEARNING      │          │   RELEARNING    │
    │   R=1, I=1 day  │          │   R=0, I=0.5 day│
    └────────┬────────┘          └────────┬────────┘
             │ Pass                        │ Pass
             ▼                             │
    ┌─────────────────┐                    │
    │   LEARNING      │◄───────────────────┘
    │   R=2, I=3 days │
    └────────┬────────┘
             │ Pass
             ▼
    ┌─────────────────┐
    │   REVIEW        │◄──── Pass ────┐
    │   R=n, I=I×EF   │               │
    └────────┬────────┘               │
             │                         │
        Pass │    Fail                 │
             │      │                  │
             └──────┤                  │
                    ▼                  │
          ┌─────────────────┐         │
          │   RELAPSE       │── Pass ─┘
          │   R=0, I=0.5 day│
          └─────────────────┘

Legend: EF = Easiness Factor, R = Repetitions, I = Interval, Q = Quality
```
