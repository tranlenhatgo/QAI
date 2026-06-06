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
                profile_resp = await client.get(
                    f"{self.base_url}/user/quiz-profile",
                    params={"userId": player_id},
                    timeout=10,
                )
                if profile_resp.status_code == 404:
                    return []
                profile_resp.raise_for_status()
                return [
                    TakeQuizResponse(**item)
                    for item in profile_resp.json().get("quizzesTaken", [])
                ]
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

    async def get_quiz_history(
        self, user_id: str, limit: int = 10, category: str | None = None
    ) -> list[dict]:
        """Fetch quiz history for the tool interface. Returns simplified dicts."""
        attempts = await self.get_player_history(user_id)
        if not attempts:
            return []

        results = []
        for attempt in attempts[:limit]:
            entry = {
                "quiz_id": attempt.quizId,
                "title": attempt.quizTitle,
                "score": attempt.score,
                "status": attempt.status,
                "date": attempt.updatedAt,
            }
            # Filter by category if requested
            if category:
                details = await self.get_quiz_details(attempt.quizId)
                if details and details.categories:
                    if category.lower() not in [c.lower() for c in details.categories]:
                        continue
                    entry["categories"] = details.categories
            results.append(entry)

        return results


# Singleton instance
quiz_client = QuizAPIClient()
