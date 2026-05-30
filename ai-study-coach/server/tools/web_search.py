"""WebSearchTool — Google Custom Search integration."""

import logging
from typing import Any

import httpx

from server.config import settings
from server.tools import BaseTool

logger = logging.getLogger(__name__)

GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"


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

        if not settings.search_api_key or not settings.search_cx:
            logger.warning("Web search not configured: missing COACH_SEARCH_API_KEY or COACH_SEARCH_CX")
            return (
                f"[Web search not configured] "
                f"Query: '{query}' — Set COACH_SEARCH_API_KEY and COACH_SEARCH_CX in environment."
            )

        logger.info(f"web_search: querying Google for '{query}'")

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    GOOGLE_SEARCH_URL,
                    params={
                        "key": settings.search_api_key,
                        "cx": settings.search_cx,
                        "q": query,
                        "num": 5,
                    },
                )
                resp.raise_for_status()
                data = resp.json()

            items = data.get("items", [])
            if not items:
                return f"No results found for: '{query}'"

            results = []
            for i, item in enumerate(items, 1):
                title = item.get("title", "No title")
                link = item.get("link", "")
                snippet = item.get("snippet", "").replace("\n", " ").strip()
                results.append(f"{i}. **{title}**\n   {snippet}\n   Source: {link}")

            return f"Search results for '{query}':\n\n" + "\n\n".join(results)

        except httpx.HTTPStatusError as e:
            logger.error(f"Google Search API error: {e.response.status_code} — {e.response.text[:200]}")
            return f"Search failed (HTTP {e.response.status_code}). Please try again."
        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return f"Search failed: {str(e)}"
