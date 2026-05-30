# Codebase Research Audit Report

## Files and Modules Inspected

### Spring Boot Backend
- `QuizController.java` — Quiz CRUD endpoints
- `QuestionController.java` — Question management endpoints
- `TakeQuizController.java` — Quiz attempt endpoints (start/end)
- `NotificationController.java` — Notification CRUD
- `ReviewScheduleController.java` — Spaced repetition schedule CRUD
- `QuizService.java` — Quiz business logic, Firestore access
- `TakeQuizService.java` — Quiz attempt logic, webhook trigger
- `TakeQuestionService.java` — Answer saving, score computation
- `WebhookService.java` — AI Coach webhook client
- `ReviewScheduleService.java` — Schedule upsert/query logic
- `NotificationService.java` — Notification operations
- All models: Quiz, Question, TakeQuiz, TakeQuestion, ReviewSchedule, User, Category enum
- All DTOs: QuestionResponseDto, TakeQuizStartResponseDto, TakeQuestionSaveRequestDto, etc.
- Config: FirebaseConfiguration, SecurityConfig, SecurityCorsProperties, AppConfig
- `application.properties` — CORS, webhook config

### AI Study Coach (FastAPI)
- `main.py` — FastAPI app, lifespan, API key middleware, route registration
- `config.py` — pydantic-settings configuration
- `router.py` — Tier/Mode routing, capability resolution
- `capabilities/agentic.py` — Full agentic loop (MAX_TOOL_ITERATIONS=10, MAX_TOOL_CALLS_PER_TURN=3)
- `capabilities/lite_orchestrator.py` — Intent classification + code-driven workflows
- `capabilities/chat.py` — Simple streaming chat
- `llm/base.py` — Abstract interface, Message, ToolCall, StreamChunk types
- `tools/__init__.py` — BaseTool abstract class
- `tools/registry.py` — ToolRegistry factory (create_full_registry, create_lite_registry)
- `tools/quiz_history.py` — QuizHistoryTool implementation
- `tools/recommend.py` — RecommendTool implementation
- `tools/reason.py` — ReasonTool (chain-of-thought via Full tier LLM)
- `tools/web_search.py` — WebSearchTool (DuckDuckGo, NOT Google CSE)
- `tools/rag.py` — RAGTool (Supabase pgvector search)
- `agent/tools.py` — Tool DEFINITIONS in OpenAI format (9 tools for LLM function-calling)
- `routes/ingest.py` — Document ingestion (CHUNK_SIZE=2000, CHUNK_OVERLAP=200)
- `routes/generate.py` — Question generation from topics/files
- `routes/webhook.py` — Quiz completion webhook + SM-2 trigger
- `services/embeddings.py` — LM Studio embedding generation
- `services/supabase_client.py` — Supabase pgvector client
- `learning/spaced_repetition.py` — SM-2 implementation (interval: 1, 3, ×EF; fail=0.5 days)
- `learning/progress.py` — ProgressTracker, mastery computation
- `scheduler/scheduler.py` — APScheduler (review check + daily progress)
- `ws/endpoint.py` — WebSocket handler (session lifecycle)
- `ws/__init__.py` — Protocol message builders

### Frontend (Next.js)
- `pages/_app.js` — Auth listener, loadUserDocuments, StudyCoachWidget
- `store/useBoundStore.js` — Merged Zustand store (7 slices)
- `store/useChat.js` — WebSocket chat state
- `store/useCoach.js` — Coach dashboard + Firestore documents
- `pages/api/coach/generate-questions.js` — BFF route with auth + API key
- `lib/withAuth.js` — Firebase token verification middleware
- `public/manifest.json` — PWA manifest

---

## Claim Verification Results

### Chapter 1: Introduction

| Claim | Status | Evidence |
|-------|--------|----------|
| Three-service microservices architecture | SUPPORTED | Spring Boot :8080, Next.js :3000, FastAPI :8000 confirmed in configs |
| AI Coach with tool use | SUPPORTED | AgenticCapability in agentic.py, 5 tools in registry, 9 definitions in agent/tools.py |
| SM-2 spaced repetition | SUPPORTED | learning/spaced_repetition.py implements SM-2 |
| RAG pipeline | SUPPORTED | routes/ingest.py + supabase_client.py + services/embeddings.py |
| Progress tracking | SUPPORTED | learning/progress.py with CategoryMastery, LearningVelocity |
| PWA | SUPPORTED | manifest.json, sw.js, workbox in public/ |

### Chapter 4: System Design (Architecture)

| Claim | Status | Issue |
|-------|--------|-------|
| API paths start with `/api/` | **UNSUPPORTED** | No context-path in application.properties. Controllers use `quiz`, `take-quiz`, `question`, `notification`, `review-schedule` without `/api/` prefix. Frontend BFF routes at `/api/coach/*` are Next.js routes (correct), but Spring Boot endpoints are at root. |
| Quiz has exactly one category | **PARTIALLY SUPPORTED** | Model has `List<Category> categories`, but `getQuizCategory()` in TakeQuizService takes `.get(0)` only. Multiple categories possible in data but only first used for analytics. |
| Category enum includes LANGUAGE, HEALTH, MUSIC, etc. | **UNSUPPORTED** | Actual enum: SCIENCE, HISTORY, GEOGRAPHY, LITERATURE, TECHNOLOGY, SPORTS, ENTERTAINMENT, MATH, ART, SPACE, GENERAL_CULTURE (11 values). Thesis listed 15 wrong values. |
| Answer encryption at rest | **UNSUPPORTED** | QuestionResponseDto returns `correctAnswer` directly. No encryption logic found anywhere. |
| Chunk size 500 chars / 50 overlap | **UNSUPPORTED** | Actual: CHUNK_SIZE=2000 chars, CHUNK_OVERLAP=200 chars (routes/ingest.py lines 22-23) |
| Web search uses Google Custom Search API | **UNSUPPORTED** | Actual: WebSearchTool uses DuckDuckGo via `ddgs` package (tools/web_search.py) |
| 9 tools available | **PARTIALLY SUPPORTED** | agent/tools.py defines 9 tool definitions for LLM. ToolRegistry (registry.py) has 5 tool implementations (quiz_history, recommend, reason, web_search, rag). The 4 "action" tools (navigate, start_quiz, etc.) are defined but executed by tool_executor.py differently. |

### Chapter 4: System Design (SM-2 Algorithm)

| Claim | Status | Issue |
|-------|--------|-------|
| First success interval = 1 day | SUPPORTED | Code: `if reps == 1: interval = 1.0` |
| Second success interval = 6 days | **UNSUPPORTED** | Code: `elif reps == 2: interval = 3.0` (NOT 6) |
| Failure resets interval to 1 day | **UNSUPPORTED** | Code: `interval = 0.5` (12 hours, not 1 day) |
| Quality mapping 70-79% = 3 | **UNSUPPORTED** | Code: `score >= 0.6` returns quality 3 (60%+, not 70%+) |
| Quality mapping 80-89% = 4 | SUPPORTED | Code: `score >= 0.8` returns 4 |
| Quality mapping 90-100% = 5 | SUPPORTED | Code: `score >= 0.9` returns 5 |
| EF formula matches SM-2 | SUPPORTED | `easiness + (0.1 - (5-quality) * (0.08 + (5-quality)*0.02))` matches |

### Chapter 4: System Design (RAG)

| Claim | Status | Issue |
|-------|--------|-------|
| nomic-embed-text-v1.5 for embeddings | SUPPORTED | config.py: `embedding_model = "text-embedding-nomic-embed-text-v1.5"` |
| Supabase pgvector storage | SUPPORTED | supabase_client.py with `match_documents` RPC |
| Chunk with smart boundary detection | SUPPORTED | ingest.py tries paragraph → sentence → word boundaries |
| Text quality validation (>70% printable) | SUPPORTED | `_is_meaningful_text()` in ingest.py |
| Null byte removal | SUPPORTED | `text.replace("\x00", "")` in `_extract_text()` |
| PyMuPDF for PDF extraction | SUPPORTED | `import fitz` in ingest.py |

### Chapter 5: Implementation

| Claim | Status | Issue |
|-------|--------|-------|
| Webhook is non-blocking | **PARTIALLY SUPPORTED** | WebhookService catches exceptions, but it's synchronous (RestTemplate.postForEntity is blocking). It won't block user response since it's called at end of EndQuiz. |
| BFF uses Firebase Admin SDK | **UNSUPPORTED** | withAuth.js uses Firebase REST API (`identitytoolkit.googleapis.com`) NOT Admin SDK. It verifies tokens via HTTP call to Google API. |
| APScheduler for background tasks | SUPPORTED | scheduler.py uses AsyncIOScheduler from apscheduler |
| Scheduler creates notifications via Spring Boot API | SUPPORTED | `store_notification()` in scheduler.py POSTs to Spring Boot |

### Chapter 6: Testing

| Claim | Status | Issue |
|-------|--------|-------|
| JUnit 5 + MockMvc tests | **NEEDS DEEPER ANALYSIS** | test/ directory exists but contents not fully inspected |
| pytest for AI Coach | SUPPORTED | tests/test_ai_response.py and tests/test_learning.py exist |
| Performance numbers (1.5s load, etc.) | **TOO VAGUE** | No benchmark scripts or measurement methodology found |
| AI quality metrics (96% grammar, etc.) | **UNSUPPORTED** | No evaluation dataset or scoring pipeline found |
| RAG metrics (84% recall@5) | **UNSUPPORTED** | No retrieval evaluation scripts found |

---

## Feature-to-Code Mapping

| Feature | Files |
|---------|-------|
| Quiz CRUD | QuizController.java, QuizService.java, Quiz.java |
| Question Management | QuestionController.java, QuestionService.java, Question.java |
| Quiz Gameplay | TakeQuizController.java, TakeQuizService.java, TakeQuestionService.java |
| Spaced Repetition | ReviewScheduleService.java, learning/spaced_repetition.py, webhook.py |
| Notifications | NotificationController.java, NotificationService.java, scheduler.py |
| AI Chat (WebSocket) | ws/endpoint.py, router.py, capabilities/agentic.py |
| Intent Classification | capabilities/lite_orchestrator.py (IntentClassifier class) |
| RAG Ingestion | routes/ingest.py, services/supabase_client.py, services/embeddings.py |
| RAG Search | tools/rag.py, supabase_client.py `match_documents` RPC |
| Question Generation | routes/generate.py (`from-topics`, `from-file`) |
| Web Search | tools/web_search.py (DuckDuckGo) |
| Progress Tracking | learning/progress.py (ProgressTracker, CategoryMastery) |
| Document Management (Frontend) | store/useCoach.js (Firestore CRUD) |
| Auth (Frontend) | lib/withAuth.js (REST token verification) |
| Chat Widget | components/Chat/StudyCoachWidget, store/useChat.js |

---

## Critical Issues Found

1. **Category enum mismatch**: Thesis lists wrong categories. Must use actual: SCIENCE, HISTORY, GEOGRAPHY, LITERATURE, TECHNOLOGY, SPORTS, ENTERTAINMENT, MATH, ART, SPACE, GENERAL_CULTURE.

2. **SM-2 interval values wrong**: Second interval is 3 days (not 6), failure interval is 0.5 days (not 1).

3. **Chunk size wrong**: Actual is 2000 chars / 200 overlap (not 500/50).

4. **Web search tool uses DuckDuckGo**: Not Google Custom Search. Config has `search_api_key` and `search_cx` for Google, but the actual tool implementation uses `ddgs` package.

5. **No answer encryption**: QuestionResponseDto includes correctAnswer in plain text. No encryption logic exists.

6. **Quality score threshold wrong**: 60% gives quality 3 (not 70% as stated).

7. **API paths wrong**: Spring Boot has no `/api/` prefix. Actual paths: `/quiz`, `/question`, `/take-quiz`, `/review-schedule`, `/notification`.

8. **Auth middleware**: Frontend uses REST API verification (not Firebase Admin SDK).

---

## Final Verdict

**PARTIALLY SUPPORTED** — The thesis correctly describes the high-level architecture, communication patterns, and overall system design. However, it contains multiple factual errors in specific implementation details (chunk sizes, SM-2 parameters, category values, API paths, tool implementations). These errors suggest some sections were written from documentation/memory rather than from actual code inspection.

**Required fixes**: All factual claims must be corrected to match actual implementation.
