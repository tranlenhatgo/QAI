# 04 — Data Flows

## Quiz Creation

```
POST /quiz
  → QuizController.create(@Valid QuizCreationRequestDto)
  → Validation: @Size(max=1) on categories list
  → QuizService.create()
    → IdUtil.generateId() → 8-char ID
    → Categories: List<String> (max 1) → List<Category> enum (uppercase)
    → Timestamps: ISO-8601 → TimestampDeserializer → Firestore Timestamp
    → Firestore.collection("quiz").document(id).set(quiz)
  ← QuizResponseDto { id, title, categories (lowercase), ... }
```

---

## Get Quizzes by Category

```
GET /quiz/category/{category}
  → QuizController.getByCategory(category)
  → QuizService.getQuizzesByCategory(category)
    → Category.valueOf(category.toUpperCase()) → validate enum
    → Firestore query: status==ACTIVE && categories array-contains CATEGORY_ENUM
  ← List<QuizResponseDto> (categories returned as lowercase)
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
    → Counts correct answers (check_answer == "CORRECT")
    → Computes score string: "correct/total"
    → Updates take_quiz: status=ACTIVE, score, end_time=now
    → Sends AI Coach webhook for spaced repetition
  ← { message: "Quiz ended successfully" }
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

## Subscription Entitlement

```
GET /subscription/current
  -> SubscriptionController verifies Firebase bearer token
  -> FirebaseAuth derives uid
  -> SubscriptionService reads users/{uid}/subscription/current
  -> missing doc returns virtual legacy Full access
  -> expired monthly/yearly doc is downgraded to fullAccess=false
```

```
POST /subscription/checkout { plan }
  -> controller verifies token and validates plan
  -> service writes users/{uid}/subscription/current
  -> response returns active Full subscription
```

---

## Adaptive Infinity Practice

```
GET /adaptive-practice/session-state?category=sports
  -> AdaptivePracticeController verifies Firebase bearer token
  -> AdaptivePracticeService normalizes category to lowercase
  -> reads only users/{uid}/adaptive_practice_answers for that category
  -> returns answeredStaticQuestionIds, wrongQuestions, recentAnswers
```

```
POST /adaptive-practice/answer
  -> validates category, question, answers, correctAnswer, selectedAnswer, correct, source
  -> writes users/{uid}/adaptive_practice_answers/{id}
  -> does not create take_quiz, take_question, review_schedule, or notification records
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
