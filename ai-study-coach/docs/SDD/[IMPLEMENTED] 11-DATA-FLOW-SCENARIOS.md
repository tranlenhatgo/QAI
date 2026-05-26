# 11 — Data Flow Scenarios

> End-to-end data flows for every major user scenario. Shows exactly what happens at each layer.

---

## Scenario 1: Student Asks a Question (Full Chat Mode)

**Trigger**: Student types "What is photosynthesis?" in Full Chat mode with a Biology KB loaded.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Frontend → AI Service (WebSocket)                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Client sends:                                                           │
│  {"type": "user_message", "content": "What is photosynthesis?"}         │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: WebSocket Handler                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ws_handler receives message                                             │
│  → session.add_user_message("What is photosynthesis?")                   │
│  → session.capability.run(messages, on_event, cancelled)                 │
│  → Capability = SimpleChatCapability (Full Chat mode)                    │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: SimpleChatCapability                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  3a. Detects kb_id is set → Server-side RAG injection                    │
│      → calls supabase_client.rpc("match_documents", {                    │
│          query_embedding: embed("What is photosynthesis?"),               │
│          match_kb_id: "kb_biology_101"                                    │
│        })                                                                │
│      → Returns 3 relevant chunks from student's textbook                 │
│                                                                          │
│  3b. Builds system prompt with RAG context:                              │
│      "You are a study coach. Context: [3 chunks about photosynthesis]"   │
│                                                                          │
│  3c. Emits: {"type": "stage", "stage": "responding", "status": "start"} │
│                                                                          │
│  3d. Calls DeepSeek API (streaming):                                       │
│      messages = [system_with_rag, ...history, user_msg]                  │
│      tools = None (chat mode, no tools)                                  │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Streaming Response                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  DeepSeek streams tokens:                                                  │
│  → on_event({"type": "content", "content": "Photosynthesis"})           │
│  → on_event({"type": "content", "content": " is the process"})          │
│  → on_event({"type": "content", "content": " by which plants..."})      │
│  → ... (30-50 chunks)                                                    │
│                                                                          │
│  Each on_event → websocket.send_json() → Frontend renders in real-time  │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Completion                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  → on_event({"type": "stage", "stage": "responding", "status": "end"})  │
│  → session.add_assistant_message(full_response)                          │
│  → websocket.send_json({"type": "done"})                                │
│                                                                          │
│  Frontend: hide spinner, enable input                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Total LLM calls**: 1
**Total time**: ~2-4s (RAG search: 200ms, DeepSeek streaming: 2-3s)

---

## Scenario 2: Student Asks for Weakness Analysis (Lite Agentic Mode)

**Trigger**: Student types "What are my weak areas in math?" in Lite Agentic mode.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: WebSocket → LiteOrchestrator                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  user_message: "What are my weak areas in math?"                         │
│  session.capability = LiteOrchestrator                                   │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Intent Classification (CODE, not LLM)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  IntentClassifier.classify("what are my weak areas in math?")            │
│  → Pattern matches: "weak\s*(point|area)" ✓                             │
│  → Intent: WEAKNESS_ANALYSIS (confidence: 0.85)                          │
│  → Extracted params: {"subject": "math"}                                 │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Data Gathering (CODE calls Java BE directly)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Emits: {"type": "stage", "stage": "fetching_data", "status": "start"}  │
│                                                                          │
│  HTTP GET → Java BE: /api/quiz-history?userId=u123&limit=20&subject=math │
│  Response: [                                                             │
│    {"quiz_title": "Algebra Quiz 3", "score": 4, "total": 10, ...},      │
│    {"quiz_title": "Geometry Basics", "score": 8, "total": 10, ...},      │
│    {"quiz_title": "Algebra Quiz 2", "score": 3, "total": 10, ...},      │
│    ...                                                                   │
│  ]                                                                       │
│                                                                          │
│  Emits: {"type": "stage", "stage": "fetching_data", "status": "end"}    │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: LLM Analysis (single call with all context)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Emits: {"type": "stage", "stage": "analyzing", "status": "start"}      │
│                                                                          │
│  Prompt to LM Studio (local model):                                      │
│  "Analyze this student's quiz history and identify weak areas:           │
│   - Algebra Quiz 3: 4/10 (40%) - weak: equations, factoring             │
│   - Geometry Basics: 8/10 (80%)                                          │
│   - Algebra Quiz 2: 3/10 (30%) - weak: equations, word problems          │
│   ..."                                                                   │
│                                                                          │
│  LLM streams response (weakness analysis with recommendations)           │
│  → on_event(content) × N chunks                                         │
│                                                                          │
│  Emits: {"type": "stage", "stage": "analyzing", "status": "end"}        │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Done                                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  → websocket.send_json({"type": "done"})                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Total LLM calls**: 1 (local LM Studio)
**Total HTTP calls**: 1 (Java BE)
**Total time**: ~3-8s (Java BE: 100ms, local LLM: 3-8s depending on model)

---

## Scenario 3: Student Asks for Quiz (Full Agentic Mode)

**Trigger**: Student types "Quiz me on chapter 5 photosynthesis" in Full Agentic mode.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: WebSocket → AgenticCapability                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  user_message: "Quiz me on chapter 5 photosynthesis"                     │
│  session.capability = AgenticCapability (tools: rag, reason, generate_   │
│  quiz, quiz_history, recommend, web_search)                              │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Agentic Loop — Iteration 1 (LLM decides to search KB)           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Emits: {"type": "stage", "stage": "thinking", "status": "start"}       │
│                                                                          │
│  Call DeepSeek with tools=[rag, generate_quiz, ...]                        │
│  DeepSeek response: function_call {                                        │
│    name: "rag",                                                          │
│    arguments: {"query": "chapter 5 photosynthesis"}                      │
│  }                                                                       │
│                                                                          │
│  Emits: {"type": "stage", "stage": "thinking", "status": "end"}         │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Tool Execution — RAG                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Emits: {"type": "tool", "tool_name": "rag", "status": "calling",       │
│          "arguments": {"query": "chapter 5 photosynthesis"}}             │
│                                                                          │
│  → Embed query → Supabase pgvector search → 5 relevant chunks           │
│  → Result: "Found 5 passages: [1] Light reactions... [2] Calvin cycle..."│
│                                                                          │
│  Emits: {"type": "tool", "tool_name": "rag", "status": "result",        │
│          "result": "Found 5 passages..."}                                │
│                                                                          │
│  → Append tool result to messages                                        │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Agentic Loop — Iteration 2 (LLM generates quiz)                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Emits: {"type": "stage", "stage": "thinking", "status": "start"}       │
│                                                                          │
│  Call DeepSeek again (now has RAG context in history)                       │
│  DeepSeek response: function_call {                                        │
│    name: "generate_quiz",                                                │
│    arguments: {"topic": "photosynthesis", "num_questions": 5}            │
│  }                                                                       │
│                                                                          │
│  Emits: {"type": "stage", "stage": "thinking", "status": "end"}         │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Tool Execution — Generate Quiz                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Emits: {"type": "tool", "tool_name": "generate_quiz", "status":        │
│          "calling"}                                                       │
│                                                                          │
│  QuizGenerator.generate(topic="photosynthesis", context=rag_results)     │
│  → Internal LLM call with QUIZ_SYSTEM_PROMPT + context                   │
│  → Parse JSON response → Validate → Quiz object                         │
│  → Return formatted quiz as string                                       │
│                                                                          │
│  Emits: {"type": "tool", "tool_name": "generate_quiz", "status":        │
│          "result", "result": "[5 questions generated]"}                   │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 6: Agentic Loop — Iteration 3 (LLM formats final response)         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Call DeepSeek again (has quiz data in history)                             │
│  DeepSeek response: TEXT (no tool calls = loop terminates)                  │
│                                                                          │
│  "Here's your quiz on Chapter 5 - Photosynthesis! 🌱                    │
│                                                                          │
│   **Question 1** (Multiple Choice)                                       │
│   What is the primary purpose of the light reactions?                     │
│   A) Produce glucose                                                     │
│   B) Split water molecules and generate ATP                              │
│   ..."                                                                   │
│                                                                          │
│  Stream as content chunks → client                                       │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 7: Done                                                             │
├─────────────────────────────────────────────────────────────────────────┤
│  → websocket.send_json({"type": "done"})                                │
└─────────────────────────────────────────────────────────────────────────┘
```

**Total LLM calls**: 4 (3 DeepSeek agentic + 1 internal quiz generation)
**Total time**: ~8-15s
**Agentic iterations**: 3

---

## Scenario 4: Student Asks to Solve a Problem (Full Agentic Mode)

**Trigger**: "Solve step by step: Find x if 2x² + 5x - 3 = 0"

```text
Iteration 1: DeepSeek calls solve_problem tool
  → StepSolver creates plan: ["Identify a,b,c", "Calculate discriminant", "Apply formula", "Simplify"]
  → Executes each step (4 internal LLM calls)
  → Returns formatted solution

Iteration 2: DeepSeek presents solution to student (text, no tool calls → done)
```

**Total LLM calls**: 6 (1 agentic + 4 solve steps + 1 conclude + 1 final)
**Total time**: ~10-20s

---

## Scenario 5: Student Requests Recommendations (Lite Agentic Mode)

**Trigger**: "What quiz should I take next?"

```text
Step 1: IntentClassifier → QUIZ_RECOMMEND (confidence: 0.8)
Step 2: Fetch quiz history from Java BE
Step 3: Fetch available quizzes from Java BE  
Step 4: Build prompt with both datasets
Step 5: LLM generates personalized recommendations
Step 6: Stream response → done
```

**Total LLM calls**: 1
**Total HTTP calls to Java BE**: 2
**Total time**: ~3-6s

---

## Scenario 6: Mode Switch Mid-Conversation

**Trigger**: User switches from Chat to Agentic mode.

```text
Step 1: Client sends {"type": "mode_switch", "mode": "agentic"}
Step 2: Server:
  - session.switch_mode(Mode.AGENTIC)
  - Creates new capability (AgenticCapability or LiteOrchestrator)
  - Preserves conversation history
Step 3: Server sends {"type": "session_ack", "mode": "agentic", "available_tools": [...]}
Step 4: Next user message goes through new capability
```

**Conversation history is preserved** — the new capability sees all previous messages.

---

## Scenario 7: Error — Provider Unavailable (Lite Mode, LM Studio not running)

```text
Step 1: User sends message
Step 2: Capability calls LM Studio at localhost:1234
Step 3: Connection refused (httpx.ConnectError)
Step 4: ProviderUnavailableError raised
Step 5: Caught at capability level
Step 6: Emits {"type": "error", "code": "provider_unavailable", 
              "message": "Local AI model is not running. Please start LM Studio."}
Step 7: Frontend shows error message with instructions
```

---

## Scenario 8: Error — DeepSeek Rate Limit (Full Mode)

```text
Step 1: User sends message (15th in 1 minute)
Step 2: DeepSeek returns 429 Too Many Requests
Step 3: RateLimitError raised with retry_after=60
Step 4: Option A: Wait and retry (if < 5s)
        Option B: Return error to user (if > 5s)
Step 5: Emits {"type": "error", "code": "rate_limit",
              "message": "AI is busy. Please wait a moment and try again."}
```

---

## Data Flow Summary Table

| Scenario | Mode | LLM Calls | External Calls | Estimated Time |
| ---------- | ------ | ----------- | ---------------- | ---------------- |
| Simple question | Full Chat | 1 | 1 (Supabase RAG) | 2-4s |
| Simple question | Lite Chat | 1 | 0 | 3-8s |
| Weakness analysis | Lite Agentic | 1 | 1 (Java BE) | 3-8s |
| Weakness analysis | Full Agentic | 2-3 | 1 (Java BE via tool) | 5-10s |
| Quiz generation | Full Agentic | 4 | 1 (Supabase RAG) | 8-15s |
| Problem solving | Full Agentic | 6 | 1 (Supabase RAG) | 10-20s |
| Recommendations | Lite Agentic | 1 | 2 (Java BE) | 3-6s |
| Recommendations | Full Agentic | 2-3 | 2 (Java BE via tools) | 5-10s |
| Quiz webhook | — (server-to-server) | 0 | 1 (Spring Boot) | <200ms |
| Progress fetch | — (REST) | 0 | 1 (Spring Boot) | <500ms |
| Scheduler: due check | — (background) | 0 | 2 (Spring Boot) | <1s |

---

## Scenario 9: Quiz Completion Webhook (Spring Boot → Coach)

**Trigger**: Spring Boot calls `POST /webhook/quiz-completed` after student finishes a quiz.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Spring Boot → AI Coach (HTTP POST)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  POST /webhook/quiz-completed                                            │
│  X-API-Key: <shared secret>                                              │
│  Body: { user_id, quiz_id, score: "7/10", category, questions[] }        │
│                                                                          │
│  → Validate API key (401 if invalid)                                     │
│  → Validate body (422 if malformed)                                      │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Update Spaced Repetition Schedule                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SpacedRepetitionScheduler.update_after_quiz(category, score)            │
│  → Parse score "7/10" → accuracy 0.7                                     │
│  → Fetch existing ReviewItem for (user_id, category) from Firestore      │
│  → Apply SM-2: compute new easiness, interval, next_review date          │
│  → Persist updated ReviewItem via Spring Boot PUT /review-schedule/{id}  │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Return Response                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  200 OK: { status: "processed", next_review, mastery_update }            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Total LLM calls**: 0
**Total HTTP calls**: 1-2 (Firestore via Spring Boot)
**Total time**: <200ms

---

## Scenario 10: Progress Tracking (Frontend → Coach → Spring Boot)

**Trigger**: Coach Dashboard loads, calls `GET /progress/{user_id}`.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Frontend → Coach (via BFF)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  GET /progress/abc12345                                                  │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Fetch Quiz History from Spring Boot                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  HTTP GET → Spring Boot: /take-quiz/user/{userId}                        │
│  → Returns all TakeQuiz records with scores, categories, timestamps      │
│                                                                          │
│  HTTP GET → Spring Boot: /review-schedule/user/{userId}                  │
│  → Returns all ReviewItem records with next_review dates                 │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Compute Progress Metrics                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ProgressTracker.compute_progress(quiz_history, quiz_details)            │
│  → Exponential-decay mastery per category                                │
│  → Learning velocity (accuracy Δ per week)                               │
│  → Study streak (consecutive active days)                                │
│  → Identify strongest/weakest categories                                 │
│  → Filter due_reviews (next_review <= now)                               │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Return ProgressReport                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  200 OK: {                                                               │
│    overall_mastery, categories[], velocities[],                           │
│    study_streak, due_reviews[], strongest/weakest_category               │
│  }                                                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Total LLM calls**: 0
**Total HTTP calls**: 2 (Spring Boot quiz history + review schedules)
**Total time**: <500ms

---

## Scenario 11: Scheduler — Due Review Check (Background)

**Trigger**: APScheduler fires `check_due_reviews` job every hour.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Scheduler Fires (hourly cron)                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CoachScheduler → check_due_reviews()                                    │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Fetch All Due Reviews                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  HTTP GET → Spring Boot: /review-schedule/due                            │
│  → Returns ReviewSchedule records where next_review <= now               │
│  → Groups by user_id                                                     │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Create Notifications                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  For each user with due reviews:                                         │
│    POST → Spring Boot: /notification/                                    │
│    Body: {                                                               │
│      userId, type: "REVIEW_DUE",                                         │
│      title: "Review due: {category}",                                    │
│      message: "You have {n} topics ready for review",                    │
│      metadata: { categories[], review_ids[] }                            │
│    }                                                                     │
│  → Notification stored in Firestore `notification` collection            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Total LLM calls**: 0
**Total HTTP calls**: 1 + N (fetch due + create notifications per user)
**Total time**: <1s typical
