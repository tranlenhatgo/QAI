# Chapter 2: Literature Review

## 2.1 Intelligent Tutoring Systems

Researchers have studied Intelligent Tutoring Systems (ITS) since the 1970s. Early systems such as SCHOLAR (Carbonell, 1970) and GUIDON (Clancey, 1982) showed how software could adapt instruction to a learner. Nwana (1990) describes four common ITS components: a domain model, a student model, a tutoring model, and a user interface.

Large Language Models (LLMs) allow tutoring systems to use conversation instead of rigid menu flows. Khan Academy's Khanmigo (2023) and Duolingo's AI features show that educational products can use LLM-powered assistants in deployed learning environments.

Many systems still use AI as a passive responder that answers only when prompted. QAI explores an **agentic paradigm** in which the coach can select tools, search data, generate content, and analyze performance during a learning session.

## 2.2 Spaced Repetition and the Forgetting Curve

Hermann Ebbinghaus (1885) showed that memory retention declines without reinforcement. Later studies replicated the spacing effect: distributed practice improves long-term retention compared with massed practice (Cepeda et al., 2006).

### 2.2.1 The SM-2 Algorithm

Piotr Wozniak's SuperMemo 2 (SM-2) algorithm (1987) implements spaced repetition with three variables:

- **Easiness Factor (EF)**: A floating-point value, minimum 1.3, that represents how easy an item is for the learner. It starts at 2.5.
- **Interval**: The number of days until the next review. Follows the progression: 1 -> 6 -> `interval x EF`.
- **Repetitions**: A counter tracking consecutive successful recalls.

The algorithm adjusts the easiness factor based on response quality (0-5 scale):
- Quality >= 3: Item considered recalled. Interval increases.
- Quality < 3: Item forgotten. Reset repetitions to 0, interval to 1 day.

SM-2 remains common because it needs little computation and has a clear update rule. QAI applies SM-2 at the category level, tracking mastery per subject area instead of per flashcard, which fits quiz-based assessment.

### 2.2.2 Alternatives Considered

- **SM-15+** (SuperMemo's later algorithms): More complex, using neural networks. Rejected for added complexity without proportional benefit in a quiz context.
- **FSRS** (Free Spaced Repetition Scheduler): A newer algorithm using machine learning. Rejected due to requiring larger training datasets than available in early system usage.
- **Leitner System**: Box-based approach with fixed intervals. Rejected as less adaptive than SM-2.

## 2.3 Large Language Models in Education

### 2.3.1 Question Generation

LLMs can generate educational questions from source context. Elkins et al. (2023) report that GPT-4 can produce multiple-choice questions comparable to human-authored items when prompts include enough context.

Key challenges in LLM-based question generation include:
- **Factual accuracy**: LLMs may generate plausible but incorrect answers (hallucination).
- **Difficulty calibration**: Controlling question difficulty.
- **Distractor quality**: Generating plausible wrong answers that test genuine understanding.
- **Format compliance**: Ensuring structured output (JSON) from free-text generation.

QAI addresses these through structured prompting with JSON output schemas, validation pipelines, and tier-based model selection (larger models for better quality).

### 2.3.2 Agentic AI Systems

LLM agents let a language model select and execute tools to complete a task. Frameworks such as LangChain, AutoGPT, and OpenAI function calling made this pattern common in 2023. The ReAct pattern (Yao et al., 2022) combines reasoning and acting in an interleaved loop.

QAI bounds the agentic loop: the LLM can invoke up to 9 tools across 3 rounds before producing a final response. This limit prevents runaway execution while still allowing multi-step workflows such as search materials, analyze, and generate quiz.

### 2.3.3 Local vs. Cloud LLM Inference

The dual-tier approach in QAI reflects a practical consideration in educational deployments:

- **Local inference** (LM Studio): No data leaves the device, zero cost, lower latency for simple tasks, but limited model quality (4B-9B parameters).
- **Cloud inference** (DeepSeek API): Higher quality responses, function calling support, but requires internet and incurs API costs.

This dual-tier design supports deployments with different connectivity, cost, and privacy constraints.

## 2.4 Retrieval-Augmented Generation (RAG)

RAG, introduced by Lewis et al. (2020), combines the generative capabilities of LLMs with external knowledge retrieval. The standard RAG pipeline consists of:

1. **Document ingestion**: Extracting text from source documents.
2. **Chunking**: Splitting text into manageable segments with overlap.
3. **Embedding**: Converting chunks into dense vector representations.
4. **Storage**: Indexing vectors in a database supporting similarity search.
5. **Retrieval**: Finding the most relevant chunks for a query through cosine similarity.
6. **Generation**: Providing retrieved chunks as context for LLM generation.

### 2.4.1 Vector Databases

Several vector storage solutions exist:
- **Pinecone**: Managed cloud service. High cost.
- **Weaviate/Milvus**: Self-hosted. Operational complexity.
- **pgvector**: PostgreSQL extension. Leverages existing database infrastructure.
- **Supabase**: Managed PostgreSQL with pgvector. Combines relational data with vector search.

QAI uses **Supabase with pgvector** because it provides managed hosting, SQL access, and a REST API without adding a separate vector database service.

### 2.4.2 Embedding Models

The choice of embedding model affects retrieval quality:
- **OpenAI text-embedding-ada-002** (1536 dims): High quality, cloud-only, paid.
- **nomic-embed-text-v1.5** (768 dims): Open-source, runs locally via LM Studio, competitive quality.
- **all-MiniLM-L6-v2** (384 dims): Lightweight, fast, slightly lower quality.

QAI uses **nomic-embed-text-v1.5** via LM Studio for local embedding generation, aligning with the dual-tier philosophy of keeping data processing local when possible.

## 2.5 WebSocket Communication Patterns

AI coaching produces responses token by token over several seconds, which makes ordinary HTTP request-response flows a poor fit. WebSocket provides full-duplex communication for:

- **Token streaming**: The server sends generated tokens as they arrive, creating a "typing" effect.
- **Tool execution notifications**: Real-time feedback when the AI is searching, analyzing, or generating.
- **Session persistence**: Maintaining conversation context across multiple exchanges.
- **Bidirectional control**: Client can send stop signals to cancel generation mid-stream.

QAI implements a WebSocket protocol with structured JSON messages for session management, content streaming, tool status updates, and error handling.

## 2.6 Progressive Web Applications

PWAs combine web accessibility with native-like capabilities:
- **Offline support**: Service workers cache core assets.
- **Installability**: Web app manifest enables home screen installation.
- **Push notifications**: Web Push API for engagement (planned).

QAI uses a PWA instead of native mobile apps for:
- Single codebase serving all platforms.
- Immediate deployment without app store review.
- URL-based sharing of quizzes and rooms.

## 2.7 Related Systems Comparison

| System | AI Chat | Spaced Repetition | RAG | Question Gen | Agentic Tools |
|--------|---------|-------------------|-----|--------------|---------------|
| Anki | No | Yes (SM-2) | No | No | No |
| Quizlet | No | Partial | No | Yes (basic) | No |
| Khan Academy (Khanmigo) | Yes | No | No | No | No |
| Duolingo | No | Yes (custom) | No | Yes | No |
| DeepTutor | Yes | No | Yes | No | Partial |
| **QAI (this work)** | **Yes** | **Yes (SM-2)** | **Yes** | **Yes** | **Yes** |

QAI combines all five capabilities in one platform, with agentic tool use connected to spaced repetition and RAG-powered question generation.

## 2.8 Summary

This chapter identified the foundations for QAI:
- Intelligent tutoring systems provide the pedagogical framework.
- SM-2 spaced repetition provides research-backed retention scheduling.
- LLMs enable natural conversation, question generation, and agentic behavior.
- RAG allows personalization through user-uploaded materials.
- WebSocket and PWA technologies enable real-time, installable experiences.

Chapter 3 translates these foundations into system requirements.
