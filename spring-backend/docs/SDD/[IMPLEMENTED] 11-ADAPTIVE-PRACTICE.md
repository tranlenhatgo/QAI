# 11 - Adaptive Practice Backend

## Purpose
Persist Adaptive Infinity answer journals and return category-scoped session state without touching formal quiz attempts, review schedules, or notifications.

## Interface Contract
- `GET /adaptive-practice/session-state?category=<category>`
  - Auth: `Authorization: Bearer <Firebase ID token>`
  - Returns selected-category static IDs, wrong questions, and recent answers.
- `POST /adaptive-practice/answer`
  - Auth: Firebase bearer token.
  - Saves one adaptive answer record under the authenticated user.

## Firestore Schema
Path: `users/{uid}/adaptive_practice_answers/{id}`

| Field | Type | Notes |
| --- | --- | --- |
| `category` | string | Normalized lowercase category |
| `sourceQuestionId` | string/null | Deterministic static ID for `questions.json` questions |
| `question` | string | Question text |
| `answers` | array<string> | Four answer options |
| `correctAnswer` | string | Correct answer text |
| `selectedAnswer` | string | User selection |
| `correct` | boolean | Whether the selected answer was correct |
| `source` | string | `static_json`, `adaptive_ai`, or `repeat` |
| `repeated` | boolean | True for repeat attempts |
| `generatedFromQuestion` | string/null | AI trace field |
| `createdAt` | timestamp | Record creation time |
| `updatedAt` | timestamp | Last update time |

## Session State Response

```json
{
  "answeredStaticQuestionIds": ["ak:abc123"],
  "hasStaticHistoryInCategory": true,
  "wrongQuestions": [
    {
      "category": "sports",
      "sourceQuestionId": "ak:abc123",
      "question": "How many players are on a soccer team?",
      "answers": ["9", "10", "11", "12"],
      "correctAnswer": "11",
      "selectedAnswer": "9",
      "correct": false,
      "source": "static_json",
      "repeated": false
    }
  ],
  "recentAnswers": []
}
```

`recentAnswers` is limited to the newest 20 records so the frontend can trim to the current 5-answer AI context without another query.

## Behavior Specification
1. Verify the Firebase ID token with Firebase Admin and derive the UID from the token.
2. Normalize the requested category to lowercase.
3. On `POST /answer`, validate required fields and write only under `users/{uid}/adaptive_practice_answers`.
4. On `GET /session-state`, query only the authenticated user's adaptive records for the selected category.
5. Return answered static IDs only from records with a `sourceQuestionId`.
6. Return wrong questions only from records where `correct=false`.
7. Do not create or update `take_quiz`, `take_question`, `review_schedule`, `notification`, or profile-score history.

## Acceptance Criteria
- Missing or invalid bearer tokens return `401`.
- Missing category returns `400`.
- Invalid answer payload returns `400`.
- Static, AI, and repeat answer sources are persisted with timestamps.
- Wrong answers from one category never appear in another category's session state.
- `.\mvnw.cmd -q -DskipTests compile` passes.

## Live Test Notes
On 2026-05-31, API tests created fresh Lite and Full Firebase users, posted `static_json`, `adaptive_ai`, and `repeat` answers, verified normalized category state, checked category isolation, and confirmed no new `take_quiz`, `review_schedule`, or `notification` records were created for adaptive answers.
