# 06 — Data Flows

## New Game Flow

```
PlayForm.jsx → build query params → navigate to /play
  → pages/play/index.js → queryValidator(queries)
  → getQuestions(categories, count) → AI Study Coach /generate/from-topics
  → render Questions.jsx with timer
```

**Actors**: User → PlayForm → Play page → AI Study Coach
**Result**: Question set loaded, gameplay starts

---

## Quiz Room Flow

```
JoinGameForm.jsx → takeQuiz() helper → queries.quizmode=true
  → /play → fetch quiz questions from Spring Boot backend
  → answers encrypted at API layer (check-answer, get-answer)
```

**Actors**: User → JoinGameForm → Play page → Spring Boot
**Result**: Existing quiz loaded for play with encrypted answers

---

## Game Completion Flow

```
GameOver.jsx → saveAttempt() → POST /api/take/save-attempt
  → Spring Boot: TakeQuizService.EndQuiz()
  → computes score ("correct/total")
  → displays result + confetti animation
```

**Actors**: Play page → GameOver component → Spring Boot
**Result**: Attempt saved, score displayed

---

## AI Coach Flow (WebSocket)

```
useChat store → openChatSocket() → ws://{COACH_URL}/ws/chat
  → send: {type: "chat_message", content: "..."}
  → receive: {type: "stream_chunk|stream_end|error", ...}
  → fallback: POST /api/coach/chat (HTTP) on failure
```

**Actors**: Chat page → useChat store → AI Study Coach WebSocket
**Result**: Streaming AI response rendered in chat UI

---

## AI Question Generation Flow

```
Create page (upload) → POST /api/quiz/upload → AI Coach /generate/from-file
  → LLM generates questions from document content
  → returns GeneratedQuestion[] → displayed in CreateQuestions.jsx
```

**Actors**: Create page → Next.js API route → AI Study Coach → DeepSeek LLM
**Result**: Generated questions available for quiz creation

---

## Quiz Creation Flow

```
CreateInfo.jsx (title, desc, categories) + CreateQuestions.jsx (questions[])
  → saveQuiz() helper
  → POST /api/quiz/save-quiz → Spring Boot creates quiz
  → POST /api/quiz/save-questions → Spring Boot stores questions
```

**Actors**: Create page → helpers → Spring Boot → Firestore
**Result**: Quiz + questions persisted, quiz ID returned
