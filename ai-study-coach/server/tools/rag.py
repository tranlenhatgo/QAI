"""RAGTool — retrieval-augmented generation from knowledge base."""

import logging
from typing import Any

from server.tools import BaseTool

logger = logging.getLogger(__name__)


class RAGTool(BaseTool):
    """Retrieves relevant content from the student's knowledge base."""

    def __init__(self, kb_id: str = ""):
        self.kb_id = kb_id

    @property
    def name(self) -> str:
        return "rag"

    @property
    def description(self) -> str:
        return (
            "Search the student's uploaded course materials (textbooks, notes, slides) "
            "for relevant information. Use this to ground your answers in the student's "
            "actual curriculum."
        )

    def parameters_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to find relevant passages",
                },
                "top_k": {
                    "type": "integer",
                    "description": "Number of results to return (default 5)",
                },
            },
            "required": ["query"],
        }

    async def execute(self, arguments: dict[str, Any]) -> str:
        query = arguments.get("query", "")
        top_k = arguments.get("top_k", 5)

        if not self.kb_id:
            return "No knowledge base configured for this session."

        try:
            from server.services.supabase_client import get_supabase_client

            client = get_supabase_client()
            if client is None:
                return "RAG not available: Supabase not configured."

            results = await client.search_documents(
                kb_id=self.kb_id, query=query, top_k=top_k
            )
            if not results:
                return f"No relevant information found in study materials for: '{query}'"

            return self._format_results(results, query)

        except Exception as e:
            logger.error(f"RAG tool error: {e}")
            return f"RAG search failed: {e}"

    def _format_results(self, results: list[dict], query: str) -> str:
        """Format retrieved chunks for LLM consumption."""
        lines = [f"Found {len(results)} relevant passages for '{query}':\n"]

        for i, r in enumerate(results, 1):
            metadata = r.get("metadata", {})
            source = metadata.get("filename", "Unknown")
            page = metadata.get("page_number", "")
            section = metadata.get("section_title", "")
            similarity = r.get("similarity", 0)

            header = f"[{i}] Source: {source}"
            if page:
                header += f", Page {page}"
            if section:
                header += f", Section: {section}"

            lines.append(header)
            lines.append(r.get("content", "")[:300])
            if similarity:
                lines.append(f"(Relevance: {similarity:.0%})\n")
            else:
                lines.append("")

        return "\n".join(lines)
