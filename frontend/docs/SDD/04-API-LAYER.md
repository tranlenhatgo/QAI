# 04 — API Layer

## BFF Pattern

The frontend uses a Backend-For-Frontend pattern — browser code calls helper functions which hit Next.js API routes, which proxy to external services:

```
Browser → src/helpers/* → src/pages/api/* → External Services
```

This keeps secrets (API keys, encryption keys) server-side and provides a unified error shape.

---

## API Routes

| Route | Method | Target Service | Purpose |
|-------|--------|---------------|---------|
| `/api/auth/set-token` | POST | — | Store Firebase JWT in HttpOnly cookie |
| `/api/auth/clear-token` | POST | — | Clear auth cookie |
| `/api/auth/login` | POST | Firebase | Firebase login |
| `/api/auth/register` | POST | Firebase | Firebase register |
| `/api/questions` | POST | AI Study Coach | Generate questions from topics |
| `/api/question/get-ai-question` | POST | AI Study Coach | Generate single AI question |
| `/api/question/quiz-questions` | POST | Spring Boot | Get questions by quiz ID |
| `/api/question/check-answer` | POST | — | Decrypt & verify answer |
| `/api/question/get-answer` | POST | — | Decrypt correct answer |
| `/api/quiz/save-quiz` | POST | Spring Boot | Create new quiz |
| `/api/quiz/save-questions` | POST | Spring Boot | Save quiz questions |
| `/api/quiz/update-questions` | POST | Spring Boot | Update existing questions |
| `/api/quiz/get-quizzes` | POST | Spring Boot | Get user's quizzes |
| `/api/quiz/upload` | POST | AI Study Coach | Upload file for question generation |
| `/api/take/take-quiz` | POST | Spring Boot | Start quiz session |
| `/api/take/save-attempt` | POST | Spring Boot | Submit quiz results |
| `/api/coach/chat` | POST | AI Study Coach | Proxy to HTTP chat endpoint |

---

## Helper Functions

Located in `src/helpers/`, these abstract API route calls for components:

| Helper | Used By | Routes Called |
|--------|---------|--------------|
| `getQuestions()` | PlayForm, Play page | `/api/questions` |
| `takeQuiz()` | JoinGameForm | `/api/take/take-quiz` |
| `saveAttempt()` | GameOver | `/api/take/save-attempt` |
| `saveQuiz()` | Create page | `/api/quiz/save-quiz` + `/api/quiz/save-questions` |
| `getQuizzes()` | Profile | `/api/quiz/get-quizzes` |

---

## AI Study Coach Integration

Three API routes proxy to the AI Study Coach (`STUDY_COACH_API_URL`):

| Frontend Route | Coach Endpoint | Purpose |
|---------------|---------------|---------|
| `/api/questions` | `POST /generate/from-topics` | Generate questions from topic list |
| `/api/question/get-ai-question` | `POST /generate/get-question` | Generate single question |
| `/api/quiz/upload` | `POST /generate/from-file` | Generate from uploaded file |

All include `X-API-Key` header when `COACH_API_KEY` is set.
