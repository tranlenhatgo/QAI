# Spring Boot Backend — Architecture Changelog

## 2025-05-26 — Firestore Schema Extension: review_schedule + notification

**Added two new Firestore collections for persistent adaptive learning data.**

### New Files

| File | Purpose |
| --- | --- |
| `model/ReviewSchedule.java` | SM-2 review schedule entity (user_id, category, easiness, interval, next_review) |
| `model/Notification.java` | User notification entity (type, title, message, read/unread) |
| `dto/ReviewScheduleUpsertDto.java` | Create/update request DTO |
| `dto/ReviewScheduleResponseDto.java` | Read response DTO |
| `dto/NotificationCreateDto.java` | Create request DTO |
| `dto/NotificationResponseDto.java` | Read response DTO |
| `service/ReviewScheduleService.java` | CRUD + upsert by user+category, due query |
| `service/NotificationService.java` | CRUD + mark read, mark all read |
| `controller/ReviewScheduleController.java` | REST endpoints for review schedules |
| `controller/NotificationController.java` | REST endpoints for notifications |

### API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/review-schedule` | Upsert review schedule |
| GET | `/review-schedule/user/{userId}` | Get all schedules for user |
| GET | `/review-schedule/user/{userId}/due` | Get due schedules |
| DELETE | `/review-schedule/{id}` | Delete schedule |
| POST | `/notification` | Create notification |
| GET | `/notification/user/{userId}` | Get all notifications |
| GET | `/notification/user/{userId}/unread` | Get unread only |
| PATCH | `/notification/{id}/read` | Mark as read |
| PATCH | `/notification/user/{userId}/read-all` | Mark all as read |
| DELETE | `/notification/{id}` | Delete notification |

### Schema Changes

Updated SDD `03-FIRESTORE-SCHEMA.md` with `review_schedule` and `notification` collection definitions.

---

## 2025-05-26 — Quiz Completion Webhook Sender (SDD 09)

**Implemented webhook notification to AI Study Coach on quiz completion.**

### New Files (Webhook)

| File | Purpose |
| --- | --- |
| `src/main/java/com/myproject/quizzai/service/WebhookService.java` | Fire-and-forget HTTP POST to AI Coach `/webhook/quiz-completed`. Non-blocking: failures logged but never break quiz flow |

### Modified Files

| File | Change |
| --- | --- |
| `service/TakeQuizService.java` | Added `WebhookService` dependency (via `@RequiredArgsConstructor`). Added webhook call at end of `EndQuiz()`. Added `getQuizCategory()` helper to look up quiz category from Firestore |
| `resources/application.properties` | Added `coach.webhook.url`, `coach.webhook.api-key`, `coach.webhook.enabled` properties |

### Webhook Payload (sent to AI Coach)

```json
{
  "user_id": "<player_id>",
  "quiz_id": "<quiz_id>",
  "score": "7/10",
  "category": "mathematics",
  "completed_at": "2025-01-15T14:30:00Z"
}
```

### Configuration

```properties
coach.webhook.url=http://localhost:8000/webhook/quiz-completed
coach.webhook.api-key=${COACH_API_KEY:}
coach.webhook.enabled=true
```

### Error Handling

- AI Coach unreachable → log warning, quiz succeeds
- Invalid API key (401) → log error, quiz succeeds
- Network timeout → RestTemplate 10s connect / 30s read, quiz succeeds
- Webhook disabled → skip entirely, no network call
- Missing category → sends "unknown"

**Critical invariant**: Quiz completion NEVER fails due to webhook issues.
