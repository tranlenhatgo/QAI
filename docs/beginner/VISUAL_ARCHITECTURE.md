# Visual Architecture Guide — DeepTutor System Diagrams

> **Audience**: ML beginners who want to see how all the pieces fit together.  
> **Format**: Diagrams first, explanations second. Less code, more pictures.

---

## 1. The 30-Second Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                        DeepTutor                                 │
│                                                                  │
│   YOU ──→ [Frontend] ──→ [Orchestrator] ──→ [Capability]        │
│                                                 │                │
│                                          ┌──────┴──────┐        │
│                                          │  LLM Cloud  │        │
│                                          │  or Local   │        │
│                                          └──────┬──────┘        │
│                                                 │                │
│                                          ┌──────┴──────┐        │
│                                          │   Tools     │        │
│                                          │ RAG|Web|Code│        │
│                                          └─────────────┘        │
│                                                 │                │
│   YOU ←── [Frontend] ←── [StreamBus] ←──────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**In plain English**: You ask a question → the system decides how to answer →
it may search your documents, the web, or run code → the answer streams
back to you in real-time.

---

## 2. Entry Points — Three Ways In

```text
┌─────────────────────────────────────────────────────────────┐
│                     Entry Points                             │
│                                                              │
│  ┌─────────┐    ┌──────────────┐    ┌───────────┐          │
│  │   CLI   │    │  WebSocket   │    │ Python SDK│          │
│  │ Terminal │    │  Web Browser │    │  Scripts  │          │
│  └────┬────┘    └──────┬───────┘    └─────┬─────┘          │
│       │                │                   │                │
│       └────────────────┼───────────────────┘                │
│                        ↓                                    │
│              ┌──────────────────┐                           │
│              │ ChatOrchestrator │                           │
│              │ (single entry)   │                           │
│              └──────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

| Entry Point | Who Uses It | How |
| ------------- | ------------ | ----- |
| CLI | Developers, power users | `deeptutor chat` in terminal |
| WebSocket | Web app users | Browser connects to `/api/v1/ws` |
| Python SDK | Automation scripts | `from deeptutor import ...` |

All three converge into the same `ChatOrchestrator` — one brain, three doors.

---

## 3. The Two-Layer Plugin Model

```text
┌───────────────────────────────────────────────────────────────────┐
│                                                                    │
│  Layer 2: CAPABILITIES (multi-step pipelines)                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  chat    │  deep_solve  │  deep_question  │  deep_research  │ │
│  │ (default)│ (plan+solve) │ (generate quiz) │  (full report)  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│       │            │               │                │             │
│       │     These capabilities USE tools internally │             │
│       ↓            ↓               ↓                ↓             │
│  Layer 1: TOOLS (single functions)                                │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ rag │ web_search │ code_execution │ reason │ brainstorm │ ...│ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

**Analogy**:

- **Tools** = Individual apps on your phone (Calculator, Maps, Camera)
- **Capabilities** = Workflows that use multiple apps (Plan a trip = Maps + Calendar + Notes)

---

## 4. The Agentic Loop — How "chat" Capability Works

```text
┌─────────────────────────────────────────────────────────────────┐
│                     AGENTIC LOOP                                 │
│                                                                  │
│  Start: User message + tool schemas sent to LLM                 │
│         ↓                                                        │
│  ┌─────────────────────────────────────────────┐                │
│  │  LLM responds with a LABEL on first line:   │                │
│  │                                              │                │
│  │   ``THINK``  → Save reasoning, continue     │                │
│  │   ``TOOL``   → Execute tool(s), continue    │                │
│  │   ``FINISH`` → Stream answer, STOP          │                │
│  └───────────────────┬─────────────────────────┘                │
│                      │                                           │
│         ┌────────────┼────────────┐                             │
│         ↓            ↓            ↓                             │
│    ┌────────┐  ┌──────────┐  ┌─────────┐                       │
│    │ THINK  │  │   TOOL   │  │ FINISH  │                       │
│    │        │  │          │  │         │                       │
│    │ Save   │  │ Execute  │  │ Stream  │                       │
│    │ text   │  │ tool(s)  │  │ answer  │                       │
│    │        │  │          │  │ to user │                       │
│    │ Loop ↩ │  │ Feed     │  │         │                       │
│    │        │  │ result   │  │  EXIT   │                       │
│    │        │  │ back     │  │         │                       │
│    │        │  │          │  │         │                       │
│    │        │  │ Loop ↩   │  │         │                       │
│    └────────┘  └──────────┘  └─────────┘                       │
│                                                                  │
│  Safety: max_iterations limit → force FINISH if exceeded        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. RAG Pipeline — Document → Answer

```text
═══════════════════════════════════════════════════════════════════
  INGESTION (one-time, when you upload a document)
═══════════════════════════════════════════════════════════════════

  📄 PDF/DOCX/TXT
       ↓
  ┌─────────────┐
  │   Parser    │  Extract plain text from any format
  └──────┬──────┘
         ↓
  ┌─────────────┐
  │  Chunker    │  Split into ~512-token pieces with overlap
  └──────┬──────┘
         ↓
  ┌─────────────┐
  │  Embedder   │  Text → vector of 1536 numbers (meaning)
  └──────┬──────┘
         ↓
  ┌─────────────┐
  │ Vector DB   │  Store chunks + vectors on disk
  └─────────────┘

═══════════════════════════════════════════════════════════════════
  RETRIEVAL (every time you ask a question)
═══════════════════════════════════════════════════════════════════

  ❓ "What is photosynthesis?"
       ↓
  ┌─────────────┐
  │  Embedder   │  Question → vector
  └──────┬──────┘
         ↓
  ┌─────────────────────────────────────────┐
  │          HYBRID SEARCH                   │
  │                                          │
  │  Vector Search ──→ ┐                     │
  │  (semantic)        ├──→ Fusion → Top-K   │
  │  BM25 Search ────→ ┘   Re-rank          │
  │  (keywords)                              │
  └──────────────────────┬──────────────────┘
                         ↓
  ┌─────────────────────────────────────────┐
  │  Top 5 chunks injected into LLM prompt  │
  └──────────────────────┬──────────────────┘
                         ↓
  ┌─────────────┐
  │     LLM     │  Reads context, generates grounded answer
  └──────┬──────┘
         ↓
  💬 "According to your textbook, photosynthesis is..."
```

---

## 6. Deep Solve — Multi-Step Problem Solving

```text
┌─────────────────────────────────────────────────────────────────┐
│                     DEEP SOLVE PIPELINE                          │
│                                                                  │
│  User: "Solve ∫x²sin(x)dx"                                     │
│         ↓                                                        │
│  ┌──────────────────────────────────────────┐                   │
│  │  STAGE 1: PLANNING                       │                   │
│  │                                           │                   │
│  │  LLM creates a step-by-step plan:        │                   │
│  │    Step 1: Identify technique             │                   │
│  │    Step 2: Apply integration by parts     │                   │
│  │    Step 3: Solve remaining integral       │                   │
│  │    Step 4: Combine results                │                   │
│  └────────────────────┬─────────────────────┘                   │
│                       ↓                                          │
│  ┌──────────────────────────────────────────┐                   │
│  │  STAGE 2: REASONING (per step)           │                   │
│  │                                           │                   │
│  │  For each step → mini agentic loop:      │                   │
│  │    [THINK] → [TOOL: code_execution] →    │                   │
│  │    [THINK] → [FINISH: step answer]       │                   │
│  │                                           │                   │
│  │  If stuck → REPLAN → revise the plan     │                   │
│  └────────────────────┬─────────────────────┘                   │
│                       ↓                                          │
│  ┌──────────────────────────────────────────┐                   │
│  │  STAGE 3: WRITING                        │                   │
│  │                                           │                   │
│  │  LLM synthesizes all step results into   │                   │
│  │  a coherent, well-formatted explanation  │                   │
│  └────────────────────┬─────────────────────┘                   │
│                       ↓                                          │
│  📝 Final answer streamed to user                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Streaming — How Events Flow to the User

```text
┌─────────────────────────────────────────────────────────────────┐
│                   STREAMING ARCHITECTURE                          │
│                                                                  │
│  Capability/Tool (producer)                                      │
│       │                                                          │
│       │ await stream.emit(event)                                 │
│       ↓                                                          │
│  ┌──────────────────┐                                           │
│  │    StreamBus      │  Fan-out to all subscribers               │
│  │                   │                                           │
│  │  History buffer   │  (late joiners get past events)          │
│  └─────┬──────┬──────┘                                          │
│        │      │                                                  │
│   ┌────┘      └────┐                                            │
│   ↓                ↓                                             │
│  ┌───────────┐  ┌───────────┐                                   │
│  │WebSocket  │  │CLI Render │                                   │
│  │ Pusher    │  │           │                                   │
│  │           │  │ Terminal  │                                   │
│  │ Browser ← │  │ output ← │                                   │
│  └───────────┘  └───────────┘                                   │
│                                                                  │
│  Event types flowing through:                                    │
│  ┌────────────┬────────────────────────────────────────┐        │
│  │ stage_start│ "Now entering: reasoning"              │        │
│  │ thinking   │ "I need to search the KB..."           │        │
│  │ tool_call  │ "Calling rag(query='...')"             │        │
│  │ tool_result│ "Found 3 relevant passages"            │        │
│  │ content    │ "Based on your textbook..."  ← visible │        │
│  │ sources    │ [citation links]                       │        │
│  │ stage_end  │ "Finished: reasoning"                  │        │
│  │ done       │ Turn complete                          │        │
│  └────────────┴────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Provider System — Talking to LLMs

```text
┌─────────────────────────────────────────────────────────────────┐
│                    LLM PROVIDER ARCHITECTURE                      │
│                                                                  │
│  ┌─────────────────────────────┐                                │
│  │         LLMConfig           │  model, api_key, base_url,     │
│  │                             │  temperature, max_tokens        │
│  └──────────────┬──────────────┘                                │
│                 ↓                                                 │
│  ┌─────────────────────────────┐                                │
│  │      BaseLLMProvider        │  Abstract base class            │
│  │                             │                                 │
│  │  • complete() → Response    │  Full response at once          │
│  │  • stream() → AsyncGen      │  Token-by-token                │
│  │  • circuit breaker          │  Stop calling if failing        │
│  │  • retry with backoff       │  Auto-retry on errors           │
│  │  • traffic control          │  Rate limiting                  │
│  └──────────────┬──────────────┘                                │
│                 │                                                 │
│    ┌────────────┼────────────────────┐                          │
│    ↓            ↓                    ↓                           │
│  ┌──────┐  ┌──────────┐  ┌───────────────┐                     │
│  │OpenAI│  │Anthropic │  │Local (OpenAI  │                     │
│  │      │  │          │  │ compatible)   │                     │
│  │GPT-4o│  │Claude    │  │LM Studio     │                     │
│  │      │  │          │  │Ollama        │                     │
│  └──┬───┘  └────┬─────┘  └──────┬───────┘                     │
│     │            │               │                              │
│     ↓            ↓               ↓                              │
│  Cloud API    Cloud API    localhost:1234                        │
│  (internet)   (internet)   (your machine)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Tool System — How Tools Are Registered and Called

```text
┌─────────────────────────────────────────────────────────────────┐
│                    TOOL LIFECYCLE                                 │
│                                                                  │
│  1. REGISTRATION (at startup)                                   │
│                                                                  │
│  ToolRegistry.load_builtins()                                   │
│       ↓                                                          │
│  ┌────────────┬────────────┬───────────────┬──────────────────┐ │
│  │ RAGTool    │ WebSearch  │ CodeExecution │ ReasonTool │ ... │ │
│  └────────────┴────────────┴───────────────┴──────────────────┘ │
│                                                                  │
│  2. SCHEMA GENERATION (before LLM call)                         │
│                                                                  │
│  Each tool → to_openai_schema() → JSON for the LLM             │
│  [{"type":"function","function":{"name":"rag",...}}, ...]       │
│                                                                  │
│  3. EXECUTION (when LLM calls a tool)                           │
│                                                                  │
│  LLM says: tool_calls=[{name:"rag", args:{query:"...",kb:"."}}]│
│       ↓                                                          │
│  Registry looks up "rag" → RAGTool instance                     │
│       ↓                                                          │
│  tool.execute(query="...", kb_name="...") → ToolResult          │
│       ↓                                                          │
│  ToolResult.content → added as role="tool" message              │
│       ↓                                                          │
│  Messages sent back to LLM for next iteration                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Knowledge Base Lifecycle

```text
┌─────────────────────────────────────────────────────────────────┐
│              KNOWLEDGE BASE LIFECYCLE                             │
│                                                                  │
│  CREATE                                                          │
│  ══════                                                          │
│  User: "deeptutor kb create biology --doc textbook.pdf"         │
│       ↓                                                          │
│  ┌──────────┐   ┌─────────┐   ┌────────┐   ┌──────────┐       │
│  │  Parse   │──→│  Chunk  │──→│ Embed  │──→│  Store   │       │
│  │  PDF     │   │  text   │   │ chunks │   │  index   │       │
│  └──────────┘   └─────────┘   └────────┘   └──────────┘       │
│                                                                  │
│  QUERY                                                           │
│  ═════                                                           │
│  User: "What is DNA?"                                           │
│       ↓                                                          │
│  ┌──────────┐   ┌─────────────┐   ┌─────────────┐              │
│  │  Embed   │──→│ Search      │──→│  Return     │              │
│  │  query   │   │ vector+BM25 │   │  top chunks │              │
│  └──────────┘   └─────────────┘   └─────────────┘              │
│                                                                  │
│  UPDATE                                                          │
│  ══════                                                          │
│  User: "deeptutor kb add biology --doc chapter5.pdf"            │
│       ↓                                                          │
│  Same pipeline → new chunks added to existing index             │
│                                                                  │
│  DELETE                                                           │
│  ══════                                                          │
│  User: "deeptutor kb delete biology"                            │
│       ↓                                                          │
│  Remove directory + all index files                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Full Request Journey — User Question to Answer

```text
TIME ──────────────────────────────────────────────────────────→

  User types          Server               LLM              Tools
  ─────────          ──────               ───              ─────
      │                 │                  │                 │
  [1] │── "What is    ─→│                  │                 │
      │    mitosis?"    │                  │                 │
      │                 │                  │                 │
      │            [2]  │── messages[] ───→│                 │
      │                 │   + tool schemas │                 │
      │                 │                  │                 │
      │                 │              [3] │ ``TOOL``        │
      │                 │←── rag(query) ───│                 │
      │                 │                  │                 │
      │            [4]  │──────────────────────── search ──→│
      │                 │                  │                 │
      │                 │←──── 3 passages ─────────────────│
      │            [5]  │                  │                 │
      │                 │── messages[] ───→│                 │
      │                 │   + tool result  │                 │
      │                 │                  │                 │
      │                 │              [6] │ ``FINISH``      │
      │  ←── stream ───│←── "Mitosis is.."│                 │
  [7] │   tokens       │     (streaming)  │                 │
      │                 │                  │                 │
      │  ← done ───────│                  │                 │
      ↓                 ↓                  ↓                 ↓
```

**Steps**:

1. User sends message via WebSocket
2. Orchestrator builds messages + tool schemas, calls LLM
3. LLM responds with `TOOL` label — wants to call RAG
4. System executes RAG search against knowledge base
5. Tool result appended, LLM called again
6. LLM responds with `FINISH` label — streams answer
7. User sees tokens appearing in real-time

---

## 12. Configuration Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│                 CONFIGURATION LAYERS                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Environment Variables                                   │    │
│  │  OPENAI_API_KEY, DEEPTUTOR_RAG_RETRIEVAL_PROFILE, etc.  │    │
│  └───────────────────────────┬─────────────────────────────┘    │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Settings Files (JSON)                                   │    │
│  │  data/user/settings/model_catalog.json                   │    │
│  │  data/user/settings/system_settings.json                 │    │
│  └───────────────────────────┬─────────────────────────────┘    │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Runtime Config Objects                                  │    │
│  │  LLMConfig, EmbeddingConfig, RetrievalConfig             │    │
│  └───────────────────────────┬─────────────────────────────┘    │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Per-Request Overrides                                   │    │
│  │  UnifiedContext.config_overrides (temperature, etc.)     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Priority: Per-request > Runtime > Settings file > Env vars     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Directory Structure Map

```text
deeptutor/
├── core/                    ← 🧠 Brain (protocols & engine)
│   ├── agentic/            ← The agentic loop engine
│   │   ├── loop.py         ← Main loop logic
│   │   ├── labels.py       ← Label parsing (THINK/TOOL/FINISH)
│   │   └── tool_dispatch.py← Execute tool calls
│   ├── capability_protocol.py  ← BaseCapability ABC
│   ├── tool_protocol.py        ← BaseTool ABC + ToolResult
│   ├── stream.py               ← StreamEvent dataclass
│   ├── stream_bus.py           ← Fan-out event channel
│   └── context.py              ← UnifiedContext (input to everything)
│
├── capabilities/            ← 🎯 What DeepTutor can DO
│   ├── chat.py             ← Default agentic chat
│   ├── deep_solve.py       ← Multi-step problem solving
│   ├── deep_question.py    ← Quiz/question generation
│   └── deep_research.py    ← Research report generation
│
├── tools/                   ← 🔧 Functions the LLM can call
│   ├── builtin/            ← All built-in tool classes
│   ├── rag_tool.py         ← RAG search wrapper
│   ├── web_search.py       ← Internet search
│   ├── code_executor.py    ← Sandboxed Python
│   └── reason.py           ← Deep reasoning LLM call
│
├── services/                ← ⚙️ Infrastructure
│   ├── llm/               ← LLM provider system
│   │   ├── providers/     ← OpenAI, Anthropic implementations
│   │   ├── config.py      ← LLMConfig dataclass
│   │   └── types.py       ← TutorResponse, TutorStreamChunk
│   ├── rag/               ← RAG pipeline
│   │   └── pipelines/     ← LlamaIndex implementation
│   └── embedding/         ← Embedding client
│
├── runtime/                 ← 🚀 Startup & routing
│   ├── orchestrator.py     ← ChatOrchestrator (main entry)
│   └── registry/          ← Tool & Capability registries
│
├── knowledge/              ← 📚 KB management (CRUD)
└── api/                    ← 🌐 WebSocket & HTTP endpoints
```

---

## 14. Analogy Map — DeepTutor as a Library

| DeepTutor Component | Library Analogy |
| -------------------- | ---- |
| **Orchestrator** | Front desk — directs you to the right section |
| **Capability** | A librarian with a specialty (research, tutoring, quiz-making) |
| **Tool** | Resources the librarian can use (catalog, internet, calculator) |
| **RAG** | Looking up a book, finding the right page, reading the relevant paragraph |
| **Embedding** | The Dewey Decimal System — organizing books by topic |
| **Vector DB** | The card catalog — find books by what they're *about* |
| **StreamBus** | The intercom — announcements reach everyone at once |
| **LLM** | The librarian's brain — reads context and formulates answers |
| **Knowledge Base** | A bookshelf with your personal collection |
| **Agentic Loop** | The librarian thinking: "Should I look this up? Check the computer? Or just answer?" |

---

## 15. What Makes DeepTutor "Intelligent"?

```text
┌───── Regular App ─────┐     ┌───── DeepTutor ──────────────────┐
│                        │     │                                   │
│  Hard-coded rules:     │     │  LLM decides dynamically:        │
│                        │     │                                   │
│  if "quiz" in msg:     │     │  "The user wants a quiz about    │
│    generate_quiz()     │     │   Chapter 3. I should:           │
│  elif "explain" in msg:│     │   1. Search KB for Ch.3 content  │
│    explain()           │     │   2. Generate 5 questions         │
│  else:                 │     │   3. Verify answers with code     │
│    generic_response()  │     │   4. Format nicely"              │
│                        │     │                                   │
│  Fragile, limited      │     │  Flexible, handles novel cases   │
└────────────────────────┘     └───────────────────────────────────┘
```

The LLM understands *intent* — it doesn't need exact keyword matches.
"Can you test me on photosynthesis?", "Make some practice questions",
and "Quiz me!" all get handled correctly without separate if-statements.

---

## Summary — How to Read the Codebase

```text
Start here:
  1. core/context.py          ← What data flows through the system
  2. core/tool_protocol.py    ← How tools are defined
  3. core/capability_protocol.py ← How capabilities are defined
  4. runtime/orchestrator.py  ← How messages get routed
  5. core/agentic/loop.py     ← The heart of the agentic engine

Then explore:
  6. capabilities/chat.py     ← Default chat behavior
  7. tools/builtin/           ← Available tool implementations
  8. services/rag/            ← RAG pipeline details
  9. services/llm/            ← LLM provider implementations
```

---

## Further Reading

| Topic | File |
| ------- | ------ |
| Every AI/ML term defined | [GLOSSARY.md](GLOSSARY.md) |
| Agentic AI deep dive | [AGENTIC_AI_EXPLAINED.md](AGENTIC_AI_EXPLAINED.md) |
| RAG pipeline details | [RAG_EXPLAINED.md](RAG_EXPLAINED.md) |
| LLM fundamentals | [HOW_LLMS_WORK.md](HOW_LLMS_WORK.md) |
| Full tool documentation | [../coder/LEVEL1_TOOLS_DEEP_DIVE.md](../coder/LEVEL1_TOOLS_DEEP_DIVE.md) |
| Architecture code details | [../coder/ARCHITECTURE_DEEP_DIVE.md](../coder/ARCHITECTURE_DEEP_DIVE.md) |
