# 07 — Environment & Security

## Environment Variables

| Variable | Required | Description |
| ---------- | ---------- | ------------- |
| `REST_API_URL` | Yes | Spring Boot base URL (server-side API routes) |
| `NEXT_PUBLIC_REST_API_URL` | Yes | Spring Boot URL (client-side) |
| `ANSWER_ENCRYPTION_KEY` | Yes | Key for answer encryption/decryption |
| `STUDY_COACH_API_URL` | Yes | AI Study Coach base URL (default: `http://localhost:8000`) |
| `COACH_API_KEY` | No | API key for AI Study Coach (if auth enabled) |
| `NEXT_PUBLIC_STUDY_COACH_API_URL` | No | AI Coach URL for client-side (WebSocket chat) |
| `NEXT_PUBLIC_STUDY_COACH_API_KEY` | No | Browser WebSocket API key; required only if AI Coach `COACH_API_KEY` is enforced |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase client API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |

---

## Security Measures

| Measure | Implementation | Purpose |
| --------- | --------------- | --------- |
| Answer encryption | AES via crypto-js | Prevent answer cheating via network inspection |
| HttpOnly cookies | `/api/auth/set-token` | Protect Firebase JWT from XSS |
| DOMPurify | Sanitizes rendered content | Prevent XSS in user-generated text |
| BFF proxy | API routes as proxy | Keep secrets server-side |
| CORS | Both backends configured | Restrict cross-origin access |

---

## Conventions

| Convention | Details |
| ----------- | --------- |
| Category flow | Single category per quiz. Radio buttons in forms select 1 category. UPPERCASE_SNAKE sent to backend, lowercase returned in responses. |
| Question shape | `{ question, answers, correctAnswer, userAnswer, answer, ... }` |
| Query config | `{ questions, time, infinitymode, timemode, quizmode, quizId, name, categories }` — `categories` is always a single-element array |
| Error shape | `{ message, statusCode }` from Spring Boot |
| ID format | 8-char UUID slices (consistent with backend `IdUtil.generateId()`) |
| Dialog pattern | Global modals in `_app.js`, triggered via `document.getElementById` |
| Styling | Tailwind utility classes, no CSS modules |
| File naming | PascalCase for components, camelCase for helpers/stores |
