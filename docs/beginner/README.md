# Beginner — ML Fundamentals for Understanding DeepTutor

> **For**: People new to Machine Learning who want to understand how
> DeepTutor's AI features work.  
> **Prerequisite**: Basic programming knowledge. No ML experience needed.

---

## Reading Order

Read these files in order. Each builds on concepts from the previous one.

| # | File | Time | What You'll Learn |
| --- | ------ | ------ | --- |
| 1 | [GLOSSARY.md](GLOSSARY.md) | Reference | Every AI/ML term — keep open while reading others |
| 2 | [HOW_LLMS_WORK.md](HOW_LLMS_WORK.md) | 15 min | What LLMs are, tokens, prompts, temperature, streaming |
| 3 | [RAG_EXPLAINED.md](RAG_EXPLAINED.md) | 15 min | How AI answers questions about YOUR documents |
| 4 | [AGENTIC_AI_EXPLAINED.md](AGENTIC_AI_EXPLAINED.md) | 15 min | Why DeepTutor is more than ChatGPT — tools, loops, decisions |
| 5 | [VISUAL_ARCHITECTURE.md](VISUAL_ARCHITECTURE.md) | 10 min | Full system diagrams with analogies |

---

## After Reading These

You'll understand:

- What tokens, embeddings, and vectors are
- How an LLM generates text (next-token prediction)
- How RAG lets the AI read your uploaded documents
- What makes an AI "agentic" (tools + decision loops)
- How all pieces of DeepTutor fit together

**Next step**: Read the `../coder/` folder for implementation details.

---

## File Summaries

### GLOSSARY.md (580 lines)

Alphabetical reference of every AI/ML term used in DeepTutor. Each entry has:
a plain-language definition + how it appears in the project's source code.
Covers: Agent, Embedding, RAG, Token, Vector DB, Streaming, Tool, Capability,
Context Window, Temperature, and 30+ more terms.

### HOW_LLMS_WORK.md (491 lines)

Explains the fundamental mechanism (next-token prediction), what tokens are,
the messages format (system/user/assistant/tool), key parameters
(temperature, max_tokens, top-p), training phases (pre-training → fine-tuning
→ RLHF), model sizes, local vs cloud, streaming, function calling, context
window management, and LLM limitations.

### RAG_EXPLAINED.md (459 lines)

Full RAG pipeline: ingestion (parse → chunk → embed → store) and retrieval
(embed query → hybrid search → inject → generate). Covers chunking strategy,
embedding models, hybrid retrieval (vector + BM25), the Smart Retriever
multi-query approach, why we can't just put entire documents in the prompt,
common RAG problems with solutions, and key metrics.

### AGENTIC_AI_EXPLAINED.md (377 lines)

What makes DeepTutor different from a regular chatbot. The agentic loop
(THINK→TOOL→FINISH), the label protocol, tools vs capabilities, how tool
schemas work, DeepTutor's built-in tools, deep_solve pipeline example,
streaming events, safety mechanisms (max iterations, protocol violations,
sandboxing), and the decision tree for when agentic is used.

### VISUAL_ARCHITECTURE.md (577 lines)

ASCII art diagrams of: the 30-second overview, entry points, two-layer plugin
model, agentic loop flow, RAG pipeline, deep_solve stages, streaming
architecture, provider system, tool lifecycle, knowledge base lifecycle,
full request journey (sequence diagram), configuration layers, directory
structure map, and library analogy for every component.
