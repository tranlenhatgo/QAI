"""StepSolver capability — multi-step problem solving (inspired by DeepTutor)."""

import json
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from server.llm.base import ChunkType, LLMService, Message, Role
from server.ws import content_chunk, stage_event

logger = logging.getLogger(__name__)

# ─── Data Models ─────────────────────────────────────────────────────────────


@dataclass
class PlanStep:
    """A single step in the solution plan."""
    id: int
    goal: str


@dataclass
class Plan:
    """Problem decomposition into ordered sub-goals."""
    analysis: str
    steps: list[PlanStep] = field(default_factory=list)


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


# ─── Prompts ─────────────────────────────────────────────────────────────────

PLAN_SYSTEM = """You are a step-by-step problem solver. Decompose the given problem into 
clear, ordered sub-goals. Each step should be a specific task that builds toward the solution.

Respond in valid JSON only:
{
  "analysis": "Brief analysis of what the problem requires",
  "steps": [
    {"id": 1, "goal": "What this step needs to accomplish"},
    {"id": 2, "goal": "What this step needs to accomplish"}
  ]
}

Rules:
- Keep steps between 2-6 depending on complexity
- Each step should be independently verifiable
- Order matters: later steps may depend on earlier results
- Be specific — not "solve the equation" but "isolate variable x by dividing both sides by 3"
"""

STEP_SOLVE_SYSTEM = """You are solving step {step_id} of a multi-step problem.

Problem: {problem}

Your goal for this step: {goal}

{previous_context}

Solve ONLY this step. Show your reasoning clearly, then state the result.
Format your response as:
REASONING: [your work]
RESULT: [what this step concludes]"""

SYNTHESIZE_SYSTEM = """You solved a problem step by step. Now synthesize a final answer.

Problem: {problem}

Steps completed:
{steps_summary}

Provide:
1. A clear final answer
2. A confidence level (high/medium/low) based on how certain you are
3. A brief explanation connecting the steps

Format:
FINAL_ANSWER: [answer]
CONFIDENCE: [high|medium|low]
EXPLANATION: [brief connection of steps to answer]"""


# ─── StepSolver Capability ───────────────────────────────────────────────────


class StepSolver:
    """Multi-stage solver: plan → execute per step → synthesize.

    Inspired by DeepTutor's SolvePipeline but simplified for the AI Study Coach.
    Phases:
      1. Plan — decompose problem into sub-goals
      2. Execute — solve each step individually with context carryover
      3. Synthesize — produce final answer with confidence
    """

    def __init__(self, provider: LLMService):
        self.llm = provider

    def tool_names(self) -> list[str]:
        return []

    async def run(
        self,
        messages: list[Message],
        on_event: Callable[[dict], Awaitable[None]],
        cancelled: Callable[[], bool],
    ) -> None:
        """Run the full solve pipeline with streaming events."""
        problem = messages[-1].content if messages else ""

        # Phase 1: Plan
        await on_event(stage_event("planning", "start"))
        plan = await self._create_plan(problem, cancelled)
        await on_event(stage_event("planning", "end"))

        if cancelled() or not plan:
            await on_event(content_chunk("I couldn't create a plan for this problem. Please try rephrasing it."))
            return

        # Emit the plan
        plan_text = f"**Analysis:** {plan.analysis}\n\n**Plan:**\n"
        for step in plan.steps:
            plan_text += f"{step.id}. {step.goal}\n"
        plan_text += "\n---\n\n"
        await on_event(content_chunk(plan_text))

        # Phase 2: Execute each step
        step_results: list[StepResult] = []
        for step in plan.steps:
            if cancelled():
                break

            await on_event(stage_event(f"step_{step.id}", "start"))
            await on_event(content_chunk(f"**Step {step.id}: {step.goal}**\n\n"))

            result = await self._execute_step(problem, step, step_results, cancelled, on_event)
            if result:
                step_results.append(result)

            await on_event(content_chunk("\n\n"))
            await on_event(stage_event(f"step_{step.id}", "end"))

        if cancelled():
            return

        # Phase 3: Synthesize
        await on_event(stage_event("synthesizing", "start"))
        await on_event(content_chunk("---\n\n"))
        final_answer, confidence = await self._synthesize(problem, step_results, cancelled, on_event)
        await on_event(stage_event("synthesizing", "end"))

        # Store solution in messages for context
        solution_text = plan_text
        for sr in step_results:
            solution_text += f"Step {sr.step_id}: {sr.result}\n"
        solution_text += f"\nFinal Answer: {final_answer} (confidence: {confidence})"
        messages.append(Message(role=Role.ASSISTANT, content=solution_text))

    async def run_http(self, problem: str) -> Solution:
        """Run the solve pipeline and return structured Solution (for REST endpoint)."""
        plan = await self._create_plan(problem, lambda: False)
        if not plan:
            return Solution(
                problem=problem,
                plan=Plan(analysis="Could not analyze this problem", steps=[]),
                step_results=[],
                final_answer="Unable to solve. Please rephrase the problem.",
                confidence="low",
            )

        step_results: list[StepResult] = []
        for step in plan.steps:
            result = await self._execute_step(problem, step, step_results, lambda: False, None)
            if result:
                step_results.append(result)

        final_answer, confidence = await self._synthesize_text(problem, step_results)

        return Solution(
            problem=problem,
            plan=plan,
            step_results=step_results,
            final_answer=final_answer,
            confidence=confidence,
        )

    # ─── Internal phases ─────────────────────────────────────────────────────

    async def _create_plan(self, problem: str, cancelled: Callable[[], bool]) -> Plan | None:
        """Phase 1: Decompose problem into sub-goals."""
        messages = [
            Message(role=Role.SYSTEM, content=PLAN_SYSTEM),
            Message(role=Role.USER, content=problem),
        ]
        parts: list[str] = []
        async for chunk in self.llm.complete(messages, tools=None, temperature=0.3):
            if cancelled():
                break
            if chunk.type == ChunkType.CONTENT:
                parts.append(chunk.content)

        raw = "".join(parts).strip()
        return self._parse_plan(raw)

    async def _execute_step(
        self,
        problem: str,
        step: PlanStep,
        previous: list[StepResult],
        cancelled: Callable[[], bool],
        on_event: Callable[[dict], Awaitable[None]] | None,
    ) -> StepResult | None:
        """Phase 2: Solve a single step with context from previous steps."""
        previous_context = ""
        if previous:
            previous_context = "Previous steps completed:\n"
            for pr in previous:
                previous_context += f"  Step {pr.step_id} ({pr.goal}): {pr.result}\n"

        prompt = STEP_SOLVE_SYSTEM.format(
            step_id=step.id,
            problem=problem,
            goal=step.goal,
            previous_context=previous_context,
        )

        messages = [
            Message(role=Role.SYSTEM, content=prompt),
            Message(role=Role.USER, content=f"Solve step {step.id}: {step.goal}"),
        ]

        parts: list[str] = []
        async for chunk in self.llm.complete(messages, tools=None, temperature=0.2):
            if cancelled():
                break
            if chunk.type == ChunkType.CONTENT:
                parts.append(chunk.content)
                if on_event:
                    await on_event(content_chunk(chunk.content))

        text = "".join(parts)
        reasoning, result = self._parse_step_output(text)

        return StepResult(
            step_id=step.id,
            goal=step.goal,
            reasoning=reasoning,
            result=result,
        )

    async def _synthesize(
        self,
        problem: str,
        step_results: list[StepResult],
        cancelled: Callable[[], bool],
        on_event: Callable[[dict], Awaitable[None]],
    ) -> tuple[str, str]:
        """Phase 3: Produce final answer with streaming."""
        steps_summary = "\n".join(
            f"  Step {sr.step_id} ({sr.goal}): {sr.result}" for sr in step_results
        )
        prompt = SYNTHESIZE_SYSTEM.format(problem=problem, steps_summary=steps_summary)

        messages = [
            Message(role=Role.SYSTEM, content=prompt),
            Message(role=Role.USER, content="Synthesize the final answer."),
        ]

        parts: list[str] = []
        async for chunk in self.llm.complete(messages, tools=None, temperature=0.2):
            if cancelled():
                break
            if chunk.type == ChunkType.CONTENT:
                parts.append(chunk.content)
                await on_event(content_chunk(chunk.content))

        text = "".join(parts)
        return self._parse_synthesis(text)

    async def _synthesize_text(
        self, problem: str, step_results: list[StepResult]
    ) -> tuple[str, str]:
        """Phase 3 (non-streaming version for HTTP endpoint)."""
        steps_summary = "\n".join(
            f"  Step {sr.step_id} ({sr.goal}): {sr.result}" for sr in step_results
        )
        prompt = SYNTHESIZE_SYSTEM.format(problem=problem, steps_summary=steps_summary)

        messages = [
            Message(role=Role.SYSTEM, content=prompt),
            Message(role=Role.USER, content="Synthesize the final answer."),
        ]

        parts: list[str] = []
        async for chunk in self.llm.complete(messages, tools=None, temperature=0.2):
            if chunk.type == ChunkType.CONTENT:
                parts.append(chunk.content)

        text = "".join(parts)
        return self._parse_synthesis(text)

    # ─── Parsing helpers ─────────────────────────────────────────────────────

    def _parse_plan(self, raw: str) -> Plan | None:
        """Parse JSON plan from LLM output."""
        # Strip markdown fences if present
        if "```" in raw:
            lines = raw.split("\n")
            json_lines = []
            inside = False
            for line in lines:
                if line.strip().startswith("```"):
                    inside = not inside
                    continue
                if inside or not any(line.strip().startswith("```") for _ in [0]):
                    json_lines.append(line)
            raw = "\n".join(json_lines)

        # Try to find JSON object in the text
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            # Fallback: treat as plain text plan
            return self._parse_plain_plan(raw)

        try:
            data = json.loads(raw[start:end])
            steps = [PlanStep(id=s["id"], goal=s["goal"]) for s in data.get("steps", [])]
            return Plan(analysis=data.get("analysis", ""), steps=steps)
        except (json.JSONDecodeError, KeyError, TypeError):
            return self._parse_plain_plan(raw)

    def _parse_plain_plan(self, raw: str) -> Plan | None:
        """Fallback: parse numbered list as plan."""
        lines = raw.strip().split("\n")
        steps = []
        for line in lines:
            line = line.strip()
            if line and line[0].isdigit() and "." in line:
                parts = line.split(".", 1)
                if len(parts) == 2:
                    try:
                        step_id = int(parts[0].strip())
                        goal = parts[1].strip()
                        steps.append(PlanStep(id=step_id, goal=goal))
                    except ValueError:
                        continue

        if not steps:
            return None

        return Plan(analysis="", steps=steps)

    def _parse_step_output(self, text: str) -> tuple[str, str]:
        """Parse REASONING: and RESULT: from step output."""
        reasoning = text
        result = text

        if "RESULT:" in text:
            parts = text.split("RESULT:", 1)
            reasoning = parts[0].replace("REASONING:", "").strip()
            result = parts[1].strip()
        elif "REASONING:" in text:
            reasoning = text.replace("REASONING:", "").strip()
            result = reasoning.split("\n")[-1] if "\n" in reasoning else reasoning

        return reasoning, result

    def _parse_synthesis(self, text: str) -> tuple[str, str]:
        """Parse FINAL_ANSWER: and CONFIDENCE: from synthesis output."""
        final_answer = text
        confidence = "medium"

        if "FINAL_ANSWER:" in text:
            parts = text.split("FINAL_ANSWER:", 1)[1]
            if "CONFIDENCE:" in parts:
                answer_part, rest = parts.split("CONFIDENCE:", 1)
                final_answer = answer_part.strip()
                conf = rest.split("\n")[0].strip().lower()
                if conf in ("high", "medium", "low"):
                    confidence = conf
            else:
                final_answer = parts.strip()

        return final_answer, confidence
