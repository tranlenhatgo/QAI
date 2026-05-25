"""ReasonTool — dedicated deep-reasoning call for complex problems."""

import logging
from typing import Any

from server.tools import BaseTool

logger = logging.getLogger(__name__)


class ReasonTool(BaseTool):
    """Performs deep reasoning on complex academic problems."""

    @property
    def name(self) -> str:
        return "reason"

    @property
    def description(self) -> str:
        return (
            "Perform extended step-by-step reasoning on a complex problem. "
            "Use this for math proofs, multi-step logic, algorithm analysis, "
            "or any question requiring careful thought."
        )

    def parameters_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "problem": {
                    "type": "string",
                    "description": "The problem statement to reason about",
                },
                "context": {
                    "type": "string",
                    "description": "Additional context or constraints (optional)",
                },
            },
            "required": ["problem"],
        }

    async def execute(self, arguments: dict[str, Any]) -> str:
        from server.llm.base import Message, Role, ChunkType
        from server.router import create_llm_provider, Tier

        problem = arguments.get("problem", "")
        context = arguments.get("context", "")

        prompt = f"Think step by step to solve this problem:\n\n{problem}"
        if context:
            prompt += f"\n\nAdditional context: {context}"

        messages = [
            Message(role=Role.SYSTEM, content="You are a precise reasoning engine. Show your work step by step."),
            Message(role=Role.USER, content=prompt),
        ]

        try:
            provider = create_llm_provider(Tier.FULL)
            result_parts = []
            async for chunk in provider.complete(messages, tools=None):
                if chunk.type == ChunkType.CONTENT:
                    result_parts.append(chunk.content)
            return "".join(result_parts)
        except Exception as e:
            logger.error(f"reason tool error: {e}")
            return f"Reasoning failed: {e}"
