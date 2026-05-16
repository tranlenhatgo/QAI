"""Tool executor — runs tool calls and returns results + frontend actions."""

import logging

from server.models.schemas import AgentAction, ToolCall
from server.quiz_client.client import quiz_client

logger = logging.getLogger(__name__)


async def execute_tool(
    tool_call: ToolCall,
    user_id: str,
    weakness_data: dict | None = None,
) -> tuple[str, AgentAction | None]:
    """Execute a tool call.

    Returns:
        (result_text, optional_frontend_action)
        - result_text is fed back to the LLM as the tool result
        - AgentAction (if any) is sent to the frontend for execution
    """
    name = tool_call.name
    args = tool_call.arguments

    try:
        match name:
            case "navigate_to_page":
                return await _navigate_to_page(args)

            case "start_quiz":
                return await _start_quiz(args, user_id)

            case "generate_questions":
                return await _generate_questions(args)

            case "show_quiz_results":
                return await _show_quiz_results(args)

            case "create_practice_quiz":
                return await _create_practice_quiz(args, user_id)

            case "show_weakness_report":
                return await _show_weakness_report(weakness_data)

            case "search_quizzes":
                return await _search_quizzes(args, user_id)

            case _:
                return f"Unknown tool: {name}", None

    except Exception as e:
        logger.error(f"Tool execution failed for '{name}': {e}")
        return f"Tool '{name}' failed: {str(e)}", None


# ─── Tool Implementations ────────────────────────────────────────────────────


async def _navigate_to_page(args: dict) -> tuple[str, AgentAction | None]:
    """Navigate user to a page on the platform."""
    page = args.get("page", "dashboard")
    action = AgentAction(
        action="navigate",
        params={"page": page},
        label=f"Navigating to {page.replace('_', ' ')}",
    )
    return f"Navigating user to the {page.replace('_', ' ')} page.", action


async def _start_quiz(args: dict, user_id: str) -> tuple[str, AgentAction | None]:
    """Start a specific quiz for the user."""
    quiz_id = args.get("quiz_id", "")
    if not quiz_id:
        return "No quiz_id provided.", None

    # Verify quiz exists
    try:
        quiz = await quiz_client.get_quiz_details(quiz_id)
        if not quiz:
            return f"Quiz with ID '{quiz_id}' not found.", None
    except Exception:
        return f"Could not verify quiz '{quiz_id}'. Starting anyway.", None

    title = quiz.title or "Untitled Quiz"
    action = AgentAction(
        action="start_quiz",
        params={"quiz_id": quiz_id, "title": title},
        label=f"Starting quiz: {title}",
    )
    return f"Starting quiz '{title}' (ID: {quiz_id}) for the student.", action


async def _generate_questions(args: dict) -> tuple[str, AgentAction | None]:
    """Generate AI questions on given topics."""
    topics = args.get("topics", [])
    if not topics:
        return "No topics provided for question generation.", None

    action = AgentAction(
        action="generate_questions",
        params={"topics": topics},
        label=f"Generating questions on: {', '.join(topics)}",
    )
    return (
        f"Generating practice questions on: {', '.join(topics)}. "
        "The student will be able to practice these topics."
    ), action


async def _show_quiz_results(args: dict) -> tuple[str, AgentAction | None]:
    """Show results for a specific quiz."""
    quiz_id = args.get("quiz_id", "")
    if not quiz_id:
        return "No quiz_id provided.", None

    action = AgentAction(
        action="show_quiz_results",
        params={"quiz_id": quiz_id},
        label="Showing quiz results",
    )
    return f"Showing results for quiz ID: {quiz_id}.", action


async def _create_practice_quiz(
    args: dict, user_id: str
) -> tuple[str, AgentAction | None]:
    """Create a new practice quiz for weak categories."""
    title = args.get("title", "Practice Quiz")
    categories = args.get("categories", [])
    if not categories:
        return "No categories provided for the practice quiz.", None

    action = AgentAction(
        action="create_practice_quiz",
        params={
            "title": title,
            "categories": categories,
            "user_id": user_id,
        },
        label=f"Creating quiz: {title}",
    )
    return (
        f"Creating a practice quiz titled '{title}' "
        f"covering: {', '.join(categories)}."
    ), action


async def _show_weakness_report(
    weakness_data: dict | None,
) -> tuple[str, AgentAction | None]:
    """Show the student's weakness analysis inline."""
    if not weakness_data:
        return (
            "No weakness data available yet. The student needs to take "
            "some quizzes first before we can analyze their weak areas."
        ), None

    # Build a text summary for the LLM
    parts = ["Weakness report for the student:"]

    weakest = weakness_data.get("weakest_categories", [])
    if weakest:
        parts.append(f"- Weakest categories: {', '.join(weakest)}")

    accuracy = weakness_data.get("accuracy_by_category", {})
    if accuracy:
        parts.append("- Accuracy by category:")
        for cat, acc in sorted(accuracy.items(), key=lambda x: x[1]):
            parts.append(f"  - {cat}: {acc:.0%}")

    declining = weakness_data.get("declining", [])
    if declining:
        parts.append(f"- Declining categories: {', '.join(declining)}")

    action = AgentAction(
        action="show_weakness_report",
        params={"weakness_data": weakness_data},
        label="Showing weakness analysis",
    )
    return "\n".join(parts), action


async def _search_quizzes(
    args: dict, user_id: str
) -> tuple[str, AgentAction | None]:
    """Search for quizzes by category."""
    category = args.get("category", "")
    if not category:
        return "No category provided for quiz search.", None

    # Fetch user's quiz profile and filter by category
    try:
        profile = await quiz_client.get_quiz_profile(user_id)
        if not profile:
            return "Could not fetch quiz profile.", None

        matching = []
        for quiz in profile.quizzesCreated:
            if quiz.categories and category.lower() in [
                c.lower() for c in quiz.categories
            ]:
                matching.append(
                    {"id": quiz.id, "title": quiz.title, "categories": quiz.categories}
                )

        if matching:
            quiz_list = "\n".join(
                f"- {q['title']} (ID: {q['id']}, categories: {', '.join(q['categories'] or [])})"
                for q in matching
            )
            action = AgentAction(
                action="search_quizzes",
                params={"category": category, "results": matching},
                label=f"Found {len(matching)} quiz(es) for '{category}'",
            )
            return (
                f"Found {len(matching)} quiz(es) matching '{category}':\n{quiz_list}"
            ), action
        else:
            return (
                f"No quizzes found matching category '{category}'. "
                "You could suggest creating a practice quiz instead."
            ), None

    except Exception as e:
        logger.error(f"Quiz search failed: {e}")
        return f"Quiz search failed: {str(e)}", None
