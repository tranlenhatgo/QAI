"""RecommendTool — suggests study topics based on quiz performance."""

from typing import Any

from server.tools import BaseTool


class RecommendTool(BaseTool):
    """Generates study recommendations based on available data."""

    @property
    def name(self) -> str:
        return "recommend"

    @property
    def description(self) -> str:
        return (
            "Suggest study topics or strategies based on the student's "
            "quiz history and identified weak areas. Call this after "
            "analyzing quiz_history results to give actionable advice."
        )

    def parameters_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "weak_categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Categories where the student scored poorly",
                },
                "recent_score_pct": {
                    "type": "number",
                    "description": "Recent average score as a percentage (0-100)",
                },
            },
            "required": ["weak_categories"],
        }

    async def execute(self, arguments: dict[str, Any]) -> str:
        weak = arguments.get("weak_categories", [])
        score_pct = arguments.get("recent_score_pct")

        if not weak:
            return "No weak categories identified. The student seems to be doing well overall."

        lines = ["Based on the student's performance, here are recommendations:\n"]
        for cat in weak:
            lines.append(f"- **{cat}**: Focus on foundational concepts. Review notes and attempt practice problems.")

        if score_pct is not None and score_pct < 50:
            lines.append("\n⚠️ Overall score is below 50%. Recommend revisiting basics before attempting more quizzes.")
        elif score_pct is not None and score_pct < 75:
            lines.append("\nScore is moderate. Targeted practice on weak areas should improve results.")

        return "\n".join(lines)
