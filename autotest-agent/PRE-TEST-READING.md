# Pre-Test Knowledge Acquisition

## Purpose

Before executing any test suite, the AI agent MUST read and understand the relevant source code and documentation to compare **intended behavior** (from docs/code) against **actual behavior** (from browser observation). This ensures tests validate correctness, not just "something works."

---

## Mandatory Reading Protocol

Before each test suite, the agent reads the corresponding files below. This is NOT optional — the agent must internalize the expected behavior BEFORE interacting with the browser.

---

### Before TC-01 (Quiz Creation)

**Read these files to understand how quiz creation works:**

| File | What to learn |
| --- | --- |
| `frontend/src/components/Create/CreateInfo.jsx` | How category selection works (radio toggle, single select) |
| `frontend/src/components/Form/NewGameForm.jsx` | How radio buttons render, category prop flow |
| `frontend/src/store/useCreate.js` | Store shape: `categories: []`, `addCreatedCategory` replaces (not appends) |
| `spring-backend/src/.../QuizCreationRequestDto.java` | `@Size(max=1)` on categories field |
| `spring-backend/src/.../QuizController.java` | `@Valid` annotation on create/update methods |
| `spring-backend/src/.../QuizService.java` | `create()` method — how categories stored as enum |
| `spring-backend/docs/SDD/[PARTIAL] 02-REST-API.md` | Expected request/response shapes |

**Key assertions to verify:**

- Input type is `radio` (not `checkbox`)
- Only 1 category can be selected at a time
- Backend rejects payload with >1 category

---

### Before TC-02 (Quiz Play)

**Read these files:**

| File | What to learn |
| --- | --- |
| `frontend/src/helpers/gameConfig.js` | `queryValidator` — how categories array is limited to 1 |
| `frontend/src/helpers/questions.js` | `getQuestions()` — calls AI Coach `/generate/from-topics` |
| `frontend/src/pages/play/index.js` | Play page initialization, query params parsing |
| `frontend/src/components/Questions/Questions.jsx` | Question rendering, answer selection, scoring |
| `frontend/src/components/Play/GameOver.jsx` | Score display, save attempt, confetti logic |
| `frontend/src/helpers/take-quiz.js` | `takeQuiz()` — quiz mode (existing quiz) flow |

**Key assertions to verify:**

- Questions array populated before rendering
- Score computed as `correct/total` string
- GameOver triggers `saveAttempt()` → Spring Boot

---

### Before TC-03 (Quiz Browser)

**Read these files:**

| File | What to learn |
| --- | --- |
| `frontend/src/components/Form/QuizBrowser.jsx` | Filter logic: `matchesSearch && matchesCategory` |
| `frontend/src/assets/categories.json` | Full category list (11 categories) |
| `spring-backend/src/.../QuizController.java` | `GET /quiz/category/{category}` endpoint |
| `spring-backend/src/.../QuizService.java` | `getQuizzesByCategory()` — Firestore query |

**Key assertions to verify:**

- Dropdown has 11 categories + "All categories" default
- Client-side filtering (not server-side for browse)
- Text search is case-insensitive on title

---

### Before TC-04 (AI Chat)

**Read these files:**

| File | What to learn |
| --- | --- |
| `frontend/src/store/useChat.js` (or chatStore) | WebSocket lifecycle: connect, send, receive, reconnect |
| `ai-study-coach/server/ws/handler.py` | WebSocket handler: session_start, user_message, mode_switch |
| `ai-study-coach/server/agent/coach.py` | `handle_chat()` vs `handle_chat_agentic()` |
| `ai-study-coach/server/llm/deepseek.py` | Full tier streaming (SSE parsing) |
| `ai-study-coach/server/llm/lm_studio.py` | Lite tier streaming |
| `ai-study-coach/server/agent/tool_executor.py` | What each tool does and returns |

**Key assertions to verify:**

- WebSocket message types: `session_start`, `session_ack`, `user_message`, `content`, `stage`, `tool`, `done`, `error`
- Agentic mode: max 3 tool rounds
- Tier switch: reconnects or sends mode_switch message
- Errors return user-friendly message (not stack trace)

---

### Before TC-05 (AI Generation)

**Read these files:**

| File | What to learn |
| --- | --- |
| `ai-study-coach/server/routes/generate.py` | `/generate/from-topics`, `/generate/from-file`, `/generate/get-question` |
| `frontend/src/components/Coach/GenerateQuestions.jsx` | UI for topic input, count, generate button |
| `frontend/src/pages/api/questions.js` | BFF proxy to AI Coach generation |
| `frontend/src/pages/api/quiz/upload.js` | File upload → AI Coach |

**Key assertions to verify:**

- Generated questions have: question text, 4 answers, correctAnswer field
- File upload accepted (multipart form)
- Count parameter respected (returns N questions)

---

### Before TC-06 (AI Solver)

**Read these files:**

| File | What to learn |
| --- | --- |
| `ai-study-coach/server/routes/solve.py` | Solve endpoint: 3-phase pipeline |
| `frontend/src/components/Coach/StepSolver.jsx` | Problem textarea, submit, steps display |
| `frontend/src/pages/api/coach/solve.js` | BFF proxy |

**Key assertions to verify:**

- Response is array of numbered steps
- Streaming: steps appear progressively
- Empty input: validation prevents submission

---

### Before TC-07 (Spaced Repetition)

**Read these files:**

| File | What to learn |
| --- | --- |
| `ai-study-coach/server/learning/spaced_repetition.py` | SM-2 algorithm: easiness, interval, repetitions |
| `ai-study-coach/server/routes/webhook.py` | `/webhook/quiz-completed` handler |
| `spring-backend/src/.../WebhookService.java` | How webhook fires after EndQuiz |
| `frontend/src/components/Coach/DueReviews.jsx` | DueReviews cards + [Review] button |
| `ai-study-coach/server/scheduler/scheduler.py` | Hourly due-review check |

**Key assertions to verify:**

- SM-2 formulas: EF' = EF + (0.1 - (5-q)(0.08+(5-q)*0.02))
- Interval calculation: 1, 6, then previous * EF
- Poor score (q<3) resets interval to 1
- Webhook payload: user_id, quiz_id, score, category, completed_at

---

### Before TC-08 (Progress Tracking)

**Read these files:**

| File | What to learn |
| --- | --- |
| `ai-study-coach/server/learning/progress.py` | ProgressTracker: mastery, velocity, streaks |
| `ai-study-coach/server/routes/progress.py` | `/progress/{user_id}` response shape |
| `frontend/src/components/Coach/ProgressOverview.jsx` | Trend chart rendering |
| `frontend/src/components/Coach/MasteryBreakdown.jsx` | Per-category bars |
| `frontend/src/components/Coach/MyWeaknesses.jsx` | Weakness cards + [Practice] |

**Key assertions to verify:**

- Mastery uses exponential decay (recent scores weighted more)
- Weak categories: mastery below threshold (e.g., 0.5)
- Progress response includes: scores_over_time, mastery_by_category, weak_categories

---

### Before TC-09 (Notifications)

**Read these files:**

| File | What to learn |
| --- | --- |
| `frontend/src/components/Coach/NotificationBell.jsx` | Polling, badge, dismiss |
| `frontend/src/pages/api/coach/notifications/[userId].js` | BFF fetch notifications |
| `frontend/src/pages/api/coach/notifications/[id]/read.js` | BFF mark-read |
| `ai-study-coach/server/scheduler/scheduler.py` | How notifications are created |

**Key assertions to verify:**

- Notifications stored in Firestore `notification` collection
- Fields: id, user_id, title, message, type, read, created_at
- Mark-read is PATCH (partial update, not delete)

---

### Before TC-10 (Cross-Service)

**Read ALL files listed above + these integration files:**

| File | What to learn |
| --- | --- |
| `ai-study-coach/server/quiz_client/client.py` | How AI Coach calls Spring Boot API |
| `spring-backend/src/.../TakeQuizService.java` | EndQuiz → score → webhook |
| `frontend/AGENTS.md` | Full data flow overview |
| `ai-study-coach/AGENTS.md` | Architecture + tool list |
| `AGENTS.md` (root) | Cross-cutting conventions, data flow diagram |

**Key assertions to verify:**

- Data flows correctly across all 3 services
- Category stays consistent (lowercase) throughout the chain
- Score format `"X/Y"` parsed correctly everywhere
- Failures degrade gracefully (no crashes)

---

## Agent Execution Protocol

```text
FOR EACH test suite file (01 through 10):
  1. READ all files in the "Before TC-XX" section above
  2. SUMMARIZE key behavioral expectations from the code
  3. NOTE any discrepancies between code comments and actual logic
  4. EXECUTE the test steps using Playwright MCP
  5. COMPARE observed behavior against code-derived expectations
  6. REPORT: PASS (matches code intent) or FAIL (diverges from code intent)
     - If FAIL: identify whether it's a UI bug, API bug, or doc/code mismatch
```

This ensures the agent tests against the **source of truth** (code), not just assumed behavior.
