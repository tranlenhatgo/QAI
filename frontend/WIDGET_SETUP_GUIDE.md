# Chat Widget Setup Guide

> **Audience:** AI Coding Agent — follow this guide to build the embeddable chat widget for the AI Study Coach.

---

## Goal

Build a **floating chat widget** (vanilla HTML/CSS/JS — no frameworks) that connects to the AI Study Coach FastAPI backend via WebSocket. The widget will be embedded into the existing **Next.js quiz platform** (port 3000) as a persistent floating bubble in the bottom-right corner.

---

## Architecture Context

```
Next.js Frontend (port 3000)
  └── Embeds: <script src="http://localhost:8000/static/widget.js"></script>
                    ↓
              Chat Widget (vanilla JS)
                    ↓ WebSocket
              FastAPI Backend (port 8000) → /ws/chat
```

The FastAPI server at `server/main.py` already has a commented-out static file mount ready for this:

```python
# server/main.py, line 75-76
# Serve widget static files (will be added later)
# app.mount("/static", StaticFiles(directory="widget"), name="static")
```

**Uncomment this line** after creating the `widget/` directory.

---

## File Structure to Create

```
ai-study-coach/
├── widget/
│   ├── widget.js          # Main entry — self-contained, creates the entire UI
│   ├── widget.css         # All widget styles (injected by widget.js)
│   └── widget.html        # Standalone test page (for development/debugging only)
```

All three files go in the `widget/` directory at the project root (same level as `server/`).

---

## Backend Integration Details

### WebSocket Endpoint

- **URL:** `ws://localhost:8000/ws/chat`
- **Protocol:** JSON text frames over native WebSocket (no Socket.io)
- **Connection:** Persistent — open once when widget loads, reconnect on disconnect

### Message Format — Client → Server

Send this JSON on every user message:

```json
{
    "user_id": "player_abc123",
    "message": "What should I study?",
    "history": [
        {"role": "user", "content": "Hi"},
        {"role": "assistant", "content": "Hello! How can I help you study?"}
    ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `user_id` | `string` | ✅ | The quiz platform's player/user ID |
| `message` | `string` | ✅ | Current user message |
| `history` | `array` | ❌ | Previous conversation turns (roles: `"user"` or `"assistant"`) |

### Message Format — Server → Client

The server streams responses token-by-token. Handle these three message types:

**1. Token (streaming):**
```json
{"type": "token", "content": "Let"}
{"type": "token", "content": "'s"}
{"type": "token", "content": " look"}
{"type": "token", "content": " at"}
```
→ Append each `content` to the current assistant message in real-time.

**2. Done (stream complete):**
```json
{"type": "done", "weaknesses": ["GEOGRAPHY", "SCIENCE"]}
```
→ Finalize the message. `weaknesses` may be `null` or a list of weak category strings.

**3. Error:**
```json
{"type": "error", "content": "No LLM available. Configure an API key or start Ollama."}
```
→ Display the error content as a system message in the chat.

### HTTP Fallback Endpoint (optional)

If WebSocket fails, fall back to:

```
POST http://localhost:8000/chat
Content-Type: application/json

{
    "user_id": "player_abc123",
    "message": "What should I study?",
    "history": []
}
```

Response:
```json
{
    "role": "assistant",
    "content": "Based on your quiz history...",
    "weaknesses": ["GEOGRAPHY"],
    "due_reviews": null
}
```

This returns the full response at once (no streaming).

---

## Widget Functional Requirements

### 1. Floating Chat Bubble

- Fixed position: **bottom-right** corner of the viewport (e.g., `bottom: 24px; right: 24px`)
- Circular button with a chat/message icon (use an SVG or emoji 💬)
- Click to toggle the chat panel open/closed
- Show an unread notification badge when a new message arrives while the panel is closed

### 2. Chat Panel

- Opens above the bubble button
- Recommended dimensions: ~`380px` wide × ~`520px` tall (responsive — shrink on mobile)
- Components:
  - **Header** — title "AI Study Coach", a close/minimize button
  - **Message area** — scrollable, auto-scrolls to bottom on new messages
  - **Input area** — text input + send button at the bottom

### 3. Messages

- **User messages** — right-aligned, colored bubble
- **Assistant messages** — left-aligned, different colored bubble
- **Streaming indicator** — show a blinking cursor or "typing..." indicator while tokens arrive
- **Markdown rendering** — the LLM returns markdown (bold, bullets, headers, emoji). Render at minimum: `**bold**`, `- bullet lists`, headers (`##`), and inline `code`. A lightweight approach (regex replacement) is fine — no need for a full markdown library.
- **Error messages** — styled differently (e.g., red/warning color, centered)

### 4. Conversation History

- Maintain a `history` array in memory (not persisted to localStorage)
- Send the full conversation history with every message (see the client→server format above)
- Each entry: `{"role": "user" | "assistant", "content": "..."}`

### 5. User ID

- The widget needs a `user_id` to send with messages
- Accept it via a configuration option when embedding:
  ```html
  <script>
      window.STUDY_COACH_CONFIG = {
          userId: "player_abc123",
          serverUrl: "ws://localhost:8000/ws/chat"
      };
  </script>
  <script src="http://localhost:8000/static/widget.js"></script>
  ```
- Default `serverUrl` to `ws://localhost:8000/ws/chat` if not provided
- If `userId` is not set, show a prompt or use a fallback like `"anonymous"`

### 6. Connection Management

- Connect WebSocket when the widget panel is **first opened** (not on page load)
- Auto-reconnect on disconnect with exponential backoff (e.g., 1s → 2s → 4s → max 30s)
- Show a connection status indicator in the header (green dot = connected, gray = disconnected)
- Disable the input while disconnected

---

## Widget Visual Design Requirements

### Style

- **Modern, clean look** — rounded corners, subtle shadows, smooth transitions
- **Dark theme preferred** — dark panel background (`#1a1a2e` or similar) with light text
- Use a color accent for the chat bubble and user messages (e.g., purple/blue gradient `#6c5ce7` → `#a29bfe`)
- Assistant messages: slightly lighter dark background (`#2d2d44` or similar)
- Input area: dark with a subtle border, focus glow on the input field

### Animations

- Chat panel: **slide-up** animation when opening, slide-down when closing
- Chat bubble: subtle **pulse** or **bounce** animation on first load to draw attention
- Messages: **fade-in** when they appear
- Typing indicator: **three bouncing dots** animation

### Typography

- Use the system font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Message text: `14px`, line-height `1.5`
- Header title: `16px`, semi-bold

### Responsiveness

- On viewports **< 480px wide**: make the chat panel full-screen (100vw × 100vh)
- On larger viewports: fixed dimensions floating above the bubble

---

## CSS Isolation

The widget will be injected into an existing Next.js app, so **style isolation is critical**:

- Prefix ALL CSS classes with `sc-` (study-coach) to avoid collisions. Example: `.sc-widget`, `.sc-bubble`, `.sc-message-user`
- Use a high `z-index` (e.g., `10000`) for the bubble and panel
- The widget.js should **inject the CSS** into the page by creating a `<style>` tag or loading `widget.css` via a `<link>` tag dynamically
- Do NOT rely on any styles from the host page

---

## Implementation Notes

### widget.js Structure

The JS file should be **self-contained** and follow this pattern:

```javascript
(function() {
    'use strict';

    // 1. Read config from window.STUDY_COACH_CONFIG
    const config = window.STUDY_COACH_CONFIG || {};
    const userId = config.userId || 'anonymous';
    const serverUrl = config.serverUrl || 'ws://localhost:8000/ws/chat';

    // 2. Inject CSS (inline <style> or load widget.css)

    // 3. Create DOM elements (bubble, panel, header, messages, input)

    // 4. WebSocket connection management
    //    - connect(), disconnect(), reconnect()
    //    - onmessage: handle token/done/error types

    // 5. Chat logic
    //    - sendMessage(text): add to UI + send via WS with history
    //    - handleToken(content): append to current assistant message
    //    - handleDone(weaknesses): finalize message
    //    - handleError(content): show error in chat

    // 6. Event listeners (send button, Enter key, bubble click)

    // 7. Initialize
})();
```

### Key Behaviors

- **Scroll to bottom**: After every token and after sending a message
- **Disable input during streaming**: Prevent sending while the assistant is responding
- **Enter to send**: `Enter` key sends, `Shift+Enter` for newlines
- **Empty message guard**: Don't send blank messages
- **Trim whitespace** from messages before sending

### widget.html (Test Page)

Create a minimal HTML page to test the widget in isolation:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Study Coach — Widget Test</title>
    <style>
        body {
            font-family: sans-serif;
            padding: 40px;
            background: #f0f0f0;
        }
    </style>
</head>
<body>
    <h1>Quiz Platform (mock page)</h1>
    <p>The chat widget should appear in the bottom-right corner.</p>

    <script>
        window.STUDY_COACH_CONFIG = {
            userId: "test_user_001",
            serverUrl: "ws://localhost:8000/ws/chat"
        };
    </script>
    <script src="widget.js"></script>
</body>
</html>
```

---

## Server-Side Changes Required

### 1. Uncomment static file mount

In `server/main.py`, line 75-76, change:

```python
# Serve widget static files (will be added later)
# app.mount("/static", StaticFiles(directory="widget"), name="static")
```

To:

```python
# Serve widget static files
app.mount("/static", StaticFiles(directory="widget"), name="static")
```

### 2. CORS (already configured)

The server already allows CORS from `http://localhost:3000` and `http://localhost:8080` (see `server/config.py` line 23). No changes needed unless the frontend runs on a different origin.

---

## Embedding in the Next.js Quiz Platform

Once the widget is built and served by FastAPI, embed it in the Next.js app by adding this to the main layout (e.g., `_app.tsx` or `layout.tsx`):

```html
<script>
    window.STUDY_COACH_CONFIG = {
        userId: "{currentUser.id}",  // from your auth context
        serverUrl: "ws://localhost:8000/ws/chat"
    };
</script>
<script src="http://localhost:8000/static/widget.js"></script>
```

For Next.js specifically, use `next/script`:

```tsx
import Script from 'next/script';

// In your layout component:
<Script id="study-coach-config" strategy="beforeInteractive">
    {`window.STUDY_COACH_CONFIG = {
        userId: "${user?.id || 'anonymous'}",
        serverUrl: "ws://localhost:8000/ws/chat"
    };`}
</Script>
<Script src="http://localhost:8000/static/widget.js" strategy="afterInteractive" />
```

---

## Testing & Verification

### Prerequisites

- FastAPI server running: `python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000`
- `COACH_EXTERNAL_LLM_API_KEY` set in `.env` (or Ollama running)

### Test Checklist

1. **Open `widget.html` directly in browser** → widget bubble appears in bottom-right
2. **Click bubble** → panel slides up, WebSocket connects (green status dot)
3. **Send a message** → tokens stream in real-time, dots animate while typing
4. **Multiple messages** → conversation history maintained, previous context informs responses
5. **Close and reopen panel** → conversation preserved (in memory)
6. **Stop the FastAPI server** → disconnection indicator shown, input disabled, auto-reconnect attempts
7. **Restart the server** → widget reconnects automatically
8. **Narrow viewport (< 480px)** → panel goes full-screen
9. **Check for style leaks** → embed in a styled page, verify no CSS conflicts

---

## Summary of Deliverables

| File | Description |
|---|---|
| `widget/widget.js` | Self-contained widget script (creates DOM, handles WS, manages chat) |
| `widget/widget.css` | All widget styles with `sc-` prefixed classes |
| `widget/widget.html` | Standalone test page |
| `server/main.py` | Uncomment the static file mount (line 76) |
