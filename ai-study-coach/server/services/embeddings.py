"""Embedding service — generates vector embeddings for RAG."""

import logging
from typing import Any

import httpx

from server.config import settings

logger = logging.getLogger(__name__)


async def get_embedding(text: str) -> list[float] | None:
    """Generate embedding for text using the configured provider.

    Tries LM Studio's embedding endpoint first, falls back to None.
    """
    if not text.strip():
        return None

    # Try LM Studio embedding endpoint
    url = f"{settings.lm_studio_url.rstrip('/')}/v1/embeddings"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url,
                json={"input": text, "model": settings.embedding_model},
            )
            if resp.status_code == 200:
                data = resp.json()
                return data["data"][0]["embedding"]
            else:
                logger.warning(f"Embedding request failed: {resp.status_code}")
                return None
    except Exception as e:
        logger.debug(f"Embedding service unavailable: {e}")
        return None
