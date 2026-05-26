# 09 — Quiz Completion Webhook Sender

## Purpose

After a quiz is completed (`EndQuiz`), send a webhook notification to the AI Study Coach service so it can update spaced repetition schedules, recompute mastery, and prepare proactive coaching context.

**Status: ✅ Implemented** — `TakeQuizService.EndQuiz()` saves to Firestore and notifies AI Coach through `WebhookService`.

**Depends on**: AI Coach `POST /webhook/quiz-completed` endpoint (AI Coach SDD 17).

---

## Current State

`TakeQuizService.EndQuiz()` currently:
1. Saves take_question answers
2. Computes score string ("correct/total")
3. Updates take_quiz document in Firestore with score, status, end_time
4. **Does NOT** notify any external service

---

## Interface Contract

### WebhookService

```java
// src/main/java/com/myproject/quizzai/service/WebhookService.java

@Service
public class WebhookService {
    
    @Value("${coach.webhook.url:http://localhost:8000/webhook/quiz-completed}")
    private String webhookUrl;
    
    @Value("${coach.webhook.api-key:}")
    private String apiKey;
    
    @Value("${coach.webhook.enabled:true}")
    private boolean enabled;
    
    private final RestTemplate restTemplate;
    private static final Logger logger = LoggerFactory.getLogger(WebhookService.class);
    
    public WebhookService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }
    
    /**
     * Notify AI Coach that a quiz has been completed.
     * Non-blocking: failures are logged but don't affect quiz completion.
     * 
     * @param takeQuiz The completed take_quiz record (with score)
     * @param quizId   The quiz ID (for category lookup)
     * @param category The quiz category
     */
    public void notifyQuizCompleted(TakeQuiz takeQuiz, String quizId, String category) {
        if (!enabled || apiKey.isEmpty()) {
            logger.debug("Webhook disabled or no API key configured, skipping");
            return;
        }
        
        try {
            Map<String, Object> payload = buildPayload(takeQuiz, quizId, category);
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-API-Key", apiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                webhookUrl, request, Map.class
            );
            
            logger.info("Webhook sent for take_quiz {}: status {}", 
                takeQuiz.getId(), response.getStatusCode());
                
        } catch (Exception e) {
            // Non-blocking: quiz completion succeeds even if webhook fails
            logger.warn("Webhook delivery failed for take_quiz {}: {}", 
                takeQuiz.getId(), e.getMessage());
        }
    }
    
    private Map<String, Object> buildPayload(TakeQuiz takeQuiz, String quizId, String category) {
        return Map.of(
            "user_id", takeQuiz.getPlayer_id(),
            "quiz_id", quizId,
            "score", takeQuiz.getScore(),
            "category", category,
            "completed_at", takeQuiz.getEnd_time().toString()
        );
    }
}
```

---

## Data Shapes

### Webhook Payload (JSON sent to AI Coach)

```json
{
  "user_id": "abc12345",
  "quiz_id": "quiz7890",
  "score": "7/10",
  "category": "mathematics",
  "completed_at": "2025-01-15T14:30:00Z"
}
```

### Expected Response from AI Coach

```json
{
  "status": "processed",
  "next_review": "2025-01-16T14:30:00Z",
  "mastery_update": {
    "category": "mathematics",
    "new_mastery": 0.72,
    "trend": "improving"
  }
}
```

---

## Behavior Specification

### Integration Point: TakeQuizService.EndQuiz()

```java
// Modified EndQuiz method — add webhook call at the end

@SneakyThrows
public void EndQuiz(TakeQuizEndRequestDto takeQuizDto) {
    String takeId = takeQuizDto.getTakeId();
    List<TakeQuestionSaveRequestDto> takeQuestionDtos = takeQuizDto.getTakeQuestionSaveRequestDtos();

    takeQuestionService.saveTakeQuestions(takeId, takeQuestionDtos);

    String score = takeQuestionService.getScore(takeId);
    TakeQuiz oldTakeQuiz = firestore.collection("take_quiz").document(takeId).get().get().toObject(TakeQuiz.class);
    assert oldTakeQuiz != null;

    TakeQuiz takeQuiz = TakeQuiz.builder()
            .id(takeId)
            .quiz_id(oldTakeQuiz.getQuiz_id())
            .player_id(oldTakeQuiz.getPlayer_id())
            .player_name(oldTakeQuiz.getPlayer_name())
            .score(score)
            .status(Status.ACTIVE)
            .start_time(oldTakeQuiz.getStart_time())
            .end_time(Timestamp.now())
            .created_at(oldTakeQuiz.getCreated_at())
            .updated_at(Timestamp.now())
            .build();

    firestore.collection("take_quiz").document(takeId).set(takeQuiz).get();

    // NEW: Notify AI Coach (non-blocking)
    String category = getQuizCategory(oldTakeQuiz.getQuiz_id());
    webhookService.notifyQuizCompleted(takeQuiz, oldTakeQuiz.getQuiz_id(), category);
}

/**
 * Look up quiz category from Firestore.
 * Returns "unknown" if quiz not found (graceful degradation).
 */
@SneakyThrows
private String getQuizCategory(String quizId) {
    Quiz quiz = firestore.collection("quiz").document(quizId).get().get().toObject(Quiz.class);
    return quiz != null ? quiz.getCategory() : "unknown";
}
```

### Dependency Injection

```java
// TakeQuizService constructor — add WebhookService
@Service
public class TakeQuizService {
    private final Firestore firestore;
    private final TakeQuestionService takeQuestionService;
    private final WebhookService webhookService;  // NEW
    
    public TakeQuizService(Firestore firestore, 
                           TakeQuestionService takeQuestionService,
                           WebhookService webhookService) {
        this.firestore = firestore;
        this.takeQuestionService = takeQuestionService;
        this.webhookService = webhookService;
    }
}
```

---

## Configuration

### application.properties

```properties
# AI Coach Webhook
coach.webhook.url=http://localhost:8000/webhook/quiz-completed
coach.webhook.api-key=${COACH_API_KEY:}
coach.webhook.enabled=true
```

### Environment Variables

```bash
COACH_API_KEY=your-shared-secret-key
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| AI Coach unreachable | Log warning, quiz completion succeeds |
| AI Coach returns 401 | Log error (bad API key), quiz completion succeeds |
| AI Coach returns 5xx | Log warning, quiz completion succeeds |
| Network timeout | RestTemplate default timeout (5s), log warning |
| Webhook disabled | Skip entirely, no network call |
| Missing category | Send "unknown" as category |

**Critical invariant**: Quiz completion MUST NOT fail due to webhook issues. The webhook is fire-and-forget.

---

## Testing

```java
@SpringBootTest
class WebhookServiceTest {
    
    @MockBean
    private RestTemplate restTemplate;
    
    @Autowired
    private WebhookService webhookService;
    
    @Test
    void shouldSendWebhookOnQuizCompletion() {
        TakeQuiz takeQuiz = TakeQuiz.builder()
            .id("take123")
            .player_id("user456")
            .quiz_id("quiz789")
            .score("7/10")
            .build();
        
        webhookService.notifyQuizCompleted(takeQuiz, "quiz789", "math");
        
        verify(restTemplate).postForEntity(
            contains("/webhook/quiz-completed"),
            any(HttpEntity.class),
            eq(Map.class)
        );
    }
    
    @Test
    void shouldNotFailWhenWebhookUnavailable() {
        when(restTemplate.postForEntity(any(), any(), any()))
            .thenThrow(new RestClientException("Connection refused"));
        
        // Should not throw
        assertDoesNotThrow(() -> 
            webhookService.notifyQuizCompleted(takeQuiz, "quiz789", "math")
        );
    }
    
    @Test
    void shouldSkipWhenDisabled() {
        // Set enabled=false via @TestPropertySource
        webhookService.notifyQuizCompleted(takeQuiz, "quiz789", "math");
        verifyNoInteractions(restTemplate);
    }
}
```

---

## Files to Create/Modify

| Action | File | Change |
|--------|------|--------|
| CREATE | `service/WebhookService.java` | New service class |
| MODIFY | `service/TakeQuizService.java` | Inject WebhookService, add webhook call in EndQuiz |
| MODIFY | `application.properties` | Add coach.webhook.* properties |

---

## Acceptance Criteria

- [ ] WebhookService sends POST to AI Coach after quiz completion
- [ ] Payload includes user_id, quiz_id, score, category, completed_at
- [ ] X-API-Key header included in request
- [ ] Quiz completion succeeds even if webhook fails (non-blocking)
- [ ] Webhook can be disabled via configuration
- [ ] Network errors logged at WARN level, not thrown
- [ ] Category resolved from quiz document in Firestore
- [ ] RestTemplate timeout prevents hanging (default 5s)
- [ ] Unit tests cover success, failure, and disabled scenarios
