"""SimpleChatCapability — direct LLM chat with no tools."""

from collections.abc import Awaitable, Callable

from server.llm.base import ChunkType, LLMService, Message, Role
from server.ws import stage_event, content_chunk


SYSTEM_PROMPT = """You are an AI Study Coach. Your role is to help students learn effectively.

Guidelines:
- Explain concepts clearly and concisely
- Use examples to illustrate points
- If the student seems confused, try a different explanation approach
- Encourage active learning (ask "does this make sense?" or "can you try explaining it back?")
- Be supportive but honest about mistakes
- Keep responses focused and not overly long"""


class SimpleChatCapability:
    """Direct chat: user message → LLM → streamed response. No tools."""

    def __init__(self, provider: LLMService, kb_id: str = ""):
        self.llm = provider
        self.kb_id = kb_id

    def tool_names(self) -> list[str]:
        return []

    async def run(
        self,
        messages: list[Message],
        on_event: Callable[[dict], Awaitable[None]],
        cancelled: Callable[[], bool],
    ) -> None:
        # Ensure system prompt
        full_messages = self._ensure_system_prompt(messages)

        # Emit stage start
        await on_event(stage_event("responding", "start"))

        # Stream LLM response
        assistant_content = ""
        async for chunk in self.llm.complete(full_messages, tools=None):
            if cancelled():
                break
            if chunk.type == ChunkType.CONTENT:
                assistant_content += chunk.content
                await on_event(content_chunk(chunk.content))

        # Emit stage end
        await on_event(stage_event("responding", "end"))

        # Add to history
        messages.append(Message(role=Role.ASSISTANT, content=assistant_content))

    def _ensure_system_prompt(self, messages: list[Message]) -> list[Message]:
        if not messages or messages[0].role != Role.SYSTEM:
            return [Message(role=Role.SYSTEM, content=SYSTEM_PROMPT)] + messages
        return messages
