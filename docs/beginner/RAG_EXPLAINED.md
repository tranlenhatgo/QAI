# RAG Explained — How DeepTutor Answers Questions About Your Documents

> **Audience**: ML beginners who want to understand how an AI can read
> *your specific* documents and answer questions about them.  
> **Key insight**: The LLM wasn't trained on your textbook. RAG lets it
> look up relevant passages in real-time and include them in its answer.

---

## 1. The Problem RAG Solves

### Without RAG

```text
You: "What does page 42 of my textbook say about mitosis?"
LLM: "I don't have access to your textbook. Generally, mitosis is..."
      ← Generic answer, might be wrong for your specific curriculum
```

### With RAG

```text
You: "What does page 42 of my textbook say about mitosis?"
     ↓
System retrieves the actual text from page 42 of your uploaded textbook
     ↓
LLM reads the real text and generates an answer based on it
     ↓
LLM: "According to your textbook (p.42), mitosis has 4 phases:
      prophase, metaphase, anaphase, telophase. Your book emphasizes..."
      ← Accurate, specific to YOUR textbook, with citations
```

---

## 2. What RAG Stands For

**R**etrieval-**A**ugmented **G**eneration

| Word | Meaning | Analogy |
| ------ | --------- | --------- |
| **Retrieval** | Find relevant information | Looking up a book in a library |
| **Augmented** | Add it to the prompt | Placing the open book on your desk |
| **Generation** | LLM writes the answer | Writing an essay with the book open |

The LLM doesn't memorize your documents. It *looks them up* every time
you ask a question — just like a student using a reference book during
an open-book exam.

---

## 3. The Full RAG Pipeline — End to End

RAG has two phases: **Ingestion** (one-time setup) and **Retrieval** (every query).

```text
═══════════════════ PHASE 1: INGESTION (once per document) ═══════════════

PDF/DOCX/TXT ──→ Parse text ──→ Split into chunks ──→ Embed each chunk
                                                              ↓
                                                    Store in Vector DB

═══════════════════ PHASE 2: RETRIEVAL (every user query) ════════════════

User question ──→ Embed the question ──→ Find similar chunks ──→ Return top-K
                                                                       ↓
                                              Inject into LLM prompt as context
                                                                       ↓
                                                           LLM generates answer
```

---

## 4. Phase 1: Ingestion — Preparing Your Documents

### Step 1: Document Parsing

Convert any file format into plain text:

```text
textbook.pdf  ──→ "Chapter 1: Introduction to Biology..."
slides.pptx   ──→ "Slide 1: Cell Structure..."
notes.docx    ──→ "Mitosis is the process of..."
```

**In DeepTutor**: `LlamaIndexDocumentLoader` handles PDF, DOCX, PPTX, images,
and more.

### Step 2: Chunking — Splitting Text into Pieces

A 300-page textbook is too large to fit in a single embedding or a single LLM
prompt. We split it into small, meaningful pieces:

```text
Full textbook (100,000 words)
    ↓ split
Chunk 1: "Chapter 1 introduces the cell theory..." (200 words)
Chunk 2: "The plasma membrane is a bilayer..."     (200 words)
Chunk 3: "Mitosis consists of four phases..."      (200 words)
...
Chunk 500: "In conclusion, evolution..."           (200 words)
```

**Key parameters**:

- `chunk_size`: How many tokens per chunk (default varies, often 512–1024)
- `chunk_overlap`: How many tokens overlap between consecutive chunks (so we
  don't cut a sentence in half)

```text
[=== Chunk 1 ===][overlap][=== Chunk 2 ===][overlap][=== Chunk 3 ===]
```

**In DeepTutor**: Uses LlamaIndex's `SentenceSplitter` which splits at sentence
boundaries (never mid-sentence):

```python
SentenceSplitter(
    chunk_size=Settings.chunk_size,      # e.g., 1024 tokens
    chunk_overlap=Settings.chunk_overlap, # e.g., 200 tokens
)
```

### Step 3: Embedding — Converting Text to Numbers

Each chunk gets converted into a **vector** (a list of numbers) that captures
its meaning:

```text
"Mitosis consists of four phases..."
    ↓ embedding model
[0.023, -0.156, 0.841, 0.002, ..., -0.445]  ← 1536 numbers
```

**Why?** Because computers can't compare meanings of text directly. But they
CAN compare lists of numbers — specifically, measure how "close" two vectors
are.

**Key insight**: Texts with similar meaning produce similar vectors:

```text
"cell division process" → [0.021, -0.153, 0.839, ...]  ← very similar!
"how cells reproduce"   → [0.019, -0.149, 0.837, ...]  ← very similar!
"recipe for chocolate"  → [-0.891, 0.234, -0.102, ...] ← very different!
```

**In DeepTutor**: `EmbeddingClient` calls embedding models:

- Cloud: OpenAI `text-embedding-3-small` (1536 dimensions)
- Local: `nomic-embed-text` (768 dimensions)

### Step 4: Storage — Saving to Vector Database

All chunks + their embeddings get stored in a searchable index:

```text
┌─────────────────────────────────────────────────────────────┐
│ Vector Database (VectorStoreIndex)                           │
├──────┬────────────────────────────────┬─────────────────────┤
│ ID   │ Text                           │ Embedding           │
├──────┼────────────────────────────────┼─────────────────────┤
│ 001  │ "Chapter 1 introduces..."      │ [0.12, -0.34, ...]  │
│ 002  │ "The plasma membrane..."       │ [0.45, 0.12, ...]   │
│ 003  │ "Mitosis consists of..."       │ [0.02, -0.15, ...]  │
│ ...  │ ...                            │ ...                 │
└──────┴────────────────────────────────┴─────────────────────┘
```

**In DeepTutor**: Uses LlamaIndex's `VectorStoreIndex` with local file storage.
The index is persisted to disk so you don't need to re-embed every time.

---

## 5. Phase 2: Retrieval — Answering a Question

### Step 1: Embed the Question

The user's question gets the same embedding treatment:

```text
"What are the phases of mitosis?"
    ↓ same embedding model
[0.019, -0.151, 0.835, 0.005, ..., -0.440]
```

### Step 2: Similarity Search

Compare the question's vector against ALL chunk vectors in the database:

```text
Question vector: [0.019, -0.151, 0.835, ...]

vs. Chunk 001: [0.12, -0.34, ...]  → similarity: 0.42 (not great)
vs. Chunk 002: [0.45, 0.12, ...]   → similarity: 0.31 (not great)
vs. Chunk 003: [0.02, -0.15, ...]  → similarity: 0.96 (very relevant!)
vs. Chunk 004: [0.03, -0.14, ...]  → similarity: 0.89 (also relevant!)
...
```

Return the top-K most similar chunks (typically K = 3–10).

### Step 3: Hybrid Retrieval (DeepTutor's Default)

DeepTutor doesn't just use vector similarity — it combines TWO search methods:

```text
┌─── Vector Search (Semantic) ───┐    ┌─── BM25 Search (Keyword) ───┐
│                                 │    │                              │
│ "What are phases of mitosis?"   │    │ "What are phases of mitosis?"│
│         ↓                       │    │         ↓                    │
│ Finds: chunks about cell        │    │ Finds: chunks containing     │
│ division, even if they don't    │    │ the exact words "phases"     │
│ use the word "mitosis"          │    │ and "mitosis"                │
│                                 │    │                              │
└────────────────┬────────────────┘    └──────────────┬───────────────┘
                 │                                     │
                 └──────────── FUSION ─────────────────┘
                                  ↓
                    Re-ranked combined results
                    (best of both methods)
```

**Why hybrid?**

- Vector search catches paraphrases ("cell division" matches "mitosis")
- BM25 catches exact terms (specific names, formulas, IDs)
- Together they cover more ground

**In DeepTutor**: `QueryFusionRetriever` from LlamaIndex merges both result sets.

### Step 4: Inject Context into Prompt

The retrieved chunks are added to the LLM's prompt:

```json
[
  {
    "role": "system",
    "content": "You are a helpful tutor. Use the following context from the user's documents to answer their question.\n\nCONTEXT:\n---\nMitosis consists of four phases: prophase, metaphase, anaphase, and telophase. During prophase, chromosomes condense...\n---\nThe cell cycle includes interphase and mitotic phase. The mitotic phase encompasses both mitosis and cytokinesis...\n---"
  },
  {
    "role": "user",
    "content": "What are the phases of mitosis?"
  }
]
```

### Step 5: LLM Generates Answer

The LLM reads the injected context and writes an answer grounded in the
actual document content:

```text
"According to your textbook, mitosis consists of four phases:
1. Prophase — chromosomes condense and become visible
2. Metaphase — chromosomes align at the cell's equator
3. Anaphase — sister chromatids separate
4. Telophase — nuclear envelopes reform

The text also notes that mitosis is just part of the mitotic phase,
which also includes cytokinesis (cell division)."
```

---

## 6. Visual Summary

```text
┌────────────────────────────────────────────────────────────────┐
│                        RAG Pipeline                              │
│                                                                  │
│  INGESTION (once):                                              │
│  📄 Document → ✂️ Chunks → 🔢 Embeddings → 💾 Vector DB        │
│                                                                  │
│  RETRIEVAL (every query):                                       │
│  ❓ Question → 🔢 Embed → 🔍 Search DB → 📋 Top-K chunks      │
│                                    ↓                            │
│                        📝 Inject into prompt                    │
│                                    ↓                            │
│                        🤖 LLM generates answer                  │
│                                    ↓                            │
│                        💬 Grounded response                     │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. DeepTutor's RAG Implementation

### File Locations

| Component | Path |
| --------- | ---- |
| RAG service entry | `deeptutor/services/rag/service.py` |
| Ingestion logic | `deeptutor/services/rag/pipelines/llamaindex/ingestion.py` |
| Retrieval logic | `deeptutor/services/rag/pipelines/llamaindex/retrievers.py` |
| Embedding client | `deeptutor/services/embedding/client.py` |
| Smart multi-query | `deeptutor/services/rag/smart_retriever.py` |
| RAG tool wrapper | `deeptutor/tools/rag_tool.py` |
| KB management | `deeptutor/knowledge/manager.py` |

### Knowledge Base Lifecycle

```text
1. User: "deeptutor kb create biology --doc textbook.pdf"
         ↓
2. DocumentLoader parses the PDF into text
         ↓
3. SentenceSplitter creates chunks
         ↓
4. EmbeddingClient embeds each chunk
         ↓
5. VectorStoreIndex stores chunks + embeddings on disk
         ↓
6. KB "biology" is ready for queries

7. User: "What is DNA replication?"
         ↓
8. EmbeddingClient embeds the question
         ↓
9. QueryFusionRetriever searches (vector + BM25)
         ↓
10. Top chunks returned and injected into LLM prompt
         ↓
11. LLM answers using the retrieved context
```

### Smart Retriever — Multi-Query

For complex questions, DeepTutor generates multiple search queries from your
single question:

```text
User: "How does photosynthesis relate to cellular respiration?"
      ↓ SmartRetriever generates:
Query 1: "photosynthesis light reactions products"
Query 2: "cellular respiration inputs glucose oxygen"
Query 3: "relationship between photosynthesis and respiration cycle"
      ↓ Each query searches the KB independently
      ↓ Results are aggregated and deduplicated
      ↓ More comprehensive context for the LLM
```

---

## 8. Why Not Just Give the LLM the Entire Document?

### Context Window Limitations

| Model | Context Window | Typical Textbook |
| ----- | ------------- | --------------- |
| GPT-4o | 128K tokens | 200K–500K tokens |
| Gemma (local) | 8K–32K tokens | 200K–500K tokens |

Most textbooks don't fit! And even if they did:

### Needle in a Haystack Problem

Even with a huge context window, LLMs get worse at finding specific info
when given too much text. It's like asking someone to find one sentence
in a 500-page book — they'll miss it.

RAG solves this by giving the LLM only the **relevant** 3–10 paragraphs,
not the entire book.

### Cost

Sending 500K tokens per query = expensive. Sending 2K tokens of relevant
context = cheap.

---

## 9. Common RAG Problems and Solutions

### Problem 1: Chunk is Too Small

```text
Chunk: "...which we discussed in the previous section."
← Useless without context!
```

**Solution**: `chunk_overlap` ensures context carries over between chunks.

### Problem 2: Wrong Chunks Retrieved

```text
Query: "What is a cell?"
Retrieved: chunk about "fuel cells" (wrong domain!)
```

**Solution**: Hybrid retrieval + multiple queries help disambiguate.

### Problem 3: Information Spans Multiple Chunks

```text
Table header in Chunk 5, table data in Chunk 6
← Neither chunk alone makes sense
```

**Solution**: Overlap helps. Some systems also retrieve neighboring chunks.

### Problem 4: User's Question Doesn't Match Document Wording

```text
User: "How do plants make food?"
Document uses: "photosynthesis", "carbon fixation"
```

**Solution**: Vector search handles this — semantic meaning matches even when
words differ!

---

## 10. Key Metrics

| Metric | What It Measures | Good Value |
| ------ | --------------- | --------- |
| **Retrieval recall** | % of relevant chunks found | > 80% |
| **Retrieval precision** | % of returned chunks that are actually relevant | > 60% |
| **Top-K** | How many chunks to return | 3–10 |
| **Chunk size** | Tokens per chunk | 256–1024 |
| **Chunk overlap** | Shared tokens between neighbors | 10–20% of chunk_size |

---

## 11. RAG vs. Other Approaches

| Approach | How It Works | Pros | Cons |
| -------- | ----------- | ---- | ---- |
| **RAG** | Retrieve + inject into prompt | No training, instant updates | Limited by retrieval quality |
| **Fine-tuning** | Retrain model on your data | Deeply learned patterns | Expensive, slow, can't update easily |
| **Long context** | Put everything in the prompt | Simple, no retrieval | Expensive, accuracy drops, size limits |
| **RAG + Fine-tuning** | Both | Best accuracy | Most complex |

DeepTutor uses RAG because:

- ✅ No GPU needed for training
- ✅ Documents can be added/removed instantly
- ✅ Works with any LLM provider
- ✅ User data stays private (not sent for training)

---

## 12. Key Takeaways

1. **RAG = look it up, don't memorize** — the LLM searches your docs every time
2. **Embeddings capture meaning** — similar text → similar numbers
3. **Chunking is crucial** — too big = imprecise, too small = no context
4. **Hybrid retrieval** — keywords + semantics together beat either alone
5. **The LLM never "learns" your documents** — it just reads relevant bits per query
6. **Quality depends on retrieval** — if the wrong chunks are found, the answer will be wrong

---

## Further Reading

| Topic | File |
| ----- | ---- |
| All AI/ML terms defined | [GLOSSARY.md](GLOSSARY.md) |
| How the agentic loop uses RAG | [AGENTIC_AI_EXPLAINED.md](AGENTIC_AI_EXPLAINED.md) |
| How LLMs generate text | [HOW_LLMS_WORK.md](HOW_LLMS_WORK.md) |
| Full architecture diagrams | [VISUAL_ARCHITECTURE.md](VISUAL_ARCHITECTURE.md) |
| RAG tool implementation | [../coder/LEVEL1_TOOLS_DEEP_DIVE.md](../coder/LEVEL1_TOOLS_DEEP_DIVE.md) |
