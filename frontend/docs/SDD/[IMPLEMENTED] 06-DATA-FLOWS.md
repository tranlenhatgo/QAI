# 06 — Data Flows

## New Game Flow

```text
PlayForm.jsx → build query params (single category) → navigate to /play
  → pages/play/index.js → queryValidator(queries) → limits to 1 category
  → getQuestions(categories, count) → AI Study Coach /generate/from-topics
  → render Questions.jsx with timer
```text
**Actors**: User → PlayForm → Play page → AI Study Coach
**Result**: Question set loaded, gameplay starts

---

## Quiz Room Flow

```text
JoinGameForm.jsx → takeQuiz() helper → queries.quizmode=true
  → /play → fetch quiz questions from Spring Boot backend
  → answers encrypted at API layer (check-answer, get-answer)
```text
**Actors**: User → JoinGameForm → Play page → Spring Boot
**Result**: Existing quiz loaded for play with encrypted answers

---

## Game Completion Flow

```text
GameOver.jsx → saveAttempt() → POST /api/take/save-attempt
  → Spring Boot: TakeQuizService.EndQuiz()
  → computes score ("correct/total")
  → displays result + confetti animation
```text
**Actors**: Play page → GameOver component → Spring Boot
**Result**: Attempt saved, score displayed

---

## AI Coach Flow (WebSocket)

```text
useChat store → connectChat() → ws://{COACH_URL}/ws
  → send: {type: "session_start", tier, mode, user_id}
  → receive: {type: "session_ack", ...}
  → send: {type: "user_message", content: "...", history: [...]}
  → receive: {type: "content|stage|tool|done|error", ...}
```text
**Actors**: Chat page → useChat store → AI Study Coach WebSocket
**Result**: Streaming AI response rendered in chat UI

---

## AI Question Generation Flow

```text
Create page (upload) → POST /api/quiz/upload → AI Coach /generate/from-file
  → LLM generates questions from document content
  → returns GeneratedQuestion[] → displayed in CreateQuestions.jsx
```text
**Actors**: Create page → Next.js API route → AI Study Coach → DeepSeek LLM
**Result**: Generated questions available for quiz creation

---

## Quiz Creation Flow

```text
CreateInfo.jsx (title, desc, single category via radio) + CreateQuestions.jsx (questions[])
  → saveQuiz() helper
  → POST /api/quiz/save-quiz → Spring Boot validates @Size(max=1) on categories → creates quiz
  → POST /api/quiz/save-questions → Spring Boot stores questions
```text
**Actors**: Create page → helpers → Spring Boot → Firestore
**Result**: Quiz + questions persisted, quiz ID returned

---

## Quiz Browser Flow

```text
QuizBrowser.jsx → fetches all quizzes via API
  → user filters by title (text search) and/or category (dropdown)
  → filter logic: matchesSearch && matchesCategory (client-side)
  → user selects quiz → navigates to play
```text
**Actors**: User → QuizBrowser → Spring Boot → Play page
**Result**: User finds and plays an existing quiz by title or category

---

## Spaced Repetition Review Flow

```text
CoachDashboard → DueReviews.jsx → useCoach.fetchDueReviews()
  → GET /api/coach/progress/{userId} → AI Coach /progress/{user_id}
  → returns due_reviews[] with quiz_id, category, scheduled_date
  → user clicks [Review] → navigates to /play with quiz
  → GameOver → POST /api/coach/review-completed → AI Coach /webhook/quiz-completed
  → AI Coach recalculates interval (SM-2) → schedules next review
```text
**Actors**: Coach Dashboard → DueReviews → Play page → AI Study Coach → Scheduler
**Result**: Review quiz completed, next interval calculated, next review date set

---

## Notification Flow

```text
AI Coach scheduler (APScheduler) → fires review_due event
  → creates Notification document in Firestore (via Spring Boot)
  → NotificationBell.jsx polls GET /api/coach/notifications/{userId}
  → displays unread count badge + dropdown list
  → user clicks dismiss → PATCH /api/coach/notifications/{id}/read
```text
**Actors**: AI Coach scheduler → Spring Boot → Firestore → NotificationBell component
**Result**: User sees upcoming review reminders, can dismiss after reading

---

## Progress Tracking Flow

```text
CoachDashboard → ProgressOverview.jsx → useCoach.fetchProgress()
  → GET /api/coach/progress/{userId} → AI Coach /progress/{user_id}
  → returns { scores_over_time[], mastery_by_category{}, weak_categories[] }
  → ProgressOverview renders SVG trend chart
  → MasteryBreakdown renders per-category progress bars
  → MyWeaknesses renders weak category cards with [Practice] buttons
```

**Actors**: Coach Dashboard → Progress components → AI Study Coach → Firestore
**Result**: User sees score trend, mastery levels, and identified weaknesses
