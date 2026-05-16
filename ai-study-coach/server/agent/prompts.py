"""System prompts and template builders for the study coach agent."""


SYSTEM_PROMPT = """You will receive structured data about the student's quiz performance. Use it to give specific, data-driven advice — reference actual quiz titles, scores, and categories. Never give generic study tips."""


AGENTIC_SYSTEM_PROMPT = """You will receive structured data about the student's quiz performance. Use it to give specific, data-driven advice.

TOOLS: You can call tools to take actions on the platform. Prefer giving advice over calling tools — only call a tool when the user explicitly asks for an action. Never call more than one tool per response. When you call a tool, explain why in one sentence.

Tool triggers:
- "show my weak areas" / "how am I doing?" → show_weakness_report
- "find math quizzes" / "quizzes about X" → search_quizzes(category="X")
- "start quiz X" / "I want to practice" → search_quizzes first, then start_quiz
- "create a quiz on X" → create_practice_quiz
- "go to dashboard" / "take me to X" → navigate_to_page
- "show results for quiz X" → show_quiz_results
- "generate questions about X" → generate_questions

Do NOT call tools for: general questions, study tips, encouragement, or chit-chat."""


def build_context_prompt(
    quiz_history: list[dict],
    weakness_report: dict | None = None,
    due_reviews: list[dict] | None = None,
) -> str:
    """Build a context message with the student's data for the LLM."""
    parts = []

    # Quiz history
    if quiz_history:
        parts.append("## Student's Quiz History")
        for attempt in quiz_history:
            title = attempt.get("quizTitle", "Unknown")
            score = attempt.get("score", "N/A")
            date = attempt.get("updatedAt", "N/A")
            parts.append(f"- **{title}**: Score {score} (on {date})")
    else:
        parts.append("## Student's Quiz History\nNo quizzes taken yet.")

    # Weakness analysis
    if weakness_report:
        parts.append("\n## Weakness Analysis")
        weakest = weakness_report.get("weakest_categories", [])
        if weakest:
            parts.append(f"- Weakest categories: {', '.join(weakest)}")

        accuracy = weakness_report.get("accuracy_by_category", {})
        if accuracy:
            parts.append("- Accuracy by category:")
            for cat, acc in sorted(accuracy.items(), key=lambda x: x[1]):
                bar = "🟩" * int(acc * 10) + "⬜" * (10 - int(acc * 10))
                parts.append(f"  - {cat}: {bar} {acc:.0%}")

        declining = weakness_report.get("declining", [])
        if declining:
            parts.append(f"- ⚠️ Declining categories: {', '.join(declining)}")

    # Due reviews (spaced repetition)
    if due_reviews:
        parts.append("\n## Quizzes Due for Review")
        for review in due_reviews:
            parts.append(
                f"- **{review['quiz_title']}** ({review['category']}) — "
                f"due {review['next_review']}"
            )

    return "\n".join(parts)


def build_messages(
    user_message: str,
    context: str,
    history: list[dict] | None = None,
    agentic: bool = False,
) -> list[dict]:
    """Build the full message list for the LLM.

    Args:
        agentic: If True, use the agentic system prompt with tool-use instructions.
    """
    system_prompt = AGENTIC_SYSTEM_PROMPT if agentic else SYSTEM_PROMPT
    messages = [{"role": "system", "content": system_prompt}]

    # Add context as a system message
    if context:
        messages.append({
            "role": "system",
            "content": f"Here is the current student data:\n\n{context}",
        })

    # Add conversation history (from frontend)
    if history:
        for msg in history:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })

    # Add the current user message
    messages.append({"role": "user", "content": user_message})

    return messages

