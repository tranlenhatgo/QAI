"""REST endpoint for AI-powered answer explanation."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from server.config import settings
from server.router import Tier, create_llm_provider
from server.llm.base import Message, Role, ChunkType

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/explain-answer")


class ExplainRequest(BaseModel):
    question: str
    answers: list[str] = []
    correct_answer: str | None = None
    user_id: str = ""
    tier: str | None = None


class ExplainResponse(BaseModel):
    explanation: str


def _resolve_tier(requested_tier: str | None) -> Tier:
    if requested_tier == "lite":
        return Tier.LITE
    if requested_tier == "full":
        return Tier.FULL
    return Tier.FULL if settings.external_llm_api_key else Tier.LITE


@router.post("", response_model=ExplainResponse)
async def explain_answer(req: ExplainRequest):
    """Generate an AI explanation for a quiz question and its answer."""
    tier = _resolve_tier(req.tier)
    provider = create_llm_provider(tier)

    answers_text = "\n".join(f"  - {a}" for a in req.answers) if req.answers else "(no answers provided)"
    correct_text = f"\nThe correct answer is: {req.correct_answer}" if req.correct_answer else ""

    prompt = f"""You are a study coach. A student just answered a quiz question and wants to understand the answer.

Question: {req.question}

Answer options:
{answers_text}
{correct_text}

Please provide a clear, concise explanation (2-4 sentences) of why the correct answer is right. If possible, briefly explain why the other options are wrong. Be educational and encouraging."""

    messages = [
        Message(role=Role.SYSTEM, content="You are a helpful and encouraging study coach. Give clear, concise explanations."),
        Message(role=Role.USER, content=prompt),
    ]

    try:
        result_parts = []
        async for chunk in provider.complete(messages, tools=None, temperature=0.3):
            if chunk.type == ChunkType.CONTENT:
                result_parts.append(chunk.content)

        explanation = "".join(result_parts).strip()
        if not explanation:
            explanation = "Unable to generate an explanation at this time."
        return ExplainResponse(explanation=explanation)
    except Exception as e:
        logger.error("Explain-answer failed: %s", e)
        # Try fallback to lite if full failed
        if tier == Tier.FULL:
            try:
                provider = create_llm_provider(Tier.LITE)
                result_parts = []
                async for chunk in provider.complete(messages, tools=None, temperature=0.3):
                    if chunk.type == ChunkType.CONTENT:
                        result_parts.append(chunk.content)
                explanation = "".join(result_parts).strip()
                if explanation:
                    return ExplainResponse(explanation=explanation)
            except Exception:
                pass
        return ExplainResponse(explanation="Failed to generate explanation. Please try again later.")
