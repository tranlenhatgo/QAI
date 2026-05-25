"""Base capability protocol — interface all capabilities implement."""

from collections.abc import Awaitable, Callable
from typing import Protocol

from server.llm.base import Message


class BaseCapability(Protocol):
    """Every capability implements this interface."""

    def tool_names(self) -> list[str]:
        """Return names of tools available in this capability."""
        ...

    async def run(
        self,
        messages: list[Message],
        on_event: Callable[[dict], Awaitable[None]],
        cancelled: Callable[[], bool],
    ) -> None:
        """
        Execute the capability.

        Args:
            messages: Full conversation history
            on_event: Callback to emit events to the client
            cancelled: Lambda returning True if user sent "stop"
        """
        ...
