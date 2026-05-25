"""WebSocket endpoint — main connection handler."""

import logging

from fastapi import WebSocket, WebSocketDisconnect

from server.router import resolve_capability, Tier, Mode
from server.ws import session_ack, error_event, done_event
from server.ws.session import Session

logger = logging.getLogger(__name__)


async def ws_handler(websocket: WebSocket):
    """Main WebSocket handler for the AI Study Coach."""
    await websocket.accept()
    session: Session | None = None

    try:
        # 1. Wait for session_start
        raw = await websocket.receive_json()
        if raw.get("type") != "session_start":
            await websocket.send_json(
                error_event("protocol", "Expected session_start as first message")
            )
            await websocket.close()
            return

        # 2. Create session
        tier = Tier(raw.get("tier", "full"))
        mode = Mode(raw.get("mode", "chat"))
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
                await _handle_user_message(websocket, session, content)

            elif msg_type == "stop":
                session.cancel()

            elif msg_type == "mode_switch":
                new_mode = raw.get("mode", "chat")
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
