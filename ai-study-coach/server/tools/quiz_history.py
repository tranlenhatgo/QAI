"""QuizHistoryTool — fetches user's quiz history from Spring Boot backend."""

import logging
from typing import Any

from server.tools import BaseTool

logger = logging.getLogger(__name__)


class QuizHistoryTool(BaseTool):
    """Retrieves a student's quiz history and performance data."""

    def __init__(self, user_id: str = ""):
        self.user_id = user_id

    @property
    def name(self) -> str:
        return "quiz_history"

    @property
    def description(self) -> str:
        return (
            "Fetch the student's quiz history including scores, categories, "
            "and recent performance. Use this to understand what the student "
            "has studied and where they need help."
        )

    def parameters_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Max number of recent quizzes to return (default 10)",
                },
                "category": {
                    "type": "string",
                    "description": "Filter by category (optional)",
                },
            },
            "required": [],
        }

    async def execute(self, arguments: dict[str, Any]) -> str:
        from server.quiz_client.client import QuizAPIClient

        limit = arguments.get("limit", 10)
        category = arguments.get("category")

        try:
            client = QuizAPIClient()
            history = await client.get_quiz_history(
                user_id=self.user_id, limit=limit, category=category
            )
            if not history:
                return "No quiz history found for this student."
            return str(history)
        except Exception as e:
            logger.error(f"quiz_history tool error: {e}")
            return f"Error fetching quiz history: {e}"
