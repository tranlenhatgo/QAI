# 09 — Step-by-Step Problem Solving

## Purpose

Implement a structured problem-solving capability that breaks complex problems into steps, showing reasoning at each stage. Used for math, science, and analytical problems.

**Status: ✅ Implemented** (`server/capabilities/solve.py` + `server/routes/solve.py`)

---

## Interface Contract

```python
class StepSolver:
    """
    Multi-phase problem solver inspired by DeepTutor's SolvePipeline.
    
    Phases:
      1. Plan — decompose problem into sub-goals (JSON structured)
      2. Execute — solve each step with context carryover
      3. Synthesize — produce final answer with confidence
    """

    def __init__(self, provider: LLMService):
        self.llm = provider

    async def run(
        self,
        messages: list[Message],
        on_event: Callable[[dict], Awaitable[None]],
        cancelled: Callable[[], bool],
    ) -> None:
        """WebSocket streaming mode — emits stage events + content chunks."""

    async def run_http(self, problem: str) -> Solution:
        """REST mode — returns structured Solution object."""
```

---

## Data Shapes

```python
@dataclass
class PlanStep:
    """A single step in the solution plan."""
    id: int
    goal: str

@dataclass
class Plan:
    """Problem decomposition into ordered sub-goals."""
    analysis: str
    steps: list[PlanStep]

@dataclass
class StepResult:
    """Result of executing a single plan step."""
    step_id: int
    goal: str
    reasoning: str
    result: str

@dataclass
class Solution:
    """Complete problem solution."""
    problem: str
    plan: Plan
    step_results: list[StepResult]
    final_answer: str
    confidence: str  # "high", "medium", "low"
```

---

## Behavior Specification

### Solving Pipeline

```text
┌──────────────────────────────────────────────────────────────┐
│                STEP-BY-STEP SOLVE PIPELINE                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Phase 1: PLAN                                                │
│     └─ LLM outputs JSON: {analysis, steps[{id, goal}]}       │
│     └─ Fallback: parse numbered list if JSON fails            │
│                                                               │
│  Phase 2: EXECUTE (per step, with context carryover)          │
│     ├─ Each step receives: problem + goal + previous results  │
│     ├─ Output format: REASONING: [...] RESULT: [...]          │
│     └─ Stream content chunk per token (WebSocket mode)        │
│                                                               │
│  Phase 3: SYNTHESIZE                                          │
│     └─ Combines all step results into final answer            │
│     └─ Output: FINAL_ANSWER + CONFIDENCE + EXPLANATION        │
└──────────────────────────────────────────────────────────────┘
```

---

## REST Endpoint

```
POST /solve
```

**Request:**
```json
{
  "problem": "Solve x² + 5x + 6 = 0",
  "user_id": "abc123"
}
```

**Response:**
```json
{
  "problem": "Solve x² + 5x + 6 = 0",
  "analysis": "This is a quadratic equation that can be factored",
  "steps": [
    {
      "step_id": 1,
      "goal": "Identify the equation type and method",
      "reasoning": "x² + 5x + 6 = 0 is a quadratic (ax²+bx+c). We need two numbers that multiply to 6 and add to 5.",
      "result": "Use factoring method — find factors of 6 that sum to 5"
    },
    {
      "step_id": 2,
      "goal": "Factor the quadratic",
      "reasoning": "Factors of 6: (1,6), (2,3). Sum check: 2+3=5 ✓",
      "result": "(x + 2)(x + 3) = 0"
    },
    {
      "step_id": 3,
      "goal": "Solve for x",
      "reasoning": "Set each factor to zero: x+2=0 → x=-2; x+3=0 → x=-3",
      "result": "x = -2 or x = -3"
    }
  ],
  "final_answer": "x = -2, x = -3",
  "confidence": "high"
}
```

---

## WebSocket Streaming

When used via WebSocket (agentic mode), the solver emits:

```json
{"type": "stage", "stage": "planning", "status": "start"}
{"type": "content", "content": "**Analysis:** ...\\n**Plan:**\\n1. ..."}
{"type": "stage", "stage": "planning", "status": "end"}
{"type": "stage", "stage": "step_1", "status": "start"}
{"type": "content", "content": "**Step 1: ...**\\n\\n"}
{"type": "content", "content": "REASONING: ..."}
{"type": "stage", "stage": "step_1", "status": "end"}
...
{"type": "stage", "stage": "synthesizing", "status": "start"}
{"type": "content", "content": "FINAL_ANSWER: ...\\nCONFIDENCE: high"}
{"type": "stage", "stage": "synthesizing", "status": "end"}
```

---

## Prompts

### Plan Prompt (System)
Instructs LLM to output JSON with `analysis` and `steps` array. Rules:
- 2-6 steps based on complexity
- Each step independently verifiable
- Specific goals (not vague)

### Step Solve Prompt (System)
Per-step prompt with variables:
- `{step_id}`, `{problem}`, `{goal}`, `{previous_context}`
- Output format: `REASONING:` + `RESULT:`

### Synthesize Prompt (System)
Combines all step results, asks for:
- `FINAL_ANSWER:` — clear answer
- `CONFIDENCE:` — high/medium/low
- `EXPLANATION:` — connects steps to answer

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| LLM tier | Full (DeepSeek) | Uses cloud model for better reasoning |
| Plan temperature | 0.3 | Slightly creative for decomposition |
| Solve temperature | 0.2 | Precise execution |
| Synthesize temperature | 0.2 | Precise conclusion |
- [ ] Max 7 steps (prevents infinite planning)
- [ ] Each step's conclusion is extractable for the next step

---

## Dependencies

- `server/llm/base.py` — LLMService
- `server/tools/rag.py` — RAGTool (optional)
- `json` (stdlib)

---

## DeepTutor Reference

| This Module | DeepTutor Equivalent | What Changed |
| ------------- | --------------------- | -------------- |
| `StepSolver` | `deeptutor/capabilities/deep_solve/` | No REPLAN back-edge, no explain-judge |
| Plan creation | Phase 1 (planning) in deep_solve | Same concept, simpler JSON output |
| Step execution | Phase 2 (solving per step) | No tool calling within steps (just LLM) |
| Conclusion | Phase 3 (writing) | Merged into conclusion step |
| `SolveProblemTool` | N/A (deep_solve is a capability, not tool) | Wrapped as tool for agentic flexibility |

### Key Simplifications from DeepTutor's deep_solve

1. **No REPLAN back-edge** — if a step seems wrong, we continue forward (simplifies loop)
2. **No explain-judge** — no secondary LLM call to evaluate if explanation is sufficient
3. **No tool calling within steps** — each step is pure LLM reasoning (tools called before, during context gathering)
4. **No pre-retrieve phase** — RAG is done once at the start, not per-step
5. **Fixed max steps (7)** — no dynamic step addition
