# 04 — Data Flows

## Quiz Creation

```
POST /quiz
  → QuizController.create(QuizCreationRequestDto)
  → QuizService.create()
    → IdUtil.generateId() → 8-char ID
    → Categories: List<String> → List<Category> enum (uppercase)
    → Timestamps: ISO-8601 → TimestampDeserializer → Firestore Timestamp
    → Firestore.collection("quiz").document(id).set(quiz)
  ← QuizResponseDto { id, title, ... }
```

---

## Question Creation (Bulk)

```
POST /question { quizId, questions[] }
  → QuestionController.create(QuestionCreationRequestDto)
  → QuestionService.create()
    → For each question: IdUtil.generateId() → 8-char ID
    → Firestore.collection("question").document(id).set(question)
  ← QuestionResponseDto[]
```

---

## Quiz Taking (Start)

```
POST /take-quiz/start { quizId, playerId, playerName }
  → TakeQuizController.start(TakeQuizStartRequestDto)
  → TakeQuizService.StartQuiz()
    → IdUtil.generateId() → takeId
    → Creates take_quiz record (status=PENDING, start_time=now)
    → Fetches all questions for quizId from question collection
  ← TakeQuizStartResponseDto { takeId, questions[] }
```

---

## Quiz Taking (End)

```
POST /take-quiz/end { takeId, takeQuestionSaveRequestDtos[] }
  → TakeQuizController.end(TakeQuizEndRequestDto)
  → TakeQuizService.EndQuiz()
    → For each answer:
      → IdUtil.generateId() → take_question ID
      → Saves to take_question collection
    → Counts correct answers (check_answer == "1" or "2")
    → Computes score string: "correct/total"
    → Updates take_quiz: status=COMPLETED, score, end_time=now
  ← TakeQuizResponseDto { score, status, ... }
```

---

## User Profile Aggregation

```
GET /user/quiz-profile?userId=abc123
  → UserController.getQuizProfile(userId)
  → UserService.getQuizProfile()
    → Queries quiz collection (host_id == userId) → created quizzes
    → Queries take_quiz collection (player_id == userId) → attempts
    → Aggregates: total quizzes, total attempts, scores
  ← UserQuizResponseDto { createdQuizzes[], attempts[], stats }
```

---

## AI Question Generation

> **Moved to AI Study Coach** — Spring Boot no longer participates in question generation.
>
> Previous flow (removed):
> - Frontend → Spring Boot `/n8n/*` → n8n webhook → LLM
>
> Current flow:
> - Frontend → AI Study Coach `/generate/*` → DeepSeek LLM → response
> - Spring Boot is only called to persist the generated questions via `POST /question`
