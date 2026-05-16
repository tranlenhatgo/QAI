"""Health check endpoint."""

from fastapi import APIRouter
from server.llm.external import external_client

router = APIRouter()


@router.get("/health")
async def health_check():
    """Check service health and LLM availability."""
    external_ok = await external_client.is_available()

    return {
        "status": "ok" if external_ok else "degraded",
        "external_llm": {
            "provider": external_client.provider,
            "model": external_client.model,
            "status": "connected" if external_ok else "unreachable",
        },
    }
