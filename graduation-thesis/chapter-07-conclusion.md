# Chapter 7: Conclusion and Future Work

## 7.1 Summary of Achievements

This thesis presented QAI, an AI-Assisted Quiz Platform that integrates intelligent tutoring, spaced repetition, and retrieval-augmented generation within a unified educational system. The primary achievements are:

1. **Three-Service Microservices Architecture**: Successfully designed and implemented a production-grade system with Spring Boot (quiz management), Next.js (frontend + BFF), and FastAPI (AI Coach), demonstrating inter-service communication via REST, WebSocket, and webhooks.

2. **Agentic AI Study Coach**: Implemented a conversational AI coach that autonomously decides when to invoke tools — searching quiz history, querying uploaded materials, generating practice questions, or browsing the web — rather than relying on user-initiated commands.

3. **Dual-Tier LLM Integration**: Achieved a practical dual-tier architecture where local inference (LM Studio) provides zero-cost, private operation, while cloud inference (DeepSeek) delivers higher quality when available.

4. **Complete RAG Pipeline**: Built an end-to-end pipeline from PDF text extraction through vector embedding (nomic-embed-text-v1.5) to cosine similarity search (Supabase pgvector), enabling personalized question generation from user materials.

5. **SM-2 Spaced Repetition**: Implemented category-level spaced repetition scheduling, automatically triggered by quiz completion webhooks, with notification reminders for due reviews.

6. **Progress Analytics**: Delivered comprehensive learning metrics including mastery levels, learning velocity, study streaks, and weakness identification.

7. **Progressive Web Application**: Shipped an installable PWA with service worker caching, responsive design across mobile/tablet/desktop, and real-time streaming AI chat.

## 7.2 Contributions to the Field

The work makes the following contributions:

- **Agentic AI in Education**: Demonstrated that bounded tool-use loops (3 rounds × 9 tools) provide meaningful educational value without the risks of unbounded agent execution.

- **LiteOrchestrator Pattern**: Introduced a code-driven intent classification approach that enables "agentic-like" behavior on small local models (4B–9B parameters) incapable of reliable function calling.

- **Category-Level SM-2**: Adapted the SM-2 algorithm from individual flashcards to quiz categories, aligning spaced repetition with assessment-based learning environments.

- **Practical Dual-Tier Design**: Provided a reference architecture for educational AI systems that must balance quality, cost, and privacy requirements.

## 7.3 Objectives Fulfillment

| Objective | Status | Evidence |
|-----------|--------|----------|
| Intelligent quiz platform | ✓ Achieved | Quiz CRUD, sharing, gameplay, AI generation |
| AI Study Coach with tools | ✓ Achieved | 9 tools, 3-round agentic loop, WebSocket streaming |
| Spaced repetition (SM-2) | ✓ Achieved | Per-category scheduling, webhook-triggered updates |
| RAG pipeline | ✓ Achieved | PDF/TXT ingestion, pgvector search, context injection |
| Progress tracking | ✓ Achieved | Mastery, velocity, streaks, weakness analysis |
| Production-ready system | ✓ Achieved | Three services running, authenticated, integrated |

## 7.4 Limitations

1. **No OCR Support**: Image-only/scanned PDFs cannot be processed. Users must provide text-based documents.

2. **Single-User Testing**: The system has not undergone formal user studies with multiple participants to validate pedagogical effectiveness.

3. **Local Model Dependencies**: The Lite tier requires a GPU-capable machine running LM Studio, limiting accessibility.

4. **No Multiplayer Real-Time**: Quiz rooms are turn-based; real-time competitive multiplayer was not implemented.

5. **Limited Language Support**: The AI Coach operates primarily in English; multilingual support depends on the selected LLM's capabilities.

6. **No Formal Security Audit**: While OWASP principles were followed, no penetration testing was conducted.

## 7.5 Future Work

### 7.5.1 Short-Term Improvements

- **OCR Integration**: Add Tesseract or cloud-based OCR for scanned document support.
- **Voice Interaction**: Speech-to-text input and text-to-speech output for accessibility.
- **Collaborative Quizzes**: Real-time multiplayer quiz rooms with WebSocket synchronization.
- **Export/Import**: Export progress reports as PDF; import quizzes from external formats (QTI).

### 7.5.2 Medium-Term Enhancements

- **Adaptive Difficulty**: Use learning analytics to automatically adjust question difficulty in generated quizzes.
- **Multi-Modal RAG**: Support images, diagrams, and tables in uploaded materials.
- **FSRS Migration**: Evaluate the Free Spaced Repetition Scheduler as a more personalized alternative to SM-2 once sufficient user data accumulates.
- **LLM Fine-Tuning**: Fine-tune a small model on educational question-answer pairs for improved Lite tier quality.

### 7.5.3 Long-Term Vision

- **Institutional Deployment**: Multi-tenant architecture with instructor dashboards, class-level analytics, and LMS integration (via LTI protocol).
- **Knowledge Graph**: Build a knowledge graph from quiz performance data to map conceptual dependencies and recommend prerequisite material.
- **Peer Learning**: Match students with complementary strengths for collaborative study sessions.
- **Formal Evaluation Study**: Conduct a controlled study comparing learning outcomes of QAI users versus traditional quiz platforms.

## 7.6 Closing Remarks

QAI demonstrates that combining modern AI capabilities (LLMs, RAG, agentic tools) with proven educational science (spaced repetition, adaptive feedback) produces a system greater than the sum of its parts. The student benefits not just from quiz practice, but from intelligent guidance that adapts to their demonstrated strengths and weaknesses.

The microservices architecture ensures each component can evolve independently — new LLM providers can be added, alternative scheduling algorithms can be tested, and the frontend can be redesigned — without disrupting the integrated experience.

As LLM capabilities continue to advance rapidly, the bounded agentic approach adopted by QAI positions the system to incorporate stronger models seamlessly, potentially achieving tutoring quality approaching that of human instructors while maintaining the scalability and accessibility advantages of software.
