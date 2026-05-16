import httpx
import logging

from server.config import settings
from server.models.schemas import (
    QuizResponse,
    TakeQuizResponse,
    QuestionResponse,
    UserQuizProfile,
)

logger = logging.getLogger(__name__)


class QuizAPIClient:
    """HTTP client wrapping the Spring Boot quiz API endpoints."""

    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or settings.quiz_api_url).rstrip("/")

    async def get_player_history(self, player_id: str) -> list[TakeQuizResponse]:
        """GET /take-quiz/player/{playerId} — all quiz attempts + scores."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/take-quiz/player/{player_id}",
                timeout=10,
            )
            if resp.status_code == 404:
                return []
            resp.raise_for_status()
            return [TakeQuizResponse(**item) for item in resp.json()]

    async def get_quiz_details(self, quiz_id: str) -> QuizResponse | None:
        """GET /quiz/{id} — quiz title, categories, description."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/quiz/{quiz_id}",
                timeout=10,
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return QuizResponse(**resp.json())

    async def get_questions(self, quiz_id: str) -> list[QuestionResponse]:
        """GET /question/quizId/{quizId} — questions + correct answers."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/question/quizId/{quiz_id}",
                timeout=10,
            )
            if resp.status_code == 404:
                return []
            resp.raise_for_status()
            return [QuestionResponse(**item) for item in resp.json()]

    async def get_quiz_profile(self, user_id: str) -> UserQuizProfile | None:
        """GET /user/quiz-profile?userId={userId} — created + taken quizzes."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/user/quiz-profile",
                params={"userId": user_id},
                timeout=10,
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return UserQuizProfile(**resp.json())


# Singleton instance
quiz_client = QuizAPIClient()
