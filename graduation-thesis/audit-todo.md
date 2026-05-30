# Thesis Audit TODO List

## Phase 1: Deep Codebase Research

### Spring Boot Backend
- [ ] Read all controllers (QuizController, QuestionController, TakeQuizController, etc.)
- [ ] Read all services (QuizService, TakeQuizService, WebhookService, etc.)
- [ ] Read all models and DTOs
- [ ] Read config files (SecurityConfig, FirebaseConfiguration, AppConfig)
- [ ] Read application.properties
- [ ] Read exception handlers
- [ ] Read utility classes
- [ ] Trace quiz completion → webhook flow
- [ ] Verify answer encryption claim
- [ ] Verify CORS configuration

### AI Study Coach (FastAPI)
- [ ] Read main.py and startup/shutdown
- [ ] Read all capabilities (agentic.py, chat.py, lite_orchestrator.py, solve.py, quiz.py)
- [ ] Read all tools (quiz_history, recommend, reason, web_search, rag)
- [ ] Read LLM providers (lm_studio.py, deepseek.py, base.py)
- [ ] Read routes (ingest.py, generate.py, webhook.py)
- [ ] Read services (embedding.py, supabase_client.py)
- [ ] Read learning modules (progress.py, spaced_repetition.py)
- [ ] Read scheduler tasks
- [ ] Read WebSocket handler
- [ ] Verify agentic loop bounds (MAX_TOOL_ITERATIONS, etc.)
- [ ] Verify RAG pipeline (chunking, embedding, storage)
- [ ] Verify SM-2 implementation

### Frontend (Next.js)
- [ ] Read all store slices (useAuth, useChat, useCoach, useQueries, etc.)
- [ ] Read BFF API routes (coach/*, quiz/*, review-schedules/*)
- [ ] Read Coach dashboard components
- [ ] Read Chat components (widget, message rendering)
- [ ] Read _app.js (auth listener, hydration)
- [ ] Read PWA files (manifest, service worker)
- [ ] Verify WebSocket protocol handling
- [ ] Verify Firestore document management
- [ ] Verify token verification in BFF routes

## Phase 2: Claim Verification per Chapter
- [ ] Chapter 1: Verify objectives match implementation
- [ ] Chapter 2: Verify algorithm references match code
- [ ] Chapter 3: Verify requirements match implemented features
- [ ] Chapter 4: Verify architecture, data models, API contracts
- [ ] Chapter 5: Verify implementation details match code
- [ ] Chapter 6: Verify test strategy matches test files
- [ ] Chapter 7: Verify achievements are real

## Phase 3: Audit Report & Thesis Improvement
- [ ] Create codebase-research-audit.md
- [ ] Improve thesis with code-level evidence
- [ ] Add missing implementation details
- [ ] Remove unsupported claims
- [ ] Split files if exceeding 500 lines
