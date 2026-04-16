# AGENTS.md

## Purpose
- Backend for an AI-assisted quiz platform: CRUD quiz/question data, run quiz-taking sessions, and proxy AI workflows via n8n.
- Stack: Spring Boot 3.4, Java 17+ target, Firestore (no SQL datasource), RestTemplate-based webhook calls.

## Architecture map (what talks to what)
- HTTP layer: `src/main/java/com/myproject/quizzai/controller/*Controller.java`.
- Business/data layer: `src/main/java/com/myproject/quizzai/service/*Service.java` directly reads/writes Firestore collections.
- Domain objects: `src/main/java/com/myproject/quizzai/model/*.java` are Firestore document shapes (`@DocumentId` + Lombok).
- DTO boundary: request/response types in `src/main/java/com/myproject/quizzai/dto/*.java` (controllers rarely expose models directly).
- Infra config: `FirebaseConfiguration` wires `FirebaseApp`, `Firestore`, `FirebaseAuth`; `AppConfig` wires timeout-configured `RestTemplate`.

## Core data flow to preserve
- Quiz creation: `POST /quiz` -> `QuizService.create()` -> collection `quiz`.
- Question creation/update: `POST /question`, `POST /question/update` -> `QuestionService` -> collection `question`.
- Play flow: `POST /take-quiz/start` creates `take_quiz` (status `PENDING`) and returns quiz questions.
- End flow: `POST /take-quiz/end` saves answers into `take_question`, computes score (`"x/y"`), then updates `take_quiz` status/score.
- User profile: `GET /user/quiz-profile` composes data from both `QuizService` and `TakeQuizService`.

## Project-specific conventions (important)
- Firestore collection names are hardcoded lowercase strings: `quiz`, `question`, `take_quiz`, `take_question`.
- IDs are short UUID slices from `IdUtil.generateId()` (8 chars); reuse this utility for new documents.
- Field naming mirrors Firestore schema and is often snake_case (`quiz_id`, `player_name`, `created_at`); follow existing names to avoid query breaks.
- Timestamps in incoming JSON use ISO-8601 and deserialize via `TimestampDeserializer` (see `QuizCreationRequestDto`).
- Category input arrives as `List<String>` and is converted to enum values in DTO getter (`QuizCreationRequestDto.getCategories()`).
- Service methods often use `@SneakyThrows` and synchronous `.get()` on Firestore futures; keep async assumptions explicit if refactoring.

## Integrations and local setup constraints
- Firebase credentials are loaded from `src/main/resources/serviceAccountKey.json` at startup (`FirebaseConfiguration`).
- n8n integration is local by default: `http://localhost:5678/webhook` in `n8nService`.
- `n8nController` endpoints: `/n8n/upload` (multipart: `quiz_id`, `data`) and `/n8n/get-question`.

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


