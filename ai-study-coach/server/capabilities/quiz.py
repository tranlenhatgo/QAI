"""QuizGenerator capability — generates quiz questions from context."""

import json
import logging
from collections.abc import Awaitable, Callable

from server.llm.base import ChunkType, LLMService, Message, Role
from server.ws import content_chunk, stage_event

logger = logging.getLogger(__name__)

PLAN_PROMPT = """Analyze the topic and plan quiz questions. Output a JSON array of objects:
[{"topic": "...", "difficulty": "easy|medium|hard", "type": "multiple_choice|true_false|short_answer"}]

Plan {num_questions} questions covering the key concepts. Vary difficulty."""

GENERATE_PROMPT = """Generate quiz questions based on this plan:
{plan}

For each planned question, create:
- "question": the question text
- "options": array of 4 options (for multiple choice) or ["True", "False"]
- "correct_answer": the correct option text
- "explanation": brief explanation of why this is correct

Output as a JSON array."""


class QuizGenerator:
    """Multi-stage quiz generation: plan → generate → validate."""

    def __init__(self, provider: LLMService, user_id: str = ""):
        self.llm = provider
        self.user_id = user_id

    def tool_names(self) -> list[str]:
        return []

    async def run(
        self,
        messages: list[Message],
        on_event: Callable[[dict], Awaitable[None]],
        cancelled: Callable[[], bool],
    ) -> None:
        # Extract topic from last user message
        topic = messages[-1].content if messages else "general knowledge"
        num_questions = 5

        # Stage 1: Plan
        await on_event(stage_event("planning", "start"))
        plan = await self._generate_plan(topic, num_questions, cancelled)
        await on_event(stage_event("planning", "end"))

        if cancelled() or not plan:
            return

        # Stage 2: Generate
        await on_event(stage_event("generating", "start"))
        questions = await self._generate_questions(plan, cancelled, on_event)
        await on_event(stage_event("generating", "end"))

        if cancelled():
            return

        # Stage 3: Format and send
        await on_event(stage_event("validating", "start"))
        result = self._format_output(questions)
        await on_event(content_chunk(result))
        await on_event(stage_event("validating", "end"))

        messages.append(Message(role=Role.ASSISTANT, content=result))

    async def _generate_plan(
        self, topic: str, num_questions: int, cancelled: Callable[[], bool]
    ) -> str:
        messages = [
            Message(role=Role.SYSTEM, content=PLAN_PROMPT.format(num_questions=num_questions)),
            Message(role=Role.USER, content=f"Topic: {topic}"),
        ]
        parts: list[str] = []
        async for chunk in self.llm.complete(messages, tools=None, temperature=0.5):
            if cancelled():
                break
            if chunk.type == ChunkType.CONTENT:
                parts.append(chunk.content)
        return "".join(parts)

    async def _generate_questions(
        self, plan: str, cancelled: Callable[[], bool], on_event: Callable[[dict], Awaitable[None]]
    ) -> str:
        messages = [
            Message(role=Role.SYSTEM, content=GENERATE_PROMPT.format(plan=plan)),
            Message(role=Role.USER, content="Generate the questions now."),
        ]
        parts: list[str] = []
        async for chunk in self.llm.complete(messages, tools=None, temperature=0.3):
            if cancelled():
                break
            if chunk.type == ChunkType.CONTENT:
                parts.append(chunk.content)
        return "".join(parts)

    def _format_output(self, raw_questions: str) -> str:
        """Try to parse and reformat, or return raw."""
        try:
            questions = json.loads(raw_questions)
            lines = [f"## Generated Quiz ({len(questions)} questions)\n"]
            for i, q in enumerate(questions, 1):
                lines.append(f"**Q{i}.** {q.get('question', '?')}")
                opts = q.get("options", [])
                for j, opt in enumerate(opts):
                    prefix = "  " + chr(65 + j) + ")"
                    lines.append(f"{prefix} {opt}")
                lines.append(f"  *Answer: {q.get('correct_answer', '?')}*")
                lines.append(f"  *Explanation: {q.get('explanation', '')}*\n")
            return "\n".join(lines)
        except (json.JSONDecodeError, TypeError):
            return raw_questions
