"""Mode routing — maps (tier × mode) to the correct capability."""

from enum import Enum

from server.config import settings


class Tier(str, Enum):
    LITE = "lite"
    FULL = "full"


class Mode(str, Enum):
    CHAT = "chat"
    AGENTIC = "agentic"


def create_llm_provider(tier: Tier):
    """Factory: create the correct LLM provider based on tier."""
    from server.llm.lm_studio import LMStudioProvider
    from server.llm.deepseek import DeepSeekProvider

    if tier == Tier.LITE:
        return LMStudioProvider(
            base_url=f"{settings.lm_studio_url.rstrip('/')}/v1",
            model=settings.external_llm_model,
        )
    else:
        return DeepSeekProvider(
            api_key=settings.external_llm_api_key,
            model=settings.external_llm_model or "deepseek-v4-flash",
        )


def resolve_capability(tier: Tier, mode: Mode, user_id: str = "", kb_id: str = ""):
    """Route to the correct capability based on tier and mode."""
    from server.capabilities.chat import SimpleChatCapability
    from server.capabilities.agentic import AgenticCapability
    from server.capabilities.lite_orchestrator import LiteOrchestrator

    provider = create_llm_provider(tier)

    if mode == Mode.CHAT:
        return SimpleChatCapability(provider=provider, kb_id=kb_id)

    if tier == Tier.LITE:
        return LiteOrchestrator(provider=provider, user_id=user_id)
    else:
        from server.tools.registry import create_full_registry

        registry = create_full_registry(user_id=user_id, kb_id=kb_id)
        return AgenticCapability(
            provider=provider,
            tools=registry.all_tools(),
            user_id=user_id,
            kb_id=kb_id,
        )
