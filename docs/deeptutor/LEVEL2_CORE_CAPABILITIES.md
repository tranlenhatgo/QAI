# DeepTutor — Level 2 Core Capabilities (Necessary Agents)

These are the **essential capabilities** that form the foundation of DeepTutor's intelligent tutoring system. Removing any of these fundamentally breaks the product's core value proposition.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Chat Capability](#1-chat--agentic-conversational-tutor)
3. [Deep Solve Capability](#2-deep_solve--multi-step-problem-solving)
4. [Deep Question Capability](#3-deep_question--intelligent-quiz-generation)

---

## Architecture Overview

### What Makes a Capability "Necessary"?

A capability is **necessary** when:
- It serves a core tutoring use case that no other capability covers
- It's used as a delegate target by other capabilities
- Removing it would break the chat fallback path or the learning loop
- It implements a fundamental pedagogical pattern (teach, assess, or solve)

### Capability Protocol (BaseCapability)

Every capability implements:

```python
class BaseCapability(ABC):
    manifest: CapabilityManifest  # Static metadata

    @abstractmethod
    async def run(self, context: UnifiedContext, stream: StreamBus) -> None:
        """Execute the full pipeline, emitting events to stream."""
```

The `CapabilityManifest` declares:
```python
@dataclass
class CapabilityManifest:
    name: str                      # Registry key
    description: str               # Human-readable
    stages: list[str]              # Pipeline phases (frontend uses for progress)
    tools_used: list[str]          # Level 1 tools this capability can call
    cli_aliases: list[str]         # CLI entry points
    request_schema: dict           # JSON schema for config_overrides validation
    config_defaults: dict          # Default parameter values
```

### Shared Infrastructure

All core capabilities share:
- **StreamBus** — Async event fan-out (STAGE_START, CONTENT, TOOL_CALL, RESULT, DONE)
- **run_agentic_loop** — Generic label-driven iteration engine
- **dispatch_tool_calls** — Parallel tool execution with tracing
- **UsageTracker** — Token/cost accounting
- **emit_capability_result** — Standardized result emission with cost_summary

---

## 1. `chat` — Agentic Conversational Tutor

### Why It's Essential
- **The default capability** — every message routes here unless the user selects a deep mode
- Used as the fallback when unknown capabilities are requested
- The only capability that uses the full tool palette
- Provides the conversational tutoring experience that is the product's core

### Manifest

```python
CapabilityManifest(
    name="chat",
    description="Agentic chat with autonomous tool selection across enabled tools.",
    stages=["thinking", "acting", "observing", "responding"],
    tools_used=["rag", "web_search", "code_execution", "reason", "brainstorm",
                "paper_search", "geogebra_analysis", "read_source", "read_memory",
                "write_memory", "web_fetch", "list_notebook", "write_note",
                "github", "ask_user"],
    cli_aliases=["chat"],
)
```

### Architecture

```
ChatCapability.run(context, stream)
         ↓
AgenticChatPipeline.run(context, stream)
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    AGENTIC LOOP                                       │
│                                                                       │
│  Label Protocol: FINISH | TOOL | THINK | PAUSE                       │
│  Max Iterations: 20 (configurable)                                   │
│  Context Window Guard: 90% ratio                                     │
│                                                                       │
│  Each iteration:                                                      │
│  1. Assemble: system prompt + memory + skills + sources + history    │
│  2. Call LLM with tool schemas                                       │
│  3. Parse label from first line                                      │
│  4. Route based on label:                                            │
│     • FINISH → stream text → exit                                    │
│     • TOOL   → dispatch tools → append results → continue           │
│     • THINK  → append as internal context → continue                 │
│     • PAUSE  → stream text to user AND continue                      │
│  5. Guard context window (snip stale tool results if >90%)           │
└─────────────────────────────────────────────────────────────────────┘
```

### Label Protocol Detail

```python
_CHAT_PROTOCOL = LabelProtocol(
    allowed=("FINISH", "TOOL", "THINK", "PAUSE"),
    terminal=frozenset({"FINISH"}),
    intermediate=frozenset({"THINK", "PAUSE"}),
    final=frozenset({"FINISH", "PAUSE"}),
    tool_label="TOOL",
)
```

| Label | Terminal? | Streams to User? | Tools? | Purpose |
|-------|----------|-----------------|--------|---------|
| `FINISH` | ✅ Yes | ✅ Yes | ❌ | Final answer, loop exits |
| `TOOL` | ❌ No | ❌ No | ✅ | Call tools, append results |
| `THINK` | ❌ No | ❌ No | ❌ | Internal reasoning (hidden) |
| `PAUSE` | ❌ No | ✅ Yes | ❌ | Visible reasoning, loop continues |

### Key Features

1. **Full Tool Palette**: All 14 built-in tools available (dynamically composed based on user settings)
2. **ask_user Pause/Resume**: Mid-turn clarification without ending the conversation
3. **Context Window Guard**: Auto-snips stale tool results at 90% capacity
4. **Force Finalization**: After max iterations, forces a FINISH via repair attempts
5. **Answer Now**: Fast-path that skips the agentic loop for impatient users
6. **Memory Integration**: Reads/writes user preferences for personalization
7. **Source Manifest**: Attached documents rendered as a browsable index

### System Prompt Assembly

The chat pipeline builds a comprehensive system prompt from:
```
Base system prompt (from YAML prompts)
  + Memory context (L3 cross-surface memory)
  + Skills context (user-defined skill instructions)
  + Source manifest (attached sources index)
  + Tool prompt hints (per-tool usage guidelines)
  + Language directive (response language)
  + Protocol documentation (label rules)
```

### Error Recovery

- Protocol violations → retry notice + repair message → next iteration
- Max iterations exhausted → `force_finalize()` drives 3 more attempts at FINISH
- Tool execution failures → error content fed back to LLM as role=tool
- Context overflow → automatic stale-result snipping

---

## 2. `deep_solve` — Multi-Step Problem Solving

### Why It's Essential
- **Core pedagogical tool** — solves complex problems step-by-step with visible reasoning
- Teaches through worked examples (the most effective tutoring pattern)
- Only capability with REPLAN back-edge (can self-correct mid-solution)
- Shows the student how to break down and approach hard problems

### Manifest

```python
CapabilityManifest(
    name="deep_solve",
    description="Multi-agent problem solving (Plan -> ReAct -> Write).",
    stages=["planning", "reasoning", "writing"],
    tools_used=["rag", "web_search", "code_execution", "reason"],
    cli_aliases=["solve"],
)
```

### Architecture (4-Phase Pipeline)

```
DeepSolveCapability.run(context, stream)
         ↓
SolvePipeline.run(context, question, ...)
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 0: PRE-RETRIEVE (only if KB attached)                          │
│                                                                       │
│  Step A: QUERIES labeled step                                        │
│    → LLM generates N search queries (JSON list)                      │
│  Step B: Parallel RAG execution                                      │
│    → All queries run against the KB simultaneously                   │
│  Step C: SUMMARY labeled step                                        │
│    → Aggregates retrieved chunks into a knowledge note               │
│                                                                       │
│  Protocol: QUERIES (single terminal) → no tools, no loop             │
│  Protocol: SUMMARY (single terminal) → no tools, no loop             │
│  Token budget: 2000 per step                                         │
│  Retrieval cap: 2000 chars per query, 6000 total aggregate           │
├─────────────────────────────────────────────────────────────────────┤
│ Phase 1: PLAN                                                         │
│                                                                       │
│  One labeled step (PLAN terminal)                                    │
│  LLM outputs JSON plan:                                              │
│  {                                                                    │
│    "analysis": "The problem requires...",                            │
│    "steps": [                                                        │
│      {"id": "step_1", "goal": "Identify variables and constraints"},│
│      {"id": "step_2", "goal": "Apply Gaussian elimination"},        │
│      {"id": "step_3", "goal": "Verify solution by substitution"}    │
│    ]                                                                  │
│  }                                                                    │
│                                                                       │
│  Protocol: PLAN (single terminal) → no tools, no loop                │
│  Input context: question + retrieved knowledge + memory + history     │
│  On REPLAN: re-enters with previous attempt + replan reason           │
├─────────────────────────────────────────────────────────────────────┤
│ Phase 2: SOLVE (per-step agentic loops)                              │
│                                                                       │
│  For each PlanStep:                                                   │
│    Agentic loop with 4 labels:                                       │
│      THINK → internal reasoning                                      │
│      TOOL  → call rag/web_search/code_execution/reason               │
│      FINISH → step complete (text streams live to user)              │
│      REPLAN → discard and re-plan from Phase 1                       │
│                                                                       │
│  Protocol: THINK | TOOL | FINISH | REPLAN                            │
│  Max iterations per step: 7 (configurable)                           │
│  Max replans total: 2 (configurable)                                 │
│                                                                       │
│  After each FINISH:                                                   │
│    Optional EXPLAIN judge → decides if elaboration is needed         │
│    If EXPLAIN: streams additional explanation                        │
│    If SKIP: moves to next step                                       │
│                                                                       │
│  REPLAN triggers:                                                     │
│    → Discards all step results so far                                │
│    → Re-enters Phase 1 with reason + previous attempt                │
│    → Budget: max 2 replans per turn                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Phase 3: SYNTHESIZE                                                   │
│                                                                       │
│  One labeled step (FINISH terminal)                                  │
│  Input: question + all StepFinish texts                              │
│  Output: Final answer + short recap                                  │
│  Streams directly to user                                            │
│                                                                       │
│  Protocol: FINISH (single terminal)                                  │
│  Token budget: 2000                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Label Protocols

| Phase | Labels | Terminal | Intermediate | Tool Label |
|-------|--------|----------|--------------|------------|
| Pre-retrieve (queries) | `QUERIES` | `{QUERIES}` | — | None |
| Pre-retrieve (summary) | `SUMMARY` | `{SUMMARY}` | — | None |
| Plan | `PLAN` | `{PLAN}` | — | None |
| Solve (per step) | `THINK`, `TOOL`, `FINISH`, `REPLAN` | `{FINISH, REPLAN}` | `{THINK}` | `TOOL` |
| Explain judge | `EXPLAIN`, `SKIP` | `{EXPLAIN, SKIP}` | — | None |
| Explain | `FINISH` | `{FINISH}` | — | None |
| Synthesize | `FINISH` | `{FINISH}` | — | None |

### REPLAN Back-Edge (Unique Feature)

```
Phase 1: Plan
  → Step 1: FINISH ✓
  → Step 2: REPLAN "The approach in step 1 leads to a contradiction"
     ↓
     Back to Phase 1 with:
       - Original question
       - Previous attempt summary
       - Replan reason
       - Attempt counter (for divergence)
     ↓
  New plan generated → Phase 2 restarts from step 1
```

This is the only capability with a **backward arc** in its execution graph. It enables self-correction when the model discovers mid-solution that its plan was flawed.

### Configuration

```python
DEFAULT_MAX_ITERATIONS_PER_STEP = 7   # Per-step loop ceiling
DEFAULT_MAX_REPLANS = 2               # Total replans per turn
DEFAULT_NUM_QUERIES = 3               # Pre-retrieve query count
DEFAULT_MAX_TOKENS = 8000             # Per-step token budget
SYNTHESIZE_MAX_TOKENS = 2000          # Final synthesis budget
MAX_CHARS_PER_RETRIEVAL = 2000        # Per-query retrieval cap
MAX_AGGREGATE_INPUT_CHARS = 6000      # Total pre-retrieve cap
```

### Tools Available in Solve Steps

| Tool | Use Case in Solve |
|------|------------------|
| `rag` | Retrieve relevant theory from KB |
| `web_search` | Look up formulas, references |
| `code_execution` | Verify calculations, plot graphs |
| `reason` | Deep-think about a sub-problem |

### Answer Now

`deep_solve` does **NOT** support Answer Now. The UI hides the button. The multi-phase architecture makes mid-execution summarization unreliable — partial results without verification could mislead students.

---

## 3. `deep_question` — Intelligent Quiz Generation

### Why It's Essential
- **Core assessment tool** — generates questions to test understanding
- Implements the test-yourself learning pattern (proven most effective for retention)
- Three distinct modes serving different pedagogical needs
- Session quiz history prevents duplicate questions across turns

### Manifest

```python
CapabilityManifest(
    name="deep_question",
    description="Fast question generation (Template batches -> Generate).",
    stages=["ideation", "generation"],
    tools_used=["rag", "web_search", "code_execution"],
    cli_aliases=["quiz"],
)
```

### Architecture (3 Modes)

```
DeepQuestionCapability.run(context, stream)
         ↓
    ┌────────────────┬──────────────────┬────────────────┐
    ↓                ↓                  ↓                ↓
 Followup         Custom            Mimic              Error
 (single Q)     (full pipeline)   (PDF → templates)  (no topic)
```

### Mode 1: Followup (Single-Call Agent)

**When**: `context.metadata["question_followup_context"]` has a question field.

```
User asks follow-up about a specific quiz question
         ↓
FollowupAgent.process(user_message, question_context, history)
    → Single LLM call
    → Answers the follow-up with context awareness
         ↓
stream.content(answer)
emit_capability_result({response, mode: "followup", question_id})
```

Simple, stateless, one-shot. Uses `BaseAgent.stream_llm()`.

### Mode 2: Custom (Full QuestionPipeline — 3 Phases)

**When**: Standard quiz generation request.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 1: EXPLORE (Agentic Loop)                                      │
│                                                                       │
│  Label Protocol: THINK | TOOL | FINISH                               │
│  Max iterations: 8                                                    │
│  Tools: rag, web_search, code_execution                              │
│                                                                       │
│  Purpose:                                                             │
│  - Research the topic using available tools                          │
│  - Build understanding of the subject matter                         │
│  - FINISH text streams to user as a brief preface                    │
│                                                                       │
│  Context includes:                                                    │
│  - Prior quiz history (avoid duplicates)                             │
│  - Conversation history                                              │
│  - Attached KB content                                               │
│                                                                       │
│  Tool results are SUMMARIZED (compressed) before appending:          │
│  - One extra LLM call per tool result                                │
│  - Keeps exploration_trace compact for downstream phases             │
│  - Budget: 800 tokens per summary, temp=0.2                         │
├─────────────────────────────────────────────────────────────────────┤
│ Phase 2: PLAN (Single Labeled Step)                                  │
│                                                                       │
│  Label Protocol: PLAN (single terminal)                              │
│  No tools, no loop                                                   │
│  Token budget: 2000                                                  │
│                                                                       │
│  Input: topic + exploration_trace + constraints                      │
│  Output: JSON template array:                                        │
│  [                                                                    │
│    {                                                                  │
│      "question_id": "q_1",                                           │
│      "topic": "Matrix determinant properties",                       │
│      "question_type": "choice",                                      │
│      "difficulty": "medium"                                          │
│    },                                                                 │
│    ...                                                                │
│  ]                                                                    │
│                                                                       │
│  Constraints applied:                                                 │
│  - num_questions (from config)                                       │
│  - difficulty filter                                                 │
│  - question_types allowlist                                          │
│  - per_type_counts distribution                                      │
│  - Quiz history avoidance                                            │
├─────────────────────────────────────────────────────────────────────┤
│ Phase 3: QUIZ (Per-Question Agentic Loops)                           │
│                                                                       │
│  For EACH template from Phase 2:                                     │
│                                                                       │
│  Label Protocol: THINK | TOOL | FINISH                               │
│  Max iterations per question: 5                                      │
│  Tools: rag, web_search, code_execution                              │
│                                                                       │
│  FINISH must output STRICT JSON:                                     │
│  {                                                                    │
│    "question_id": "q_1",                                             │
│    "question_type": "choice",                                        │
│    "difficulty": "medium",                                           │
│    "question": "Which property holds for det(AB)?",                  │
│    "options": {"A": "det(A)+det(B)", "B": "det(A)·det(B)", ...},    │
│    "answer": "B",                                                    │
│    "explanation": "By the multiplicative property...",               │
│    "hints": ["Think about what det measures...", "Try 2×2 case"]     │
│  }                                                                    │
│                                                                       │
│  On JSON parse failure:                                              │
│    → One-shot REPAIR attempt (FINISH protocol, 2500 tokens)          │
│    → Feed schema violation back to LLM                               │
│    → If repair fails → skip question with warning                    │
│                                                                       │
│  On success:                                                          │
│    → Emit quiz_question_emitted StreamEvent                          │
│    → Frontend renders card immediately (incremental)                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Mode 3: Mimic (PDF → Templates → Pipeline)

**When**: `config_overrides.mode == "mimic"`.

```
PDF attachment or parsed directory
         ↓
parse_exam_paper_to_templates(path, max_questions)
    → MinerU PDF parsing (for uploads)
    → Template extraction from exam structure
    → Returns: [{question_id, topic, question_type, difficulty}, ...]
         ↓
QuestionPipeline.run(... templates_override=templates ...)
    → Skips Phase 1 (Explore) and Phase 2 (Plan)
    → Goes directly to Phase 3 (Quiz) with extracted templates
    → Generates NEW questions mimicking the exam's style
```

Three input variants:
1. **Uploaded PDF** → write to temp, parse with MinerU
2. **Server-side parsed directory** → skip parsing, extract questions
3. **[Attached Documents]** in user message → fall back to custom mode with mimic hint

### Question Type Taxonomy

```python
class QuestionType(StrEnum):
    CHOICE = "choice"           # Multiple choice (A/B/C/D)
    CONCEPT = "concept"         # True/False conceptual
    FILL_IN_BLANK = "fill_in_blank"  # ____ completion
    SHORT_ANSWER = "short_answer"     # Brief text response
    WRITTEN = "written"         # Long-form essay
    CODING = "coding"           # Code writing
```

### Session Quiz History

```python
quiz_history = await load_session_quiz_history(context.session_id)
```

- Loaded per-session to prevent duplicate questions
- Fed into both Explore and Plan phases
- LLM is instructed to avoid previously generated topics/types
- Enables progressive difficulty escalation across a study session

### Answer Now

`deep_question` does **NOT** support Answer Now. The quiz structure requires complete generation — partial questions would confuse students.

### Configuration

```python
DEFAULT_MAX_EXPLORE_ITERATIONS = 8       # Explore phase loop cap
DEFAULT_MAX_QUIZ_ITERATIONS_PER_QUESTION = 5  # Per-question loop cap
PLAN_MAX_TOKENS = 2000                   # Plan phase budget
QUIZ_FINISH_MAX_TOKENS = 3000            # Per-question generation budget
REPAIR_MAX_TOKENS = 2500                 # JSON repair budget
FINALIZATION_REPAIR_ATTEMPTS = 2         # Max repair retries
```

---

## Why These Three Are Irreducible

| Capability | Pedagogical Role | Unique Feature | If Removed... |
|-----------|-----------------|----------------|---------------|
| **chat** | Conversational teaching, Q&A | Full tool palette + ask_user pause | System has no default mode. Nothing works. |
| **deep_solve** | Worked examples, step-by-step reasoning | REPLAN back-edge for self-correction | Students can't see problem-solving methodology |
| **deep_question** | Active recall, self-assessment | Session history + 6 question types + mimic mode | Students can't test their understanding |

Together they form the **teach → assess → solve** loop:
1. **Chat** teaches concepts conversationally
2. **Deep Question** tests understanding with targeted quizzes
3. **Deep Solve** demonstrates how to approach problems the student struggled with
4. Loop back to **Chat** for follow-up discussion

This is the pedagogical flywheel that makes DeepTutor an intelligent tutor rather than a simple chatbot.

---

## Shared Engine Primitives

All three capabilities build on the same agentic engine (`deeptutor/core/agentic/`):

| Primitive | Module | Used By |
|-----------|--------|---------|
| `run_labeled_step` | `labeled_step.py` | Single LLM call with label routing |
| `run_agentic_loop` | `loop.py` | Multi-iteration label-driven loop |
| `dispatch_tool_calls` | `tool_dispatch.py` | Parallel tool execution |
| `LabelProtocol` | `loop.py` | Declarative label vocabulary |
| `LoopHost` | `loop.py` | Capability-specific hooks interface |
| `UsageTracker` | `usage.py` | Token/cost accounting |
| `classify_label` | `labels.py` | Protocol-label parsing |

This layered design means:
- Adding a new capability = define labels + prompts + wire into the loop
- The loop engine handles iteration, guards, retry, and streaming
- Capabilities focus on domain-specific orchestration, not plumbing
