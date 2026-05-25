# AGENTS.md

## Big Picture
- This is a Next.js Pages Router frontend (no `app/`) for Qraft quiz play, quiz-room features, and the AI Coach dashboard.
- `src/pages/_app.js` mounts global dialogs once (`PlayForm`, `AuthForm`, `CreateQuizRoomForm`), and pages trigger them by DOM id.
- State is centralized in merged Zustand slices via `src/store/useBoundStore.js`.
- The app is a BFF frontend: browser -> `src/helpers/**` -> `src/pages/api/**` -> external REST services.

## Core Data Flows
- New game flow: `src/components/Form/PlayForm.jsx` builds query -> `/play` -> `src/pages/play/index.js` validates with `queryValidator` -> `getQuestions`.
- Join quiz room flow: `takeQuiz` (`src/helpers/take/takeQuiz.js`) -> `queries.quizmode=true` -> `/play`.
- Quiz-room answers are encrypted at fetch time in `src/pages/api/take/take-quiz.js`, then checked/decrypted via `src/pages/api/question/check-answer.js` and `src/pages/api/question/get-answer.js`.
- Game result submission happens in `src/components/Play/GameOver.jsx` via `src/helpers/take/saveAttempt.js`.
- AI Coach dashboard flow: `/coach` -> `src/components/Coach/**` -> `useCoach` -> `/api/coach/generate-questions` and `/api/coach/solve`.

## Conventions to Preserve
- Keep `queries` shape from `src/helpers/gameConfig.js` (`questions`, `time`, `infinitymode`, `timemode`, `quizmode`, `quizId`, `name`, `categories`).
- Keep question object compatibility across flows: `{ question, answers, correctAnswer, userAnswer, answer, ... }`.
- Category values are transformed by layer:
  ids in query state (`categories.json` ids), names for local generation (`src/helpers/getQuestions.js`), uppercase snake case for save payloads (`src/helpers/quiz/saveQuiz.js`).
- Do not blindly rename existing identifiers (`wildCards`, `changueCurrent`, `infiniteLifes`); they are referenced across files.
- Existing UI logic relies on direct DOM operations (`document.getElementById`, `querySelectorAll`) for dialogs, keyboard shortcuts, and animation classes.

## Integrations and Env
- Required env vars discovered in code: `REST_API_URL`, `NEXT_PUBLIC_REST_API_URL`, `ANSWER_ENCRYPTION_KEY`, `STUDY_COACH_API_URL` (or `NEXT_PUBLIC_STUDY_COACH_API_URL`), `COACH_API_KEY` (or legacy `STUDY_COACH_API_KEY` for chat).
- AI question generation calls AI Study Coach `/generate/from-topics` and `/generate/from-file` endpoints (replaced Cohere + n8n).
- Step solving calls AI Study Coach `/solve` through the protected frontend BFF route `/api/coach/solve`.
- Firebase auth is client-side in `src/helpers/auth/firebase.js`; session auth UX uses `sessionStorage.user` + `dest` redirect state in `useAuth`.
- PWA is enabled through `next.config.js` (`@ducanh2912/next-pwa`) and disabled in development.

## Developer Workflow
- Install: `npm install`
- Run local: `npm run dev`
- Validate build: `npm run build`
- Lint: `npm run lint`
- No `test` script exists in `package.json`; use lint plus manual play/create/profile flow checks.

## How to Add Features Safely
- Follow existing layering: helper (`src/helpers`) -> API route (`src/pages/api`) -> store action (`src/store`) -> UI component/page.
- Keep API error payload style `{ message, statusCode }` to match current callers.
- For protected create/profile actions, keep current pattern: set `dest`, open `authDialog`, resume action after login.
