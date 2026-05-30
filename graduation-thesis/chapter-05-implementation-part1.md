# Chapter 5: Implementation — Part 1: Spring Boot Backend

## 5.1 Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Java | 21 (LTS) |
| Framework | Spring Boot | 3.4 |
| Build Tool | Maven | 3.9+ |
| Database | Google Cloud Firestore | — |
| Authentication | Firebase Auth (Admin SDK) | — |
| HTTP Client | RestTemplate | — |
| Code Generation | Lombok | — |
| Deployment | Embedded Tomcat | — |

## 5.2 Project Structure

```
spring-backend/src/main/java/com/myproject/quizzai/
├── QuizzAiOnlineApplication.java    # Application entry point
├── config/
│   ├── AppConfig.java               # Bean definitions (RestTemplate, etc.)
│   ├── FirebaseConfiguration.java   # Firebase/Firestore bean setup
│   ├── SecurityConfig.java          # CORS and security filter chain
│   └── SecurityCorsProperties.java  # CORS configuration properties
├── controller/
│   ├── QuizController.java          # Quiz CRUD endpoints
│   ├── QuestionController.java      # Question management
│   ├── TakeQuizController.java      # Quiz attempt recording
│   ├── TakeQuestionController.java  # Answer submission
│   ├── ReviewScheduleController.java # Spaced repetition schedules
│   ├── NotificationController.java  # User notifications
│   └── UserController.java          # User profile management
├── service/
│   ├── QuizService.java             # Quiz business logic
│   ├── QuestionService.java         # Question business logic
│   ├── TakeQuizService.java         # Quiz attempt + webhook trigger
│   ├── TakeQuestionService.java     # Answer validation
│   ├── ReviewScheduleService.java   # SM-2 schedule persistence
│   ├── NotificationService.java     # Notification CRUD
│   ├── UserService.java             # User profile ops
│   └── WebhookService.java          # AI Coach webhook client
├── model/
│   ├── Quiz.java                    # Quiz entity
│   ├── Question.java                # Question entity
│   ├── TakeQuiz.java                # Quiz attempt entity
│   ├── TakeQuestion.java            # Answer attempt entity
│   ├── ReviewSchedule.java          # SM-2 state entity
│   ├── Notification.java            # Notification entity
│   ├── User.java                    # User profile entity
│   ├── Category.java                # Category enum
│   ├── Status.java                  # Active/Inactive enum
│   ├── Role.java                    # User role enum
│   └── CheckAnswer.java            # CORRECT/INCORRECT enum
├── dto/                             # Data Transfer Objects
├── exceptions/                      # Custom exception types
└── utils/                           # Utility classes (IdUtil, TimeUtils)
```

## 5.3 Firebase Configuration

The application initializes Firebase using a service account key file, establishing beans for both Firestore (data) and FirebaseAuth (token verification):

```java
@Configuration
public class FirebaseConfiguration {

    @Bean
    public FirebaseApp firebaseApp() {
        FileInputStream serviceAccount = 
            new FileInputStream("src/main/resources/serviceAccountKey.json");
        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                .build();
        return FirebaseApp.initializeApp(options);
    }

    @Bean
    public Firestore firestore(FirebaseApp app) {
        return FirestoreClient.getFirestore(app);
    }

    @Bean
    public FirebaseAuth firebaseAuth(FirebaseApp app) {
        return FirebaseAuth.getInstance(app);
    }
}
```

All services inject the `Firestore` bean and use the collection API for data access without an ORM layer.

## 5.4 Data Access Pattern

Since Firestore is schemaless and accessed via its native Java SDK (not JPA), the service layer directly manages persistence:

```java
@Service
@RequiredArgsConstructor
public class ReviewScheduleService {

    private final Firestore firestore;
    private static final String COLLECTION = "review_schedule";

    public ReviewScheduleResponseDto upsert(ReviewScheduleUpsertDto dto) {
        // Query for existing schedule by composite key (user_id + category)
        List<QueryDocumentSnapshot> existing = firestore.collection(COLLECTION)
                .whereEqualTo("user_id", dto.getUser_id())
                .whereEqualTo("category", dto.getCategory())
                .get().get().getDocuments();

        String docId = existing.isEmpty() 
            ? IdUtil.generateId() 
            : existing.get(0).getId();

        ReviewSchedule schedule = ReviewSchedule.builder()
                .id(docId)
                .user_id(dto.getUser_id())
                .category(dto.getCategory())
                .easiness(dto.getEasiness())
                .interval_days(dto.getInterval_days())
                .repetitions(dto.getRepetitions())
                .next_review(parseTimestamp(dto.getNext_review()))
                .last_reviewed(parseTimestamp(dto.getLast_reviewed()))
                .last_score(dto.getLast_score())
                .updated_at(Timestamp.now())
                .build();

        firestore.collection(COLLECTION).document(docId).set(schedule).get();
        return toResponse(schedule);
    }
}
```

This pattern — query by composite key, upsert with builder — is consistent across all services.

## 5.5 Webhook Integration

When a quiz is completed, `TakeQuizService` triggers the webhook to notify the AI Coach:

```java
@Service
public class WebhookService {

    @Value("${coach.webhook.url:http://localhost:8000/webhook/quiz-completed}")
    private String webhookUrl;

    @Value("${coach.webhook.api-key:}")
    private String apiKey;

    @Value("${coach.webhook.enabled:true}")
    private boolean enabled;

    public void notifyQuizCompleted(TakeQuiz takeQuiz, String quizId, 
                                    String category, List<TakeQuestionSaveRequestDto> results) {
        if (!enabled || apiKey.isEmpty()) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("user_id", takeQuiz.getPlayer_id());
        payload.put("quiz_id", quizId);
        payload.put("score", takeQuiz.getScore());
        payload.put("category", category);
        payload.put("completed_at", TimeUtils.toIsoString(takeQuiz.getEnd_time()));
        payload.put("questions", mapQuestionResults(results));

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-Key", apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        restTemplate.postForEntity(webhookUrl, new HttpEntity<>(payload, headers), String.class);
    }
}
```

Key design decisions:
- **Non-blocking**: Webhook failures are logged but never propagate to the quiz completion response.
- **Configurable**: URL, API key, and enable flag are externalized in `application.properties`.
- **Authenticated**: X-API-Key header prevents unauthorized webhook calls.

## 5.6 Answer Handling

During quiz gameplay, the `StartQuiz` endpoint returns all questions with their correct answers included (via `QuestionResponseDto`). Answer validation is performed client-side for immediate feedback:

- The frontend compares the user's selected answer against `correctAnswer`.
- The `TakeQuestionSaveRequestDto` includes a `check_answer` field indicating correctness.
- The `TakeQuestionService.getScore()` method recomputes the final score server-side by counting `CORRECT` entries.

The `CheckAnswer` enum mapping uses numeric codes: `"1"` or `"2"` → CORRECT, `"-1"` → INCORRECT, other → NOT_ANSWERED.

## 5.7 CORS Configuration

Cross-origin requests are configured via externalized properties (`SecurityCorsProperties`):

```java
@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(SecurityCorsProperties.class)
public class SecurityConfig {
    
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) {
        http.csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .anyRequest().permitAll())
            .cors(Customizer.withDefaults());
        return http.build();
    }
}
```

The `application.properties` configures CORS with wildcard patterns for development:
```properties
app.security.cors.allowed-origin-patterns=*
app.security.cors.allowed-methods=GET,POST,PUT,PATCH,DELETE,OPTIONS
app.security.cors.allowed-headers=*
```

**Note**: Controller paths have no `/api/` prefix. Actual endpoint paths are: `/quiz`, `/question`, `/take-quiz`, `/review-schedule`, `/notification`. The Next.js BFF routes proxy under `/api/*` (e.g., `/api/quiz` → Spring Boot `/quiz`).

## 5.8 Error Handling

A global exception handler converts exceptions to consistent error responses:

| Exception | HTTP Status | Response |
|-----------|-------------|----------|
| ResourceNotFoundException | 404 | `{"message": "Quiz not found", "code": "NOT_FOUND"}` |
| ValidationException | 400 | `{"message": "...", "code": "VALIDATION_ERROR"}` |
| FirestoreException | 500 | `{"message": "Database error", "code": "INTERNAL"}` |

## 5.9 Build and Deployment

The project builds as a fat JAR via Maven:

```bash
./mvnw clean package -DskipTests
java -jar target/quizai_spring-0.0.1-SNAPSHOT.jar
```

Configuration is provided via `application.properties` and environment variables, following the 12-factor app methodology.
