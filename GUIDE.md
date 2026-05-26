# QAI — Setup & Run Guide

## Dev note

- Account: username: `User1`, email: `testuser1@gmail.com`, password: `testuser` (for testing only, no real user data)

## Prerequisites

| Dependency | Version | Check |
|------------|---------|-------|
| Java JDK | 17+ | `java --version` |
| Node.js | 18+ | `node --version` |
| Python | 3.12+ | `python --version` |
| Maven Wrapper | bundled | `spring-backend/mvnw.cmd` |
| Firebase service account | JSON key file | place at `spring-backend/src/main/resources/serviceAccountKey.json` |
| LM Studio | local server on :1234 | Load a model in LM Studio and start the server |

---

## 1. Spring Boot Backend (:8080)

```bash
cd spring-backend

# Build (skip tests if no serviceAccountKey.json yet)
.\mvnw.cmd -q -DskipTests package

# Run
.\mvnw.cmd spring-boot:run
```

Verify: `curl http://localhost:8080/quiz` returns `[]` (empty Firestore).

### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service Accounts
2. Generate new private key → download JSON
3. Save as `spring-backend/src/main/resources/serviceAccountKey.json`

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/quiz` | GET | List all active quizzes |
| `/quiz/{id}` | GET | Get quiz by ID |
| `/quiz/user/{userId}` | GET | Get quizzes by creator |
| `/quiz` | POST | Create quiz |
| `/question/quizId/{quizId}` | GET | Get questions for a quiz |
| `/take-quiz/start` | POST | Start quiz attempt |
| `/take-quiz/end` | POST | End quiz attempt (triggers webhook) |
| `/take-quiz/player/{playerId}` | GET | Get player's quiz history |
| `/review-schedule` | POST | Upsert review schedule (from AI Coach) |
| `/review-schedule/user/{userId}` | GET | Get user's review schedules |
| `/review-schedule/due` | GET | Get all due reviews |
| `/notification` | POST | Create notification (from AI Coach) |
| `/notification/user/{userId}/unread` | GET | Get unread notifications |
| `/user/quiz-profile` | GET | Aggregated quiz profile |

---

## 2. Frontend (:3000)

```bash
cd frontend

# Install
npm install

# Run dev server
npm run dev
```

Verify: open `http://localhost:3000`.

### Required Env Vars

Create `frontend/.env.local`:
```
REST_API_URL=http://localhost:8080
NEXT_PUBLIC_REST_API_URL=http://localhost:8080
NEXT_PUBLIC_STUDY_COACH_API_URL=http://localhost:8000
NEXT_PUBLIC_STUDY_COACH_TIER=lite
ANSWER_ENCRYPTION_KEY=any-random-string-32-chars
FIREBASE_WEB_API_KEY=your-firebase-web-api-key
```

### Key Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page, categories, game modes |
| `/play` | Quiz gameplay (timer, questions, scoring) |
| `/create` | Create quizzes (manual + AI generation) |
| `/profile` | User profile, quiz history |
| `/coach` | AI Coach Dashboard (Overview, Generate, Solver, Materials, Weaknesses, Chat) |

---

## 3. AI Study Coach (:8000)

```bash
cd ai-study-coach

# Create venv (first time only)
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # Mac/Linux

# Install deps
pip install -r requirements.txt

# Configure
copy .env.example .env
# Edit .env — set at minimum COACH_LM_STUDIO_URL

# Run
python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
```

Verify: `curl http://localhost:8000/health` returns `{"status":"ok"}`.

### Required Env Vars

Edit `ai-study-coach/.env`:
```
COACH_QUIZ_API_URL=http://localhost:8080
COACH_EXTERNAL_LLM_PROVIDER=lm_studio
COACH_LM_STUDIO_URL=http://127.0.0.1:1234
COACH_API_KEY=sc-dev-key-change-me-in-production
COACH_SUPABASE_URL=your-supabase-url        # for RAG
COACH_SUPABASE_KEY=your-supabase-key        # for RAG
```

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ws` | WebSocket | Streaming AI chat (primary interface) |
| `/health` | GET | Health check + LLM status |
| `/chat/{mode}` | POST | HTTP chat (legacy compatibility) |
| `/generate/from-topics` | POST | AI question generation from topics |
| `/generate/from-file` | POST | AI question generation from file |
| `/generate/get-question` | POST | Generate single question |
| `/solve` | POST | Step-by-step problem solver |
| `/progress/{user_id}` | GET | Progress metrics + due reviews |
| `/webhook/quiz-completed` | POST | Quiz completion webhook (from Spring Boot) |

### LM Studio Setup

Download and install [LM Studio](https://lmstudio.ai), load a model in the app, and start the local server on port 1234. The coach auto-detects LM Studio via the `/v1/models` endpoint. Recommended models: any instruction-tuned model with 7B+ parameters.

---

## 4. Running All Together

Terminal 1: `cd spring-backend && .\mvnw.cmd spring-boot:run`
Terminal 2: `cd frontend && npm run dev`
Terminal 3: `cd ai-study-coach && venv\Scripts\activate && python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000`

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| Coach API | http://localhost:8000 |
| Coach Swagger | http://localhost:8000/docs |

---

## Optional: Firestore MCP

The repo includes `firestore-mcp/`, a Python MCP server for direct CRUD access to QAI Firestore collections:

```bash
cd firestore-mcp
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

By default it uses `spring-backend/src/main/resources/serviceAccountKey.json`.

Important: this MCP bypasses Spring Boot validation and can permanently delete Firestore documents. Use the QAI schema field names documented in `firestore-mcp/README.md`.

---

## 5. Integration Flow (How Components Connect)

```
User plays quiz → Frontend → POST /take-quiz/end → Spring Boot
                                                   ↓
                              Spring Boot fires POST /webhook/quiz-completed → AI Coach
                                                                              ↓
                              AI Coach updates SM-2 schedule → POST /review-schedule → Spring Boot → Firestore
                                                                              ↓
                              Scheduler (hourly) checks due → POST /notification → Spring Boot → Firestore
                                                                              ↓
                              Frontend polls notifications → NotificationBell → User sees "Review Math!"
```

### Webhook Configuration

Spring Boot → AI Coach webhook is configured in `spring-backend/src/main/resources/application.properties`:
```properties
coach.webhook.url=http://localhost:8000/webhook/quiz-completed
coach.webhook.api-key=sc-dev-key-change-me-in-production
coach.webhook.enabled=true
```

The API key must match `COACH_API_KEY` in the AI Coach `.env`.

---

## Quick Test Flow

1. Open `http://localhost:3000` → log in with test account or Google
2. Click PLAY → browse available quizzes or create a new game
3. Complete the quiz → score is shown
4. Open Coach (`/coach`) → chat asks "How am I doing?"
5. Coach fetches history, analyzes weaknesses, responds with advice
6. Due reviews appear in Coach → DueReviews tab → click [Review] to replay

---

## Testing

```bash
# Spring Boot: compile check
cd spring-backend && .\mvnw.cmd -q -DskipTests compile

# AI Coach: unit tests (10 tests)
cd ai-study-coach && python -m pytest tests/ -v

# Frontend: lint
cd frontend && npm run lint
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `contextLoads` test fails | Missing `serviceAccountKey.json` — add file or use `-DskipTests` |
| Coach: "No LLM available" | Start LM Studio, load a model, ensure it's running on :1234 |
| Coach can't reach quiz API | Ensure Spring Boot is running on :8080, check `COACH_QUIZ_API_URL` |
| Frontend API calls fail | Check `REST_API_URL` in `.env.local` points to :8080 |
| Firestore errors | Verify `serviceAccountKey.json` is valid and Firestore is enabled |
| Webhook not firing | Check `coach.webhook.enabled=true` and API key matches |
| WebSocket connection refused | Ensure AI Coach is running, check `NEXT_PUBLIC_STUDY_COACH_API_URL` |
| Notifications not appearing | Verify scheduler is running (check Coach logs for "scheduler started") |
