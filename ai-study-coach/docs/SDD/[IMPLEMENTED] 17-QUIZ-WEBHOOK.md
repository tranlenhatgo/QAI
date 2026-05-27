# 17 — Quiz Completion Webhook

## Purpose

Implement a webhook endpoint that receives notifications from Spring Boot when a student completes a quiz. This triggers the AI Coach to update spaced repetition schedules, recompute weakness analysis, and prepare coaching context.

**Status: ✅ Implemented** — `server/routes/webhook.py` with `POST /webhook/quiz-completed`. Validates X-API-Key, updates SR schedule (Firestore-backed), stores event for Coach context. Called by Spring Boot `WebhookService` on quiz completion.

**Design constraint**: Each quiz has exactly 1 category (enforced by frontend single-select UI and backend `@Size(max=1)` validation). The webhook receives a single `category` string per quiz completion — no multi-category disambiguation needed.

**Reference**: DeepTutor's `deeptutor/events/event_bus.py` Event dataclass + publish/subscribe pattern provides the internal event routing after webhook receipt.

---

## Interface Contract

### Endpoint

```http
POST /webhook/quiz-completed
Content-Type: application/json
X-API-Key: <shared secret>
```

### Request Body (from Spring Boot)

```json
{
  "user_id": "abc12345",
  "quiz_id": "quiz7890",
  "score": "7/10",
  "category": "mathematics",
  "completed_at": "2025-01-15T14:30:00Z",
  "questions": [
    {
      "question_id": "q001",
      "correct": true,
      "time_spent_seconds": 45
    },
    {
      "question_id": "q002",
      "correct": false,
      "time_spent_seconds": 120
    }
  ]
}
```

### Response

```json
// 200 OK
{
  "status": "processed",
  "next_review": "2025-01-16T14:30:00Z",
  "mastery_update": {
    "category": "mathematics",
    "new_mastery": 0.72,
    "trend": "improving"
  }
}

// 401 Unauthorized
{
  "detail": "Invalid API key"
}

// 422 Validation Error
{
  "detail": [{"loc": ["body", "score"], "msg": "invalid score format"}]
}
```

---

## Data Shapes

```python
# server/models/webhook.py

from pydantic import BaseModel, field_validator
from datetime import datetime

class QuestionResult(BaseModel):
    question_id: str
    correct: bool
    time_spent_seconds: int | None = None

class QuizCompletedWebhook(BaseModel):
    """Payload received from Spring Boot on quiz completion."""
    user_id: str
    quiz_id: str
    score: str                          # Format: "correct/total"
    category: str
    completed_at: datetime
    questions: list[QuestionResult] = []
    
    @field_validator("score")
    @classmethod
    def validate_score_format(cls, v: str) -> str:
        """Ensure score is in 'N/M' format."""
        parts = v.split("/")
        if len(parts) != 2:
            raise ValueError("Score must be in 'correct/total' format")
        correct, total = int(parts[0]), int(parts[1])
        if correct < 0 or total <= 0 or correct > total:
            raise ValueError("Invalid score values")
        return v
    
    @property
    def accuracy(self) -> float:
        """Compute accuracy from score string."""
        correct, total = self.score.split("/")
        return int(correct) / int(total)

class WebhookResponse(BaseModel):
    status: str = "processed"
    next_review: datetime | None = None
    mastery_update: dict | None = None
```

---

## Behavior Specification

### Route Handler

```python
# server/routes/webhook.py

from fastapi import APIRouter, Header, HTTPException, status
from server.models.webhook import QuizCompletedWebhook, WebhookResponse
from server.config import get_settings

router = APIRouter(prefix="/webhook", tags=["webhook"])

@router.post("/quiz-completed", response_model=WebhookResponse)
async def handle_quiz_completed(
    payload: QuizCompletedWebhook,
    x_api_key: str = Header(...),
):
    """
    Receive quiz completion notification from Spring Boot.
    
    Flow:
    1. Validate API key
    2. Update spaced repetition schedule
    3. Recompute category mastery
    4. Store event for Coach context
    5. Return processing result
    """
    settings = get_settings()
    
    # 1. Auth check
    if x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    
    # 2. Update spaced repetition
    from server.learning.spaced_repetition import on_quiz_completed
    review_item = await on_quiz_completed(
        user_id=payload.user_id,
        category=payload.category,
        score=payload.score,
    )
    
    # 3. Recompute mastery
    from server.learning.progress import ProgressTracker
    tracker = ProgressTracker()
    mastery = await tracker.get_category_mastery(
        user_id=payload.user_id,
        category=payload.category,
    )
    
    # 4. Store event for chat context
    await store_quiz_event(payload)
    
    # 5. Return result
    return WebhookResponse(
        status="processed",
        next_review=review_item.next_review,
        mastery_update={
            "category": payload.category,
            "new_mastery": mastery.mastery_level,
            "trend": mastery.trend,
        },
    )
```

### Event Storage

```python
# server/scheduler/events.py

from collections import defaultdict
from datetime import datetime

_recent_events: dict[str, list[QuizCompletedWebhook]] = defaultdict(list)

async def store_quiz_event(payload: QuizCompletedWebhook):
    """
    Store recent quiz events for Coach context.
    
    The AI Coach reads these at the start of a chat session to
    provide proactive feedback like:
    "I see you just finished a math quiz with 70% — let me help 
    with the questions you missed."
    """
    _recent_events[payload.user_id].append(payload)
    # Keep only last 10 events per user
    if len(_recent_events[payload.user_id]) > 10:
        _recent_events[payload.user_id] = _recent_events[payload.user_id][-10:]

async def get_recent_quiz_events(user_id: str) -> list[QuizCompletedWebhook]:
    """Get recent quiz events (not cleared — read only)."""
    return _recent_events.get(user_id, [])
```

---

## Spring Boot Integration

### Sending the Webhook (Spring Boot side)

```java
// spring-backend/src/.../service/WebhookService.java (to be created)

@Service
public class WebhookService {
    
    @Value("${coach.webhook.url:http://localhost:8000/webhook/quiz-completed}")
    private String webhookUrl;
    
    @Value("${coach.webhook.api-key}")
    private String apiKey;
    
    private final RestTemplate restTemplate;
    
    public void notifyQuizCompleted(TakeQuiz takeQuiz, Quiz quiz) {
        Map<String, Object> payload = Map.of(
            "user_id", takeQuiz.getPlayerId(),
            "quiz_id", takeQuiz.getQuizId(),
            "score", takeQuiz.getScore(),
            "category", quiz.getCategory(),
            "completed_at", takeQuiz.getUpdatedAt(),
            "questions", buildQuestionResults(takeQuiz)
        );
        
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-Key", apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
        
        try {
            restTemplate.postForEntity(webhookUrl, request, Map.class);
        } catch (Exception e) {
            log.warn("Webhook delivery failed: {}", e.getMessage());
            // Non-blocking — quiz completion succeeds even if webhook fails
        }
    }
}
```

### Call site in existing endpoint

```java
// In TakeQuizService.endQuiz() — after computing score
webhookService.notifyQuizCompleted(takeQuiz, quiz);
```

---

## Configuration

```python
# server/config.py additions
class Settings(BaseSettings):
    # ... existing ...
    
    # Webhook
    webhook_enabled: bool = True
    webhook_max_events_per_user: int = 10
```

Spring Boot `application.properties`:

```properties
coach.webhook.url=http://localhost:8000/webhook/quiz-completed
coach.webhook.api-key=${COACH_API_KEY}
```

---

## Security

- **API Key validation**: Same `X-API-Key` header used for all Coach endpoints
- **Input validation**: Pydantic model validates score format, required fields
- **Rate limiting**: Consider adding rate limiting per user_id [TODO: not critical for MVP]
- **Non-blocking on Spring Boot side**: Webhook failure doesn't block quiz submission
- **Idempotency**: Duplicate webhooks with same `quiz_id` + `user_id` should be handled gracefully (upsert, not duplicate)

---

## Router Registration

```python
# server/router.py — add webhook routes
from server.routes.webhook import router as webhook_router

app.include_router(webhook_router)
```

---

## Acceptance Criteria

- [ ] `POST /webhook/quiz-completed` accepts valid payload and returns 200
- [ ] Invalid API key returns 401
- [ ] Invalid score format returns 422
- [ ] Spaced repetition schedule is updated on receipt
- [ ] Category mastery is recomputed
- [ ] Event is stored for Coach chat context
- [ ] Spring Boot can call webhook after quiz completion
- [ ] Webhook failure on Spring Boot side is non-blocking (quiz still completes)
- [ ] Duplicate events don't corrupt data (idempotent processing)
- [ ] Coach proactively references recent quiz results in next chat session
