<!-- markdownlint-disable MD024 -->
# DeepTutor — Level 2 Optional/Redundant Capabilities

These capabilities are **non-essential** for DeepTutor's core tutoring mission. They add specialized value but can be trimmed, deferred, or simplified without breaking the teach → assess → solve learning loop.

---

## Table of Contents

1. [Classification Rationale](#classification-rationale)
2. [Auto Capability](#1-auto--meta-router-agent)
3. [Visualize Capability](#2-visualize--multi-format-visualization)
4. [Math Animator Capability](#3-math_animator--manim-animation-generation)
5. [Deep Research Capability](#4-deep_research--multi-agent-deep-research)
6. [Trimming Strategy](#trimming-strategy)

---

## Classification Rationale

### What Makes a Capability "Redundant"?

A capability is classified as **optional/redundant** when:

- Its function can be partially covered by the `chat` capability with the right tools
- It requires expensive or scarce resources (GPU rendering, multiple LLM calls)
- It serves a narrow use case that most students don't need daily
- It has heavy external dependencies (Manim, multi-model orchestration)
- It duplicates routing logic that could be manual
- Removing it degrades experience but doesn't break the core learning loop

### Redundancy Spectrum

```text
Most Redundant ←────────────────────────────────────→ Least Redundant
                                                        
auto         math_animator      visualize      deep_research
(pure router)  (needs manim)    (specialized)  (valuable but heavy)
```

---

## 1. `auto` — Meta-Router Agent

### What It Does

An **agentic router** that analyzes the user's intent and autonomously delegates to the best matching capability (deep_solve, deep_question, deep_research, math_animator, visualize).

### Manifest

```python
CapabilityManifest(
    name="auto",
    description="Agentic router: analyzes intent, autonomously delegates...",
    stages=["analyzing", "delegating", "synthesizing"],
    tools_used=[],
    cli_aliases=["auto"],
)
```

### Architecture (3 Stages)

```text
AutoPipeline.run(context, stream)
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Stage 1: ANALYZING                                                    │
│                                                                       │
│  Single LLM call (no tools, no loop)                                 │
│  Max tokens: 400                                                     │
│  Purpose: Acknowledge user intent, stream thinking                   │
│  Output: Brief analysis text (shown as THINKING events)              │
├─────────────────────────────────────────────────────────────────────┤
│ Stage 2: DELEGATING LOOP                                             │
│                                                                       │
│  Router LLM with tool_call schemas for:                              │
│    - delegate_to_deep_solve(question, ...)                           │
│    - delegate_to_deep_question(topic, num_questions, ...)            │
│    - delegate_to_deep_research(topic, depth, ...)                    │
│    - delegate_to_math_animator(concept, output_mode, ...)            │
│    - delegate_to_visualize(concept, render_mode, ...)                │
│    - Atomic tools: rag, web_search, code_execution, etc.             │
│                                                                       │
│  Each iteration:                                                      │
│  1. Call router LLM with full history + tool schemas                 │
│  2. If plain text → that's the final answer (exit)                   │
│  3. If tool_call(delegate_to_X) → run sub-capability                 │
│  4. If tool_call(atomic_tool) → dispatch via ToolRegistry            │
│  5. Append results → continue loop                                   │
│                                                                       │
│  Guards:                                                              │
│  - max_iterations (default: 5)                                       │
│  - max_same_capability_calls (prevent infinite delegation)           │
│  - router_llm_retries budget (default: 3)                            │
│  - per_delegation_retries (default: 3)                               │
├─────────────────────────────────────────────────────────────────────┤
│ Stage 3: SYNTHESIZING                                                │
│                                                                       │
│  If loop exited with plain text → emit as final                      │
│  If loop exhausted iterations → synthesizer LLM call                 │
│    → Produces inline answer from accumulated trace                   │
│  Max tokens: 800                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Why It's Redundant

1. **Pure overhead**: Adds 1-3 extra LLM calls just to decide which mode to use
2. **Users already choose**: The UI has explicit mode buttons (Solve, Quiz, Research)
3. **Fallible routing**: The router can pick the wrong capability, wasting time
4. **Doubles complexity**: Failed delegations require retry/recovery logic
5. **No unique value**: Everything `auto` does, the user can do manually in one click

### What to Keep If Trimming

The `auto` capability's **atomic tool dispatch** is slightly useful — it can call `rag` or `web_search` before deciding to delegate. But `chat` already does this better with its full agentic loop.

### Cost

- **Minimum 3 LLM calls** per turn (analyze + route + synthesize)
- Often 5-7 calls when delegating + retrying
- Large system prompt with all capability schemas (~2000 tokens)
- Heavy `_LoopState` tracking with retry budgets

### Verdict: **REMOVE FIRST**

Users should explicitly select their mode. The router adds latency and confusion for minimal value.

---

## 2. `visualize` — Multi-Format Visualization

### What It Does

Generates interactive visualizations in 6 render types: SVG, Chart.js, Mermaid diagrams, interactive HTML, Manim video, or Manim storyboard images.

### Manifest

```python
CapabilityManifest(
    name="visualize",
    description="Generate SVG, Chart.js, Mermaid, interactive HTML, or Manim...",
    stages=["analyzing", "generating", "reviewing",
            "concept_analysis", "concept_design", "code_generation",
            "code_retry", "summary", "render_output"],
    tools_used=[],
    cli_aliases=["visualize", "viz"],
)
```

### Architecture (Branching Pipeline)

```text
VisualizeCapability.run(context, stream)
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Stage 1: ANALYZING (AnalysisAgent)                                   │
│                                                                       │
│  Single LLM call                                                     │
│  Routes to one of 6 render types:                                    │
│    svg | chartjs | mermaid | html | manim_video | manim_image        │
│  Output: VisualizationAnalysis(render_type, description, ...)        │
├─────────────────────┬───────────────────────────────────────────────┤
│                     │                                                 │
│     TEXT PATH       │              MANIM PATH                         │
│  (svg/chartjs/      │         (manim_video/image)                    │
│   mermaid/html)     │                                                 │
│                     │                                                 │
├─────────────────────┤  ┌────────────────────────────────────────────┤
│ Stage 2: GENERATE   │  │ concept_analysis → concept_design           │
│  CodeGeneratorAgent │  │ → code_generation → code_retry → render     │
│  → raw code output  │  │ (Full MathAnimatorPipeline)                 │
├─────────────────────┤  │                                             │
│ Stage 3: REVIEW     │  │ See Math Animator section below             │
│  ReviewAgent        │  │                                             │
│  → validates code   │  └────────────────────────────────────────────┤
│  → optimizes        │                                                 │
│  → fixes errors     │                                                 │
├─────────────────────┘                                                 │
│                                                                       │
│ Final: Emit fenced code block + structured result                    │
│   {render_type, code: {language, content}, analysis, review}         │
└─────────────────────────────────────────────────────────────────────┘
```

### Three Internal Agents

| Agent | Role | LLM Calls |
| --- | --- | --- |
| `AnalysisAgent` | Classify render type + extract data description | 1 |
| `CodeGeneratorAgent` | Generate visualization code in the target language | 1 |
| `ReviewAgent` | Validate, optimize, fix code | 1 (skipped for HTML) |

### Why It's Redundant

1. **Chat can generate code**: The `code_execution` tool already generates and runs Python (matplotlib, etc.)
2. **Specialized output**: Most students don't need Chart.js or SVG — a matplotlib plot suffices
3. **HTML rendering is fragile**: Complex HTML pages often fail validation
4. **Manim is heavy**: Requires `pip install deeptutor[math-animator]` (optional dep)
5. **3+ LLM calls for one diagram**: Analyze → Generate → Review
6. **Limited educational utility**: Visualizations help but aren't core to learning

### What to Keep If Trimming

- **Mermaid diagrams**: Useful for concept maps, can be done inline by `chat`
- **SVG**: Can be emitted by chat directly in markdown
- The review agent adds quality but doubles cost — remove for budget

### Cost

- **3 LLM calls minimum** (text path)
- **5-7 LLM calls** (manim path with retries)
- Large system prompts with render-type-specific instructions
- Manim path: subprocess execution + file I/O + video encoding

### Verdict: **SIMPLIFY** — keep Mermaid/SVG inline in chat, remove as standalone capability

---

## 3. `math_animator` — Manim Animation Generation

### What It Does

Generates math animations (video) or storyboard images using Manim, a Python animation library.

### Manifest

```python
CapabilityManifest(
    name="math_animator",
    description="Generate math animations or storyboard images with Manim.",
    stages=["concept_analysis", "concept_design", "code_generation",
            "code_retry", "summary", "render_output"],
    tools_used=[],
    cli_aliases=["animate"],
    config_defaults={"output_mode": "video", "quality": "medium", "style_hint": ""},
)
```

### Architecture (Multi-Stage Pipeline)

```text
MathAnimatorCapability.run(context, stream)
         ↓
    Check: manim installed? (raises RuntimeError if not)
         ↓
MathAnimatorPipeline
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Stage 1: CONCEPT ANALYSIS                                            │
│  Analyze the math concept, determine animation approach              │
│  Input: user message + history + attachments                         │
│  Output: analysis object (concept, approach, complexity)             │
├─────────────────────────────────────────────────────────────────────┤
│ Stage 2: CONCEPT DESIGN                                              │
│  Design the animation sequence, scenes, transitions                  │
│  Input: user message + analysis                                      │
│  Output: design spec (scenes, objects, timing)                       │
├─────────────────────────────────────────────────────────────────────┤
│ Stage 3: CODE GENERATION                                             │
│  Generate Manim Python code                                          │
│  Input: analysis + design + request_config(output_mode, quality)     │
│  Output: Python code string                                          │
├─────────────────────────────────────────────────────────────────────┤
│ Stage 4: CODE RETRY (if render fails)                                │
│  Retry manager feeds error back to LLM for fix                       │
│  Budget: configurable retries (default: 2-3)                         │
├─────────────────────────────────────────────────────────────────────┤
│ Stage 5: RENDER OUTPUT                                               │
│  Execute Manim subprocess:                                           │
│    manim render -ql scene.py SceneName                               │
│  Capture video/image artifact                                        │
│  Encode to base64 for frontend delivery                              │
├─────────────────────────────────────────────────────────────────────┤
│ Stage 6: SUMMARY                                                     │
│  Generate narration/explanation of the animation                     │
│  Output: text summary for the chat bubble                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Internal Components

| Component | File | Role |
| --- | --- | --- |
| `MathAnimatorPipeline` | `agents/math_animator/pipeline.py` | Orchestrates all stages |
| `renderer.py` | Subprocess Manim execution | Runs Python code, captures output |
| `retry_manager.py` | Error → re-generation loop | Feeds render errors back to LLM |
| `visual_review.py` | Output validation | Checks rendered output quality |
| `duration_utils.py` | Timing estimation | Predicts render time |

### Why It's Redundant

1. **Optional dependency**: Requires `pip install deeptutor[math-animator]` — not in base install
2. **Heavy resource cost**: 4-6 LLM calls + subprocess render (30-90 seconds total)
3. **GPU beneficial**: Manim rendering benefits from GPU acceleration
4. **Niche use case**: Most tutoring doesn't need animated videos
5. **Fragile code generation**: Manim API changes frequently; generated code often needs retries
6. **Already accessible via `visualize`**: The visualize capability can delegate to manim path
7. **Static alternatives exist**: SVG/Mermaid/Chart.js cover 80% of visualization needs

### What to Keep If Trimming

- **Nothing** — this is fully removable. Chat's `code_execution` tool can generate matplotlib plots for basic math visualization.

### Cost

- **4-6 LLM calls** per animation
- **30-90 seconds** subprocess render time
- ~100MB Manim + LaTeX dependencies
- File I/O for temporary Python scripts + rendered output
- Base64 encoding for video/image delivery

### Verdict: **REMOVE** — most dispensable capability, optional dependency already signals this

---

## 4. `deep_research` — Multi-Agent Deep Research

### What It Does

Conducts multi-phase deep research on a topic: rephrases the question with user clarification, decomposes into sub-topics, researches each block with tool-augmented agentic loops, then assembles a structured report with citations.

### Manifest

```python
CapabilityManifest(
    name="deep_research",
    description="Agentic-loop deep research with iterative report generation.",
    stages=["rephrasing", "decomposing", "researching", "reporting"],
    tools_used=["rag", "web_search", "paper_search", "code_execution"],
    cli_aliases=["research"],
)
```

### Architecture (4-Phase Pipeline + Outline Preview)

```text
DeepResearchCapability.run(context, stream)
         ↓
    Two-stage flow:
    Call 1: No confirmed_outline → returns outline preview → EXITS
    Call 2: With confirmed_outline → drives Phase 3 + 4
         ↓
ResearchPipeline.run(context, topic, confirmed_outline, ...)
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 1: REPHRASE (Mini Agentic Loop)                                │
│                                                                       │
│  Protocol: THINK | TOOL | FINISH                                     │
│  Only tool available: ask_user                                       │
│  Max iterations: 8                                                   │
│  Max ask_user rounds: 3 (each with 1-3 questions)                   │
│                                                                       │
│  Purpose:                                                             │
│  - Clarify the research topic with structured questions              │
│  - Narrow scope, determine depth preferences                        │
│  - FINISH = refined research statement                               │
│                                                                       │
│  May FINISH immediately if topic is unambiguous                      │
├─────────────────────────────────────────────────────────────────────┤
│ Phase 2: DECOMPOSE (Single Labeled Step)                             │
│                                                                       │
│  Protocol: OUTLINE (single terminal)                                 │
│  Max tokens: 2000                                                    │
│                                                                       │
│  Output: JSON list of sub-topics:                                    │
│  [                                                                    │
│    {"title": "Historical Context", "overview": "..."},              │
│    {"title": "Current Approaches", "overview": "..."},              │
│    {"title": "Open Problems", "overview": "..."},                   │
│  ]                                                                    │
│                                                                       │
│  → Pipeline returns here on first call (outline_preview)             │
│  → Frontend shows editable outline to user                           │
│  → User confirms/edits → second call with confirmed_outline          │
├─────────────────────────────────────────────────────────────────────┤
│ Phase 3: RESEARCH BLOCKS (Per-Block Agentic Loops)                   │
│                                                                       │
│  Protocol: THINK | TOOL | APPEND | FINISH                            │
│  Max iterations per block: 5                                         │
│  Tools: rag, web_search, paper_search, code_execution                │
│                                                                       │
│  Dynamic Topic Queue:                                                 │
│    Initial: confirmed sub-topics                                     │
│    APPEND label: LLM can ADD new sub-topics mid-research             │
│    Queue max length: 8                                                │
│    Parallel execution: up to 3 blocks simultaneously                 │
│                                                                       │
│  Per block:                                                           │
│    - Agentic loop researches the sub-topic                           │
│    - Tools provide evidence (citable)                                │
│    - FINISH produces dense knowledge summary                         │
│    - Results registered in CitationManager                           │
│                                                                       │
│  Note Agent (sidecar):                                               │
│    After each tool result → summarizer produces dense note           │
│    Notes feed into CitationManager for report anchoring              │
│    Budget: 1500 tokens per note, 8000 char raw input cap             │
├─────────────────────────────────────────────────────────────────────┤
│ Phase 4: REPORTING (Sequential Labeled Steps)                        │
│                                                                       │
│  Step A: OUTLINE → report structure plan                             │
│  Step B: INTRO → introduction section                                │
│  Step C: Per-section SECTION × N → body sections with citations      │
│  Step D: CONCLUSION → concluding section                             │
│                                                                       │
│  Each step: single labeled call, one terminal label                  │
│  Protocols: _PROTOCOL_REPORT_OUTLINE, _REPORT_INTRO, etc.           │
│  Token budgets: 2000-6000 per section                                │
│                                                                       │
│  Citation injection:                                                  │
│    CitationManager provides [1], [2], etc. anchors                   │
│    Each citation links back to tool evidence source                  │
│    Frontend renders citation sidebar                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Unique Data Structures

```python
@dataclass
class DynamicTopicQueue:
    """Self-growing queue — APPEND label adds new blocks mid-research."""
    blocks: list[TopicBlock]
    max_length: int = 8

@dataclass
class TopicBlock:
    title: str
    overview: str
    status: TopicStatus  # PENDING | RUNNING | DONE | FAILED

@dataclass
class ResearchedBlock:
    block: TopicBlock
    knowledge: str  # Accumulated FINISH text

class CitationManager:
    """Tracks all evidence and provides numbered citation anchors."""
    # Registers tool results as citable sources
    # Generates [N] anchors for report sections
    # Links anchors to source URLs/papers/KB passages
```

### Why It's Partially Redundant

1. **High token cost**: 15-30+ LLM calls per research turn (rephrase + decompose + N blocks × iterations + N report sections)
2. **Time-intensive**: 2-5 minutes per full research cycle
3. **ask_user dependency**: Phase 1 requires mid-turn user interaction (complex UX)
4. **Two-call pattern**: Outline preview → user confirmation → second call (stateful)
5. **Chat can do basic research**: `web_search` + `paper_search` + `rag` in chat covers simple cases
6. **Requires model quality**: Small models cannot decompose topics or write coherent reports
7. **Heavy infrastructure**: DynamicTopicQueue, CitationManager, Note Agent sidecar

### What to Keep If Trimming

- **The citation system** is genuinely useful and could be ported to `chat` for RAG citations
- **Topic decomposition** (Phase 2) is a pattern worth preserving for complex questions
- **The rephrase loop** (Phase 1) is elegant but `ask_user` in `chat` does the same

### Cost

- **Minimum 10 LLM calls** (simple 3-block research)
- **Typical 20-30 LLM calls** (5 blocks × 3-4 iterations + report phases)
- Multiple tool executions per block (web_search, paper_search, rag)
- Note summarizer sidecar (1 call per tool result)
- Large context windows needed for report sections (6000 tokens)
- Two HTTP round-trips (outline preview → confirm → research)

### Verdict: **DEFER** — valuable for advanced students but too heavy for core product, gate behind feature flag

---

## Trimming Strategy

### Priority Order for Removal

| Priority | Capability | Action | Savings |
| --- | --- | --- | --- |
| 1 | `auto` | **Remove entirely** | 3-7 LLM calls/turn + routing complexity |
| 2 | `math_animator` | **Remove entirely** | 4-6 calls + 100MB deps + render time |
| 3 | `visualize` | **Simplify** → inline SVG/Mermaid in chat | 3 calls + review agent |
| 4 | `deep_research` | **Feature-flag** → available only on demand | 15-30 calls + infra |

### Minimal Configuration

To run DeepTutor with only necessary capabilities:

```python
# deeptutor/runtime/bootstrap/builtin_capabilities.py
BUILTIN_CAPABILITY_CLASSES: dict[str, str] = {
    "chat": "deeptutor.capabilities.chat:ChatCapability",
    "deep_solve": "deeptutor.capabilities.deep_solve:DeepSolveCapability",
    "deep_question": "deeptutor.capabilities.deep_question:DeepQuestionCapability",
    # REMOVED: "auto", "visualize", "math_animator", "deep_research"
}
```

### Impact Assessment

| What Breaks | Mitigation |
| --- | --- |
| No auto-routing | Users manually pick mode (already the common path) |
| No Manim animations | Chat's `code_execution` generates matplotlib plots |
| No Chart.js/HTML viz | Chat can emit Mermaid in markdown; SVG via code_execution |
| No deep research | Chat + web_search + paper_search covers basic research |
| No citation management | RAG sources still appear in chat; just no numbered anchors |
| No outline preview UX | Not needed for simple research queries |

### For Small Models (2B-4B): Remove ALL Optional

```python
BUILTIN_CAPABILITY_CLASSES = {
    "chat": "deeptutor.capabilities.chat:ChatCapability",
    # Even deep_solve and deep_question require 7B+ for reliable label adherence
}
```

For 2B/4B models, even the "necessary" capabilities should be simplified:

- `chat` with single-tool (rag only) or no tools
- No deep modes at all
- Single-shot responses without agentic loops

### Dependency Reduction

| Capability Removed | Dependencies Saved |
| --- | --- |
| `math_animator` | `manim`, `latex`, `ffmpeg`, `cairo` (~100MB) |
| `deep_research` | No external deps, but large prompt YAML files |
| `visualize` | No external deps (Manim path shares with math_animator) |
| `auto` | No external deps, but complex delegation module |

### Code Footprint

| Capability | Files | Lines (approx) |
| --- | --- | --- |
| `auto` | `agents/auto/` (5 files) | ~800 |
| `visualize` | `agents/visualize/` (6 files) + capability | ~1200 |
| `math_animator` | `agents/math_animator/` (8 files) + capability | ~1500 |
| `deep_research` | `agents/research/` (10+ files) + capability | ~2500 |
| **Total removable** | | **~6000 lines** |

Removing all optional capabilities eliminates ~6000 lines of code and significantly simplifies the system's cognitive load for contributors and for the LLM models that must adhere to its protocols.
