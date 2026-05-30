# Chapter 2: Literature Review

## 2.1 Intelligent Tutoring Systems

Intelligent Tutoring Systems (ITS) have been studied since the 1970s, with early systems like SCHOLAR (Carbonell, 1970) and GUIDON (Clancey, 1982) demonstrating the potential of adaptive instruction. Modern ITS typically consist of four components: a domain model, a student model, a tutoring model, and a user interface (Nwana, 1990).

Recent advances in natural language processing have enabled a new generation of ITS that interact through conversational interfaces rather than rigid menu-driven systems. Systems like Khan Academy's Khanmigo (2023) and Duolingo's AI features demonstrate the commercial viability of LLM-powered educational assistants.

However, most existing systems treat the AI as a passive responder — answering questions when asked. The **agentic paradigm**, where the AI proactively decides to use tools (search databases, generate content, analyze data), represents an emerging frontier that QAI explores.

## 2.2 Spaced Repetition and the Forgetting Curve

Hermann Ebbinghaus's seminal research (1885) established that memory retention decays exponentially without reinforcement. The spacing effect — the finding that distributed practice leads to better long-term retention than massed practice — has been replicated extensively (Cepeda et al., 2006).

### 2.2.1 The SM-2 Algorithm

The SuperMemo 2 (SM-2) algorithm, developed by Piotr Wozniak (1987), operationalizes spaced repetition through three key variables:

- **Easiness Factor (EF)**: A floating-point value (minimum 1.3) representing how easy an item is for the learner. Starts at 2.5.
- **Interval**: The number of days until the next review. Follows the progression: 1 → 6 → `interval × EF`.
- **Repetitions**: A counter tracking consecutive successful recalls.

The algorithm adjusts the easiness factor based on response quality (0–5 scale):
- Quality ≥ 3: Item considered recalled. Interval increases.
- Quality < 3: Item forgotten. Reset repetitions to 0, interval to 1 day.

SM-2 remains widely used due to its simplicity, effectiveness, and low computational cost. QAI implements SM-2 at the category level — tracking mastery per subject area rather than per individual flashcard — to align with the quiz-based assessment model.

### 2.2.2 Alternatives Considered

- **SM-15+** (SuperMemo's later algorithms): More complex, using neural networks. Rejected for added complexity without proportional benefit in a quiz context.
- **FSRS** (Free Spaced Repetition Scheduler): A newer algorithm using machine learning. Rejected due to requiring larger training datasets than available in early system usage.
- **Leitner System**: Box-based approach with fixed intervals. Rejected as less adaptive than SM-2.

## 2.3 Large Language Models in Education

### 2.3.1 Question Generation

LLMs have demonstrated strong capabilities in generating educational questions. Research by Elkins et al. (2023) shows that GPT-4 can produce multiple-choice questions of comparable quality to human-authored items when given appropriate context.

Key challenges in LLM-based question generation include:
- **Factual accuracy**: LLMs may generate plausible but incorrect answers (hallucination).
- **Difficulty calibration**: Controlling question difficulty reliably.
- **Distractor quality**: Generating plausible wrong answers that test genuine understanding.
- **Format compliance**: Ensuring structured output (JSON) from free-text generation.

QAI addresses these through structured prompting with JSON output schemas, validation pipelines, and tier-based model selection (larger models for better quality).

### 2.3.2 Agentic AI Systems

The concept of LLM agents — systems where the language model selects and executes tools to accomplish tasks — emerged prominently in 2023 with frameworks like LangChain, AutoGPT, and OpenAI's function calling. The ReAct pattern (Yao et al., 2022) combines reasoning and acting in an interleaved loop.

QAI implements a bounded agentic loop: the LLM can invoke up to 9 tools over a maximum of 3 rounds before generating a final response. This bounded approach prevents runaway execution while enabling meaningful multi-step reasoning (e.g., search materials → analyze → generate quiz).

### 2.3.3 Local vs. Cloud LLM Inference

The dual-tier approach in QAI reflects a practical consideration in educational deployments:

- **Local inference** (LM Studio): No data leaves the device, zero cost, lower latency for simple tasks, but limited model quality (4B–9B parameters).
- **Cloud inference** (DeepSeek API): Higher quality responses, function calling support, but requires internet and incurs API costs.

This dual-tier design allows the system to function in environments with varying connectivity and privacy requirements.

## 2.4 Retrieval-Augmented Generation (RAG)

RAG, introduced by Lewis et al. (2020), combines the generative capabilities of LLMs with external knowledge retrieval. The standard RAG pipeline consists of:

1. **Document ingestion**: Extracting text from source documents.
2. **Chunking**: Splitting text into manageable segments with overlap.
3. **Embedding**: Converting chunks into dense vector representations.
4. **Storage**: Indexing vectors in a database supporting similarity search.
5. **Retrieval**: Given a query, finding the most relevant chunks via cosine similarity.
6. **Generation**: Providing retrieved chunks as context for LLM generation.

### 2.4.1 Vector Databases

Several vector storage solutions exist:
- **Pinecone**: Managed cloud service. High cost.
- **Weaviate/Milvus**: Self-hosted. Operational complexity.
- **pgvector**: PostgreSQL extension. Leverages existing database infrastructure.
- **Supabase**: Managed PostgreSQL with pgvector. Combines relational data with vector search.

QAI uses **Supabase with pgvector** for its combination of managed hosting, SQL familiarity, and integrated REST API — avoiding the need for a separate vector database service.

### 2.4.2 Embedding Models

The choice of embedding model affects retrieval quality:
- **OpenAI text-embedding-ada-002** (1536 dims): High quality, cloud-only, paid.
- **nomic-embed-text-v1.5** (768 dims): Open-source, runs locally via LM Studio, competitive quality.
- **all-MiniLM-L6-v2** (384 dims): Lightweight, fast, slightly lower quality.

QAI uses **nomic-embed-text-v1.5** via LM Studio for local embedding generation, aligning with the dual-tier philosophy of keeping data processing local when possible.

## 2.5 WebSocket Communication Patterns

Traditional HTTP request-response patterns are inadequate for AI coaching where responses are generated token-by-token over several seconds. WebSocket provides full-duplex communication enabling:

- **Token streaming**: Each generated token is sent immediately, creating a "typing" effect.
- **Tool execution notifications**: Real-time feedback when the AI is searching, analyzing, or generating.
- **Session persistence**: Maintaining conversation context across multiple exchanges.
- **Bidirectional control**: Client can send stop signals to cancel generation mid-stream.

QAI implements a WebSocket protocol with structured JSON messages for session management, content streaming, tool status updates, and error handling.

## 2.6 Progressive Web Applications

PWAs combine web accessibility with native-like capabilities:
- **Offline support**: Service workers cache critical assets.
- **Installability**: Web app manifest enables home screen installation.
- **Push notifications**: Web Push API for engagement (planned).

The PWA approach was chosen over native mobile development for:
- Single codebase serving all platforms.
- Immediate deployment without app store review.
- URL-based sharing of quizzes and rooms.

## 2.7 Related Systems Comparison

| System | AI Chat | Spaced Repetition | RAG | Question Gen | Agentic Tools |
|--------|---------|-------------------|-----|--------------|---------------|
| Anki | ✗ | ✓ (SM-2) | ✗ | ✗ | ✗ |
| Quizlet | ✗ | Partial | ✗ | ✓ (basic) | ✗ |
| Khan Academy (Khanmigo) | ✓ | ✗ | ✗ | ✗ | ✗ |
| Duolingo | ✗ | ✓ (custom) | ✗ | ✓ | ✗ |
| DeepTutor | ✓ | ✗ | ✓ | ✗ | Partial |
| **QAI (this work)** | **✓** | **✓ (SM-2)** | **✓** | **✓** | **✓** |

QAI is distinguished by its integration of all five capabilities within a single platform, particularly the combination of agentic tool-use with spaced repetition and RAG-powered question generation.

## 2.8 Summary

This chapter established the theoretical and practical foundations for QAI:
- Intelligent tutoring systems provide the pedagogical framework.
- SM-2 spaced repetition offers scientifically-validated retention scheduling.
- LLMs enable natural conversation, question generation, and agentic behavior.
- RAG allows personalization through user-uploaded materials.
- WebSocket and PWA technologies enable real-time, installable experiences.

The following chapter translates these foundations into concrete system requirements.
