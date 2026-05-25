"""Tool registry — discovers and provides tools."""

from server.tools import BaseTool
from server.tools.quiz_history import QuizHistoryTool
from server.tools.recommend import RecommendTool
from server.tools.reason import ReasonTool
from server.tools.web_search import WebSearchTool


class ToolRegistry:
    """Holds available tool instances and provides them to capabilities."""

    def __init__(self, tools: list[BaseTool]):
        self._tools = {t.name: t for t in tools}

    def get(self, name: str) -> BaseTool | None:
        return self._tools.get(name)

    def all_tools(self) -> list[BaseTool]:
        return list(self._tools.values())

    def all_definitions(self) -> list:
        """Return ToolDefinition list for passing to LLM."""
        return [t.definition() for t in self._tools.values()]

    def tool_names(self) -> list[str]:
        return list(self._tools.keys())


def create_full_registry(user_id: str = "", kb_id: str = "") -> ToolRegistry:
    """Create registry with all available tools for Full tier."""
    tools: list[BaseTool] = [
        QuizHistoryTool(user_id=user_id),
        RecommendTool(),
        ReasonTool(),
        WebSearchTool(),
    ]

    # Add RAG tool if kb_id provided
    if kb_id:
        from server.tools.rag import RAGTool
        tools.append(RAGTool(kb_id=kb_id))

    return ToolRegistry(tools)

def create_lite_registry(user_id: str = "") -> ToolRegistry:
    """Create registry with limited tools for Lite tier."""
    tools: list[BaseTool] = [
        QuizHistoryTool(user_id=user_id),
        RecommendTool(),
    ]
    return ToolRegistry(tools)
