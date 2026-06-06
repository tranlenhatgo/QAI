# AI Study Coach — API Reference (Postman Testing Guide)

> **Base URL:** `http://localhost:8000`  
> **Start server:** `python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000`
---

## 1. Root
**Check the service is running.**
```
GET /
```
**Response:**
```json
{
    "service": "AI Study Coach",
    "version": "0.1.0",
    "docs": "/docs"
}
```

---
## 2. Health Check
**Check LLM connectivity (Ollama + external API).**
```
GET /health
```
**Response:**
```json
{
    "status": "ok",
    "ollama": "connected",
    "external_llm": "configured"
}
```
| Field | Values |
|-------|--------|
| `status` | `"ok"` (at least 1 LLM available) or `"degraded"` (none) |
| `ollama` | `"connected"` or `"unavailable"` |
| `external_llm` | `"configured"` or `"not configured"` |

---
## 3. Chat (Simple HTTP Compatibility)
**Compatibility endpoint for non-streaming clients. The frontend and widgets use WebSocket chat by default.**
```
POST /chat
Content-Type: application/json
```
**Request Body:**
```json
{
    "user_id": "test_user_001",
    "message": "I scored 40% on my Math quiz. Help me improve.",
    "history": []
}
```
**Response:**
```json
{
    "role": "assistant",
    "content": "Let's work on improving your Math score! 📊\n\n**Your Score: 40%** ...",
    "weaknesses": ["MATH", "SCIENCE"],
    "due_reviews": null,
    "actions": null
}
```
### With Conversation History
To continue a conversation, pass previous messages in `history`:
```json
{
    "user_id": "test_user_001",
    "message": "What about Science?",
    "history": [
        {
            "role": "user",
            "content": "I scored 40% on my Math quiz. Help me improve."
        },
        {
            "role": "assistant",
            "content": "Let's work on improving your Math score! ..."
        }
    ]
}
```
---
## 4. Chat Agentic (HTTP Compatibility)
**Compatibility endpoint for non-streaming tool-use clients. The frontend and widgets use WebSocket chat by default.** The coach can decide to navigate pages, start quizzes, generate questions, etc.
```
POST /chat/agentic
Content-Type: application/json
```
**Request Body:** (same format as `/chat`)
```json
{
    "user_id": "test_user_001",
    "message": "Take me to the quiz list page",
    "history": []
}
```
**Response:**
```json
{
    "role": "assistant",
    "content": "I'll navigate you to the quiz list page right away! 📋",
    "weaknesses": null,
    "due_reviews": null,
    "actions": [
        {
            "action": "navigate",
            "params": {
                "page": "quiz-list"
            },
            "label": "Opening quiz list"
        }
    ]
}
```
### Possible Actions
The `actions` array may contain these action types:
| Action | Params | Description |
|--------|--------|-------------|
| `navigate` | `{"page": "dashboard"}` | Navigate to a page |
| `start_quiz` | `{"quiz_id": "abc123"}` | Start a specific quiz |
| `generate_questions` | `{"topics": ["Math"]}` | Generate AI questions |
| `show_results` | `{"quiz_id": "abc123"}` | Show quiz results |
| `create_practice_quiz` | `{"categories": ["MATH"]}` | Create a practice quiz |
| `show_weakness_report` | `{}` | Display weakness report |
| `search_quizzes` | `{"category": "MATH"}` | Search quizzes |
### Test Prompts for Agentic Mode
Copy these into Postman to trigger different tools:
```json
// Navigation
{"user_id": "test_user_001", "message": "Go to my dashboard", "history": []}
// Start a quiz
{"user_id": "test_user_001", "message": "Start a Math quiz for me", "history": []}
// Generate questions
{"user_id": "test_user_001", "message": "Generate some Science questions about the Solar System", "history": []}
// Weakness report
{"user_id": "test_user_001", "message": "Show me my weakness report", "history": []}
// Study plan (no tool, just coaching)
{"user_id": "test_user_001", "message": "Create a study plan for this week", "history": []}
// Search quizzes
{"user_id": "test_user_001", "message": "Find me Geography quizzes", "history": []}
```
---
## 5. WebSocket Chat (Streaming)
**Real-time streaming chat with agentic actions.** Use Postman's WebSocket feature or a WebSocket client.
```
WS ws://localhost:8000/ws
```
### Connect
Open a WebSocket connection to `ws://localhost:8000/ws`. If `COACH_API_KEY` is set on the AI Coach service, connect with `?api_key=YOUR_KEY`.
### Start a Session
```json
{"type": "session_start", "tier": "full", "mode": "agentic", "user_id": "test_user_001"}
```
### Send a Message
```json
{"type": "user_message", "content": "What are my weakest subjects?", "history": []}
```
### Receive Messages
The server sends multiple messages in sequence:
**1. Content chunks:**
```json
{"type": "content", "content": "Your"}
{"type": "content", "content": " weakest"}
{"type": "content", "content": " subjects"}
```
**2. Tool events (agentic mode):**
```json
{"type": "tool", "tool_name": "quiz_history", "status": "calling"}
{"type": "tool", "tool_name": "quiz_history", "status": "result", "result": "..."}
```
**3. Done signal (always last):**
```json
{"type": "done"}
```
**4. Error (if something goes wrong):**
```json
{"type": "error", "message": "Failed to generate response."}
```
### Testing WebSocket in Postman
1. Click **New** → **WebSocket**
2. Enter URL: `ws://localhost:8000/ws`
3. Click **Connect**
4. In the message box, paste:
```json
{"type": "session_start", "tier": "full", "mode": "agentic", "user_id": "test_user_001"}
```
5. Click **Send**, wait for `session_ack`, then send:
```json
{"type": "user_message", "content": "Help me study", "history": []}
```
6. Watch the response stream in real-time
---
## 6. Swagger Docs (Auto-Generated)
FastAPI provides interactive docs:
```
GET /docs        → Swagger UI (interactive, try endpoints directly)
GET /redoc       → ReDoc (readable documentation)
```
---
## 7. Widget Static Files
The chat widget files are served at:
```
GET /static/widget.js    → Chat widget JavaScript
GET /static/widget.css   → Chat widget styles
```
---
## Postman Setup Tips
### Create a Collection
1. Create a new Collection: **"AI Study Coach"**
2. Add a variable: `base_url` = `http://localhost:8000`
3. Use `{{base_url}}` in all request URLs
### Environment Variables
| Variable | Value |
|----------|-------|
| `base_url` | `http://localhost:8000` |
| `user_id` | `test_user_001` |
### Request Order for Testing
Run in this order:
1. `GET {{base_url}}/` — verify server is up
2. `GET {{base_url}}/health` — verify LLM is connected
3. `WS ws://localhost:8000/ws` — test primary streaming chat
4. `POST {{base_url}}/chat` — test HTTP compatibility chat
5. `POST {{base_url}}/chat/agentic` — test HTTP compatibility agentic mode
---
## Notes
- **No authentication** — all endpoints are open (for development)
- **user_id** — must match a user in your Spring Boot quiz app for real quiz data. If the user doesn't exist, the coach will still respond but without quiz-specific context
- **LLM priority** — Ollama (Gemma 4 E2B) is tried first, Gemini API is the fallback
- **Timeout** — responses from local Ollama take ~20-35s on RTX 3050. Set Postman timeout to 120s
- **CORS** — configured for `http://localhost:3000` (your Next.js frontend)
