"""HTTP chat endpoints for the AI Study Coach."""

import logging

from fastapi import APIRouter
from server.agent.coach import handle_chat, handle_chat_agentic
from server.models.schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message and get a response from the study coach."""
    return await handle_chat(request)


@router.post("/chat/agentic", response_model=ChatResponse)
async def chat_agentic(request: ChatRequest):
    """Send a message and get an agentic response with tool-use and actions."""
    return await handle_chat_agentic(request)
