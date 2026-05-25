"""WebSearchTool — web search with citations (stub, requires API key)."""

import logging
from typing import Any

from server.tools import BaseTool

logger = logging.getLogger(__name__)


class WebSearchTool(BaseTool):
    """Searches the web for information relevant to a student's question."""

    @property
    def name(self) -> str:
        return "web_search"

    @property
    def description(self) -> str:
        return (
            "Search the web for current information on a topic. "
            "Use this when the student asks about recent events, "
            "needs up-to-date references, or when your training data "
            "may be outdated."
        )

    def parameters_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query",
                },
            },
            "required": ["query"],
        }

    async def execute(self, arguments: dict[str, Any]) -> str:
        query = arguments.get("query", "")
        if not query:
            return "No query provided."

        # TODO: Integrate with a web search API (e.g., SerpAPI, Brave Search)
        # For now, return a stub response
        logger.info(f"web_search called with query: {query}")
        return (
            f"[Web search not yet configured] "
            f"Query: '{query}' — To enable, set COACH_SEARCH_API_KEY in environment."
        )
