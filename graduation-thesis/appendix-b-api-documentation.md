# Appendix B: API Documentation

## B.1 Spring Boot REST API — Complete Endpoint Reference

### B.1.1 Quiz Endpoints

#### GET /quiz
Get all active quizzes.

**Response** `200 OK`:
```json
[
  {
    "quiz_id": "quiz-abc123",
    "host_id": "user-uid",
    "title": "Biology Basics",
    "description": "Fundamental biology concepts",
    "status": "ACTIVE",
    "categories": ["science"],
    "start_time": null,
    "end_time": null,
    "availability": null
  }
]
```

#### POST /quiz
Create a new quiz.

**Request**:
```json
{
  "user_id": "user-uid",
  "title": "Biology Basics",
  "description": "Fundamental biology concepts",
  "categories": ["SCIENCE"]
}
```

**Response** `201 Created`:
```json
{
  "quizId": "quiz-generated-id"
}
```

#### GET /quiz/category/{category}
Get quizzes by category.

**Path Parameters**: `category` — One of: SCIENCE, HISTORY, GEOGRAPHY, LITERATURE, TECHNOLOGY, SPORTS, ENTERTAINMENT, MATH, ART, SPACE, GENERAL_CULTURE

#### PUT /quiz/update/{id}
Update a quiz by ID.

**Response** `204 No Content`

---

### B.1.2 Question Endpoints

#### POST /question
Create multiple questions for a quiz.

**Request**:
```json
[
  {
    "quiz_id": "quiz-abc123",
    "content": "What is the powerhouse of the cell?",
    "answers": ["Mitochondria", "Nucleus", "Ribosome", "Golgi apparatus"],
    "correct_answer": "Mitochondria"
  }
]
```

**Response** `201 Created`:
```json
{
  "q-001": "Success"
}
```

#### GET /question/quizId/{quizId}
Get questions for a quiz.

**Response** `200 OK`:
```json
[
  {
    "id": "q-001",
    "quizId": "quiz-abc123",
    "question": "What is the powerhouse of the cell?",
    "answers": ["Mitochondria", "Nucleus", "Ribosome", "Golgi apparatus"],
    "correctAnswer": "Mitochondria"
  }
]
```

Note: `correctAnswer` IS included in the response (client-side validation model).

---

### B.1.3 Take Quiz Endpoints

#### POST /take-quiz/start
Start a quiz attempt.

**Request**:
```json
{
  "quizId": "quiz-abc123",
  "playerId": "user-uid",
  "playerName": "John"
}
```

**Response** `200 OK`:
```json
{
  "takeId": "take-001",
  "questionResponseDtos": [
    {
      "id": "q-001",
      "quizId": "quiz-abc123",
      "question": "What is the powerhouse of the cell?",
      "answers": ["Mitochondria", "Nucleus", "Ribosome", "Golgi apparatus"],
      "correctAnswer": "Mitochondria"
    }
  ]
}
```

Note: The start response includes all questions with correct answers. Validation occurs client-side, and results are submitted back via the end endpoint.

#### POST /take-quiz/end
End a quiz attempt and submit all answers.

**Request**:
```json
{
  "takeId": "take-001",
  "takeQuestionSaveRequestDtos": [
    {
      "question_id": "q-001",
      "answer": "Mitochondria",
      "check_answer": "1"
    }
  ]
}
```

Values for `check_answer`: `"1"` or `"2"` = CORRECT, `"-1"` = INCORRECT.

**Response** `200 OK`:
```json
{"message": "Quiz ended successfully"}
```

When the quiz ends, the system:
1. Saves all TakeQuestion records to Firestore.
2. Computes final score by counting CORRECT answers (e.g., "4/5").
3. Updates the TakeQuiz document with score and end_time.
4. Fires webhook to AI Coach with score, category, and per-question results.

#### GET /take-quiz/player/{playerId}
Get completed quiz attempts for a player.

**Response** `200 OK`:
```json
[
  {
    "quizId": "quiz-abc123",
    "quizTitle": "Biology Basics",
    "categories": ["science"],
    "score": "4/5",
    "status": "ACTIVE",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
]
```

### B.1.4 Review Schedule Endpoints

#### GET /review-schedule/user/{userId}
Get all review schedules for a user.

**Response** `200 OK`:
```json
[
  {
    "id": "rs-001",
    "user_id": "user-uid",
    "category": "SCIENCE",
    "easiness": 2.3,
    "interval_days": 3.0,
    "repetitions": 2,
    "next_review": "2024-01-17T00:00:00Z",
    "last_reviewed": "2024-01-14T15:00:00Z",
    "last_score": "0.8"
  }
]
```

#### POST /review-schedule
Create or update a review schedule (upsert by user_id + category).

**Request**:
```json
{
  "user_id": "user-uid",
  "category": "SCIENCE",
  "easiness": 2.36,
  "interval_days": 7.08,
  "repetitions": 3,
  "next_review": "2024-01-21T00:00:00Z",
  "last_reviewed": "2024-01-14T10:30:00Z",
  "last_score": "0.8"
}
```
```

---

### B.1.5 Notification Endpoints

#### GET /notification/user/{userId}
Get all notifications for a user.

**Response** `200 OK`:
```json
[
  {
    "id": "notif-001",
    "user_id": "user-uid",
    "type": "REVIEW_DUE",
    "title": "Review Due",
    "message": "Your Science review is due. Keep your streak going!",
    "read": false,
    "created_at": "2024-01-15T08:00:00Z"
  }
]
```

#### GET /notification/user/{userId}/unread
Get unread notifications only.

#### PATCH /notification/{id}/read
Mark notification as read.

**Response** `204 No Content`

#### PATCH /notification/user/{userId}/read-all
Mark all notifications as read for a user.

#### DELETE /notification/{id}
Delete a notification.

**Response** `204 No Content`

---

## B.2 AI Coach REST API — Complete Reference

### B.2.1 POST /ingest

Upload and index a document for RAG search.

**Headers**:
- `X-API-Key: <api-key>` (required)
- `Content-Type: multipart/form-data`

**Form Fields**:
- `file`: Binary file (PDF, TXT, or MD, max 10MB)
- `kb_id`: Knowledge base identifier (typically user UID)

**Success Response** `200 OK`:
```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "chunks_stored": 24,
  "message": "Document indexed successfully"
}
```

**Error Responses**:
- `400 Bad Request`: Image-only PDF or invalid file
  ```json
  {"detail": "PDF contains no extractable text (image-only). Please use a text-based PDF."}
  ```
- `401 Unauthorized`: Missing or invalid API key
- `413 Payload Too Large`: File exceeds size limit
- `500 Internal Server Error`: Embedding or storage failure

---

### B.2.2 DELETE /ingest/{document_id}

Remove all chunks associated with a document.

**Headers**: `X-API-Key: <api-key>`

**Response** `200 OK`:
```json
{"message": "Document deleted", "chunks_removed": 24}
```

---

### B.2.3 POST /generate/from-topics

Generate multiple-choice questions from a topic.

**Headers**:
- `X-API-Key: <api-key>`
- `Content-Type: application/json`

**Request**:
```json
{
  "topics": ["photosynthesis", "cellular respiration"],
  "num_questions": 5,
  "difficulty": "medium",
  "document_name": "biology-chapter-3.pdf",
  "user_id": "user-uid"
}
```

Fields `document_name` and `user_id` are optional. When both are provided, the system performs RAG search against the user's indexed documents and includes retrieved context in the generation prompt.

**Response** `200 OK`:
```json
{
  "questions": [
    {
      "content": "Which molecule is the final electron acceptor in the electron transport chain?",
      "answers": ["Oxygen", "Carbon dioxide", "Water", "NADH"],
      "correct_answer": "Oxygen"
    }
  ]
}
```

---

### B.2.4 POST /generate/from-file

Generate questions directly from an uploaded file (without RAG indexing).

**Headers**: `X-API-Key: <api-key>`  
**Content-Type**: `multipart/form-data`

**Form Fields**:
- `file`: Binary file (PDF, TXT, MD)
- `num_questions`: Number of questions (default: 5)

**Response**: Same format as `/generate/from-topics`

---

### B.2.5 POST /webhook/quiz-completed

Receive quiz completion event from Spring Boot.

**Headers**: `X-API-Key: <api-key>`

**Request**:
```json
{
  "user_id": "user-uid",
  "quiz_id": "quiz-abc123",
  "score": "4/5",
  "category": "SCIENCE",
  "completed_at": "2024-01-15T10:30:00Z",
  "questions": [
    {"question_id": "q-001", "correct": true},
    {"question_id": "q-002", "correct": true},
    {"question_id": "q-003", "correct": false},
    {"question_id": "q-004", "correct": true},
    {"question_id": "q-005", "correct": true}
  ]
}
```

**Response** `200 OK`:
```json
{
  "status": "processed",
  "schedule_updated": true,
  "next_review": "2024-01-21T00:00:00Z"
}
```

---

## B.3 WebSocket Protocol Reference

### B.3.1 Connection

**URL**: `ws://<host>:8000/ws/coach`

No authentication on WebSocket itself — user identity is passed in `session_start` message.

### B.3.2 Client → Server Messages

| Type | Fields | Description |
|------|--------|-------------|
| `session_start` | tier, mode, user_id, kb_id, conversation_id | Initialize session |
| `user_message` | content | Send chat message |
| `stop` | — | Cancel current generation |
| `mode_switch` | mode | Switch between chat/agentic |

### B.3.3 Server → Client Messages

| Type | Fields | Description |
|------|--------|-------------|
| `session_ack` | session_id, tier, mode, available_tools | Session confirmed |
| `content` | content | Text chunk (one or more tokens) |
| `stage` | stage, status | Processing stage (thinking start/end) |
| `tool` | tool, status, arguments?, result? | Tool invocation lifecycle |
| `done` | — | Generation complete |
| `error` | code, message | Error occurred |

### B.3.4 Tool Event Lifecycle

```
tool(name, "calling", arguments)  → Tool execution begins
tool(name, "result", result)      → Tool completed successfully
tool(name, "error", error_msg)    → Tool failed
```
