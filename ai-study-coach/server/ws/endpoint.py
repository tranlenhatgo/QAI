"""WebSocket endpoint — main connection handler."""

import logging

from fastapi import WebSocket, WebSocketDisconnect

from server.config import settings
from server.llm.base import Message, Role
from server.router import resolve_capability, Tier, Mode
from server.ws import session_ack, error_event, done_event
from server.ws.session import Session

logger = logging.getLogger(__name__)


async def ws_handler(websocket: WebSocket):
    """Main WebSocket handler for the AI Study Coach."""
    await websocket.accept()
    session: Session | None = None

    try:
        if settings.api_key:
            api_key = (
                websocket.query_params.get("api_key")
                or websocket.headers.get("x-api-key", "")
            )
            if api_key != settings.api_key:
                await websocket.send_json(error_event("auth", "Invalid or missing API key"))
                await websocket.close(code=1008)
                return

        # 1. Wait for session_start
        raw = await websocket.receive_json()
        if raw.get("type") != "session_start":
            await websocket.send_json(
                error_event("protocol", "Expected session_start as first message")
            )
            await websocket.close()
            return

        # 2. Create session
        try:
            tier = Tier(raw.get("tier", "lite"))
            mode = Mode(raw.get("mode", "chat"))
        except ValueError:
            await websocket.send_json(error_event("protocol", "Invalid tier or mode"))
            await websocket.close()
            return

        user_id = raw.get("user_id", "")
        kb_id = raw.get("kb_id", "")

        try:
            capability = resolve_capability(tier, mode, user_id, kb_id)
        except Exception as e:
            await websocket.send_json(error_event("internal", str(e)))
            await websocket.close()
            return

        session = Session(
            tier=tier.value,
            mode=mode.value,
            capability=capability,
            user_id=user_id,
            kb_id=kb_id,
        )

        # 3. Send ack
        tool_names = (
            capability.tool_names() if hasattr(capability, "tool_names") else []
        )
        await websocket.send_json(
            session_ack(session.id, tier.value, mode.value, tool_names)
        )

        logger.info(
            f"WS session {session.id[:8]} started: tier={tier.value}, mode={mode.value}"
        )

        # 4. Message loop
        while True:
            raw = await websocket.receive_json()
            msg_type = raw.get("type")

            if msg_type == "user_message":
                content = raw.get("content", "").strip()
                if not content:
                    await websocket.send_json(done_event())
                    continue
                history = _coerce_history(raw.get("history"))
                if history:
                    session.messages = history
                await _handle_user_message(websocket, session, content)

            elif msg_type == "stop":
                session.cancel()

            elif msg_type == "mode_switch":
                try:
                    new_mode = Mode(raw.get("mode", "chat")).value
                except ValueError:
                    await websocket.send_json(error_event("protocol", "Invalid mode"))
                    continue
                session.switch_mode(new_mode)
                tool_names = (
                    session.capability.tool_names()
                    if hasattr(session.capability, "tool_names")
                    else []
                )
                await websocket.send_json(
                    session_ack(session.id, session.tier, new_mode, tool_names)
                )

    except WebSocketDisconnect:
        logger.info(f"WS session {session.id[:8] if session else '?'} disconnected")
    except Exception as e:
        logger.error(f"WS error: {e}", exc_info=True)
        try:
            await websocket.send_json(error_event("internal", str(e)))
        except Exception:
            pass
    finally:
        if session:
            session.cleanup()


async def _handle_user_message(websocket: WebSocket, session: Session, content: str):
    """Run the capability and stream results back."""
    session.add_user_message(content)

    async def on_event(event: dict):
        if not session.cancelled:
            await websocket.send_json(event)

    try:
        await session.capability.run(
            messages=session.messages,
            on_event=on_event,
            cancelled=lambda: session.cancelled,
        )
    except Exception as e:
        logger.error(f"Capability error: {e}", exc_info=True)
        await websocket.send_json(error_event("internal", str(e)))

    await websocket.send_json(done_event(cancelled=session.cancelled))


def _coerce_history(raw_history) -> list[Message]:
    """Convert optional client-side chat history into LLM messages."""
    if not isinstance(raw_history, list):
        return []

    role_map = {
        "system": Role.SYSTEM,
        "user": Role.USER,
        "assistant": Role.ASSISTANT,
    }
    messages: list[Message] = []

    for item in raw_history:
        if not isinstance(item, dict):
            continue
        role = role_map.get(str(item.get("role", "")).lower())
        content = item.get("content")
        if role is None or not isinstance(content, str) or not content.strip():
            continue
        messages.append(Message(role=role, content=content.strip()))

    return messages[-20:]
