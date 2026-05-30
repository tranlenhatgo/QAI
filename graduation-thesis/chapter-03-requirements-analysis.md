# Chapter 3: Requirements Analysis

## 3.1 Stakeholders

| Stakeholder | Role | Key Concerns |
|-------------|------|--------------|
| Student (Primary User) | Takes quizzes, interacts with AI coach, reviews materials | Usability, learning effectiveness, response speed |
| Quiz Creator | Creates and shares quizzes | Easy creation workflow, AI assistance |
| System Administrator | Deploys and maintains the platform | Reliability, scalability, security |
| Educational Institution | Potential adopter of the platform | Data privacy, academic integrity, integration capability |

## 3.2 Functional Requirements

### FR-01: Quiz Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01.1 | Users shall create quizzes with a title, category, and multiple-choice questions | Must |
| FR-01.2 | Each question shall have exactly 4 answer options with one correct answer | Must |
| FR-01.3 | Quizzes shall be organized by categories (Science, Math, History, etc.) | Must |
| FR-01.4 | A quiz shall have exactly one category | Must |
| FR-01.5 | Users shall browse and take quizzes created by other users | Must |
| FR-01.6 | Quiz completion shall record the score in format "correct/total" | Must |
| FR-01.7 | Users shall view their quiz history and scores | Should |

### FR-02: AI Question Generation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-02.1 | System shall generate multiple-choice questions from a given topic | Must |
| FR-02.2 | System shall generate questions from uploaded files (PDF, TXT, MD) | Must |
| FR-02.3 | Generated questions shall conform to the 4-option multiple-choice format | Must |
| FR-02.4 | Users shall specify the number of questions to generate (1–20) | Should |
| FR-02.5 | System shall support both local (Lite) and cloud (Full) generation tiers | Should |
| FR-02.6 | System shall generate questions from RAG-indexed documents | Should |

### FR-03: AI Study Coach

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-03.1 | System shall provide real-time conversational AI coaching via WebSocket | Must |
| FR-03.2 | AI coach shall stream responses token-by-token | Must |
| FR-03.3 | AI coach shall support agentic tool use (up to 9 tools, 3 rounds) | Must |
| FR-03.4 | AI coach shall access user quiz history for personalized advice | Must |
| FR-03.5 | AI coach shall search uploaded study materials via RAG | Should |
| FR-03.6 | AI coach shall search the web for current information | Should |
| FR-03.7 | Users shall be able to stop AI generation mid-stream | Should |
| FR-03.8 | Chat conversations shall persist across page navigation | Should |

### FR-04: Spaced Repetition

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-04.1 | System shall implement SM-2 algorithm for review scheduling | Must |
| FR-04.2 | Review schedules shall be per-category, per-user | Must |
| FR-04.3 | System shall display due reviews to the user | Must |
| FR-04.4 | Completing a review quiz shall update the schedule | Must |
| FR-04.5 | System shall create notifications for upcoming reviews | Should |

### FR-05: Progress Tracking

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-05.1 | System shall display score trends over time | Must |
| FR-05.2 | System shall calculate mastery level per category | Must |
| FR-05.3 | System shall identify weak categories | Must |
| FR-05.4 | System shall track study streaks (consecutive active days) | Should |
| FR-05.5 | System shall calculate learning velocity (improvement rate) | Should |

### FR-06: Document Management (RAG)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-06.1 | Users shall upload study materials (PDF, TXT, MD) | Must |
| FR-06.2 | System shall extract text from uploaded documents | Must |
| FR-06.3 | System shall reject image-only PDFs with a clear error message | Must |
| FR-06.4 | System shall chunk, embed, and index documents for vector search | Must |
| FR-06.5 | Document metadata shall persist across sessions (Firestore) | Must |
| FR-06.6 | Users shall delete documents (removes metadata + RAG chunks) | Must |
| FR-06.7 | Document upload shall be restricted to Full tier only | Should |

### FR-07: Step-by-Step Problem Solver

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-07.1 | Users shall input a problem and receive a structured solution | Should |
| FR-07.2 | Solution shall be broken into numbered steps with explanations | Should |
| FR-07.3 | System shall provide a final answer with confidence level | Should |

### FR-08: Authentication and Authorization

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-08.1 | Users shall sign up with email/password | Must |
| FR-08.2 | Users shall sign in with Google OAuth | Must |
| FR-08.3 | Protected features shall require authentication | Must |
| FR-08.4 | Firestore security rules shall enforce user-scoped data access | Must |

## 3.3 Non-Functional Requirements

### NFR-01: Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01.1 | Page load time (initial) | < 3 seconds |
| NFR-01.2 | AI chat first token latency (Lite tier) | < 2 seconds |
| NFR-01.3 | AI chat first token latency (Full tier) | < 4 seconds |
| NFR-01.4 | Question generation time (5 questions) | < 15 seconds |
| NFR-01.5 | Document ingestion (10-page PDF) | < 30 seconds |
| NFR-01.6 | RAG search response time | < 500 milliseconds |

### NFR-02: Scalability

| ID | Requirement | Description |
|----|-------------|-------------|
| NFR-02.1 | Concurrent WebSocket sessions | Support 50+ simultaneous chat sessions |
| NFR-02.2 | Document storage per user | Up to 50MB of study materials |
| NFR-02.3 | Quiz history retention | Unlimited (Firestore auto-scaling) |

### NFR-03: Security

| ID | Requirement | Description |
|----|-------------|-------------|
| NFR-03.1 | API authentication | All BFF routes require valid Firebase ID token |
| NFR-03.2 | Inter-service auth | AI Coach endpoints protected by API key (X-API-Key header) |
| NFR-03.3 | Answer handling | Client-side quiz validation with correct answers sent on quiz start; results submitted back to server |
| NFR-03.4 | Data isolation | Users can only access their own documents, progress, and history |
| NFR-03.5 | CORS policy | Restricted to known frontend origins |

### NFR-04: Availability and Reliability

| ID | Requirement | Description |
|----|-------------|-------------|
| NFR-04.1 | Graceful degradation | If LM Studio is unavailable, Full tier (DeepSeek) serves as fallback |
| NFR-04.2 | Error recovery | Agentic loop falls back to simple chat on tool failure |
| NFR-04.3 | Offline capability | PWA caches static assets for offline access |

### NFR-05: Usability

| ID | Requirement | Description |
|----|-------------|-------------|
| NFR-05.1 | Responsive design | Functional on mobile, tablet, and desktop |
| NFR-05.2 | Accessibility | Keyboard navigation, semantic HTML, ARIA labels |
| NFR-05.3 | Installability | PWA manifest for home screen installation |

## 3.4 Use Cases

### UC-01: Take a Quiz

**Actor**: Student  
**Precondition**: Student is authenticated  
**Main Flow**:
1. Student browses quizzes by category or searches by title.
2. Student selects a quiz and clicks "Play".
3. System presents questions one at a time with a timer.
4. Student selects answers for each question.
5. System shows results with score and correct answers.
6. System fires webhook to AI Coach for spaced repetition processing.

### UC-02: AI-Assisted Study

**Actor**: Student  
**Precondition**: Student is authenticated, AI Coach server running  
**Main Flow**:
1. Student opens the Coach dashboard or chat widget.
2. Student asks a question or requests help.
3. AI Coach decides whether to use tools (search history, materials, web).
4. AI Coach streams a personalized response with actionable advice.
5. If tools were used, tool execution status is shown as pills in chat.

### UC-03: Upload and Search Study Materials

**Actor**: Student  
**Precondition**: Student is authenticated, Full tier active  
**Main Flow**:
1. Student navigates to Materials tab in Coach dashboard.
2. Student drags a PDF/TXT file into the upload zone.
3. System extracts text, validates content quality (>70% printable).
4. System chunks text and generates embeddings.
5. Document appears in list with "RAG" badge when indexed.
6. In subsequent chat sessions, AI Coach can search this material.
7. In Generate tab, student can select document as source for questions.

### UC-04: Spaced Repetition Review

**Actor**: Student  
**Precondition**: Student has completed at least one quiz  
**Main Flow**:
1. System scheduler checks for due reviews hourly.
2. Due reviews appear in the Coach dashboard Overview tab.
3. Student clicks "Review" on a due category.
4. System navigates to quiz play with questions from that category.
5. Upon completion, webhook updates SM-2 schedule.
6. Next review date is recalculated and stored.

## 3.5 System Context Diagram

```text
                    ┌─────────────┐
                    │   Student   │
                    └──────┬──────┘
                           │
              WebSocket + HTTP (Browser)
                           │
                    ┌──────▼──────┐
                    │  QAI System │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼───────┐  ┌───────▼───────┐  ┌──────▼───────┐
│  Firebase     │  │  Supabase     │  │  LM Studio   │
│  (Auth + DB)  │  │  (pgvector)   │  │  (Local LLM) │
└───────────────┘  └───────────────┘  └──────────────┘
                                             │
                                      ┌──────▼───────┐
                                      │  DeepSeek    │
                                      │  (Cloud LLM) │
                                      └──────────────┘
```

## 3.6 Constraints

1. **Budget**: Zero recurring API cost for Lite tier; minimal cost for Full tier (DeepSeek pricing).
2. **Hardware**: Local LLM requires GPU with ≥8GB VRAM (LM Studio).
3. **Network**: Full tier features require internet connectivity.
4. **Text PDFs only**: Document ingestion does not support scanned/image-only PDFs (no OCR).
5. **Single category per quiz**: Architectural constraint for accurate per-category analytics.
