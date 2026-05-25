# DeepTutor — Level 1 Tools Deep Dive

Every tool in DeepTutor follows the same contract: implement `BaseTool` with `get_definition()` (schema) and `execute(**kwargs)` (logic). The LLM sees only the schema; the runtime handles dispatch, result routing, and streaming.

---

## Table of Contents

1. [Tool Architecture & Lifecycle](#tool-architecture--lifecycle)
2. [RAG Tool](#1-rag--knowledge-base-retrieval)
3. [Web Search Tool](#2-web_search--web-search-with-citations)
4. [Code Execution Tool](#3-code_execution--sandboxed-python-execution)
5. [Reason Tool](#4-reason--deep-reasoning-llm-call)
6. [Brainstorm Tool](#5-brainstorm--breadth-first-idea-exploration)
7. [Paper Search Tool](#6-paper_search--arxiv-academic-paper-search)
8. [GeoGebra Analysis Tool](#7-geogebra_analysis--image-to-geogebra-commands)
9. [Read Source Tool](#8-read_source--attached-source-full-text)
10. [Read Memory Tool](#9-read_memory--user-persistent-memory)
11. [Write Memory Tool](#10-write_memory--save-user-preferences)
12. [Web Fetch Tool](#11-web_fetch--url-content-extraction)
13. [List Notebook Tool](#12-list_notebook--notebook-discovery)
14. [Write Note Tool](#13-write_note--notebook-record-creation)
15. [GitHub Tool](#14-github--read-only-github-queries)
16. [Ask User Tool](#15-ask_user--mid-turn-clarification)

---

## Tool Architecture & Lifecycle

### Base Classes

```
deeptutor/core/tool_protocol.py
├── ToolParameter        — One parameter in the function-calling schema
├── ToolDefinition       — Full tool metadata (name, description, parameters)
├── ToolResult           — Standardized return value
├── ToolPromptHints      — Guidance for when/how to use a tool
├── ToolAlias            — Alternative names/sub-modes
├── ToolEventSink        — Async callback for streaming progress
└── BaseTool (ABC)       — Abstract base: get_definition() + execute()
```

### Registration & Discovery

```python
# deeptutor/runtime/registry/tool_registry.py
class ToolRegistry:
    def load_builtins(self):
        for tool_type in BUILTIN_TOOL_TYPES:
            tool = tool_type()
            self.register(tool)

    def get(self, name) -> BaseTool | None: ...
    def get_definitions(self, names) -> list[ToolDefinition]: ...
    def get_enabled(self, names) -> list[BaseTool]: ...
```

All 14 built-in tools are registered at startup:
```python
BUILTIN_TOOL_TYPES = (
    BrainstormTool, RAGTool, WebSearchTool, CodeExecutionTool,
    ReasonTool, PaperSearchToolWrapper, ReadSourceTool,
    ReadMemoryTool, WriteMemoryTool, WebFetchTool,
    ListNotebookTool, WriteNoteTool, GithubTool, AskUserTool,
)
```

### ToolResult — The Universal Return Type

Every tool returns a `ToolResult`:

```python
@dataclass
class ToolResult:
    content: str = ""              # Text body returned to the LLM as role=tool
    sources: list[dict] = []       # Citations surfaced through stream.sources
    metadata: dict = {}            # Structured UI hints (e.g., ask_user card data)
    success: bool = True           # False = explicit failure (LLM still reads content)
    terminate_turn: bool = False   # End the agentic loop after this tool
    pause_for_user: dict | None    # Pause loop, await user reply, then resume
```

### Execution Flow (Generic)

```
LLM response contains tool_calls
         ↓
dispatch_tool_calls() [parallel, up to 8]
         ↓
ToolRegistry.get(name) → BaseTool instance
         ↓
tool.execute(**parsed_args) → ToolResult
         ↓
ToolResult.content → role=tool message → appended to conversation
ToolResult.sources → accumulated for citation rendering
ToolResult.pause_for_user → triggers loop pause (ask_user only)
```

---

## 1. `rag` — Knowledge Base Retrieval

### Purpose
Search one of the user's attached knowledge bases using vector similarity (RAG). Returns relevant passages the LLM uses to ground its response.

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Search query |
| `kb_name` | string | ✅ | Knowledge base to search (must be attached) |

### Internal Flow

```
AskUser selects KB → context.knowledge_bases = ["my-textbook"]
         ↓
LLM decides: tool_call(rag, {query: "eigenvalues", kb_name: "my-textbook"})
         ↓
RAGTool.execute()
    → deeptutor.tools.rag_tool.rag_search(query, kb_name)
        → Vector store similarity search
        → Chunk retrieval + re-ranking
        → Returns {answer: "...", chunks: [...]}
         ↓
ToolResult(
    content="Eigenvalues are the scalars λ such that...",
    sources=[{"type": "rag", "query": "eigenvalues", "kb_name": "my-textbook"}],
    metadata={answer, chunks, scores}
)
```

### Key Details
- Requires explicit `kb_name` — the LLM must specify which KB to search
- The chat pipeline can call RAG once per KB per turn (parallel calls supported)
- Actual implementation in `deeptutor/tools/rag_tool.py` handles embedding, retrieval, and scoring
- Results are also passed to the frontend for citation links

---

## 2. `web_search` — Web Search with Citations

### Purpose
Search the web and return summarized results with URL citations. Used when the user's question requires current or external information not in their knowledge base.

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Search query |

### Internal Flow

```
LLM decides it needs web info
         ↓
tool_call(web_search, {query: "latest transformer architectures 2025"})
         ↓
WebSearchTool.execute()
    → asyncio.to_thread(web_search, query=query)
        → External search API (provider-dependent)
        → Summarization of top results
        → Citation extraction
         ↓
ToolResult(
    content="Recent advances include... [1]...",
    sources=[
        {"type": "web", "url": "https://...", "title": "Paper Title"},
        ...
    ],
    metadata={answer, citations: [...]}
)
```

### Key Details
- Runs in a thread (`asyncio.to_thread`) to avoid blocking the event loop
- Returns structured citations that the frontend renders as clickable links
- Output can be verbose — the context-window guard may snip it on later iterations
- Implementation in `deeptutor/tools/web_search.py`

---

## 3. `code_execution` — Sandboxed Python Execution

### Purpose
Execute Python code in a restricted sandbox. Can either run explicit code or auto-generate code from a natural-language intent via an internal LLM call.

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `intent` | string | ✅* | Natural-language description of computation |
| `code` | string | No | Raw Python code to execute directly |
| `timeout` | integer | No | Max execution time (default: 30s) |

*Either `intent` or `code` must be provided.

### Internal Flow

```
LLM decides: tool_call(code_execution, {intent: "solve x^2 - 4 = 0"})
         ↓
CodeExecutionTool.execute()
    ├── If code provided → use directly
    └── If only intent → _generate_code(intent)
            → Internal LLM call with CODEGEN_SYSTEM_PROMPT
            → Strips markdown fences
            → Returns raw Python
         ↓
run_code(language="python", code="...", timeout=30)
    → Sandboxed subprocess execution
    → Captures stdout, stderr, exit_code
    → Collects file artifacts
         ↓
ToolResult(
    content="x = 2.0\nx = -2.0",
    success=(exit_code == 0),
    sources=[{"type": "code", "file": "plot.png"}],
    metadata={stdout, stderr, exit_code, code, intent, artifacts}
)
```

### Key Details
- **Two modes**: direct code execution vs. LLM-generated code from intent
- Code generation uses a dedicated system prompt at `temperature=0.0` for determinism
- Sandbox implementation in `deeptutor/tools/code_executor.py`
- Supports workspace directories and task-scoped file artifacts
- Failed executions (`exit_code != 0`) still return content (the error) but `success=False`
- The LLM can inspect errors and retry with corrected code in the next iteration

### Code Generation System Prompt
```
You are a Python code generator.
- Output only Python code, no markdown fences or explanation.
- Prefer: math, numpy, pandas, matplotlib, scipy, sympy.
- Print the final answer to stdout.
- Save plots/files to current working directory.
```

---

## 4. `reason` — Deep Reasoning LLM Call

### Purpose
Perform dedicated deep reasoning on a complex sub-problem via a separate LLM call. Used when the current context is insufficient for a confident answer and the model needs more "thinking space."

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | The sub-problem to reason about |
| `context` | string | No | Supporting context for reasoning |

### Internal Flow

```
LLM decides: tool_call(reason, {query: "Derive closed-form for...", context: "..."})
         ↓
ReasonTool.execute()
    → deeptutor.tools.reason.reason(query, context)
        → Builds user prompt: "## Focus\n{query}\n## Context\n{context}"
        → Single streaming LLM call with reasoning system prompt
        → Accumulates full response
         ↓
ToolResult(
    content="Step 1: We start with...\nStep 2: ...\nConclusion: ...",
    metadata={query, answer, model}
)
```

### Key Details
- Uses a dedicated **reasoning system prompt** that enforces step-by-step analysis:
  - "Show your reasoning chain explicitly — number each step"
  - "If mathematical derivation is needed, show each algebraic step"
  - "Conclude with a clearly-labeled answer"
- Temperature and max_tokens are resolved from `agents.yaml` config
- The tool acts as a "thinking budget extension" — giving the model a fresh context window focused purely on one sub-problem
- No external data access — purely synthesis and deduction

---

## 5. `brainstorm` — Breadth-First Idea Exploration

### Purpose
Explore multiple plausible directions for a topic instead of converging on one answer early. Generates 5-8 distinct possibilities with rationales.

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topic` | string | ✅ | The topic/goal/problem to brainstorm |
| `context` | string | No | Supporting context or constraints |

### Internal Flow

```
LLM decides: tool_call(brainstorm, {topic: "approaches to teach calculus"})
         ↓
BrainstormTool.execute()
    → deeptutor.tools.brainstorm.brainstorm(topic, context)
        → Builds user prompt: "## Topic\n...\n## Context\n..."
        → Single streaming LLM call with brainstorm system prompt
        → High temperature (0.8) for creative diversity
         ↓
ToolResult(
    content="# Brainstorm\n## 1. Visual Intuition First\n- Direction: ...\n- Rationale: ...",
    metadata={topic, answer, model}
)
```

### Key Details
- System prompt enforces structured output:
  ```
  # Brainstorm
  ## 1. <short title>
  - Direction: <1-2 sentence idea>
  - Rationale: <brief why>
  ```
- Uses **higher temperature (0.8)** than other tools for creative diversity
- Generates 5-8 distinct possibilities from different angles
- Guidelines: "methods, framing, applications, risks, experiments, or product directions"
- Explicitly told: "Do not pretend uncertain facts are verified"

---

## 6. `paper_search` — arXiv Academic Paper Search

### Purpose
Search arXiv preprints by keyword and return concise metadata (title, authors, abstract, URL).

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Search query |
| `max_results` | integer | No | Max papers (default: 3) |
| `years_limit` | integer | No | Only last N years (default: 3) |
| `sort_by` | string | No | "relevance" or "date" (default: relevance) |

### Internal Flow

```
LLM decides: tool_call(paper_search, {query: "attention mechanisms", max_results: 5})
         ↓
PaperSearchToolWrapper.execute()
    → ArxivSearchTool().search_papers(query, max_results, years_limit, sort_by)
        → arXiv API query
        → Parse XML response
        → Extract: title, authors, abstract, year, arxiv_id, url
         ↓
ToolResult(
    content="**Attention Is All You Need** (2017)\nAuthors: Vaswani et al.\narXiv: 1706.03762\n...",
    sources=[{"type": "paper", "provider": "arxiv", "url": "...", "title": "..."}],
    metadata={"provider": "arxiv", "papers": [...]}
)
```

### Key Details
- Implementation in `deeptutor/tools/paper_search_tool.py`
- Gracefully handles arXiv rate-limiting — returns a friendly error message
- Abstracts are truncated to 400 characters in the content string
- Full paper metadata is available in `metadata.papers` for programmatic use
- Returns empty result message if no papers match

---

## 7. `geogebra_analysis` — Image → GeoGebra Commands

### Purpose
Analyze a math problem image using a 4-stage vision pipeline and generate validated GeoGebra commands for interactive visualization.

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `question` | string | ✅ | The math problem text |
| `image_base64` | string | No | Base64-encoded image (injected from attachments) |

### Internal Flow (4-Stage Vision Pipeline)

```
LLM decides: tool_call(geogebra_analysis, {question: "Find angle ABC..."})
    ↓ (pipeline injects image_base64 from context.attachments)

GeoGebraAnalysisTool.execute()
    → VisionSolverAgent.process(question_text, image_base64)
        ↓
    ┌───────────────────────────────────────────────────────────────┐
    │ Stage 1: BBOX Detection                                       │
    │   Vision LLM analyzes image → identifies geometric elements   │
    │   Output: bounding boxes, element labels                      │
    ├───────────────────────────────────────────────────────────────┤
    │ Stage 2: ANALYSIS                                             │
    │   Extracts constraints and geometric relations                │
    │   Output: constraints[], geometric_relations[]                │
    ├───────────────────────────────────────────────────────────────┤
    │ Stage 3: COMMAND GENERATION                                   │
    │   Converts analysis to GeoGebra commands                      │
    │   Output: raw GeoGebra command list                           │
    ├───────────────────────────────────────────────────────────────┤
    │ Stage 4: REFLECTION & VALIDATION                              │
    │   Validates commands against detected elements                │
    │   Fixes issues, removes duplicates                            │
    │   Output: final_ggb_commands[]                                │
    └───────────────────────────────────────────────────────────────┘
         ↓
ToolResult(
    content="Constraints (3): [...]\nRelations (2): [...]\n\n```geogebra\nA = (0, 0)\n...\n```",
    metadata={
        has_image: true,
        commands_count: 8,
        final_ggb_commands: [...],
        bbox_elements: 5,
        constraints_count: 3,
        relations_count: 2,
        reflection_issues: 1,
    }
)
```

### Key Details
- **Most complex tool** — involves multiple internal LLM calls (vision model)
- Requires vision-capable model (checks `supports_vision` capability)
- Auto-normalizes base64 format: adds `data:image/png;base64,` prefix if missing
- Implementation in `deeptutor/agents/vision_solver/vision_solver_agent.py`
- Language-aware (defaults to Chinese — `language="zh"`)
- The frontend renders GeoGebra commands in an interactive widget

---

## 8. `read_source` — Attached Source Full Text

### Purpose
Load the full text of one attached source (notebook record, book reference, history session, question bank entry, or document attachment) by its manifest ID.

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source_id` | string | ✅ | Source ID from the Attached Sources manifest |

### Internal Flow

```
User attaches a PDF → context.source_manifest populated
    "nb-abc123 | Study Notes | notebook | First 200 chars..."
         ↓
LLM sees manifest preview is insufficient
         ↓
tool_call(read_source, {source_id: "nb-abc123"})
         ↓
ReadSourceTool.execute()
    → kwargs["source_index"] is injected by _augment_tool_kwargs
    → Looks up source_id in the index dict
    → Returns full text
         ↓
ToolResult(
    content="<full text of the notebook record>",
    metadata={source_id: "nb-abc123", char_count: 4521}
)
```

### Key Details
- **Auto-mounted** only when the turn has non-image attached sources
- The tool itself is **stateless** — the chat pipeline injects `source_index` via `_augment_tool_kwargs`
- Source ID prefixes: `nb-` (notebook), `bk-` (book), `hs-` (history), `qb-` (question bank), `at-` (attachment)
- Explicit guardrails: "Do not call this on every source 'just in case'"
- Returns helpful error with valid IDs when an invalid source_id is provided

---

## 9. `read_memory` — User Persistent Memory

### Purpose
Read the user's L3 cross-surface persistent memory: recent learning summary, user profile, knowledge scope, and explicit preferences. Used for personalization.

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | — | — | No parameters needed |

### Internal Flow

```
LLM decides personalization would help
         ↓
tool_call(read_memory, {})
         ↓
ReadMemoryTool.execute()
    → get_memory_store().read_l3_concat()
        → Reads 4 markdown documents:
            1. recent.md    — Recent learning summary
            2. profile.md   — User profile
            3. scope.md     — Knowledge scope
            4. preferences.md — Explicit preferences
        → Concatenates into one text block
         ↓
ToolResult(
    content="## Recent Learning\n...\n## Profile\n...\n## Preferences\n...",
    metadata={char_count: 2340}
)
```

### Key Details
- **Multi-user safe** — paths resolve to the active user via ContextVars
- The Memory system has 3 layers: L1 (raw events), L2 (processed), L3 (final markdown docs)
- This tool reads only L3 (the polished, readable layer)
- Guidance: "Use to personalise tone, depth, and examples — not on every turn, not for purely factual questions"

---

## 10. `write_memory` — Save User Preferences

### Purpose
Persist an explicit user preference into the L3 `preferences.md`. The only write-path from chat into the memory system.

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `op` | string | ✅ | "add" (new) or "edit" (revise existing) |
| `text` | string | ✅ | The preference, ≤ 240 chars |
| `target_id` | string | No | Entry ID for edit (form `m_xxx`) |
| `reason` | string | No | One-line note for the Memory workbench |

### Internal Flow

```
User says: "I prefer explanations with analogies, not formal proofs"
         ↓
LLM recognizes explicit preference
         ↓
tool_call(write_memory, {op: "add", text: "Prefers analogies over formal proofs"})
         ↓
WriteMemoryTool.execute()
    → Validates op and text
    → Emits L1 TraceEvent ("preference_stated")
    → store.write_preference(op="add", text="...", trace_id=event.id)
        → Appends to preferences.md
        → Returns report with entry_id
         ↓
ToolResult(
    content="preference added (entry=m_42).",
    metadata={op: "add", entry_id: "m_42"}
)
```

### Key Details
- **Strict guard**: "Call ONLY when the user clearly states a preference — never speculate"
- Supports both `add` and `edit` operations
- Emits an L1 trace event so the preference has provenance
- Edit requires a valid `target_id` (from `read_memory` or Memory workbench)
- 240-character limit on preference text
- The Memory workbench (UI) shows the reason field as a footnote

---

## 11. `web_fetch` — URL Content Extraction

### Purpose
Fetch a specific URL and extract its content as readable markdown. Different from `web_search` which finds URLs — this tool reads a known URL.

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | ✅ | Full http:// or https:// URL |
| `max_chars` | integer | No | Cap on extracted text (default: 50000) |

### Internal Flow

```
User shares a link: "Summarize this article: https://example.com/paper"
         ↓
LLM: tool_call(web_fetch, {url: "https://example.com/paper"})
         ↓
WebFetchTool.execute()
    → fetch_url_as_markdown(url, max_chars=50000)
        → HTTP GET request
        → HTML parsing + readability extraction
        → Convert to clean markdown
        → Truncate if over max_chars
         ↓
ToolResult(
    content="# Article Title\n\nThe paper presents...",
    sources=[{"type": "web", "url": "https://...", "title": "Article Title"}],
    metadata={url, title, char_count, truncated: bool}
)
```

### Key Details
- Implementation in `deeptutor/tools/web_fetch.py`
- Separate from `web_search` — use `web_fetch` for known URLs, `web_search` for discovery
- Returns `success=False` with error message on network failures
- Tracks whether content was truncated via `metadata.truncated`
- Default 50,000 character limit prevents context window overflow

---

## 12. `list_notebook` — Notebook Discovery

### Purpose
Two-mode discovery tool: list all user notebooks OR list records inside one specific notebook.

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `notebook_id` | string | No | Omit for notebook index; provide to list records |

### Internal Flow

```
Mode 1: List all notebooks
tool_call(list_notebook, {})
    → list_notebooks_or_records(notebook_id="")
    → Returns: "1. Study Notes (id: nb-abc, 12 records)\n2. ..."

Mode 2: Drill into one notebook
tool_call(list_notebook, {notebook_id: "nb-abc"})
    → list_notebooks_or_records(notebook_id="nb-abc")
    → Returns: "1. Calculus Chapter 3 (rec-001) — Summary: ...\n2. ..."
```

### Key Details
- **Auto-mounted** only when the user has at least one notebook
- Stateless — reads directly from the per-user notebook manager
- Intended as a precursor to `write_note` (to discover valid IDs)
- Implementation in `deeptutor/tools/list_notebook.py`

---

## 13. `write_note` — Notebook Record Creation

### Purpose
Create a new record in a notebook or edit an existing one. Can save either the actual chat transcript or an agent-authored markdown body.

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mode` | string | ✅ | "append" (new) or "edit" (patch) |
| `notebook_id` | string | ✅ | Target notebook ID |
| `record_id` | string | No | Required for edit mode |
| `title` | string | No | Record title |
| `content` | string | No | Agent-authored body (omit for transcript) |
| `turns_to_include` | string | No | How many turns in transcript (default: "3") |
| `note` | string | No | Commentary / summary |

### Internal Flow

```
User: "Save this conversation to my study notes"
         ↓
LLM: tool_call(write_note, {mode: "append", notebook_id: "nb-abc", title: "Eigenvalues Q&A"})
         ↓
WriteNoteTool.execute()
    → write_note(mode, notebook_id, title, ...)
        → Append mode: builds transcript from conversation_history (last 3 turns)
        → Edit mode: patches existing record fields
        → Persists to notebook storage
         ↓
ToolResult(
    content="Saved new record in notebook 'Study Notes' (record id: rec-xyz).",
    metadata={mode: "append", record_id: "rec-xyz", notebook_id: "nb-abc", ...}
)
```

### Key Details
- **Auto-mounted** only when user has at least one notebook
- The pipeline injects `conversation_history` and `current_user_message` — the model never needs to fabricate the saved content
- Default behavior: saves real Q&A transcript (recommended)
- `content` parameter overrides transcript with custom markdown
- `turns_to_include`: "3" (default), or "all" for entire conversation
- Implementation in `deeptutor/tools/write_note.py`

---

## 14. `github` — Read-Only GitHub Queries

### Purpose
Query GitHub PRs, issues, CI runs, and repos via the `gh` CLI. Strictly read-only — cannot comment, close, or merge.

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query_type` | string | ✅ | "pr", "issue", "run", "repo", or "api" |
| `target` | string | ✅ | owner/repo[#number] or gh-api path |

### Internal Flow

```
User: "What's the status of PR #42 on our repo?"
         ↓
LLM: tool_call(github, {query_type: "pr", target: "org/repo#42"})
         ↓
GithubTool.execute()
    → run_github_query(query_type="pr", target="org/repo#42")
        → Constructs gh CLI command
        → Executes subprocess
        → Parses output
         ↓
ToolResult(
    content="PR #42: Add caching layer\nStatus: Open\nReviews: 2 approved\n...",
    sources=[{"type": "github", "query_type": "pr", "target": "org/repo#42"}],
    metadata={query_type, target}
)
```

### Key Details
- **Always auto-mounted** — gracefully reports "gh unavailable" if CLI not installed
- Strictly read-only: "no comments, no closes, no merges"
- Implementation in `deeptutor/tools/github_query.py`
- Supports 5 query types: `pr`, `issue`, `run`, `repo`, `api`
- The `api` type allows arbitrary gh API GET requests (read-only)

---

## 15. `ask_user` — Mid-Turn Clarification

### Purpose
Pause the agentic loop mid-turn to ask the user 1-3 clarifying questions. The turn doesn't end — when answers arrive, the loop resumes from exactly where it stopped.

### Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `questions` | array | No* | 1-3 structured questions |
| `intro` | string | No | One-line lead-in text |
| `question` | string | No* | Legacy single-question shorthand |
| `options` | array | No | Legacy options (paired with `question`) |

*Either `questions` array or legacy `question` string must be provided.

### Question Object Shape

```json
{
  "prompt": "What difficulty level do you want?",
  "options": ["Easy", "Medium", "Hard"],
  "id": "difficulty",
  "allow_free_text": true,
  "placeholder": "Or describe your own..."
}
```

### Internal Flow (Detailed)

```
1. LLM output: tool_call(ask_user, {questions: [...], intro: "..."})

2. AskUserTool.execute()
    → build_ask_user_payload(questions=[...], intro="...")
        → Validates: max 3 questions, max 8 options each
        → Enforces: 800 char/question, 120 char/option, 400 char/intro
        → Deduplicates options, assigns stable IDs
        → Returns AskUserPayload(questions=(...), intro="...")

3. Returns ToolResult(
        content="[awaiting user reply to: What difficulty level?]",
        metadata={"ask_user": payload.to_dict()},
        pause_for_user=payload.to_dict(),  ← PAUSE SIGNAL
   )

4. dispatch_tool_calls() sees pause_for_user → sets DispatchOutcome.pause=True

5. Agentic loop calls LoopHost.resolve_pause()
    → Emits StreamEvent(type=PENDING_USER_INPUT, metadata=payload)
    → WebSocket pushes event to frontend
    → Frontend renders AskUserOptions.tsx card with tabs

6. User answers → WebSocket reply → reply queue

7. resolve_pause() receives answer → substitutes into role=tool message:
    Before: "[awaiting user reply to: ...]"
    After:  "User answered: Medium"

8. resolve_pause() returns True → loop RESUMES next iteration
    → LLM sees "User answered: Medium" as tool result
    → Proceeds with generating medium-difficulty content
```

### Key Details
- **Does NOT end the turn** — uses `pause_for_user` instead of `terminate_turn`
- The loop stays alive across the pause; all context is preserved
- Duplicate `ask_user` calls in the same iteration are detected and suppressed
- Legacy shape (`{question, options}`) auto-wraps into the v2 list format
- Frontend renders all questions as tabs in a single card
- User can abort via the stop button (cancels entire turn)
- Guardrails: "Use sparingly: only when intent is genuinely ambiguous and progress without clarification is unsafe"

---

## Tool Interaction Patterns

### Parallel Execution
Up to 8 tools can execute simultaneously in one iteration. The dispatcher:
1. Deduplicates calls (same tool + same args = duplicate)
2. Suppresses duplicate `ask_user` calls (only first one wins)
3. Aggregates all sources and metadata into one `DispatchOutcome`

### Tool Chaining
Tools cannot call other tools directly. Multi-tool workflows emerge from the agentic loop:
```
Iteration 1: LLM calls rag → gets knowledge
Iteration 2: LLM calls reason → deep-thinks about the retrieved info
Iteration 3: LLM calls code_execution → verifies with computation
Iteration 4: LLM emits FINISH → final answer incorporating all tool results
```

### Context Window Management
The pipeline has a guard at `CONTEXT_WINDOW_GUARD_RATIO = 0.9`:
- If messages exceed 90% of the model's context window
- The largest stale tool-result is replaced with:
  `[earlier tool result snipped — call the same tool again if needed]`
- Prevents out-of-context crashes while preserving recent results

### Server-Side Argument Augmentation
The chat pipeline can inject arguments the LLM doesn't provide:
- `read_source` → `source_index` (the full-text index for all attached sources)
- `geogebra_analysis` → `image_base64` (from context.attachments)
- `code_execution` → `workspace_dir`, `session_id`, `turn_id`
- `write_note` → `conversation_history`, `current_user_message`

This keeps tool schemas simple for the LLM while providing necessary runtime context.
