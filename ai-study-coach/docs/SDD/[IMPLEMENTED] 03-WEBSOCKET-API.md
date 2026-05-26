# 03 — WebSocket API

## Purpose

Define the WebSocket communication protocol between the Next.js frontend and the FastAPI AI service, including message shapes, connection lifecycle, and streaming behavior.

---

## Interface Contract

**Endpoint**: `ws://localhost:8000/ws`

If `COACH_API_KEY` is configured, browser clients authenticate with `ws://localhost:8000/ws?api_key=...` because the WebSocket API cannot set `X-API-Key` headers from the browser.

**Connection flow**:

```text
1. Client opens WebSocket connection
2. Client sends session_start message (tier + mode + metadata)
3. Server acknowledges with session_ack
4. Client sends user messages
5. Server streams responses (tokens, stages, tool events)
6. Client can send new messages after response completes
7. Either side can close the connection
```

---

## Data Shapes — Client → Server Messages

```python
# server/ws/protocol.py

from dataclasses import dataclass
from typing import Literal, Any

# === CLIENT → SERVER ===

@dataclass
class SessionStartMessage:
    """First message after WS connect. Sets tier and mode."""
    type: Literal["session_start"] = "session_start"
    tier: Literal["lite", "full"] = "full"
    mode: Literal["chat", "agentic"] = "chat"
    user_id: str = ""           # Optional: for personalization
    kb_id: str = ""             # Optional: knowledge base to use for RAG
    conversation_id: str = ""   # Optional: resume previous conversation

@dataclass
class UserMessage:
    """A user chat message."""
    type: Literal["user_message"] = "user_message"
    content: str = ""
    history: list[dict] = None  # Optional: localStorage conversation replay after reconnect
    attachments: list[str] = None  # Optional: file URLs for context

@dataclass  
class StopMessage:
    """User requests to stop current generation."""
    type: Literal["stop"] = "stop"

@dataclass
class ModeSwitch:
    """User switches mode mid-session."""
    type: Literal["mode_switch"] = "mode_switch"
    mode: Literal["chat", "agentic"] = "chat"
```

## Data Shapes — Server → Client Messages

```python
# === SERVER → CLIENT ===

@dataclass
class SessionAck:
    """Confirms session setup."""
    type: Literal["session_ack"] = "session_ack"
    session_id: str = ""
    tier: str = ""
    mode: str = ""
    available_tools: list[str] = None  # Tools available in this mode

@dataclass
class ContentChunk:
    """A streamed token/text chunk from the LLM."""
    type: Literal["content"] = "content"
    content: str = ""
    
@dataclass
class StageEvent:
    """Indicates the AI is entering a named stage."""
    type: Literal["stage"] = "stage"
    stage: str = ""        # e.g., "thinking", "searching", "generating"
    status: str = "start"  # "start" | "end"

@dataclass
class ToolEvent:
    """The AI is calling or received result from a tool."""
    type: Literal["tool"] = "tool"
    tool_name: str = ""
    status: str = ""       # "calling" | "result" | "error"
    arguments: dict = None # Tool input (when calling)
    result: str = ""       # Tool output (when result)

@dataclass
class ErrorEvent:
    """An error occurred."""
    type: Literal["error"] = "error"
    code: str = ""         # "provider_unavailable", "rate_limit", "internal"
    message: str = ""

@dataclass
class DoneEvent:
    """Response generation is complete."""
    type: Literal["done"] = "done"
    usage: dict = None     # {"prompt_tokens": N, "completion_tokens": M}
```

---

## Behavior Specification

### Connection Lifecycle

```text
Client                              Server
  │                                    │
  │──── WS Connect ──────────────────→│
  │                                    │ (accept connection)
  │──── session_start ───────────────→│
  │                                    │ resolve_capability(tier, mode)
  │←─── session_ack ─────────────────│
  │                                    │
  │──── user_message ────────────────→│
  │                                    │ capability.run(message)
  │←─── stage("thinking", "start") ──│
  │←─── content("Let me") ───────────│
  │←─── content(" help") ────────────│
  │←─── content(" you...") ──────────│
  │←─── stage("thinking", "end") ────│
  │←─── done ────────────────────────│
  │                                    │
  │──── user_message ────────────────→│  (next turn)
  │     ...                            │
  │                                    │
  │──── close ───────────────────────→│
  │←─── close ────────────────────────│
```

### Agentic Mode (with tool calls)

```text
Client                              Server
  │──── user_message ────────────────→│
  │                                    │ capability.run(message)
  │←─── stage("thinking", "start") ──│
  │←─── tool("rag", "calling", args) │  ← LLM decided to search KB
  │←─── tool("rag", "result", data) ─│  ← RAG results found
  │←─── stage("thinking", "end") ────│
  │←─── stage("responding", "start") │
  │←─── content("Based on...") ──────│  ← Final answer streaming
  │←─── content(" your notes...") ───│
  │←─── stage("responding", "end") ──│
  │←─── done ────────────────────────│
```

### Stop/Cancel Flow

```text
Client                              Server
  │──── user_message ────────────────→│
  │←─── content("Let me") ───────────│
  │←─── content(" think") ───────────│
  │──── stop ────────────────────────→│  ← User clicks Stop
  │                                    │ cancel current generation
  │←─── done(cancelled=true) ────────│
```

---

## WebSocket Endpoint Implementation

```python
# server/ws/endpoint.py

from fastapi import WebSocket, WebSocketDisconnect
from server.config import AppConfig
from server.router import resolve_capability, Tier, Mode
from server.ws.protocol import *
from server.ws.session import Session
import json

async def ws_handler(websocket: WebSocket, config: AppConfig):
    """Main WebSocket handler."""
    await websocket.accept()
    session: Session | None = None
    
    try:
        # 1. Wait for session_start
        raw = await websocket.receive_json()
        if raw.get("type") != "session_start":
            await websocket.send_json({"type": "error", "code": "protocol", "message": "Expected session_start"})
            await websocket.close()
            return
        
        # 2. Create session
        tier = Tier(raw.get("tier", "full"))
        mode = Mode(raw.get("mode", "chat"))
        capability = resolve_capability(tier, mode)
        session = Session(
            tier=tier,
            mode=mode,
            capability=capability,
            user_id=raw.get("user_id", ""),
            kb_id=raw.get("kb_id", ""),
        )
        
        # 3. Send ack
        await websocket.send_json({
            "type": "session_ack",
            "session_id": session.id,
            "tier": tier.value,
            "mode": mode.value,
            "available_tools": session.capability.tool_names(),
        })
        
        # 4. Message loop
        while True:
            raw = await websocket.receive_json()
            msg_type = raw.get("type")
            
            if msg_type == "user_message":
                content = raw.get("content", "")
                await handle_user_message(websocket, session, content)
            
            elif msg_type == "stop":
                session.cancel()
            
            elif msg_type == "mode_switch":
                new_mode = Mode(raw.get("mode", "chat"))
                session.switch_mode(new_mode)
                await websocket.send_json({
                    "type": "session_ack",
                    "mode": new_mode.value,
                })
    
    except WebSocketDisconnect:
        pass
    finally:
        if session:
            session.cleanup()


async def handle_user_message(websocket: WebSocket, session: Session, content: str):
    """Run the capability and stream results back."""
    session.add_user_message(content)
    
    # Stream callback — sends events to client
    async def on_event(event: dict):
        if not session.cancelled:
            await websocket.send_json(event)
    
    try:
        await session.capability.run(
            messages=session.messages,
            on_event=on_event,
            cancelled=lambda: session.cancelled,
        )
        await websocket.send_json({"type": "done"})
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "code": "internal",
            "message": str(e),
        })
```

---

## Session State

```python
# server/ws/session.py

import uuid
from dataclasses import dataclass, field

@dataclass
class Session:
    """Per-connection session state."""
    tier: str
    mode: str
    capability: Any
    user_id: str = ""
    kb_id: str = ""
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    messages: list = field(default_factory=list)  # Conversation history
    cancelled: bool = False
    
    def add_user_message(self, content: str):
        self.messages.append(Message(role=Role.USER, content=content))
        self.cancelled = False  # Reset cancel flag for new message
    
    def add_assistant_message(self, content: str):
        self.messages.append(Message(role=Role.ASSISTANT, content=content))
    
    def cancel(self):
        self.cancelled = True
    
    def switch_mode(self, new_mode):
        from server.router import resolve_capability
        self.mode = new_mode
        self.capability = resolve_capability(self.tier, new_mode)
    
    def cleanup(self):
        """Release resources on disconnect."""
        self.messages.clear()
```

---

## JSON Wire Format Examples

### Client → Server

```json
// Session start
{"type": "session_start", "tier": "full", "mode": "agentic", "user_id": "u123", "kb_id": "kb_math101"}

// User message
{"type": "user_message", "content": "Explain the quadratic formula"}

// Stop generation
{"type": "stop"}

// Switch to chat mode
{"type": "mode_switch", "mode": "chat"}
```

### Server → Client

```json
// Session acknowledged
{"type": "session_ack", "session_id": "abc123", "tier": "full", "mode": "agentic", "available_tools": ["rag", "reason", "quiz_history", "recommend", "web_search"]}

// Content streaming
{"type": "content", "content": "The quadratic"}
{"type": "content", "content": " formula is"}
{"type": "content", "content": " x = (-b ± √(b²-4ac)) / 2a"}

// Stage indicators
{"type": "stage", "stage": "searching", "status": "start"}
{"type": "stage", "stage": "searching", "status": "end"}

// Tool events
{"type": "tool", "tool_name": "rag", "status": "calling", "arguments": {"query": "quadratic formula derivation"}}
{"type": "tool", "tool_name": "rag", "status": "result", "result": "From Chapter 3: The quadratic formula..."}

// Error
{"type": "error", "code": "rate_limit", "message": "DeepSeek rate limit exceeded. Retry in 60s."}

// Done
{"type": "done", "usage": {"prompt_tokens": 150, "completion_tokens": 89}}
```

---

## Acceptance Criteria

- [ ] WebSocket endpoint accepts connections at `/ws`
- [ ] Missing `session_start` → error + close
- [ ] Invalid tier/mode → error + close  
- [ ] `session_ack` returns correct tier, mode, and tool list
- [ ] Content chunks stream as individual JSON messages
- [ ] `stop` message cancels in-progress generation within 500ms
- [ ] `mode_switch` changes capability without disconnecting
- [ ] Conversation history persists across messages in same session
- [ ] Client disconnect triggers `session.cleanup()`
- [ ] Server handles malformed JSON gracefully (error event, not crash)
- [ ] Max message size enforced (e.g., 64KB) to prevent abuse

---

## Dependencies

```text
fastapi>=0.104.0
websockets>=12.0
```

---

## DeepTutor Reference

| This Module | DeepTutor Equivalent | What Changed |
| ------------- | --------------------- | -------------- |
| WS endpoint | `deeptutor/api/routers/unified_ws.py` | Same concept, simplified protocol |
| Message protocol | `deeptutor/core/stream.py` StreamEvent | Reduced from 10+ event types to 6 |
| Session state | `deeptutor/core/context.py` UnifiedContext | Minimal: just messages + config |
| Stage events | StreamEvent with `stage` source | Same concept, simpler |
