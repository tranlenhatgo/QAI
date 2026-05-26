# AGENTS.md

## Purpose

- Backend for an AI-assisted quiz platform: CRUD quiz/question data, run quiz-taking sessions, manage review schedules, notifications, and serve quiz data to the AI Study Coach.
- Stack: Spring Boot 3.4, Java 17+ target, Firestore (no SQL datasource).

## Architecture map (what talks to what)

- HTTP layer: `src/main/java/com/myproject/quizzai/controller/*Controller.java`.
- Business/data layer: `src/main/java/com/myproject/quizzai/service/*Service.java` directly reads/writes Firestore collections.
- Domain objects: `src/main/java/com/myproject/quizzai/model/*.java` are Firestore document shapes (`@DocumentId` + Lombok).
- DTO boundary: request/response types in `src/main/java/com/myproject/quizzai/dto/*.java` (controllers rarely expose models directly).
- Infra config: `FirebaseConfiguration` wires `FirebaseApp`, `Firestore`, `FirebaseAuth`; `AppConfig` wires timeout-configured `RestTemplate`.

## Controllers

| Controller | Root Mapping | Purpose |
| --- | --- | --- |
| `QuizController` | `/quiz` | CRUD quizzes |
| `QuestionController` | `/question` | CRUD questions, get by quiz |
| `TakeQuizController` | `/take-quiz` | Start/end quiz attempts, history |
| `TakeQuestionController` | `/take-question` | Individual question answers |
| `UserController` | `/user` | Profile, quiz-profile aggregate |
| `ReviewScheduleController` | `/review-schedule` | CRUD spaced repetition schedules |
| `NotificationController` | `/notification` | Create/read/mark-read notifications |

## Services

| Service | Firestore Collection | Purpose |
| --- | --- | --- |
| `QuizService` | `quiz` | Quiz CRUD, host lookup |
| `QuestionService` | `question` | Question CRUD, quiz-filtered queries |
| `TakeQuizService` | `take_quiz` + `take_question` | Quiz attempt lifecycle, score computation |
| `TakeQuestionService` | `take_question` | Individual answer storage |
| `UserService` | Firebase Auth | User profile management |
| `ReviewScheduleService` | `review_schedule` | SM-2 schedule CRUD, due-review queries |
| `NotificationService` | `notification` | Notification CRUD, unread queries |
| `WebhookService` | — (outbound) | Fires `POST /webhook/quiz-completed` to AI Coach |

## Core data flows

- **Quiz creation**: `POST /quiz` → `QuizService.create()` → collection `quiz`
- **Question creation/update**: `POST /question`, `POST /question/update` → `QuestionService` → collection `question`
- **Play flow**: `POST /take-quiz/start` creates `take_quiz` (status `PENDING`) and returns quiz questions
- **End flow**: `POST /take-quiz/end` saves answers into `take_question`, computes score (`"x/y"`), updates `take_quiz` status/score, then `WebhookService` fires webhook to AI Coach
- **Review schedule**: `PUT /review-schedule/{id}` updates interval/easiness/next_review (called by AI Coach after SM-2 computation)
- **Notifications**: `POST /notification/` creates notification (called by AI Coach scheduler), `GET /notification/user/{id}/unread` returns unread, `PATCH /notification/{id}/read` marks read
- **User profile**: `GET /user/quiz-profile` composes data from both `QuizService` and `TakeQuizService`

## Firestore collections

| Collection | Document ID | Key Fields |
| --- | --- | --- |
| `quiz` | 8-char UUID | host_id, title, categories[], status |
| `question` | 8-char UUID | quiz_id, content, answers[], correct_answer |
| `take_quiz` | 8-char UUID | quiz_id, player_id, score, status |
| `take_question` | 8-char UUID | take_id, question_id, answer, check_answer |
| `review_schedule` | 8-char UUID | user_id, category, easiness, interval_days, repetitions, next_review |
| `notification` | 8-char UUID | user_id, type, title, message, read, created_at |

## Project-specific conventions (important)

- Firestore collection names are hardcoded lowercase strings (see table above).
- IDs are short UUID slices from `IdUtil.generateId()` (8 chars); reuse this utility for new documents.
- Field naming mirrors Firestore schema and is often snake_case (`quiz_id`, `player_name`, `created_at`); follow existing names to avoid query breaks.
- Timestamps in incoming JSON use ISO-8601 and deserialize via `TimestampDeserializer` (see `QuizCreationRequestDto`).
- Category input arrives as `List<String>` and is converted to enum values in DTO getter (`QuizCreationRequestDto.getCategories()`).
- Service methods often use `@SneakyThrows` and synchronous `.get()` on Firestore futures; keep async assumptions explicit if refactoring.
- Score format is always `"correct/total"` string (e.g., "7/10").

## Integrations and local setup constraints

- Firebase credentials are loaded from `src/main/resources/serviceAccountKey.json` at startup (`FirebaseConfiguration`).
- AI Coach webhook: `WebhookService` sends `POST` to `COACH_URL/webhook/quiz-completed` with quiz result payload + `X-API-Key` header.

## Developer workflow (verified here)

- Build without tests:
  - `.\mvnw.cmd -q -DskipTests package`
- Run tests:
  - `.\mvnw.cmd test`
- Current test caveat: `contextLoads` fails if `src/main/resources/serviceAccountKey.json` is missing because Spring eagerly creates Firebase beans.
- Run app locally:
  - `.\mvnw.cmd spring-boot:run`

## Safe-change checklist for agents

- When adding endpoints, define root mappings as `ROOT_MAPPING` constants like existing controllers.
- Keep controller thin: orchestration belongs in services; persistence belongs in Firestore-backed services.
- If you rename model fields, update Firestore queries and all DTO mapping code in services.
- For quiz-taking changes, validate both `take_quiz` and `take_question` write paths together (they are coupled in `TakeQuizService.EndQuiz()`).
- For review schedule/notification changes, coordinate with AI Coach (it calls these endpoints).
