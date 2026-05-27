# 02 — REST API

## Endpoints

### Quiz Management (`/quiz`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/quiz` | Create a new quiz (max 1 category, validated with `@Valid`) |
| GET | `/quiz` | Get all active quizzes |
| GET | `/quiz/{id}` | Get quiz by ID |
| GET | `/quiz/user/{userId}` | Get all quizzes by user |
| GET | `/quiz/category/{category}` | Get active quizzes by category (e.g., `math`) |
| PUT | `/quiz/update/{id}` | Update quiz (max 1 category, validated with `@Valid`) |

### Question Management (`/question`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/question` | Create questions (bulk) |
| GET | `/question/quizId/{quizId}` | Get questions by quiz |
| GET | `/question/id={id}` | Get question by ID |
| POST | `/question/update` | Update questions (bulk, upsert) |

### Quiz Taking (`/take-quiz`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/take-quiz/start` | Start a quiz session (creates `take_quiz` record) |
| POST | `/take-quiz/end` | Submit answers, compute score, update status |
| GET | `/take-quiz/player/{playerId}` | Completed quiz attempts for AI Coach history |

### User (`/user`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user/quiz-profile?userId=` | Aggregated profile (created quizzes + attempts) |

---

## Request/Response DTOs

### Quiz Creation

**Request** (`QuizCreationRequestDto`):
```json
{
  "host_id": "abc12345",
  "title": "My Quiz",
  "description": "A sample quiz",
  "categories": ["MATH"],
  "start_time": "2024-01-01T10:00:00Z",
  "end_time": "2024-01-01T11:00:00Z"
}
```

**Response** (`QuizResponseDto`):
```json
{
  "quiz_id": "q1a2b3c4",
  "host_id": "abc12345",
  "title": "My Quiz",
  "description": "A sample quiz",
  "status": "ACTIVE",
  "categories": ["SCIENCE", "MATH"],
  "start_time": "2024-01-01T10:00:00Z",
  "end_time": "2024-01-01T11:00:00Z"
}
```

### Take Quiz Start

**Request** (`TakeQuizStartRequestDto`):
```json
{
  "quizId": "q1a2b3c4",
  "playerId": "user1234",
  "playerName": "John"
}
```

**Response** (`TakeQuizStartResponseDto`):
```json
{
  "takeId": "t1a2b3c4",
  "questions": [...]
}
```

### Take Quiz End

**Request** (`TakeQuizEndRequestDto`):
```json
{
  "takeId": "t1a2b3c4",
  "takeQuestionSaveRequestDtos": [
    { "questionId": "q1", "answer": "Option A", "checkAnswer": "1" }
  ]
}
```

**Response**:
```json
{
  "message": "Quiz ended successfully"
}
```

**History Response** (`GET /take-quiz/player/{playerId}` returns `TakeQuizResponseDto[]`):
```json
{
  "quizId": "q1a2b3c4",
  "quizTitle": "My Quiz",
  "score": "7/10",
  "status": "ACTIVE",
  "updatedAt": "2024-01-01T11:00:00Z"
}
```

---

## Error Shape

All errors return:
```json
{
  "message": "Quiz not found",
  "statusCode": 404
}
```

---

## Consumed by AI Study Coach

The AI Study Coach (`server/quiz_client/`) calls these endpoints:

| Endpoint | Purpose in Coach |
|----------|-----------------|
| `GET /quiz/user/{userId}` | Fetch quizzes created by a user |
| `GET /take-quiz/player/{playerId}` | Fetch completed attempts for progress/weakness analysis |
| `GET /quiz/{id}` | Get quiz details for context |
| `GET /question/quizId/{quizId}` | Get questions for a specific quiz |
| `GET /user/quiz-profile?userId=` | Full profile for coaching insights |
