"""Tool protocol — base interface for all tools."""

from abc import ABC, abstractmethod
from typing import Any

from server.llm.base import ToolDefinition


class BaseTool(ABC):
    """Every tool implements this interface."""

    @property
    @abstractmethod
    def name(self) -> str:
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        ...

    @abstractmethod
    def parameters_schema(self) -> dict[str, Any]:
        """Return JSON Schema for the tool's input parameters."""
        ...

    @abstractmethod
    async def execute(self, arguments: dict[str, Any]) -> str:
        """Execute the tool. Returns string result fed back to LLM."""
        ...

    def definition(self) -> ToolDefinition:
        """Convert to the format passed to LLM."""
        return ToolDefinition(
            name=self.name,
            description=self.description,
            parameters=self.parameters_schema(),
        )
