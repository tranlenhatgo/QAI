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
| LM Studio | local server on :1234 | Load a model in LM Studio and run it |

Optional: n8n (for AI question generation).

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
# NEXT_PUBLIC_STUDY_COACH_API_KEY=optional-api-key-for-browser-websocket
ANSWER_ENCRYPTION_KEY=any-random-string-32-chars
COHERE_API_KEY=your-cohere-key   # optional, for AI questions via Cohere
```

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
# COACH_EXTERNAL_LLM_MODEL=optional-loaded-model-id
COACH_API_KEY=optional-api-key-for-auth
```

### LM Studio Setup

Download and install [LM Studio](https://lmstudio.ai), load a model in the app, and start the local server on port 1234. The coach auto-detects LM Studio via the `/v1/models` endpoint.

---

## 4. Optional: n8n (:5678)

```bash
n8n start
# Configure webhooks at http://localhost:5678
```

---

## Running All Together

Terminal 1: `cd spring-backend && .\mvnw.cmd spring-boot:run`
Terminal 2: `cd frontend && npm run dev`
Terminal 3: `cd ai-study-coach && venv\Scripts\activate && python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000`

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| Coach API | http://localhost:8000 |
| Coach Docs | http://localhost:8000/docs |
| n8n | http://localhost:5678 |

---

## Quick Test Flow

1. Open `http://localhost:3000` → log in with Google
2. Create a quiz → add questions → save
3. Play the quiz → submit answers
4. Open Coach chat widget → ask "How am I doing?"
5. Coach fetches your history, analyzes weaknesses, responds

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `contextLoads` test fails | Missing `serviceAccountKey.json` — add file or use `-DskipTests` |
| Coach: "No LLM available" | Start LM Studio, load a model, and ensure it's running on :1234 |
| Coach can't reach quiz API | Ensure Spring Boot is running on :8080, check `COACH_QUIZ_API_URL` |
| Frontend API calls fail | Check `REST_API_URL` in `.env.local` points to :8080 |
| Firestore errors | Verify `serviceAccountKey.json` is valid and Firestore is enabled |
