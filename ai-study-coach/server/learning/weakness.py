"""Weakness analysis engine — algorithmic, no AI needed."""

import logging
from server.models.schemas import WeaknessReport, TakeQuizResponse
from server.quiz_client.client import quiz_client

logger = logging.getLogger(__name__)


def _parse_score(score: str) -> tuple[int, int]:
    """Parse score string like '3/5' into (correct, total)."""
    try:
        parts = score.split("/")
        return int(parts[0]), int(parts[1])
    except (ValueError, IndexError):
        return 0, 0


async def analyze_weaknesses(
    user_id: str,
    quiz_history: list[dict] | None = None,
) -> WeaknessReport | None:
    """
    Analyze quiz history to find weak categories.

    Algorithm:
    1. For each quiz attempt, fetch the quiz to get its categories
    2. Aggregate scores by category
    3. Calculate accuracy per category
    4. Detect declining trends (last 3 attempts getting worse)
    """
    # Fetch history if not provided
    if quiz_history is None:
        history = await quiz_client.get_player_history(user_id)
        quiz_history = [h.model_dump() for h in history]

    if not quiz_history:
        return None

    # Aggregate by category: {category: [(correct, total, date), ...]}
    category_scores: dict[str, list[tuple[int, int, str]]] = {}

    for attempt in quiz_history:
        quiz_id = attempt.get("quizId", "")
        score_str = attempt.get("score", "0/0")
        date = attempt.get("updatedAt", "")
        correct, total = _parse_score(score_str)

        if total == 0:
            continue

        # Fetch quiz details to get categories
        try:
            quiz = await quiz_client.get_quiz_details(quiz_id)
            categories = quiz.categories if quiz and quiz.categories else ["GENERAL"]
        except Exception:
            categories = ["GENERAL"]

        for cat in categories:
            if cat not in category_scores:
                category_scores[cat] = []
            category_scores[cat].append((correct, total, date))

    if not category_scores:
        return WeaknessReport(
            weakest_categories=[],
            accuracy_by_category={},
            declining=[],
        )

    # Calculate accuracy per category
    accuracy_by_category: dict[str, float] = {}
    for cat, scores in category_scores.items():
        total_correct = sum(s[0] for s in scores)
        total_questions = sum(s[1] for s in scores)
        accuracy_by_category[cat] = (
            total_correct / total_questions if total_questions > 0 else 0.0
        )

    # Find weakest categories (below 60% accuracy)
    weakest = [
        cat
        for cat, acc in sorted(accuracy_by_category.items(), key=lambda x: x[1])
        if acc < 0.6
    ]

    # Detect declining trends: compare last 2 attempts vs previous 2
    declining = []
    for cat, scores in category_scores.items():
        if len(scores) >= 4:
            # Sort by date (most recent last)
            sorted_scores = sorted(scores, key=lambda s: s[2])
            recent = sorted_scores[-2:]
            previous = sorted_scores[-4:-2]

            recent_acc = sum(s[0] for s in recent) / max(sum(s[1] for s in recent), 1)
            prev_acc = sum(s[0] for s in previous) / max(
                sum(s[1] for s in previous), 1
            )

            if recent_acc < prev_acc - 0.1:  # 10% decline threshold
                declining.append(cat)

    return WeaknessReport(
        weakest_categories=weakest,
        accuracy_by_category=accuracy_by_category,
        declining=declining,
    )
