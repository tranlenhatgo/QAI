"""Question generation endpoints — replaces n8n workflow."""

import json
import logging
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

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
    title: str | None = None  # optional title to narrow question focus
    document_name: str | None = None  # optional: generate from uploaded document via RAG
    user_id: str | None = None  # required when document_name is provided


class GeneratedQuestion(BaseModel):
    question: str
    answers: list[str]
    correctAnswer: str


class GenerateResponse(BaseModel):
    questions: list[GeneratedQuestion]


class AdaptiveAnswerHistoryItem(BaseModel):
    question: str
    answers: list[str] = Field(default_factory=list)
    correctAnswer: str
    selectedAnswer: str | None = None
    wasCorrect: bool
    source: str | None = None


class AdaptiveWrongQuestion(BaseModel):
    question: str
    answers: list[str] = Field(default_factory=list)
    correctAnswer: str
    selectedAnswer: str | None = None
    source: str | None = None
    wrongCount: int | None = None


class AdaptiveQuestionsRequest(BaseModel):
    category: str | None = None
    count: int = 5
    history: list[AdaptiveAnswerHistoryItem] = Field(default_factory=list)
    wrong_questions: list[AdaptiveWrongQuestion] = Field(default_factory=list)
    recent_questions: list[str] = Field(default_factory=list)
    tier: str | None = None


class AdaptiveGeneratedQuestion(BaseModel):
    question: str
    answers: list[str]
    correctAnswer: str
    topic: str
    source: str = "adaptive_ai"
    generatedFromQuestion: str | None = None


class AdaptiveQuestionsResponse(BaseModel):
    questions: list[AdaptiveGeneratedQuestion]


# ─── Prompts ─────────────────────────────────────────────────────────────────

TOPIC_GENERATION_PROMPT = """You are a quiz question generator. Generate exactly {count} multiple-choice questions about the following topics: {topics}.{title_context}

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

ADAPTIVE_GENERATION_PROMPT = """You are generating an adaptive Infinity Quiz batch for one category only.

Category: {category}

Generate exactly {count} new multiple-choice questions for this same category only.

Use this recent answer history, ordered from older to newer:
{history_json}

Use these active wrong-repeat questions to identify concepts the student missed:
{wrong_json}

Avoid these already-seen question texts:
{recent_json}

Rules:
- Every question must stay inside the selected category.
- If recent answers were wrong, target the same concept or a prerequisite concept.
- If recent answers were correct, increase difficulty slightly or move to a nearby same-category concept.
- Mix remedial, nearby, and slightly harder questions across the batch.
- Do not repeat or closely paraphrase any already-seen question text.
- Each question must have exactly 4 answer options.
- correctAnswer must be one of the 4 answer options.

Respond ONLY with valid JSON in this exact format:
{{
  "questions": [
    {{
      "question": "Question text",
      "answers": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "topic": "{topic}",
      "source": "adaptive_ai",
      "generatedFromQuestion": "short source question text or null"
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


def _strip_json_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        lines = [line for line in lines if not line.strip().startswith("```")]
        raw = "\n".join(lines).strip()
    return raw


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

    raw = _strip_json_fences("".join(result_parts))

    try:
        data = json.loads(raw)
        return data.get("questions", [])
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}\nRaw: {raw[:500]}")
        raise HTTPException(status_code=502, detail="LLM returned invalid JSON response")


def _resolve_adaptive_tier(requested_tier: str | None) -> Tier:
    if requested_tier == "lite":
        return Tier.LITE
    if requested_tier == "full":
        return Tier.FULL
    raise HTTPException(status_code=400, detail="tier must be lite or full")


def _normalize_question_text(value: str) -> str:
    return " ".join(value.lower().strip().split())


def _validate_adaptive_questions(
    questions: list[dict[str, Any]],
    *,
    category: str,
    count: int,
    recent_questions: list[str],
) -> list[AdaptiveGeneratedQuestion]:
    if len(questions) != count:
        raise ValueError(f"Expected {count} questions, received {len(questions)}")

    recent = {_normalize_question_text(text) for text in recent_questions if text}
    seen: set[str] = set()
    validated: list[AdaptiveGeneratedQuestion] = []
    topic = category.strip().lower()

    for raw_question in questions:
        question_text = str(raw_question.get("question", "")).strip()
        answers = raw_question.get("answers")
        correct_answer = str(raw_question.get("correctAnswer", "")).strip()

        if not question_text:
            raise ValueError("Generated question is missing question text")
        if not isinstance(answers, list) or len(answers) != 4:
            raise ValueError("Generated question must have exactly 4 answers")
        normalized_answers = [str(answer).strip() for answer in answers]
        if not all(normalized_answers):
            raise ValueError("Generated answers cannot be blank")
        if correct_answer not in normalized_answers:
            option_index = {"a": 0, "b": 1, "c": 2, "d": 3}.get(correct_answer.lower().strip(").: "))
            if option_index is None and correct_answer.strip().isdigit():
                numeric_index = int(correct_answer.strip()) - 1
                option_index = numeric_index if 0 <= numeric_index < 4 else None
            if option_index is not None:
                correct_answer = normalized_answers[option_index]
        if correct_answer not in normalized_answers:
            raise ValueError("correctAnswer must be one of the answer options")

        normalized_text = _normalize_question_text(question_text)
        if normalized_text in recent or normalized_text in seen:
            raise ValueError("Generated question duplicated a recent or same-batch question")
        seen.add(normalized_text)

        validated.append(
            AdaptiveGeneratedQuestion(
                question=question_text,
                answers=normalized_answers,
                correctAnswer=correct_answer,
                topic=topic,
                source="adaptive_ai",
                generatedFromQuestion=raw_question.get("generatedFromQuestion"),
            )
        )

    return validated


async def _call_adaptive_llm(prompt: str, tier: Tier, max_tokens: int = 6000) -> list[dict[str, Any]]:
    provider = create_llm_provider(tier)
    is_available = getattr(provider, "is_available", None)
    if is_available and not await is_available():
        raise HTTPException(status_code=503, detail=f"{tier.value} provider is unavailable")

    messages = [
        Message(role=Role.SYSTEM, content="You are a precise adaptive quiz generator. Always respond with valid JSON only."),
        Message(role=Role.USER, content=prompt),
    ]

    result_parts: list[str] = []
    try:
        async for chunk in provider.complete(messages, tools=None, temperature=0.75, max_tokens=max_tokens):
            if chunk.type == ChunkType.CONTENT:
                result_parts.append(chunk.content)
    except HTTPException:
        raise
    except Exception as error:
        logger.warning("Adaptive generation provider failed: %s", error)
        raise HTTPException(status_code=503, detail=f"{tier.value} provider is unavailable")

    raw = _strip_json_fences("".join(result_parts))
    try:
        data = json.loads(raw)
        questions = data.get("questions", [])
        if not isinstance(questions, list):
            raise ValueError("questions must be a list")
        return questions
    except (json.JSONDecodeError, ValueError) as error:
        logger.warning("Adaptive generation returned invalid JSON: %s; raw=%s", error, raw[:500])
        raise ValueError("LLM returned invalid adaptive question JSON") from error


ADAPTIVE_LITE_BATCH_SIZE = 5
ADAPTIVE_LITE_CONTEXT_LIMIT = 5
ADAPTIVE_FULL_BATCH_SIZE = 10
ADAPTIVE_FULL_CONTEXT_LIMIT = 20


def _adaptive_batch_size_for_tier(tier: Tier) -> int:
    return ADAPTIVE_FULL_BATCH_SIZE if tier == Tier.FULL else ADAPTIVE_LITE_BATCH_SIZE


def _adaptive_context_limit_for_tier(tier: Tier) -> int:
    return ADAPTIVE_FULL_CONTEXT_LIMIT if tier == Tier.FULL else ADAPTIVE_LITE_CONTEXT_LIMIT


def _adaptive_prompt(
    req: AdaptiveQuestionsRequest,
    retry: bool = False,
    count_override: int | None = None,
    recent_override: list[str] | None = None,
    context_limit: int = ADAPTIVE_LITE_CONTEXT_LIMIT,
) -> str:
    history = [item.model_dump() for item in req.history[-context_limit:]]
    wrongs = [item.model_dump() for item in req.wrong_questions[-context_limit:]]
    suffix = "\nThe previous response was invalid or duplicated existing questions. Regenerate a fully valid, non-duplicated batch." if retry else ""
    category = (req.category or "").strip()
    return ADAPTIVE_GENERATION_PROMPT.format(
        category=category,
        topic=category.lower(),
        count=count_override or req.count,
        history_json=json.dumps(history, ensure_ascii=False, indent=2),
        wrong_json=json.dumps(wrongs, ensure_ascii=False, indent=2),
        recent_json=json.dumps((recent_override or req.recent_questions)[-context_limit:], ensure_ascii=False, indent=2),
    ) + suffix


async def _generate_lite_adaptive_questions(req: AdaptiveQuestionsRequest, category: str) -> list[AdaptiveGeneratedQuestion]:
    """Generate a Qwen-friendly Lite adaptive batch."""
    generated: list[AdaptiveGeneratedQuestion] = []
    recent_questions = list(req.recent_questions)
    batch_size = ADAPTIVE_LITE_BATCH_SIZE

    while len(generated) < req.count:
        remaining = req.count - len(generated)
        current_batch_size = min(batch_size, remaining)
        last_error: Exception | None = None

        for attempt in range(2):
            try:
                prompt = _adaptive_prompt(
                    req,
                    retry=attempt > 0,
                    count_override=current_batch_size,
                    recent_override=recent_questions,
                    context_limit=ADAPTIVE_LITE_CONTEXT_LIMIT,
                )
                raw_questions = await _call_adaptive_llm(prompt, Tier.LITE, max_tokens=2200)
                questions = _validate_adaptive_questions(
                    raw_questions,
                    category=category,
                    count=current_batch_size,
                    recent_questions=recent_questions,
                )
                generated.extend(questions)
                recent_questions.extend(question.question for question in questions)
                break
            except HTTPException:
                raise
            except Exception as error:
                last_error = error
                logger.warning(
                    "Lite adaptive batch validation failed at offset %s on attempt %s: %s",
                    len(generated),
                    attempt + 1,
                    error,
                )
        else:
            raise HTTPException(
                status_code=502,
                detail=str(last_error) if last_error else "Invalid adaptive question batch",
            )

    return generated


# ─── Endpoints ───────────────────────────────────────────────────────────────


@router.post("/from-topics", response_model=GenerateResponse)
async def generate_from_topics(req: GenerateFromTopicsRequest):
    """Generate quiz questions from a list of topics.

    Replaces: n8n topic-based generation + Cohere /api/questions
    """
    if not req.topics:
        raise HTTPException(status_code=400, detail="At least one topic is required")

    total_count = req.count * len(req.topics)
    title_context = f"\nFocus specifically on: {req.title}" if req.title else ""

    # If document_name is provided, search RAG for relevant content
    document_context = ""
    if req.document_name and req.user_id:
        try:
            from server.services.supabase_client import get_supabase_client

            client = get_supabase_client()
            if client:
                # Search using the document name + topics as query
                query = f"{req.document_name} {' '.join(req.topics)}"
                results = await client.search_documents(
                    kb_id=req.user_id, query=query, top_k=8
                )
                if results:
                    chunks = "\n---\n".join(r.get("content", "") for r in results)
                    document_context = f"\n\nUse the following content from the uploaded document '{req.document_name}' as the primary source for generating questions:\n\n{chunks}\n"
        except Exception as e:
            logger.warning(f"RAG search failed for document generation: {e}")

    prompt = TOPIC_GENERATION_PROMPT.format(
        count=total_count,
        topics=", ".join(req.topics),
        title_context=title_context + document_context,
    )

    resolved_tier = _resolve_tier(req.tier)
    questions = await _call_llm_for_questions(prompt, tier=resolved_tier)
    return GenerateResponse(questions=[GeneratedQuestion(**q) for q in questions])


@router.post("/adaptive-questions", response_model=AdaptiveQuestionsResponse)
async def generate_adaptive_questions(req: AdaptiveQuestionsRequest):
    """Generate a tier-sized adaptive same-category batch for Infinity Quiz."""
    category = (req.category or "").strip()
    if not category:
        raise HTTPException(status_code=400, detail="category is required")
    resolved_tier = _resolve_adaptive_tier(req.tier)
    expected_count = _adaptive_batch_size_for_tier(resolved_tier)
    context_limit = _adaptive_context_limit_for_tier(resolved_tier)
    if req.count != expected_count:
        raise HTTPException(status_code=400, detail=f"{resolved_tier.value} count must be {expected_count}")

    if resolved_tier == Tier.LITE:
        return AdaptiveQuestionsResponse(
            questions=await _generate_lite_adaptive_questions(req, category)
        )

    last_error: Exception | None = None
    for attempt in range(2):
        try:
            raw_questions = await _call_adaptive_llm(
                _adaptive_prompt(req, retry=attempt > 0, context_limit=context_limit),
                resolved_tier,
            )
            questions = _validate_adaptive_questions(
                raw_questions,
                category=category,
                count=req.count,
                recent_questions=req.recent_questions,
            )
            return AdaptiveQuestionsResponse(questions=questions)
        except HTTPException:
            raise
        except Exception as error:
            last_error = error
            logger.warning("Adaptive generation validation failed on attempt %s: %s", attempt + 1, error)

    raise HTTPException(status_code=502, detail=str(last_error) if last_error else "Invalid adaptive question batch")


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
