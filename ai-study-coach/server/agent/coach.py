"""Main agent loop — orchestrates quiz data fetching, analysis, and LLM response."""

import logging

from server.quiz_client.client import quiz_client
from server.llm.external import external_client
from server.agent.prompts import build_context_prompt, build_messages
from server.agent.tools import get_tool_definitions
from server.models.schemas import (
    ChatRequest,
    ChatResponse,
    ChatRole,
    AgentAction,
    LLMResponse,
)

logger = logging.getLogger(__name__)

# Maximum tool-calling rounds to prevent runaway loops
MAX_TOOL_ROUNDS = 3


async def _get_llm_client():
    """Get the LLM client."""
    if await external_client.is_available():
        return external_client
    return None


async def _get_llm_response(messages: list[dict]) -> str:
    """Get a response from the configured LLM (LM Studio)."""
    if await external_client.is_available():
        logger.info(f"Using {external_client.provider} ({external_client.model})")
        return await external_client.chat(messages)

    raise RuntimeError(
        "No LLM available. Start LM Studio and load a model, "
        "or configure an external API provider in .env."
    )


async def _fetch_quiz_data(user_id: str) -> tuple[list[dict], dict | None]:
    """Fetch quiz history and run weakness analysis. Returns (quiz_data, weakness_data)."""
    # Fetch quiz history
    try:
        history = await quiz_client.get_player_history(user_id)
        quiz_data = [h.model_dump() for h in history] if history else []
    except Exception as e:
        logger.error(f"Failed to fetch quiz history: {e}")
        quiz_data = []

    # Weakness analysis (import here to avoid circular imports at startup)
    weakness_data = None
    if quiz_data:
        try:
            from server.learning.weakness import analyze_weaknesses

            weakness_data = await analyze_weaknesses(user_id, quiz_data)
            weakness_data = weakness_data.model_dump() if weakness_data else None
        except Exception as e:
            logger.error(f"Weakness analysis failed: {e}")

    return quiz_data, weakness_data


async def handle_chat(request: ChatRequest) -> ChatResponse:
    """
    Original (non-agentic) agent flow:
    1. Fetch quiz history from quiz API
    2. Run weakness analysis (algorithmic)
    3. Build context prompt
    4. Call LLM
    5. Return response
    """
    user_id = request.user_id
    user_message = request.message

    # 1–2. Fetch data
    quiz_data, weakness_data = await _fetch_quiz_data(user_id)

    # 3. Build context prompt
    context = build_context_prompt(
        quiz_history=quiz_data,
        weakness_report=weakness_data,
    )

    # 4. Build messages with conversation history
    chat_history = [msg.model_dump() for msg in request.history] if request.history else None
    messages = build_messages(user_message, context, chat_history)

    # 5. Call LLM
    try:
        response_text = await _get_llm_response(messages)
    except RuntimeError as e:
        return ChatResponse(
            content=f"⚠️ {str(e)} Please check the Study Coach server configuration.",
        )
    except Exception as e:
        logger.error(f"LLM request failed: {e}")
        return ChatResponse(
            content="Sorry, I encountered an error generating a response. Please try again.",
        )

    # 6. Return response with metadata
    weaknesses = weakness_data.get("weakest_categories") if weakness_data else None

    # Populate due_reviews from spaced repetition schedule
    due_reviews = None
    try:
        from server.learning.spaced_repetition import SpacedRepetitionScheduler, load_schedule
        items = await load_schedule(user_id)
        if items:
            scheduler = SpacedRepetitionScheduler()
            due_items = scheduler.get_due_reviews(items)
            if due_items:
                due_reviews = [item.category for item in due_items]
    except Exception as e:
        logger.debug(f"Due reviews lookup failed: {e}")

    return ChatResponse(
        content=response_text,
        weaknesses=weaknesses,
        due_reviews=due_reviews,
    )


async def handle_chat_agentic(request: ChatRequest) -> ChatResponse:
    """
    Agentic agent flow with tool use:
    1. Fetch quiz history + weakness analysis
    2. Build context + messages with agentic prompt
    3. Send to LLM with tool definitions
    4. If LLM returns tool_calls → execute them → feed results back → repeat
    5. When LLM returns text → return response with collected actions
    """
    user_id = request.user_id
    user_message = request.message

    # 1. Fetch data
    quiz_data, weakness_data = await _fetch_quiz_data(user_id)

    # 2. Build context + messages
    context = build_context_prompt(
        quiz_history=quiz_data,
        weakness_report=weakness_data,
    )
    chat_history = [msg.model_dump() for msg in request.history] if request.history else None
    messages = build_messages(user_message, context, chat_history, agentic=True)

    # 3. Get LLM client
    llm_client = await _get_llm_client()
    if not llm_client:
        return ChatResponse(
            content=(
                "⚠️ No LLM available. Start LM Studio and load a model, "
                "or configure an external API provider in .env."
            ),
        )

    provider_name = getattr(llm_client, "provider", "lm_studio")
    model_name = llm_client.model
    logger.info(f"Agentic chat using {provider_name}: {model_name}")

    tools = get_tool_definitions()
    pending_actions: list[AgentAction] = []

    try:
        for round_num in range(MAX_TOOL_ROUNDS):
            # Call LLM with tools
            llm_response: LLMResponse = await llm_client.chat_with_tools(
                messages, tools
            )

            if llm_response.tool_calls:
                logger.info(
                    f"Round {round_num + 1}: LLM requested {len(llm_response.tool_calls)} tool call(s): "
                    f"{[tc.name for tc in llm_response.tool_calls]}"
                )

                # Append the assistant's tool-call message to conversation
                messages.append({
                    "role": "assistant",
                    "content": llm_response.content or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.name,
                                "arguments": str(tc.arguments),
                            },
                        }
                        for tc in llm_response.tool_calls
                    ],
                })

                # Execute each tool call
                for tc in llm_response.tool_calls:
                    # Lazy import to avoid circular imports
                    from server.agent.tool_executor import execute_tool

                    result_text, action = await execute_tool(
                        tc, user_id, weakness_data
                    )

                    if action:
                        pending_actions.append(action)

                    # Append tool result to messages
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result_text,
                    })

            else:
                # LLM gave a final text response — we're done
                logger.info(
                    f"Agentic flow complete after {round_num + 1} round(s), "
                    f"{len(pending_actions)} action(s) collected"
                )

                weaknesses = (
                    weakness_data.get("weakest_categories")
                    if weakness_data
                    else None
                )

                return ChatResponse(
                    content=llm_response.content or "I'm here to help! What would you like to do?",
                    weaknesses=weaknesses,
                    actions=pending_actions if pending_actions else None,
                )

        # Exhausted max rounds — return whatever we have
        logger.warning(f"Agentic loop hit max rounds ({MAX_TOOL_ROUNDS})")
        final_text = await _get_llm_response(messages)
        weaknesses = weakness_data.get("weakest_categories") if weakness_data else None

        return ChatResponse(
            content=final_text,
            weaknesses=weaknesses,
            actions=pending_actions if pending_actions else None,
        )

    except Exception as e:
        logger.error(f"Agentic chat failed: {e}", exc_info=True)
        # Fall back to non-agentic flow
        logger.info("Falling back to non-agentic chat")
        return await handle_chat(request)

