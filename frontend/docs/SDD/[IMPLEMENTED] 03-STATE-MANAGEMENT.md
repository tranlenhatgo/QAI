# 03 — State Management

## Overview

All state is managed via **Zustand** with a merged store pattern. Individual slices are defined in `src/store/` and combined into a single hook via `useBoundStore.js`.

---

## Store Slices

| Slice | File | Manages |
| ------- | ------ | --------- |
| `useAuth` | `useAuth.js` | User session, login/logout, Firebase token |
| `useQueries` | `useQueries.js` | Game config (categories, time, modes) |
| `useQuestions` | `useQuestions.js` | Current question set during gameplay |
| `useWildcards` | `useWildcards.js` | Wildcard items (50/50, skip, etc.) |
| `useCreate` | `useCreate.js` | Quiz creation form state |
| `useChat` | `useChat.js` | AI coach conversations, WebSocket/HTTP toggle, settings |
| `useCoach` | `useCoach.js` | Coach dashboard: progress, generation, solver, reviews, notifications |

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

## Coach Store Details

The `useCoach` slice manages all Coach Dashboard features including question generation, step solving, progress tracking, spaced repetition reviews, and notifications.

### Coach Key Features

- **Question generation** — topic-based and file-based via AI Coach API
- **Step-by-step solver** — problem solving with solution steps display
- **Progress tracking** — score history, mastery breakdown, study streak
- **Due reviews** — spaced repetition items fetched from Spring Boot
- **Notifications** — Firestore-backed unread notifications via BFF proxy
- **Tier selection** — Lite (LM Studio) or Full (DeepSeek) mode

### Coach State Shape

```javascript
{
  generatedQuestions: [],     // Generated question list
  isGenerating: false,
  solutionSteps: [],          // Step solver results
  isSolving: false,
  dueReviews: [],             // Spaced repetition due items
  upcomingReviews: [],        // Reviews coming soon
  notifications: [],          // { id, title, message, type, read }
  activeCoachFeature: 'overview',  // Current dashboard tab
  coachTier: 'full',          // 'lite' | 'full'
}
```

### Coach Actions

- `loadCoachProgress()` — fetch quiz profile + compute progress metrics
- `generateQuestions(topic, count)` — call AI Coach generation endpoint
- `solveProblem(problem)` — call AI Coach solve endpoint
- `fetchDueReviews(userId)` — fetch spaced repetition schedule
- `startReview(category)` — begin a review quiz for a category
- `completeReview(userId, category, score)` — notify AI Coach of review completion
- `fetchNotifications(userId)` — load unread notifications from Spring Boot
- `markNotificationRead(id)` — dismiss a notification

---

## Persistence

| Store | Persistence | Method |
| ------- | ------------ | -------- |
| `useAuth` | sessionStorage | Manual get/set |
| `useChat` | localStorage | Manual get/set on conversations |
| Others | None | In-memory only (reset on page reload) |
