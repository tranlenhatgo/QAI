# Chapter 7: Conclusion and Future Work

## 7.1 Summary of Achievements

This thesis presented QAI, an AI-Assisted Quiz Platform that combines intelligent tutoring, spaced repetition, and retrieval-augmented generation in one learning system. The project achieved the following:

1. **Three-Service Microservices Architecture**: Designed and implemented a system with Spring Boot for quiz management, Next.js for the frontend and BFF, and FastAPI for the AI Coach. The services communicate through REST, WebSocket, and webhooks.

2. **Agentic AI Study Coach**: Implemented a conversational coach that can invoke tools for quiz history, uploaded materials, practice generation, and web search during a conversation.

3. **Dual-Tier LLM Integration**: Built a dual-tier architecture where local inference through LM Studio supports low-cost private use, while DeepSeek provides cloud inference for Full mode.

4. **RAG Pipeline**: Built a pipeline from PDF text extraction through vector embedding with nomic-embed-text-v1.5 to cosine similarity search in Supabase pgvector, enabling question generation from user materials.

5. **SM-2 Spaced Repetition**: Implemented category-level spaced repetition scheduling triggered by quiz completion webhooks, with notification reminders for due reviews.

6. **Progress Analytics**: Delivered learning metrics for mastery levels, learning velocity, study streaks, and weak categories.

7. **Progressive Web Application**: Shipped an installable PWA with service worker caching, responsive design across mobile/tablet/desktop, and real-time streaming AI chat.

8. **Adaptive Infinity Quiz**: Added signed-in, single-category endless practice that starts from static `questions.json` questions, requests tier-sized Lite/Full AI batches, and repeats wrong answers with in-session spacing while keeping adaptive records separate from formal quiz history.

## 7.2 Contributions to the Field

The work makes the following contributions:

- **Agentic AI in Education**: Showed how bounded tool-use loops, limited to 3 rounds and 9 tools, can support educational tasks without unbounded agent execution.

- **LiteOrchestrator Pattern**: Introduced a code-driven intent classification approach that gives small local models (4B-9B parameters) agent-like workflows without requiring function calling.

- **Category-Level SM-2**: Adapted the SM-2 algorithm from individual flashcards to quiz categories, aligning spaced repetition with assessment-based learning environments.

- **Practical Dual-Tier Design**: Provided a reference architecture for educational AI systems that must balance quality, cost, and privacy requirements.

- **Separated Adaptive Practice Journal**: Stored endless-practice answers in a dedicated user-scoped Firestore subcollection, keeping them separate from formal quiz scoring.

## 7.3 Objectives Fulfillment

| Objective | Status | Evidence |
|-----------|--------|----------|
| Intelligent quiz platform | Yes Achieved | Quiz CRUD, sharing, gameplay, AI generation |
| AI Study Coach with tools | Yes Achieved | 9 tools, 3-round agentic loop, WebSocket streaming |
| Spaced repetition (SM-2) | Yes Achieved | Per-category scheduling, webhook-triggered updates |
| RAG pipeline | Yes Achieved | PDF/TXT ingestion, pgvector search, context injection |
| Progress tracking | Yes Achieved | Mastery, velocity, streaks, weakness analysis |
| Adaptive endless practice | Achieved | Static warmup, Lite 5-question and Full 10-question AI batches, wrong-repeat queue |
| Production-ready system | Yes Achieved | Three services running, authenticated, integrated |

## 7.4 Limitations

1. **No OCR Support**: Image-only/scanned PDFs cannot be processed. Users must provide text-based documents.

2. **Single-User Testing**: The project did not include a formal multi-participant user study to validate pedagogical effectiveness.

3. **Local Model Dependencies**: The Lite tier requires a GPU-capable machine running LM Studio, limiting accessibility.

4. **No Multiplayer Real-Time**: Quiz rooms are turn-based; real-time competitive multiplayer was not implemented.

5. **Limited Language Support**: The AI Coach operates in English; multilingual support depends on the selected LLM's capabilities.

6. **No Formal Security Audit**: While OWASP principles were followed, no penetration testing was conducted.

## 7.5 Future Work

### 7.5.1 Short-Term Improvements

- **OCR Integration**: Add Tesseract or cloud-based OCR for scanned document support.
- **Voice Interaction**: Speech-to-text input and text-to-speech output for accessibility.
- **Collaborative Quizzes**: Real-time multiplayer quiz rooms with WebSocket synchronization.
- **Export/Import**: Export progress reports as PDF; import quizzes from external formats (QTI).

### 7.5.2 Medium-Term Enhancements

- **Adaptive Difficulty**: Use learning analytics to adjust question difficulty in generated quizzes.
- **Adaptive Infinity Optimization**: Cache AI batches and add model-specific prompt tuning to reduce Lite local generation latency.
- **Multi-Modal RAG**: Support images, diagrams, and tables in uploaded materials.
- **FSRS Migration**: Evaluate the Free Spaced Repetition Scheduler as a more personalized alternative to SM-2 once sufficient user data accumulates.
- **LLM Fine-Tuning**: Fine-tune a small model on educational question-answer pairs for improved Lite tier quality.

### 7.5.3 Long-Term Vision

- **Institutional Deployment**: Multi-tenant architecture with instructor dashboards, class-level analytics, and LMS integration (via LTI protocol).
- **Knowledge Graph**: Build a knowledge graph from quiz performance data to map conceptual dependencies and recommend prerequisite material.
- **Peer Learning**: Match students with complementary strengths for collaborative study sessions.
- **Formal Evaluation Study**: Conduct a controlled study comparing learning outcomes of QAI users versus traditional quiz platforms.

## 7.6 Closing Remarks

QAI combines LLMs, RAG, and agentic tools with spaced repetition and adaptive feedback. Students receive quiz practice, targeted guidance, and review scheduling from the same learning record.

The microservices architecture lets each component evolve on its own. Developers can add LLM providers, test scheduling algorithms, or redesign the frontend without changing the whole system.

As LLMs improve, QAI can route stronger models through the same bounded agentic interface while preserving the scalability and accessibility advantages of software.
