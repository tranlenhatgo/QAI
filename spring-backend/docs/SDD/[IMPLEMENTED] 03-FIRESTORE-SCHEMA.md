# 03 — Firestore Schema

## Overview

All persistence uses **Google Firestore** (NoSQL document database). Each entity maps to a top-level collection. Documents are identified by 8-char UUID slices generated via `IdUtil.generateId()`.

---

## Collection: `quiz`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | 8-char UUID (auto-generated) |
| `host_id` | string | Creator user ID |
| `title` | string | Quiz title |
| `description` | string | Quiz description |
| `status` | string | Status enum value |
| `categories` | array[string] | Category enum values (UPPERCASE) |
| `start_time` | Timestamp | Quiz start time |
| `end_time` | Timestamp | Quiz end time |
| `createdAt` | Timestamp | Creation timestamp |
| `updatedAt` | Timestamp | Last update timestamp |

---

## Collection: `question`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | 8-char UUID |
| `quiz_id` | string | Parent quiz ID |
| `content` | string | Question text |
| `answers` | array[string] | Answer options |
| `correct_answer` | string | Correct answer text |

---

## Collection: `take_quiz`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | 8-char UUID |
| `quiz_id` | string | Quiz being taken |
| `player_id` | string | Player user ID |
| `player_name` | string | Player display name |
| `score` | string | Format: `"correct/total"` (e.g., `"7/10"`) |
| `status` | string | `PENDING` → `COMPLETED` |
| `start_time` | Timestamp | Session start |
| `end_time` | Timestamp | Session end |
| `created_at` | Timestamp | Record creation |
| `updated_at` | Timestamp | Last update |

---

## Collection: `take_question`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | 8-char UUID |
| `take_id` | string | Parent `take_quiz` session ID |
| `question_id` | string | Question being answered |
| `answer` | string | Student's answer |
| `check_answer` | string | `"1"` or `"2"` = correct, `"-1"` = incorrect |

---

## Relationships

```
quiz (1) ──→ (N) question        (via quiz_id)
quiz (1) ──→ (N) take_quiz       (via quiz_id)
take_quiz (1) ──→ (N) take_question  (via take_id)
question (1) ──→ (N) take_question   (via question_id)
```

---

## Field Naming Convention

- Firestore fields use **snake_case** (matching Java model `@PropertyName` or field names)
- Categories stored as UPPERCASE enum strings in Firestore, received as lowercase from frontend
- Timestamps stored as Firestore `Timestamp` type, serialized as ISO-8601 in JSON

---

## Collection: `review_schedule`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | 8-char UUID |
| `user_id` | string | Student user ID |
| `category` | string | Category (UPPERCASE) — one schedule per user+category |
| `easiness` | number | SM-2 easiness factor (1.3 – 2.5) |
| `interval_days` | number | Current interval in days |
| `repetitions` | number | Consecutive successful reviews |
| `next_review` | Timestamp | When this category is due for review |
| `last_reviewed` | Timestamp | When the user last reviewed this category |
| `last_score` | string | Last category accuracy as decimal string (legacy "correct/total" also accepted by Coach) |
| `updated_at` | Timestamp | Last update timestamp |

**Unique constraint**: One document per `(user_id, category)` pair — upsert logic in service.

---

## Collection: `notification`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | 8-char UUID |
| `user_id` | string | Target user ID |
| `type` | string | `REVIEW_DUE` or `PROGRESS_MILESTONE` |
| `title` | string | Notification title |
| `message` | string | Notification body text |
| `read` | boolean | Whether the user has seen this |
| `created_at` | Timestamp | Creation timestamp |
| `expires_at` | Timestamp | Optional expiry (auto-cleanup candidate) |
