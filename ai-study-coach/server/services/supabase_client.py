"""Supabase client for pgvector-based RAG storage."""

import logging
from typing import Any

from server.config import settings

logger = logging.getLogger(__name__)

_client_instance = None


class SupabaseClient:
    """Wrapper for Supabase pgvector operations."""

    def __init__(self, url: str, key: str):
        self.url = url
        self.key = key
        self._client = None

    async def _get_client(self):
        if self._client is None:
            try:
                from supabase import create_client
                self._client = create_client(self.url, self.key)
            except ImportError:
                logger.error("supabase package not installed. Run: pip install supabase")
                raise
        return self._client

    async def search_documents(
        self, kb_id: str, query: str, top_k: int = 5
    ) -> list[dict[str, Any]]:
        """Search documents using pgvector similarity search."""
        from server.services.embeddings import get_embedding

        embedding = await get_embedding(query)
        if embedding is None:
            return []

        client = await self._get_client()

        # Call the Supabase RPC function for similarity search
        result = client.rpc(
            "match_documents",
            {
                "query_embedding": embedding,
                "match_count": top_k,
                "filter_kb_id": kb_id,
            },
        ).execute()

        return result.data if result.data else []

    async def store_document(
        self, kb_id: str, content: str, metadata: dict[str, Any] | None = None
    ) -> None:
        """Store a document chunk with its embedding."""
        from server.services.embeddings import get_embedding

        embedding = await get_embedding(content)
        if embedding is None:
            logger.warning("Failed to get embedding, skipping document storage")
            return

        client = await self._get_client()
        client.table("documents").insert({
            "kb_id": kb_id,
            "content": content,
            "embedding": embedding,
            "metadata": metadata or {},
        }).execute()


def get_supabase_client() -> SupabaseClient | None:
    """Get or create singleton Supabase client. Returns None if not configured."""
    global _client_instance

    url = getattr(settings, "supabase_url", "")
    key = getattr(settings, "supabase_key", "")

    if not url or not key:
        return None

    if _client_instance is None:
        _client_instance = SupabaseClient(url=url, key=key)

    return _client_instance
