# Chapter 4: System Design — Part 3: AI Coach and Learning Algorithms

## 4.11 AI Coach Architecture

The AI Study Coach follows a layered design separating protocol handling, routing, capability execution, and tool invocation:

```text
┌─────────────────────────────────────────────┐
│              WebSocket Handler               │
│  (connection lifecycle, message parsing)     │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│              Router (router.py)              │
│  resolve_capability(tier, mode) → Capability│
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│            Capabilities Layer                │
│  SimpleChatCapability │ AgenticCapability    │
│  LiteOrchestrator     │                     │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│         Tools Layer (registry.py)           │
│  QuizHistory │ Recommend │ Reason │ RAG     │
│  WebSearch                                  │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│            LLM Providers                    │
│  LMStudioProvider │ DeepSeekProvider        │
│  (OpenAI-compatible API)                    │
└─────────────────────────────────────────────┘
```

### 4.11.1 Capability Design Pattern

Each capability implements a common interface:

```python
async def run(
    messages: list[Message],
    on_event: Callable[[dict], Awaitable[None]],
    cancelled: Callable[[], bool],
) -> None
```

- `messages`: Full conversation history including system prompt.
- `on_event`: Callback to emit WebSocket events (content chunks, tool status, stages).
- `cancelled`: Check if user sent a stop signal.

This design allows the WebSocket handler to remain stateless — it simply pipes events to the client.

### 4.11.2 Agentic Loop (Full Tier)

The Full-tier agentic capability implements a bounded reasoning loop:

```
┌─────────────────────────────────────┐
│         MAX_TOOL_ITERATIONS = 10    │
│         MAX_TOOL_CALLS_PER_TURN = 3 │
│         TOOL_TIMEOUT = 30 seconds   │
└─────────────────────────────────────┘

FOR iteration IN 1..10:
    1. Send messages + tool_definitions to LLM
    2. Collect response (content + tool_calls)
    3. IF no tool_calls → stream content as final answer → RETURN
    4. FOR EACH tool_call (max 3 per turn):
       a. Emit tool_event("calling")
       b. Execute tool with timeout
       c. Emit tool_event("result") or tool_event("error")
       d. Append tool result to messages
    5. Loop back to step 1 (LLM sees tool results)
```

This bounded approach prevents infinite loops while allowing multi-step reasoning. In practice, most interactions complete in 1–2 iterations.

### 4.11.3 LiteOrchestrator (Lite Tier)

For local models that lack reliable function-calling, the LiteOrchestrator uses a **code-driven workflow** approach:

1. **Intent Classification** (rule-based, no LLM needed):
   - Pattern matching against regex dictionaries.
   - Returns: intent enum + confidence score + extracted parameters.

2. **Workflow Execution** (per-intent logic):
   - `WEAKNESS_ANALYSIS`: Fetch quiz history → compute stats → prompt LLM with data.
   - `QUIZ_RECOMMEND`: Analyze weak categories → suggest next quiz.
   - `EXPLAIN_TOPIC`: Direct LLM pass-through with topic context.
   - `QUIZ_REQUEST`: Generate questions via code path.
   - `SOLVE_PROBLEM`: Step-by-step prompting with structured output.
   - `GENERAL_CHAT`: Direct LLM response.

3. **LLM Generation** (final step):
   - LLM receives pre-gathered context + user question.
   - Streams response without tool-calling overhead.

This approach enables "agentic-like" behavior on smaller models (4B–9B parameters) that cannot reliably follow function-calling schemas.

### 4.11.4 Tool Definitions

Tools are defined in OpenAI function-calling format for compatibility with both LM Studio and DeepSeek:

| Tool | Description | Parameters | Available In |
|------|-------------|------------|--------------|
| `quiz_history` | Fetch user's quiz attempt history | user_id, limit, category | Full + Lite |
| `recommend` | Generate study recommendations | weak_categories, recent_score_pct | Full + Lite |
| `reason` | Deep multi-step reasoning via Full tier LLM | problem, context | Full only |
| `web_search` | Search the web via DuckDuckGo | query | Full only |
| `rag` | Search user's uploaded materials | query, top_k | Full only |
| `navigate_to_page` | Navigate user to a platform page | page (enum) | Full only (action) |
| `start_quiz` | Start a specific quiz for the user | quiz_id | Full only (action) |
| `generate_questions` | Generate practice questions | topics | Full only (action) |
| `search_study_materials` | Semantic search in uploaded documents | query | Full only (action) |

## 4.12 RAG Pipeline Design

### 4.12.1 Ingestion Flow

```text
                  Upload (multipart/form-data)
                           │
              ┌────────────▼────────────────┐
              │      Text Extraction         │
              │  PyMuPDF (PDF) / utf-8 (TXT) │
              └────────────┬────────────────┘
                           │
              ┌────────────▼────────────────┐
              │     Quality Validation       │
              │  >50 chars AND >70% printable│
              └────────────┬────────────────┘
                           │ (fail → HTTP 400)
              ┌────────────▼────────────────┐
              │      Null Byte Removal       │
              │  text.replace("\x00", "")    │
              └────────────┬────────────────┘
                           │
              ┌────────────▼────────────────┐
              │         Chunking             │
              │  500 chars, 50 char overlap  │
              └────────────┬────────────────┘
                           │
              ┌────────────▼────────────────┐
              │       Embedding              │
              │  nomic-embed-text-v1.5       │
              │  via LM Studio /v1/embeddings│
              └────────────┬────────────────┘
                           │
              ┌────────────▼────────────────┐
              │     Supabase Storage         │
              │  INSERT into documents table │
              │  with kb_id = user_id        │
              └─────────────────────────────┘
```

### 4.12.2 Retrieval Flow

```text
              User query / topic
                    │
              ┌─────▼──────────────────────┐
              │    Query Embedding          │
              │    nomic-embed-text-v1.5    │
              └─────┬──────────────────────┘
                    │
              ┌─────▼──────────────────────┐
              │    Supabase RPC             │
              │    match_documents(         │
              │      embedding, top_k=5,   │
              │      filter_kb_id=user_id) │
              └─────┬──────────────────────┘
                    │
              ┌─────▼──────────────────────┐
              │    Context Assembly         │
              │    Join top-k chunks        │
              │    Prepend to LLM prompt    │
              └────────────────────────────┘
```

### 4.12.3 Design Decisions

- **Chunk size ~2000 characters with 200-char overlap**: Balances context completeness against embedding quality. Smart boundary detection prefers splitting at paragraphs, then sentences, then word boundaries.
- **768-dimensional embeddings**: nomic-embed-text-v1.5 offers strong multilingual performance at reasonable dimensionality.
- **User-scoped knowledge bases**: Each user's documents are isolated via `kb_id`, preventing cross-user information leakage.
- **No OCR**: Image-only PDFs are rejected with a clear error message. This simplifies the pipeline and avoids Tesseract dependency issues across platforms.

## 4.13 Spaced Repetition Algorithm

### 4.13.1 SM-2 Implementation

The system implements SM-2 at the **category level** — each (user, category) pair maintains an independent schedule:

```text
Input: quality (0–5 scale derived from quiz score)
State: easiness (EF), interval_days, repetitions

IF quality >= 3 (pass):
    IF repetitions == 0: interval = 1 day
    ELIF repetitions == 1: interval = 3 days
    ELSE: interval = interval × EF
    repetitions += 1
ELSE (fail):
    repetitions = 0
    interval = 0.5 days (12 hours)
    easiness unchanged

// Update easiness factor (only on pass)
EF = EF + (0.1 - (5 - quality) × (0.08 + (5 - quality) × 0.02))
EF = max(EF, 1.3)  // Never below 1.3

next_review = now + interval days
```

### 4.13.2 Quality Score Mapping

Quiz scores are mapped to the SM-2 quality scale (0–5):

| Score Range | Quality | Interpretation |
|-------------|---------|----------------|
| 90–100% | 5 | Perfect recall |
| 80–89% | 4 | Correct with hesitation |
| 60–79% | 3 | Correct with difficulty |
| 40–59% | 2 | Incorrect, easy to recall |
| 20–39% | 1 | Incorrect, vaguely remembered |
| 0–19% | 0 | Complete blackout |

### 4.13.3 Webhook-Triggered Processing

The spaced repetition engine is triggered by the quiz completion webhook:

```text
POST /webhook/quiz-completed
{
  "user_id": "...",
  "quiz_id": "...",
  "score": "4/5",
  "category": "SCIENCE",
  "completed_at": "2024-01-15T10:30:00Z",
  "questions": [...]
}

Processing:
1. Parse score → compute quality (4/5 = 80% → quality 4)
2. Fetch existing ReviewSchedule for (user_id, SCIENCE)
3. Apply SM-2 algorithm
4. PUT updated schedule to Spring Boot API
5. If next_review < now + 24h → create notification
```

## 4.14 Progress Tracking Algorithms

### 4.14.1 Mastery Level Calculation

Category mastery uses a **recency-weighted average**:

```python
mastery = Σ(score_i × weight_i) / Σ(weight_i)

where weight_i = 0.9^(days_since_attempt_i)
```

More recent scores have exponentially higher weight, reflecting current knowledge state.

### 4.14.2 Learning Velocity

Velocity measures improvement rate per week:

```python
velocity = (recent_avg - earlier_avg) / weeks_between

where:
  recent_avg = mean of last 3 attempts
  earlier_avg = mean of 3 attempts before that
```

Direction classification:
- velocity > 0.05: "accelerating"
- -0.05 ≤ velocity ≤ 0.05: "steady"
- velocity < -0.05: "decelerating"

### 4.14.3 Study Streak

Consecutive days with at least one quiz completion:

```python
streak = 0
for day in reverse_chronological_days:
    if day has quiz_completion:
        streak += 1
    else:
        break
```

## 4.15 Question Generation Design

### 4.15.1 From Topics

```text
User provides: topic, count, difficulty
System:
  1. Build prompt with structured output requirements (JSON array)
  2. If document_name provided: RAG search → append context
  3. Send to LLM (Lite or Full based on tier)
  4. Parse JSON response
  5. Validate: exactly 4 answers, correct_answer in answers
  6. Return validated questions
```

### 4.15.2 From File Upload

```text
User provides: file (PDF/TXT/MD), count
System:
  1. Extract text from file
  2. Validate text quality
  3. Chunk text (for context window management)
  4. Build prompt with file content as context
  5. Generate questions grounded in the content
  6. Return validated questions
```

### 4.15.3 Prompt Engineering

Key prompt design principles for question generation:
- **Explicit JSON schema**: Define exact output format in the prompt.
- **Difficulty guidance**: Include examples of what "easy" vs. "hard" means.
- **Distractor quality**: Instruct LLM to make wrong answers plausible.
- **Context grounding**: When RAG context is provided, instruct to only ask about content in the context.

## 4.16 Notification System Design

Notifications are generated by two triggers:

1. **Scheduler** (hourly review check):
   - Query all `ReviewSchedule` where `next_review ≤ now`.
   - For each due schedule, create a `REVIEW_DUE` notification.
   - Avoid duplicates: skip if unread notification already exists.

2. **Milestone detection** (on quiz completion):
   - Check for achievements: first quiz, 10-quiz streak, category mastery.
   - Create `MILESTONE` notification with achievement details.

Notifications are stored in Firestore and displayed in the frontend header with a badge count.
