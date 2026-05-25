"""REST endpoint for step-by-step problem solving."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from server.capabilities.solve import StepSolver
from server.router import Tier, create_llm_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/solve")


# ─── Request / Response Models ────────────────────────────────────────────────


class SolveRequest(BaseModel):
    problem: str
    user_id: str = ""


class SolveStepResponse(BaseModel):
    step_id: int
    goal: str
    reasoning: str
    result: str


class SolveResponse(BaseModel):
    problem: str
    analysis: str
    steps: list[SolveStepResponse]
    final_answer: str
    confidence: str  # "high" | "medium" | "low"


# ─── Endpoint ─────────────────────────────────────────────────────────────────


@router.post("", response_model=SolveResponse)
async def solve_problem(request: SolveRequest):
    """Solve a problem step by step using the AI Study Coach.

    Returns a structured solution with:
    - Problem analysis
    - Numbered plan steps with reasoning and results
    - Final answer with confidence level
    """
    provider = create_llm_provider(Tier.FULL)
    solver = StepSolver(provider=provider)

    solution = await solver.run_http(request.problem)

    return SolveResponse(
        problem=solution.problem,
        analysis=solution.plan.analysis,
        steps=[
            SolveStepResponse(
                step_id=sr.step_id,
                goal=sr.goal,
                reasoning=sr.reasoning,
                result=sr.result,
            )
            for sr in solution.step_results
        ],
        final_answer=solution.final_answer,
        confidence=solution.confidence,
    )
