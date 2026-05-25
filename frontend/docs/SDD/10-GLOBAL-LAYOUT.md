# 10 — Global Layout & App Bootstrap

## `_app.js` — Application Root

The `src/pages/_app.js` file is the global layout and initialization point.

---

## Firebase Auth Sync

On mount, `_app.js` sets up an `onIdTokenChanged` listener:

```
1. Firebase emits token change (login, refresh, logout)
2. If token exists → POST /api/auth/set-token (creates HttpOnly cookie)
3. If null → POST /api/auth/clear-token (removes cookie)
4. Updates Zustand auth store with user state
```

This keeps the server-side cookie in sync with client-side Firebase auth.

---

## Study Coach Widget Initialization

The chat widget is configured at app root:

| Config | Source | Default |
|--------|--------|---------|
| Server URL | `NEXT_PUBLIC_STUDY_COACH_API_URL` | `http://localhost:8000` |
| User ID | From auth store | — |
| Transport | `webhook` | — |
| Hidden paths | `[/, /chat, /play]` | Widget hidden on these pages |

`hydrateChat()` is called on mount to restore conversations from localStorage.

---

## Global Modal Composition

Modals are rendered at root level (portals via DOM id):

| Modal | Trigger | Purpose |
|-------|---------|---------|
| `AuthForm` | `document.getElementById('auth-form')` | Login/register |
| `PlayForm` | `document.getElementById('play-form')` | Game configuration |
| `CreateQuizRoomForm` | `document.getElementById('create-room')` | Room creation |
| `StudyCoachWidget` | Always rendered (visibility toggled) | Chat widget |

This pattern avoids prop drilling and allows any component to open a modal.

---

## Zustand Store Binding

A single `useBoundStore` composites all 6 slice stores via spread operator:
```javascript
const useBoundStore = create((...a) => ({
  ...useAuth(...a),
  ...useChat(...a),
  ...useCreate(...a),
  ...useQueries(...a),
  ...useQuestions(...a),
  ...useWildcards(...a),
}))
```

All components import from `useBoundStore` — never from individual slices directly.
