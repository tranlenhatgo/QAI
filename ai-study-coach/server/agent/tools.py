"""Tool definitions for the agentic study coach.

Each tool is defined in OpenAI function-calling format so it works
with both Groq and Google Gemini via their OpenAI-compatible endpoints.
"""

# All available tools the coach can use
TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "navigate_to_page",
            "description": (
                "Navigate the student to a specific page on the quiz platform. "
                "Use this when the student asks to go somewhere, wants to see their "
                "dashboard, quiz list, or profile."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "page": {
                        "type": "string",
                        "enum": [
                            "dashboard",
                            "quiz_list",
                            "create_quiz",
                            "profile",
                            "review",
                        ],
                        "description": "The page to navigate to.",
                    }
                },
                "required": ["page"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "start_quiz",
            "description": (
                "Start a specific quiz for the student. Use this when the student "
                "wants to practice or retake a quiz. You must have a valid quiz_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "quiz_id": {
                        "type": "string",
                        "description": "The ID of the quiz to start.",
                    }
                },
                "required": ["quiz_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_questions",
            "description": (
                "Generate AI-powered practice questions on specific topics. "
                "Use this when the student wants custom practice questions on "
                "particular subjects."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "topics": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of topics to generate questions for.",
                    }
                },
                "required": ["topics"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "show_quiz_results",
            "description": (
                "Show the results of a specific quiz attempt. Use this when "
                "the student wants to review their answers or see how they did."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "quiz_id": {
                        "type": "string",
                        "description": "The ID of the quiz to show results for.",
                    }
                },
                "required": ["quiz_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_practice_quiz",
            "description": (
                "Create a new practice quiz targeting specific weak categories. "
                "Use this when you want to help the student practice their weak areas "
                "by setting up a dedicated quiz."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Title for the new practice quiz.",
                    },
                    "categories": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Categories/topics the quiz should cover.",
                    },
                },
                "required": ["title", "categories"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "show_weakness_report",
            "description": (
                "Display the student's weakness analysis report showing accuracy "
                "by category, weakest areas, and declining trends. Use this when "
                "the student asks about their weak points or progress."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_quizzes",
            "description": (
                "Search for available quizzes by category or topic. Use this "
                "to find relevant quizzes the student can take for practice."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "The category or topic to search quizzes for.",
                    }
                },
                "required": ["category"],
            },
        },
    },
]


def get_tool_definitions() -> list[dict]:
    """Return all tool definitions for use in LLM function-calling."""
    return TOOL_DEFINITIONS


def get_tool_names() -> list[str]:
    """Return list of all tool names."""
    return [t["function"]["name"] for t in TOOL_DEFINITIONS]
