# Coder — Developer Reference for DeepTutor

> **For**: Developers who understand ML basics and want to know how
> DeepTutor is built — its architecture, tools, capabilities, and provider
> system.  
> **Prerequisite**: Read `../beginner/` first if you're new to ML concepts.

---

## Reading Order

| # | File | What You'll Learn |
| --- | ------ | --- |
| 1 | [ARCHITECTURE_DEEP_DIVE.md](ARCHITECTURE_DEEP_DIVE.md) | Full architecture: layers, registries, orchestrator, streaming |
| 2 | [LEVEL1_TOOLS_DEEP_DIVE.md](LEVEL1_TOOLS_DEEP_DIVE.md) | All 14 Level 1 tools: interface, parameters, execution patterns |
| 3 | [LEVEL2_CORE_CAPABILITIES.md](LEVEL2_CORE_CAPABILITIES.md) | Core capabilities: chat, deep_solve, deep_question |
| 4 | [LEVEL2_OPTIONAL_CAPABILITIES.md](LEVEL2_OPTIONAL_CAPABILITIES.md) | Optional: auto, visualize, math_animator, deep_research |
| 5 | [AI_MODEL_SELECTION_GUIDE.md](AI_MODEL_SELECTION_GUIDE.md) | 13+ providers, model tiers, cost strategy, trimming |

---

## When to Use This Folder

| You want to... | Read |
| --- | --- |
| Understand how messages flow through the system | `ARCHITECTURE_DEEP_DIVE.md` |
| Know what tools the LLM can call | `LEVEL1_TOOLS_DEEP_DIVE.md` |
| Understand deep_solve or deep_question | `LEVEL2_CORE_CAPABILITIES.md` |
| Choose which provider/model to use | `AI_MODEL_SELECTION_GUIDE.md` |
| Build a similar system (your AI Study Coach) | Start here, then read `../SDD/` |

---

## File Summaries

### ARCHITECTURE_DEEP_DIVE.md

Full system architecture: the two-layer plugin model (Tools + Capabilities),
ChatOrchestrator routing, StreamBus event system, entry points (CLI/WS/SDK),
UnifiedContext dataclass, tool dispatch flow, provider abstraction, and
local model feasibility analysis.

### LEVEL1_TOOLS_DEEP_DIVE.md

Exhaustive documentation of all 14 tools: `rag`, `web_search`,
`code_execution`, `reason`, `brainstorm`, `paper_search`,
`geogebra_analysis`, `ask_user`, `write_note`, `list_notebook`,
`github_query`, `web_fetch`, `tex_chunker`, `tex_downloader`.
Includes: BaseTool interface, ToolDefinition schema, ToolResult structure,
prompt hints system, and tool execution lifecycle.

### LEVEL2_CORE_CAPABILITIES.md

The three capabilities you likely need: `chat` (agentic with tool selection),
`deep_solve` (plan → per-step agentic loops → synthesis), `deep_question`
(ideation → evaluation → generation → validation). Includes stage
descriptions, label sets, and pipeline flows.

### LEVEL2_OPTIONAL_CAPABILITIES.md

Capabilities that may be unnecessary for your project: `auto` (auto-select
mode), `visualize` (diagram generation), `math_animator` (Manim video),
`deep_research` (multi-agent report). Includes analysis of when each is
redundant and when it adds value.

### AI_MODEL_SELECTION_GUIDE.md

All 13+ LLM providers DeepTutor supports, categorized by binding type.
Includes: model capabilities matrix (tools support, vision, streaming),
cost comparison, local vs cloud trade-offs, the simplified tier strategy
for your Study Coach (Lite + Full), and provider configuration patterns.

---

## Relationship to Other Folders

```text
beginner/  →  Understand ML concepts (what is RAG? tokens? agentic?)
    ↓
coder/     →  Understand DeepTutor's implementation (you are here)
    ↓
SDD/       →  Specifications for building YOUR AI Study Coach
```
