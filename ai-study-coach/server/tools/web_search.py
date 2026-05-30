"""WebSearchTool — DuckDuckGo search integration."""

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

        logger.info(f"web_search: querying DuckDuckGo for '{query}'")

        try:
            from ddgs import DDGS

            ddgs = DDGS()
            results = list(ddgs.text(query, max_results=5))

            if not results:
                return f"No results found for: '{query}'"

            formatted = []
            for i, r in enumerate(results, 1):
                title = r.get("title", "No title")
                body = r.get("body", "").strip()
                href = r.get("href", "")
                formatted.append(f"{i}. **{title}**\n   {body}\n   Source: {href}")

            return f"Search results for '{query}':\n\n" + "\n\n".join(formatted)

        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return f"Search failed: {str(e)}"
