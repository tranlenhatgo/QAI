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
│  3d. Calls Gemini API (streaming):                                       │
│      messages = [system_with_rag, ...history, user_msg]                  │
│      tools = None (chat mode, no tools)                                  │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Streaming Response                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Gemini streams tokens:                                                  │
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
**Total time**: ~2-4s (RAG search: 200ms, Gemini streaming: 2-3s)

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
│  Call Gemini with tools=[rag, generate_quiz, ...]                        │
│  Gemini response: function_call {                                        │
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
│  Call Gemini again (now has RAG context in history)                       │
│  Gemini response: function_call {                                        │
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
│  Call Gemini again (has quiz data in history)                             │
│  Gemini response: TEXT (no tool calls = loop terminates)                  │
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

**Total LLM calls**: 4 (3 Gemini agentic + 1 internal quiz generation)
**Total time**: ~8-15s
**Agentic iterations**: 3

---

## Scenario 4: Student Asks to Solve a Problem (Full Agentic Mode)

**Trigger**: "Solve step by step: Find x if 2x² + 5x - 3 = 0"

```text
Iteration 1: Gemini calls solve_problem tool
  → StepSolver creates plan: ["Identify a,b,c", "Calculate discriminant", "Apply formula", "Simplify"]
  → Executes each step (4 internal LLM calls)
  → Returns formatted solution

Iteration 2: Gemini presents solution to student (text, no tool calls → done)
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

## Scenario 8: Error — Gemini Rate Limit (Full Mode)

```text
Step 1: User sends message (15th in 1 minute)
Step 2: Gemini returns 429 Too Many Requests
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
