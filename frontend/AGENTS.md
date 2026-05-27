# AGENTS.md

## Big Picture

- This is a Next.js Pages Router frontend (no `app/`) for QAI quiz play, quiz-room features, and the AI Coach dashboard.
- `src/pages/_app.js` mounts global dialogs once (`PlayForm`, `AuthForm`, `CreateQuizRoomForm`), and pages trigger them by DOM id.
- State is centralized in merged Zustand slices via `src/store/useBoundStore.js`.
- The app is primarily a BFF frontend: browser → `src/helpers/**` → `src/pages/api/**` → external REST services. AI Coach chat is the exception: `useChat` connects directly to the FastAPI WebSocket at `/ws`.

## Pages

| Page | Route | Purpose |
| --- | --- | --- |
| Home | `/` | Landing page with categories, game modes |
| Play | `/play` | Quiz gameplay with timer and questions |
| Create | `/create` | Quiz creation (manual + AI generation) |
| Profile | `/profile` | User profile, quiz history, leaderboard |
| Coach | `/coach` | AI Coach dashboard (tabbed) |
| Chat | `/chat` | Standalone AI chat page |

## Store Architecture (Zustand)

Merged slices in `src/store/useBoundStore.js`:

| Slice | File | Purpose |
| --- | --- | --- |
| `useAuth` | `authStore.js` | Firebase auth state, login/logout |
| `useQuiz` | `quizStore.js` | Quiz CRUD state |
| `usePlay` | `playStore.js` | Gameplay state (questions, score, timer) |
| `useChat` | `chatStore.js` | WebSocket chat state |
| `useCoach` | `coachStore.js` | Coach dashboard state (progress, reviews, notifications) |
| `useProfile` | `profileStore.js` | Profile data, history |
| `useUI` | `uiStore.js` | Modal/dialog visibility |

## Component Directories

| Directory | Purpose |
| --- | --- |
| `src/components/Auth/` | Login/register forms |
| `src/components/Chat/` | AI coaching chat widget |
| `src/components/Coach/` | Coach Dashboard (Overview, Generate, Solver, Materials, Weaknesses, Chat, DueReviews, NotificationBell) |
| `src/components/Create/` | Quiz creation UI |
| `src/components/Form/` | Global modal forms (play, auth, join) |
| `src/components/Home/` | Landing page sections |
| `src/components/Play/` | Gameplay, GameOver, results |
| `src/components/Profile/` | Profile, history, leaderboard |
| `src/components/Questions/` | Question display during play |

## Core Data Flows

- **New game**: `PlayForm.jsx` builds query → `/play` → `queryValidator` → `getQuestions` → AI Coach `/generate/from-topics`
- **Category selection**: All category pickers (NewGameForm, CreateQuizRoomForm, CreateInfo) use **radio buttons** (single-select). `queryValidator` in `gameConfig.js` enforces max 1 category. `QuizBrowser` has a category dropdown filter for browsing quizzes by category.
- **Join quiz room**: `takeQuiz` helper → `queries.quizmode=true` → `/play` → fetch from Spring Boot
- **Quiz completion**: `GameOver.jsx` → `saveAttempt` → Spring Boot `take-quiz/end` → `WebhookService` fires to AI Coach
- **Answer security**: Answers encrypted at fetch time (`take-quiz.js`), checked/decrypted via `check-answer.js` and `get-answer.js`
- **Coach dashboard**: `/coach` → `useCoach` actions → BFF routes (`/api/coach/*`) → AI Coach / Spring Boot; embedded chat uses direct AI Coach WebSocket
- **Spaced repetition**: DueReviews loads via `fetchDueReviews()` → coach progress endpoint → user clicks [Review] → quiz play → webhook cycle
- **Notifications**: `NotificationBell` polls `GET /api/coach/notifications/{userId}` → displays unread → mark-read on dismiss

## BFF API Routes (src/pages/api/)

| Route | Target | Purpose |
| --- | --- | --- |
| `/api/auth/*` | Firebase | Token set/clear, login/register |
| `/api/questions` | AI Coach | Generate questions from topics |
| `/api/question/*` | Spring Boot / local | Get questions, check/get answer |
| `/api/quiz/*` | Spring Boot / AI Coach | Quiz CRUD, upload for AI generation |
| `/api/take/*` | Spring Boot | Start/end quiz attempts |
| `/api/coach/chat` | AI Coach | Legacy HTTP chat proxy; normal chat uses WebSocket `/ws` |
| `/api/coach/generate-questions` | AI Coach | Dashboard question generation |
| `/api/coach/solve` | AI Coach | Step-by-step solver |
| `/api/coach/progress/[userId]` | AI Coach | Progress metrics |
| `/api/coach/review-completed` | AI Coach | Notify review quiz done |
| `/api/coach/notifications/[userId]` | Spring Boot | Fetch unread notifications |
| `/api/coach/notifications/[id]/read` | Spring Boot | Mark notification read |

## Conventions to Preserve

- Keep `queries` shape from `src/helpers/gameConfig.js` (`questions`, `time`, `infinitymode`, `timemode`, `quizmode`, `quizId`, `name`, `categories`).
- Keep question object compatibility across flows: `{ question, answers, correctAnswer, userAnswer, answer, ... }`.
- Category values are transformed by layer: ids in query state, names for local generation, uppercase snake case for save payloads. **A quiz has exactly 1 category** — enforced at UI level (radio buttons) and backend validation (`@Size(max = 1)`). `gameConfig.js` `queryValidator` limits to 1 category.
- Do not blindly rename existing identifiers (`wildCards`, `changueCurrent`, `infiniteLifes`); they are referenced across files.
- Existing UI logic relies on direct DOM operations (`document.getElementById`, `querySelectorAll`) for dialogs, keyboard shortcuts, and animation classes.
- Score format: always `"correct/total"` string (e.g., "7/10").
- Store usage: always import from `useBoundStore`, never individual slice files.

## Integrations and Env

- Required env vars: `REST_API_URL`, `NEXT_PUBLIC_REST_API_URL`, `ANSWER_ENCRYPTION_KEY`, `STUDY_COACH_API_URL`, `COACH_API_KEY`, `NEXT_PUBLIC_STUDY_COACH_API_URL`.
- If the AI Coach enforces `COACH_API_KEY`, browser WebSocket clients also need `NEXT_PUBLIC_STUDY_COACH_API_KEY` so they can connect with `?api_key=...`.
- AI question generation: AI Study Coach `/generate/from-topics` and `/generate/from-file`.
- Step solving: AI Study Coach `/solve` through BFF `/api/coach/solve`.
- Firebase auth: client-side in `src/helpers/auth/firebase.js`; session auth uses `sessionStorage.user` + `dest` redirect.
- PWA: enabled through `next.config.js` (`@ducanh2912/next-pwa`), disabled in development.

## Developer Workflow

- Install: `npm install`
- Run local: `npm run dev`
- Validate build: `npm run build`
- Lint: `npm run lint`
- No `test` script exists in `package.json`; use lint plus manual flow checks or Playwright MCP (see `AGENTS-E2E-TEST.md` at root).

## How to Add Features Safely

- Follow existing layering: helper (`src/helpers`) → API route (`src/pages/api`) → store action (`src/store`) → UI component/page.
- Keep API error payload style `{ message, statusCode }` to match current callers.
- For protected create/profile actions, keep current pattern: set `dest`, open `authDialog`, resume action after login.
- For coach features, add actions in `useCoach` slice, route through `/api/coach/*` BFF, component in `src/components/Coach/`.
