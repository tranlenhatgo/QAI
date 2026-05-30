"""Question generation endpoints — replaces n8n workflow."""

import logging
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from server.config import settings
from server.router import Tier, create_llm_provider
from server.llm.base import Message, Role, ChunkType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["Generation"])


# ─── Request / Response Schemas ──────────────────────────────────────────────


class GenerateFromTopicsRequest(BaseModel):
    topics: list[str]
    count: int = 3  # questions per topic
    tier: str | None = None  # "lite" | "full" | None (auto-detect)


class GeneratedQuestion(BaseModel):
    question: str
    answers: list[str]
    correctAnswer: str


class GenerateResponse(BaseModel):
    questions: list[GeneratedQuestion]


# ─── Prompts ─────────────────────────────────────────────────────────────────

TOPIC_GENERATION_PROMPT = """You are a quiz question generator. Generate exactly {count} multiple-choice questions about the following topics: {topics}.

Each question must have:
- A clear question text
- Exactly 4 answer options
- One correct answer (must be one of the 4 options)

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{{
  "questions": [
    {{
      "question": "What is ...?",
      "answers": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A"
    }}
  ]
}}"""

FILE_GENERATION_PROMPT = """You are a quiz question generator. Based on the following document content, generate {count} multiple-choice questions that test understanding of the key concepts.

Document content:
---
{content}
---

Each question must have:
- A clear question text based on the document
- Exactly 4 answer options
- One correct answer (must be one of the 4 options)

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{{
  "questions": [
    {{
      "question": "What is ...?",
      "answers": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A"
    }}
  ]
}}"""


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _resolve_tier(requested_tier: str | None) -> Tier:
    """Resolve tier from request parameter, falling back to auto-detect."""
    if requested_tier == "lite":
        return Tier.LITE
    if requested_tier == "full":
        return Tier.FULL
    # Auto-detect: prefer Full if API key available
    return Tier.FULL if settings.external_llm_api_key else Tier.LITE


async def _call_llm_for_questions(prompt: str, tier: Tier | None = None) -> list[dict[str, Any]]:
    """Send prompt to LLM and parse JSON response. Full tier falls back to Lite on failure."""
    import json

    resolved_tier = tier or (Tier.FULL if settings.external_llm_api_key else Tier.LITE)
    provider = create_llm_provider(resolved_tier)
    messages = [
        Message(role=Role.SYSTEM, content="You are a precise quiz question generator. Always respond with valid JSON only."),
        Message(role=Role.USER, content=prompt),
    ]

    try:
        result_parts = []
        async for chunk in provider.complete(messages, tools=None, temperature=0.7):
            if chunk.type == ChunkType.CONTENT:
                result_parts.append(chunk.content)
    except Exception as e:
        # Full tier can fall back to Lite (LM Studio), but NOT vice versa
        if resolved_tier == Tier.FULL:
            logger.warning(f"Full tier LLM failed ({e}), falling back to Lite (LM Studio)")
            provider = create_llm_provider(Tier.LITE)
            result_parts = []
            async for chunk in provider.complete(messages, tools=None, temperature=0.7):
                if chunk.type == ChunkType.CONTENT:
                    result_parts.append(chunk.content)
        else:
            raise

    raw = "".join(result_parts).strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        lines = raw.split("\n")
        # Remove first and last lines (```json and ```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        raw = "\n".join(lines).strip()

    try:
        data = json.loads(raw)
        return data.get("questions", [])
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}\nRaw: {raw[:500]}")
        raise HTTPException(status_code=502, detail="LLM returned invalid JSON response")


# ─── Endpoints ───────────────────────────────────────────────────────────────


@router.post("/from-topics", response_model=GenerateResponse)
async def generate_from_topics(req: GenerateFromTopicsRequest):
    """Generate quiz questions from a list of topics.

    Replaces: n8n topic-based generation + Cohere /api/questions
    """
    if not req.topics:
        raise HTTPException(status_code=400, detail="At least one topic is required")

    total_count = req.count * len(req.topics)
    prompt = TOPIC_GENERATION_PROMPT.format(
        count=total_count,
        topics=", ".join(req.topics),
    )

    resolved_tier = _resolve_tier(req.tier)
    questions = await _call_llm_for_questions(prompt, tier=resolved_tier)
    return GenerateResponse(questions=[GeneratedQuestion(**q) for q in questions])


@router.post("/from-file", response_model=GenerateResponse)
async def generate_from_file(
    file: UploadFile = File(...),
    quiz_id: str = Form(""),
    count: int = Form(5),
    tier: str = Form(""),
):
    """Generate quiz questions from an uploaded document.

    Replaces: n8n file upload → question generation workflow.
    Accepts: .txt, .md, .pdf (text extracted), .docx (future)
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="File is required")

    # Read file content
    content_bytes = await file.read()
    filename = file.filename.lower()

    # Extract text based on file type
    if filename.endswith((".txt", ".md")):
        text_content = content_bytes.decode("utf-8", errors="replace")
    elif filename.endswith(".pdf"):
        # Try to extract text from PDF
        try:
            import fitz  # PyMuPDF

            doc = fitz.open(stream=content_bytes, filetype="pdf")
            text_content = "\n".join(page.get_text() for page in doc)
            doc.close()
        except ImportError:
            # Fallback: treat as raw text
            logger.warning("PyMuPDF not installed — treating PDF as raw text")
            text_content = content_bytes.decode("utf-8", errors="replace")
    else:
        # Generic: try to decode as text
        text_content = content_bytes.decode("utf-8", errors="replace")

    if not text_content.strip():
        raise HTTPException(status_code=400, detail="File is empty or could not be read")

    # Truncate to avoid exceeding LLM context limits
    max_chars = 12000
    if len(text_content) > max_chars:
        text_content = text_content[:max_chars] + "\n\n[... content truncated ...]"

    prompt = FILE_GENERATION_PROMPT.format(count=count, content=text_content)
    resolved_tier = _resolve_tier(tier or None)
    questions = await _call_llm_for_questions(prompt, tier=resolved_tier)
    return GenerateResponse(questions=[GeneratedQuestion(**q) for q in questions])


@router.post("/get-question")
async def get_single_question(quiz_id: str = ""):
    """Generate a single question for an existing quiz.

    Replaces: /n8n/get-question endpoint.
    Returns the same shape as the old n8n response for compatibility.
    """
    if not quiz_id:
        raise HTTPException(status_code=400, detail="quiz_id is required")

    # Fetch quiz context from Spring Boot to know the topic
    try:
        import httpx

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.quiz_api_url}/quiz/{quiz_id}")
            if resp.status_code == 200:
                quiz_data = resp.json()
                categories = quiz_data.get("categories", [])
                title = quiz_data.get("title", "General Knowledge")
            else:
                categories = []
                title = "General Knowledge"
    except Exception as e:
        logger.warning(f"Could not fetch quiz context: {e}")
        categories = []
        title = "General Knowledge"

    topics = categories if categories else [title]
    prompt = TOPIC_GENERATION_PROMPT.format(count=1, topics=", ".join(topics))
    questions = await _call_llm_for_questions(prompt)

    if not questions:
        raise HTTPException(status_code=502, detail="Failed to generate question")

    q = questions[0]
    # Return in the same shape as old n8n response (QuizResponseN8n.Output)
    return {
        "question": q["question"],
        "answers": q["answers"],
        "correctAnswer": q["correctAnswer"],
    }
