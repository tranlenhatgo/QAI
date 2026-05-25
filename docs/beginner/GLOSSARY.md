# DeepTutor Glossary — AI/ML Terms Explained

> **Audience**: Beginners in Machine Learning who want to understand the AI
> concepts used throughout DeepTutor.  
> **Format**: Alphabetical, with plain-language definitions and how each term
> appears in the project.

---

## A

### Agent / Agentic AI

An AI system that can **take actions** (call tools, search the web, run code)
on its own — not just generate text. A regular chatbot only replies;
an agent decides *what to do next*, does it, reads the result, and
keeps going until the task is done.

**In DeepTutor**: The "chat" capability runs an agentic loop that lets the LLM
decide whether to call `rag`, `web_search`, `code_execution`, etc.

---

### API (Application Programming Interface)

A contract that lets two programs talk to each other. When DeepTutor calls
OpenAI's API, it sends a JSON request and receives a JSON response — no
human UI involved.

---

### Async / Asynchronous

Code that can *wait* for something (network call, file read) without blocking
the rest of the program. DeepTutor is async (uses Python `asyncio`) so it can
stream tokens from the LLM to the user while simultaneously executing tools.

---

## B

### Base URL

The web address where an LLM service lives. OpenAI's default is
`https://api.openai.com/v1`. For local models (LM Studio, Ollama), it's
typically `http://localhost:1234/v1`.

**In DeepTutor**: Configurable per provider in `LLMConfig.base_url`.

---

### Batch Size

How many items are processed in one API call. When embedding 500 text chunks,
DeepTutor sends them in batches (e.g., 32 at a time) to avoid overloading the
embedding service.

---

### Binding

The SDK/protocol used to talk to an LLM provider. DeepTutor supports:
- `openai` — OpenAI-compatible HTTP (works with OpenAI, LM Studio, Ollama, vLLM)
- `anthropic` — Anthropic's native SDK
- `gemini` — Google's Generative AI SDK
- `azure_openai` — Azure-hosted OpenAI

---

### BM25 (Best Matching 25)

A classic keyword-matching algorithm for search. It scores documents by how
many of your query words they contain (weighted by rarity).

**In DeepTutor**: Used alongside vector search in "hybrid retrieval" mode.
Documents that match both keywords AND semantic meaning rank highest.

---

## C

### Capability (Level 2)

A multi-step AI pipeline that takes over the conversation for complex tasks.
Each capability has named **stages** and may call multiple tools internally.

**In DeepTutor**: `chat`, `deep_solve`, `deep_question`, `deep_research`, etc.

---

### Chunk / Chunking

Splitting a large document into smaller pieces (typically 200–1000 tokens each)
so they fit inside vector embeddings. Each chunk becomes one row in the vector
database.

**In DeepTutor**: Uses `SentenceSplitter` from LlamaIndex with configurable
`chunk_size` and `chunk_overlap`.

---

### Circuit Breaker

A safety pattern: if an LLM provider fails too many times in a row, stop
calling it temporarily. Like a fuse in an electrical circuit.

**In DeepTutor**: `BaseLLMProvider` checks `is_call_allowed()` before every
request.

---

### Completion

A single request→response cycle with an LLM. You send messages, the model
"completes" them with a response.

---

### Context Window

The maximum amount of text (measured in tokens) an LLM can read + generate in
one call. Examples:
- GPT-4o: 128k tokens
- Gemini 2.0 Flash: 1M tokens
- Gemma 4 (local): 8k–32k tokens

If your conversation + documents exceed this, older messages must be trimmed.

---

### Cosine Similarity

A math formula that measures how "close" two vectors are in direction
(ignoring magnitude). Returns a number from −1 (opposite) to +1 (identical).

**In RAG**: When you search, your query's embedding is compared to every
chunk's embedding using cosine similarity. The top-K most similar chunks are
returned.

---

## D

### Delta (streaming)

Each small piece of text sent during streaming. Instead of waiting for the
entire response, the LLM sends it character-by-character (or token-by-token)
as "deltas".

**In DeepTutor**: `TutorStreamChunk.delta` contains the new text fragment.

---

## E

### Embedding

Converting text into a list of numbers (a vector) that captures its *meaning*.
Similar sentences produce vectors that are close together in vector space.

**Example**: "dog" → [0.12, -0.84, 0.33, ...] (hundreds of dimensions)

**In DeepTutor**: The `EmbeddingClient` converts document chunks and user
queries into vectors using models like `text-embedding-3-small`.

---

### Embedding Model

A specialized AI model trained specifically to produce good embeddings —
not to chat. Much smaller and faster than chat models.

**Popular choices**: OpenAI `text-embedding-3-small` (1536 dims),
`nomic-embed-text` (local, 768 dims).

---

## F

### Fine-Tuning

Taking a pre-trained model and training it further on your specific data.
DeepTutor does NOT fine-tune — it uses **RAG** (cheaper, no training needed).

---

### Function Calling (Tool Calling)

A feature where the LLM's response isn't just text — it can also say
"I want to call the function `rag(query='photosynthesis')`". The application
then executes that function and feeds the result back.

**In DeepTutor**: Tool schemas are defined with `ToolDefinition.to_openai_schema()`
and passed to the LLM alongside the messages.

---

## G

### Grounding

Connecting an LLM's response to real sources (documents, databases, websites)
so it doesn't hallucinate. RAG is a grounding technique.

---

## H

### Hallucination

When an LLM confidently generates information that is factually wrong or
completely made up. Common with questions about specific documents or recent
events the model wasn't trained on.

**In DeepTutor**: RAG reduces hallucination by injecting real document passages
into the prompt.

---

### Hybrid Retrieval

Combining two search strategies:
1. **Vector search** (semantic, "what does this *mean*?")
2. **BM25 / keyword search** (lexical, "does this exact word appear?")

Results are fused and re-ranked. Catches things that each method alone misses.

**In DeepTutor**: Default retrieval mode. Uses `QueryFusionRetriever`.

---

## I

### Inference

Running a trained model to get predictions/outputs. Every time DeepTutor asks
an LLM to respond, that's one inference call. (Contrasted with "training",
which updates the model's weights.)

---

### Ingestion

The process of loading documents, splitting them into chunks, computing
embeddings, and storing everything in the vector database.

**In DeepTutor**: `LlamaIndexPipeline.initialize()` handles the full
ingestion pipeline.

---

## J

### JSON Schema

A format for describing the shape of JSON data. Used to tell the LLM exactly
what parameters a tool accepts and their types.

**In DeepTutor**: `ToolDefinition.to_openai_schema()` produces the schema.

---

## K

### Knowledge Base (KB)

A collection of documents that have been ingested (chunked + embedded) and
are searchable via RAG.

**In DeepTutor**: Users create KBs with `deeptutor kb create my-kb --doc textbook.pdf`.

---

## L

### Label Protocol

DeepTutor's way of structuring LLM responses in the agentic loop. The model
must start every reply with a label like `` `FINISH` ``, `` `TOOL` ``, or
`` `THINK` `` so the system knows what to do next.

---

### LLM (Large Language Model)

A neural network trained on massive text data that can generate human-like
text. Examples: GPT-4, Claude, Gemini, Llama, Gemma.

**How it works (simplified)**:
1. You give it text (the "prompt")
2. It predicts the next word, one at a time
3. Each prediction is added to the context for the next prediction
4. This repeats until it generates a stop signal

---

## M

### Max Tokens

The maximum number of tokens the model is allowed to *generate* in its response.
Set too low → response gets cut off. Set too high → costs more money.

**In DeepTutor**: `LLMConfig.max_tokens = 4096` by default.

---

### Messages Array

The standard format for sending conversation history to an LLM:

```json
[
  {"role": "system", "content": "You are a helpful tutor."},
  {"role": "user", "content": "What is photosynthesis?"},
  {"role": "assistant", "content": "Photosynthesis is..."},
  {"role": "user", "content": "Can you explain the light reactions?"}
]
```

---

### Model

The trained AI that generates text. A model has a specific size (measured in
parameters/weights) and was trained on specific data with specific abilities.

---

## N

### Node (in LlamaIndex)

LlamaIndex's term for a chunk after processing. A node contains the text,
its embedding vector, and metadata (source file, position, etc.).

---

## O

### OpenAI-Compatible

Any API that speaks the same protocol as OpenAI's API. LM Studio, Ollama,
vLLM, and many cloud providers expose OpenAI-compatible endpoints, so the
same client code works with all of them.

**In DeepTutor**: The `openai` binding supports any OpenAI-compatible provider.

---

### Orchestrator

The central routing component that receives a user message and decides which
capability handles it.

**In DeepTutor**: `ChatOrchestrator` in `deeptutor/runtime/orchestrator.py`.

---

## P

### Parameter (Model Parameter / Weight)

The numbers inside a neural network that were learned during training.
A "7B model" has 7 billion parameters. More parameters generally = more
capable but slower and more memory-hungry.

---

### Pipeline

A sequence of processing steps. In DeepTutor:
- **Ingestion pipeline**: Load → Parse → Chunk → Embed → Store
- **Retrieval pipeline**: Query → Embed query → Search vectors → Return top-K
- **Capability pipeline**: Plan → Reason → Write (for `deep_solve`)

---

### Prompt

The full text input sent to an LLM. Includes system instructions, conversation
history, RAG context, and the user's latest message.

---

### Provider

A service that hosts and runs LLM models. Examples: OpenAI, Anthropic, Google,
or self-hosted (LM Studio, Ollama, vLLM).

**In DeepTutor**: Each provider has its own class (e.g., `OpenAIProvider`)
extending `BaseLLMProvider`.

---

## R

### RAG (Retrieval-Augmented Generation)

A technique where you:
1. **Retrieve** relevant document passages (from a vector database)
2. **Augment** the prompt with those passages
3. **Generate** a response grounded in real sources

This lets the LLM answer questions about *your* documents without fine-tuning.

---

### Rate Limiting

Restricting how many API calls you can make per minute. Providers impose limits;
DeepTutor's `TrafficController` enforces `requests_per_minute` locally.

---

### Retriever

The component that searches the vector database and returns relevant chunks.

**In DeepTutor**: `build_retriever()` creates either a vector-only or hybrid
(vector + BM25) retriever.

---

## S

### Semantic Search

Finding documents by *meaning* rather than exact keywords. "How do plants
make food?" matches a chunk about "photosynthesis" even though the words
are different — because their embeddings are similar.

---

### Streaming

Sending the LLM's response token-by-token as it's generated, instead of
waiting for the entire response. Makes the UI feel faster.

**In DeepTutor**: `StreamBus` emits `StreamEvent` objects that flow to the
CLI/WebSocket consumer in real-time.

---

### System Prompt

Special instructions given to the LLM at the start of the conversation that
shape its behavior. The user typically can't see or edit it.

**Example**: "You are a patient tutor. Explain concepts step by step."

---

## T

### Temperature

A number (0.0–2.0) controlling how "creative" vs. "deterministic" the model's
output is:
- **0.0**: Always picks the most probable next token (very predictable)
- **0.7**: Balanced (DeepTutor's default)
- **1.5+**: Very random, more creative but less reliable

---

### Token

The smallest unit an LLM processes. Roughly:
- 1 token ≈ 4 characters in English
- 1 token ≈ ¾ of a word
- "Photosynthesis" = 4 tokens
- 100 tokens ≈ 75 words

Tokens determine cost (pay per input + output tokens) and context window limits.

---

### Tool (Level 1)

A single-function capability the LLM can call on demand. Tools are lightweight
and stateless — they take input, return output.

**In DeepTutor**: `BaseTool` → `ToolDefinition` → `ToolResult`.

---

### Tool Schema

A JSON description of what a tool does and what parameters it accepts.
Passed to the LLM so it knows *how* to call the tool.

```json
{
  "type": "function",
  "function": {
    "name": "rag",
    "description": "Retrieve passages from a knowledge base.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {"type": "string", "description": "Search query."},
        "kb_name": {"type": "string", "description": "KB to search."}
      },
      "required": ["query", "kb_name"]
    }
  }
}
```

---

## U

### Usage (Token Usage)

How many tokens were consumed in a request:
- `prompt_tokens`: Input (your messages + context)
- `completion_tokens`: Output (model's response)
- `total_tokens`: Sum of both

**In DeepTutor**: Tracked in `TutorResponse.usage`.

---

## V

### Vector

A list of numbers representing a point in high-dimensional space.
In ML, vectors encode meaning — similar concepts are nearby vectors.

**Example**: `[0.12, -0.84, 0.33, 0.91, ...]` (1536 numbers for OpenAI embeddings)

---

### Vector Database / Vector Store

A database optimized for storing and searching vectors by similarity.
Instead of SQL `WHERE name = 'X'`, you ask "find the 5 vectors most
similar to this query vector."

**In DeepTutor**: Uses LlamaIndex's `VectorStoreIndex` backed by local
storage (JSON or FAISS-like indexes on disk).

---

### Vector Space

An imaginary space where each dimension corresponds to one number in the
embedding. Documents about similar topics cluster together in this space.

---

## W

### WebSocket

A persistent two-way connection between client and server. Unlike HTTP
(request→response→close), a WebSocket stays open so the server can push
streaming tokens to the client in real-time.

**In DeepTutor**: The web frontend connects via WebSocket to receive
`StreamEvent`s as they're emitted.

---

## Quick Reference Table

| Concept | One-line Definition | DeepTutor File |
|---------|--------------------|-|
| Embedding | Text → numbers vector | `deeptutor/services/embedding/client.py` |
| RAG | Retrieve → Augment → Generate | `deeptutor/services/rag/service.py` |
| Chunking | Split docs into small pieces | `llamaindex/ingestion.py` |
| Tool | Single function LLM can call | `deeptutor/core/tool_protocol.py` |
| Capability | Multi-step AI pipeline | `deeptutor/core/capability_protocol.py` |
| Streaming | Send tokens as generated | `deeptutor/core/stream_bus.py` |
| Orchestrator | Routes messages to capabilities | `deeptutor/runtime/orchestrator.py` |
| Context Window | Max tokens model can handle | `deeptutor/services/llm/config.py` |
| Agentic Loop | LLM decides → acts → observes → repeats | `deeptutor/core/agentic/loop.py` |
| Provider | Service hosting the LLM | `deeptutor/services/llm/providers/` |
