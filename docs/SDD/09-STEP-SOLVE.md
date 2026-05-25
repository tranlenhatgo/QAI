# 09 — Step-by-Step Problem Solving

## Purpose

Implement a structured problem-solving capability that breaks complex problems into steps, showing reasoning at each stage. Used in Full Agentic mode for math, science, and analytical problems.

---

## Interface Contract

```python
class StepSolver:
    """
    Multi-step problem solver.
    
    Breaks a problem into steps, solves each step with optional tool use
    (RAG for formulas, reason for deep thinking), and presents a structured solution.
    """

    async def solve(
        self,
        problem: str,
        context: str = "",        # RAG context if available
        show_steps: bool = True,  # Whether to show intermediate steps
        on_event: Callable = None,
    ) -> Solution:
        """
        Solve a problem step by step.
        
        Returns: Solution with steps, final answer, and explanation.
        """
```

---

## Data Shapes

```python
@dataclass
class SolveStep:
    """A single step in the solution."""
    number: int
    title: str              # e.g., "Identify known variables"
    reasoning: str          # The work done in this step
    result: str             # What this step concludes
    tools_used: list[str]   # Which tools were called (if any)

@dataclass
class Solution:
    """Complete problem solution."""
    problem: str
    steps: list[SolveStep]
    final_answer: str
    explanation: str        # High-level explanation of approach
    confidence: str         # "high", "medium", "low"
```

---

## Behavior Specification

### Solving Pipeline

```text
┌──────────────────────────────────────────────────────────────┐
│                STEP-BY-STEP SOLVE PIPELINE                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Phase 1: UNDERSTAND                                          │
│     └─ LLM analyzes the problem, identifies what's given      │
│        and what's asked                                        │
│                                                               │
│  Phase 2: PLAN                                                │
│     └─ LLM creates a step-by-step plan (3-7 steps)           │
│                                                               │
│  Phase 3: SOLVE (per step)                                    │
│     ├─ Execute each step                                      │
│     ├─ Use tools if needed (rag for formulas, reason for      │
│     │  complex logic)                                         │
│     └─ Stream step result to client                           │
│                                                               │
│  Phase 4: CONCLUDE                                            │
│     └─ Synthesize final answer from all steps                 │
└──────────────────────────────────────────────────────────────┘
```

### Implementation

```python
# ai_coach/capabilities/solve.py

class StepSolver:
    def __init__(self, llm: LLMService, rag_tool: RAGTool | None = None):
        self.llm = llm
        self.rag = rag_tool
    
    async def solve(self, problem, context="", kb_id="", show_steps=True, on_event=None):
        # Phase 1: Understand + Plan
        if on_event:
            await on_event({"type": "stage", "stage": "planning", "status": "start"})
        
        # Optionally gather RAG context
        if not context and self.rag and kb_id:
            context = await self.rag.execute({"query": problem, "kb_id": kb_id})
        
        plan = await self._create_plan(problem, context)
        
        if on_event:
            await on_event({"type": "stage", "stage": "planning", "status": "end"})
        
        # Phase 2: Execute each step
        steps = []
        for i, step_title in enumerate(plan, 1):
            if on_event:
                await on_event({"type": "stage", "stage": f"step_{i}", "status": "start"})
            
            step = await self._execute_step(
                problem=problem,
                step_number=i,
                step_title=step_title,
                previous_steps=steps,
                context=context,
            )
            steps.append(step)
            
            # Stream step to client
            if on_event and show_steps:
                await on_event({
                    "type": "content",
                    "content": f"\n**Step {i}: {step.title}**\n{step.reasoning}\n→ {step.result}\n",
                })
            
            if on_event:
                await on_event({"type": "stage", "stage": f"step_{i}", "status": "end"})
        
        # Phase 3: Final answer
        if on_event:
            await on_event({"type": "stage", "stage": "concluding", "status": "start"})
        
        final = await self._conclude(problem, steps)
        
        if on_event:
            await on_event({
                "type": "content",
                "content": f"\n**Final Answer:**\n{final.final_answer}\n\n{final.explanation}",
            })
            await on_event({"type": "stage", "stage": "concluding", "status": "end"})
        
        return Solution(
            problem=problem,
            steps=steps,
            final_answer=final.final_answer,
            explanation=final.explanation,
            confidence=final.confidence,
        )
    
    async def _create_plan(self, problem: str, context: str) -> list[str]:
        """Ask LLM to create a step-by-step plan."""
        prompt = f"""Analyze this problem and create a step-by-step plan to solve it.

Problem: {problem}
{"Relevant context:\n" + context if context else ""}

Respond with a JSON array of step titles (3-7 steps):
["Step title 1", "Step title 2", ...]

Each step should be a clear, actionable step toward the solution.
Respond with ONLY the JSON array."""
        
        result = await self.llm.complete_sync(
            messages=[
                Message(role=Role.SYSTEM, content=SOLVER_SYSTEM_PROMPT),
                Message(role=Role.USER, content=prompt),
            ]
        )
        
        # Parse plan
        try:
            plan = json.loads(result.content.strip().strip("```json").strip("```"))
        except json.JSONDecodeError:
            # Fallback: split by newlines
            plan = [line.strip("- ").strip() for line in result.content.split("\n") if line.strip()]
        
        return plan[:7]  # Max 7 steps
    
    async def _execute_step(
        self,
        problem: str,
        step_number: int,
        step_title: str,
        previous_steps: list[SolveStep],
        context: str,
    ) -> SolveStep:
        """Execute a single solving step."""
        # Build context from previous steps
        prev_work = ""
        if previous_steps:
            prev_work = "\n".join(
                f"Step {s.number} ({s.title}): {s.result}" for s in previous_steps
            )
        
        prompt = f"""You are solving this problem step by step.

Problem: {problem}
{"Relevant reference material:\n" + context if context else ""}

{"Previous work:\n" + prev_work if prev_work else ""}

Current step ({step_number}): {step_title}

Execute this step. Show your reasoning and state what you conclude.
Be precise and mathematical where appropriate."""
        
        result = await self.llm.complete_sync(
            messages=[
                Message(role=Role.SYSTEM, content=SOLVER_SYSTEM_PROMPT),
                Message(role=Role.USER, content=prompt),
            ]
        )
        
        return SolveStep(
            number=step_number,
            title=step_title,
            reasoning=result.content,
            result=self._extract_conclusion(result.content),
            tools_used=[],
        )
    
    async def _conclude(self, problem: str, steps: list[SolveStep]):
        """Synthesize final answer from all steps."""
        all_work = "\n".join(
            f"Step {s.number} ({s.title}):\n{s.reasoning}\nConclusion: {s.result}\n"
            for s in steps
        )
        
        prompt = f"""Based on the step-by-step work below, state the final answer.

Problem: {problem}

Work:
{all_work}

Provide:
1. The final answer (concise, direct)
2. A brief explanation of the approach
3. Your confidence level (high/medium/low)

Format:
ANSWER: [your answer]
EXPLANATION: [brief explanation]
CONFIDENCE: [high/medium/low]"""
        
        result = await self.llm.complete_sync(
            messages=[
                Message(role=Role.SYSTEM, content=SOLVER_SYSTEM_PROMPT),
                Message(role=Role.USER, content=prompt),
            ]
        )
        
        # Parse structured response
        lines = result.content.split("\n")
        answer = explanation = ""
        confidence = "medium"
        
        for line in lines:
            if line.startswith("ANSWER:"):
                answer = line[7:].strip()
            elif line.startswith("EXPLANATION:"):
                explanation = line[12:].strip()
            elif line.startswith("CONFIDENCE:"):
                confidence = line[11:].strip().lower()
        
        # Fallback if parsing fails
        if not answer:
            answer = result.content
        
        return type("Final", (), {
            "final_answer": answer,
            "explanation": explanation,
            "confidence": confidence,
        })()
    
    def _extract_conclusion(self, reasoning: str) -> str:
        """Extract the conclusion from a step's reasoning."""
        # Look for common conclusion indicators
        for marker in ["Therefore", "Thus", "So,", "This gives us", "We get", "Result:"]:
            if marker in reasoning:
                idx = reasoning.rfind(marker)
                return reasoning[idx:].split("\n")[0].strip()
        # Fallback: last non-empty line
        lines = [l.strip() for l in reasoning.split("\n") if l.strip()]
        return lines[-1] if lines else reasoning[:200]
```

### Solver System Prompt

```python
SOLVER_SYSTEM_PROMPT = """You are a patient, thorough problem-solving tutor.

Your approach:
1. Break problems into clear, logical steps
2. Show ALL work — don't skip steps
3. Explain WHY each step follows from the previous one
4. Use proper notation (mathematical, scientific, etc.)
5. If you're unsure about a step, say so
6. Verify your answer at the end if possible

For math problems: show the algebraic manipulation clearly.
For science problems: identify principles and apply them systematically.
For analytical problems: state assumptions explicitly.

NEVER skip steps or say "it's obvious." The student needs to see the full reasoning."""
```

---

## Integration as Agentic Tool

```python
class SolveProblemTool(BaseTool):
    """Wraps StepSolver as a tool callable from the agentic loop."""
    name = "solve_problem"
    description = "Solve a complex problem step by step with detailed reasoning. Use for math, physics, chemistry, or analytical problems that need structured solutions."
    
    def parameters_schema(self):
        return {
            "type": "object",
            "properties": {
                "problem": {"type": "string", "description": "The problem to solve"},
                "show_steps": {"type": "boolean", "description": "Whether to show step-by-step work (default: true)"},
            },
            "required": ["problem"]
        }
    
    async def execute(self, arguments: dict) -> str:
        solution = await self.solver.solve(
            problem=arguments["problem"],
            show_steps=arguments.get("show_steps", True),
            kb_id=self.session_kb_id,
        )
        
        # Format for LLM to present to user
        output = [f"Solution ({solution.confidence} confidence):"]
        for step in solution.steps:
            output.append(f"\nStep {step.number}: {step.title}")
            output.append(step.reasoning)
        output.append(f"\nFinal Answer: {solution.final_answer}")
        output.append(f"\n{solution.explanation}")
        
        return "\n".join(output)
```

---

## WebSocket Events During Solving

```json
{"type": "stage", "stage": "planning", "status": "start"}
{"type": "stage", "stage": "planning", "status": "end"}
{"type": "stage", "stage": "step_1", "status": "start"}
{"type": "content", "content": "\n**Step 1: Identify known variables**\nWe are given...\n→ x = 5, y = 3\n"}
{"type": "stage", "stage": "step_1", "status": "end"}
{"type": "stage", "stage": "step_2", "status": "start"}
{"type": "content", "content": "\n**Step 2: Apply the formula**\n..."}
{"type": "stage", "stage": "step_2", "status": "end"}
{"type": "stage", "stage": "concluding", "status": "start"}
{"type": "content", "content": "\n**Final Answer:**\nThe answer is 42.\n\nWe used..."}
{"type": "stage", "stage": "concluding", "status": "end"}
```

---

## Acceptance Criteria

- [ ] Creates a 3-7 step plan for any given problem
- [ ] Executes each step with full reasoning shown
- [ ] Previous step context is available to subsequent steps
- [ ] Final answer is synthesized from all steps
- [ ] Confidence level is reported (high/medium/low)
- [ ] RAG context is used when available
- [ ] Stage events are emitted for each phase (planning, step_N, concluding)
- [ ] Content is streamed per step (not all at once)
- [ ] Works as a standalone capability and as an agentic tool
- [ ] Plan parsing handles both JSON and plain text LLM responses
- [ ] Max 7 steps (prevents infinite planning)
- [ ] Each step's conclusion is extractable for the next step

---

## Dependencies

- `ai_coach/llm/base.py` — LLMService
- `ai_coach/tools/rag.py` — RAGTool (optional)
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
