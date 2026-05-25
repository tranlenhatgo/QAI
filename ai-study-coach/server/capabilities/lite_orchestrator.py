"""LiteOrchestrator — code-driven workflows for Lite tier agentic mode."""

import logging
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from enum import Enum

from server.llm.base import ChunkType, LLMService, Message, Role
from server.quiz_client.client import QuizAPIClient
from server.tools.registry import create_lite_registry
from server.ws import content_chunk, stage_event, tool_event

logger = logging.getLogger(__name__)

LITE_SYSTEM_PROMPT = """You are an AI Study Coach (Lite mode).
You have limited capabilities but can still help students effectively.

You can:
- Answer questions about study topics
- Look up quiz history to identify weak areas
- Provide study recommendations

Keep answers concise since you're running on a local model with limited context."""


# ─── Intent Classification ───────────────────────────────────────────────────


class Intent(str, Enum):
    GENERAL_CHAT = "general_chat"
    WEAKNESS_ANALYSIS = "weakness"
    QUIZ_RECOMMEND = "recommend"
    EXPLAIN_TOPIC = "explain"
    QUIZ_REQUEST = "quiz"
    SOLVE_PROBLEM = "solve"


@dataclass
class IntentResult:
    intent: Intent
    confidence: float = 0.0
    extracted_params: dict = field(default_factory=dict)


class IntentClassifier:
    """Rule-based intent classification. No LLM needed — fast and deterministic."""

    PATTERNS: dict[Intent, list[str]] = {
        Intent.WEAKNESS_ANALYSIS: [
            r"weak\s*(point|area|spot|ness)",
            r"what.*(struggle|bad at|improve|failing)",
            r"(my|which).*(mistakes|errors|wrong)",
            r"(analyze|review).*(performance|results|history)",
            r"where.*(need|should).*(improve|focus|work)",
        ],
        Intent.QUIZ_RECOMMEND: [
            r"(what|which).*(should|can|do).*(study|review|practice|take)",
            r"recommend.*(quiz|topic|subject|study)",
            r"(next|suggest).*(quiz|topic|study|lesson)",
            r"what.*(next|focus on)",
        ],
        Intent.EXPLAIN_TOPIC: [
            r"explain\s+",
            r"what\s+(is|are|does|do)\s+",
            r"how\s+(does|do|is|are)\s+",
            r"(tell|teach)\s+me\s+about",
            r"(define|describe|clarify)\s+",
        ],
        Intent.QUIZ_REQUEST: [
            r"quiz\s+me",
            r"(test|assess|check)\s+(my|me)",
            r"(give|create|generate|make).*(quiz|question|test)",
            r"practice\s+question",
        ],
        Intent.SOLVE_PROBLEM: [
            r"solve\s+",
            r"(calculate|compute|find|determine)\s+",
            r"(how|help).*(solve|answer|work out)",
            r"step.*(by|-).*step",
        ],
    }

    def classify(self, text: str) -> IntentResult:
        text_lower = text.lower().strip()
        best_intent = Intent.GENERAL_CHAT
        best_confidence = 0.0

        for intent, patterns in self.PATTERNS.items():
            matches = sum(1 for p in patterns if re.search(p, text_lower))
            if matches > 0:
                confidence = min(0.95, 0.5 + matches * 0.15)
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_intent = intent

        extracted_params = self._extract_params(text_lower, best_intent)
        return IntentResult(intent=best_intent, confidence=best_confidence, extracted_params=extracted_params)

    def _extract_params(self, text: str, intent: Intent) -> dict:
        params: dict = {}
        topic_match = re.search(
            r"(?:explain|about|on|quiz me on|study|review|solve)\s+(.+?)(?:\?|$|\.)",
            text,
        )
        if topic_match:
            params["topic"] = topic_match.group(1).strip()

        subjects = ["math", "physics", "chemistry", "biology", "history", "english", "computer science"]
        for subject in subjects:
            if subject in text:
                params["subject"] = subject
                break
        return params


# ─── Orchestrator ────────────────────────────────────────────────────────────


class LiteOrchestrator:
    """Lite-tier agentic: intent classification → code-driven tool calls → LLM response."""

    def __init__(self, provider: LLMService, user_id: str = ""):
        self.llm = provider
        self.user_id = user_id
        self.registry = create_lite_registry(user_id=user_id)
        self.classifier = IntentClassifier()
        self.quiz_client = QuizAPIClient()

    def tool_names(self) -> list[str]:
        return ["weakness_analysis", "recommendations", "explain", "quiz", "solve"]

    async def run(
        self,
        messages: list[Message],
        on_event: Callable[[dict], Awaitable[None]],
        cancelled: Callable[[], bool],
    ) -> None:
        user_message = messages[-1].content if messages else ""
        intent_result = self.classifier.classify(user_message)

        if intent_result.intent == Intent.GENERAL_CHAT:
            await self._simple_chat(messages, on_event, cancelled)

        elif intent_result.intent == Intent.WEAKNESS_ANALYSIS:
            await self._weakness_workflow(messages, intent_result, on_event, cancelled)

        elif intent_result.intent == Intent.QUIZ_RECOMMEND:
            await self._recommend_workflow(messages, intent_result, on_event, cancelled)

        elif intent_result.intent == Intent.EXPLAIN_TOPIC:
            await self._simple_chat(messages, on_event, cancelled)

        elif intent_result.intent == Intent.QUIZ_REQUEST:
            await self._simple_chat(messages, on_event, cancelled)

        elif intent_result.intent == Intent.SOLVE_PROBLEM:
            await self._simple_chat(messages, on_event, cancelled)

        else:
            await self._simple_chat(messages, on_event, cancelled)

    async def _weakness_workflow(
        self,
        messages: list[Message],
        intent_result: IntentResult,
        on_event: Callable[[dict], Awaitable[None]],
        cancelled: Callable[[], bool],
    ) -> None:
        """Fetch quiz history → build analysis prompt → LLM analyzes."""
        await on_event(stage_event("fetching_data", "start"))

        quiz_history = ""
        try:
            history = await self.quiz_client.get_quiz_history(user_id=self.user_id, limit=20)
            quiz_history = str(history) if history else "No quiz history available."
        except Exception as e:
            quiz_history = f"Could not fetch quiz history: {e}"

        await on_event(stage_event("fetching_data", "end"))

        if cancelled():
            return

        await on_event(stage_event("analyzing", "start"))

        subject = intent_result.extracted_params.get("subject", "all subjects")
        analysis_prompt = f"""Analyze this student's quiz history and identify their weak areas.

Quiz History (last 20 results):
{quiz_history}

Student's question: {messages[-1].content}
Focus area: {subject}

Provide:
1. Top 3 weak areas (with evidence from quiz scores)
2. Specific topics to review
3. Recommended study strategy
4. Encouragement based on their progress

Be specific — reference actual quiz scores and topics."""

        full_messages = [
            Message(role=Role.SYSTEM, content="You are a supportive study coach analyzing a student's performance."),
            Message(role=Role.USER, content=analysis_prompt),
        ]

        response_content = ""
        async for chunk in self.llm.complete(full_messages, tools=None):
            if cancelled():
                break
            if chunk.type == ChunkType.CONTENT:
                response_content += chunk.content
                await on_event(content_chunk(chunk.content))

        await on_event(stage_event("analyzing", "end"))
        messages.append(Message(role=Role.ASSISTANT, content=response_content))

    async def _recommend_workflow(
        self,
        messages: list[Message],
        intent_result: IntentResult,
        on_event: Callable[[dict], Awaitable[None]],
        cancelled: Callable[[], bool],
    ) -> None:
        """Fetch quiz history → build recommendation prompt → LLM recommends."""
        await on_event(stage_event("fetching_data", "start"))

        quiz_history = ""
        try:
            history = await self.quiz_client.get_quiz_history(user_id=self.user_id, limit=10)
            quiz_history = str(history) if history else "No quiz history available."
        except Exception as e:
            quiz_history = f"Could not fetch quiz history: {e}"

        await on_event(stage_event("fetching_data", "end"))

        if cancelled():
            return

        await on_event(stage_event("recommending", "start"))

        goal = intent_result.extracted_params.get("topic", "general improvement")
        prompt = f"""Based on this student's history, recommend what they should study next.

Recent Quiz History:
{quiz_history}

Student's goal: {goal}

Recommend 3-5 specific actions (quizzes to take, topics to review).
For each recommendation, explain WHY based on their history."""

        full_messages = [
            Message(role=Role.SYSTEM, content="You are a study advisor making personalized recommendations."),
            Message(role=Role.USER, content=prompt),
        ]

        response_content = ""
        async for chunk in self.llm.complete(full_messages, tools=None):
            if cancelled():
                break
            if chunk.type == ChunkType.CONTENT:
                response_content += chunk.content
                await on_event(content_chunk(chunk.content))

        await on_event(stage_event("recommending", "end"))
        messages.append(Message(role=Role.ASSISTANT, content=response_content))

    async def _simple_chat(
        self,
        messages: list[Message],
        on_event: Callable[[dict], Awaitable[None]],
        cancelled: Callable[[], bool],
    ) -> None:
        """Fallback: just chat with the LLM, no data gathering."""
        await on_event(stage_event("responding", "start"))

        full_messages = [
            Message(role=Role.SYSTEM, content=LITE_SYSTEM_PROMPT),
            *messages[-10:],
        ]

        response_content = ""
        async for chunk in self.llm.complete(full_messages, tools=None):
            if cancelled():
                break
            if chunk.type == ChunkType.CONTENT:
                response_content += chunk.content
                await on_event(content_chunk(chunk.content))

        await on_event(stage_event("responding", "end"))
        messages.append(Message(role=Role.ASSISTANT, content=response_content))
