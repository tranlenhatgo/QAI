# 03 — State Management

## Overview

All state is managed via **Zustand** with a merged store pattern. Individual slices are defined in `src/store/` and combined into a single hook via `useBoundStore.js`.

---

## Store Slices

| Slice | File | Manages |
|-------|------|---------|
| `useAuth` | `useAuth.js` | User session, login/logout, Firebase token |
| `useQueries` | `useQueries.js` | Game config (categories, time, modes) |
| `useQuestions` | `useQuestions.js` | Current question set during gameplay |
| `useWildcards` | `useWildcards.js` | Wildcard items (50/50, skip, etc.) |
| `useCreate` | `useCreate.js` | Quiz creation form state |
| `useChat` | `useChat.js` | AI coach conversations, WebSocket/HTTP toggle, settings |

---

## Chat Store Details

The `useChat` slice is the most complex, managing AI coaching interactions:

### Key Features
- **Multi-conversation support** — conversations persisted in localStorage
- **Dual transport** — WebSocket (`ws://`) or HTTP fallback (`/api/coach/chat`)
- **Chat modes** — `simple` (direct REST) / `agentic` (tool-augmented LLM)
- **Auto-reconnect** — automatic WebSocket reconnection on failure
- **Configurable URL** — server URL via `NEXT_PUBLIC_STUDY_COACH_API_URL`

### State Shape
```javascript
{
  conversations: [],       // Array of conversation objects
  activeConversationId: null,
  isConnected: false,      // WebSocket connection status
  isStreaming: false,      // Currently receiving stream chunks
  chatMode: 'simple',     // 'simple' | 'agentic'
  useWebSocket: true,     // Transport toggle
  serverUrl: '...',       // AI Coach base URL
}
```

### Actions
- `openChatSocket()` — establish WebSocket connection
- `sendMessage(content)` — send via WS or HTTP based on toggle
- `createConversation()` — start new conversation thread
- `switchConversation(id)` — change active conversation
- `clearConversation()` — reset current thread

---

## Persistence

| Store | Persistence | Method |
|-------|------------|--------|
| `useAuth` | sessionStorage | Manual get/set |
| `useChat` | localStorage | Manual get/set on conversations |
| Others | None | In-memory only (reset on page reload) |
