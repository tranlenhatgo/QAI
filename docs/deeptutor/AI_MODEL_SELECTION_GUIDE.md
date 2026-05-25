# DeepTutor — AI Model Selection & Simplified Study Coach Guide

A practical guide for choosing an AI model and trimming DeepTutor into a lightweight AI Study Coach.

---

## Table of Contents

1. [Model Selection Matrix](#model-selection-matrix)
2. [Provider Comparison](#provider-comparison)
3. [Architecture Requirements per Model Tier](#architecture-requirements-per-model-tier)
4. [Simplified AI Study Coach Blueprint](#simplified-ai-study-coach-blueprint)
5. [What to Remove at Each Tier](#what-to-remove-at-each-tier)
6. [Minimal Viable Configuration](#minimal-viable-configuration)
7. [Implementation Roadmap](#implementation-roadmap)

---

## Model Selection Matrix

### Critical Capabilities Required by DeepTutor

| Capability | Why Needed | Impact if Missing |
| --------- | --------- | ----------------- |
| **Function/Tool Calling** | LLM invokes tools (rag, web_search, etc.) | Falls back to text-based label protocol (less reliable) |
| **Label Protocol Adherence** | First-line labels (FINISH/TOOL/THINK) drive the loop | Loop breaks, infinite iterations, garbled output |
| **JSON Output Compliance** | Plan steps, quiz questions, research outlines | Parse failures → repair attempts → eventual failure |
| **Context Window (8K+ tokens)** | System prompt + history + tool results | Truncated context → incoherent responses |
| **Instruction Following** | Complex system prompts with multi-rule constraints | Ignores constraints → wrong tool calls, bad format |
| **Streaming Support** | Real-time token delivery to UI | Blocks until full response (poor UX, not broken) |

### Model Tier Classification

| Tier | Parameters | Context | Examples | DeepTutor Compatibility |
| ---- | --------- | ------- | -------- | ---------------------- |
| **Micro** | 1-3B | 2-4K | Gemma-2B, Phi-2, Qwen2-1.5B, TinyLlama | ❌ Chat-only, no tools, no agentic |
| **Small** | 3-8B | 4-8K | Phi-3-mini (3.8B), Gemma-2-2B-IT, Llama-3.2-3B, Qwen2.5-3B | ⚠️ Single tool (RAG), simplified protocol |
| **Medium** | 7-14B | 8-32K | Llama-3.1-8B, Mistral-7B, Qwen2.5-7B, Gemma-2-9B | ✅ Basic agentic (2-3 tools, chat + basic solve) |
| **Large** | 14-70B | 32-128K | Llama-3.1-70B, Qwen2.5-72B, Mixtral-8x7B, DeepSeek-V2 | ✅ Full agentic (all tools, all capabilities) |
| **Frontier** | 100B+ / MoE | 128K+ | GPT-4o, Claude-4, Gemini-2, DeepSeek-V3 | ✅✅ Full agentic + deep research |

### Detailed Compatibility Table

| Feature | Micro (1-3B) | Small (3-8B) | Medium (7-14B) | Large (14-70B) | Frontier |
| ------- | :---: | :---: | :---: | :---: | :---: |
| Basic chat (no tools) | ✅ | ✅ | ✅ | ✅ | ✅ |
| RAG (server-injected) | ✅ | ✅ | ✅ | ✅ | ✅ |
| RAG (via tool_call) | ❌ | ⚠️ | ✅ | ✅ | ✅ |
| 2-label protocol (ANSWER/TOOL) | ❌ | ⚠️ | ✅ | ✅ | ✅ |
| 4-label protocol (FINISH/TOOL/THINK/PAUSE) | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| Multi-tool parallel dispatch | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| ask_user structured output | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| JSON plan generation | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| REPLAN back-edge (deep_solve) | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Quiz JSON strict output | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| Deep Research (multi-agent) | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Code generation (code_execution) | ❌ | ⚠️ | ✅ | ✅ | ✅ |
| Vision (geogebra_analysis) | ❌ | ❌ | ❌ | ⚠️ | ✅ |

---

## Provider Comparison

### Cloud Providers (Recommended for Full Features)

| Provider | Binding | Tools Support | Vision | Best Models | Cost |
| -------- | ------- | :---: | :---: | ----------- | ---- |
| **OpenAI** | `openai` | ✅ | ✅ | GPT-4o, GPT-4o-mini | $$$ |
| **Anthropic** | `anthropic` | ✅ | ✅ | Claude-4-Sonnet | $$$ |
| **DeepSeek** | `deepseek` | ✅ | ❌ | DeepSeek-V3, DeepSeek-R1 | $ |
| **Groq** | `groq` | ✅ | ✅ | Llama-3.1-70B (fast) | $$ |
| **Together AI** | `together` | ✅ | ✅ | Llama-3.1-70B, Qwen | $$ |
| **OpenRouter** | `openrouter` | ✅ | ✅ | Any model (aggregator) | Varies |
| **Mistral** | `mistral` | ✅ | ✅ | Mistral-Large | $$ |
| **Moonshot** | `moonshot` | ✅ | Per-model | Kimi-K2.5/K2.6 | $$ |
| **MiniMax** | `minimax` | ✅ | ❌ | MiniMax-M series | $ |

### Local Providers (Budget / Privacy)

| Provider | Binding | Tools Support | Best For | Setup |
| -------- | ------- | :---: | -------- | ----- |
| **Ollama** | `ollama` | ❌ | Easy local setup, many models | `ollama pull model` |
| **LM Studio** | `lm_studio` | ❌ | GUI-based, user-friendly | Desktop app |
| **vLLM** | `vllm` | ❌ | High-throughput serving | GPU server |
| **llama.cpp** | `llama_cpp` | ❌ | Minimal deps, CPU inference | Single binary |

**Important**: All local providers are marked `supports_tools: False`. The system uses the **label-based text protocol** instead of native function calling. This means the LLM must reliably emit `` `FINISH` `` / `` `TOOL` `` as text — which small models often fail at.

### Recommended Model for Each Use Case

| Use Case | Recommended Model | Provider | Monthly Cost (est.) |
| -------- | ---------------- | -------- | ----------------- |
| **Full DeepTutor (all capabilities)** | GPT-4o / Claude-4-Sonnet | OpenAI / Anthropic | $50-200 |
| **Budget full features** | DeepSeek-V3 | DeepSeek | $10-30 |
| **Fast inference (Groq)** | Llama-3.1-70B | Groq | $20-60 |
| **Simple Study Coach (cloud)** | GPT-4o-mini / DeepSeek-V3 | OpenAI / DeepSeek | $5-15 |
| **Simple Study Coach (local)** | Qwen2.5-7B / Llama-3.1-8B | Ollama | $0 (+ hardware) |
| **Absolute minimum (local)** | Phi-3-mini (3.8B) | Ollama / LM Studio | $0 |

---

## Architecture Requirements per Model Tier

### Micro Models (1-3B) — "Barely Useful"

```text
┌─────────────────────────────────────────┐
│ CAPABILITIES: chat (no tools)            │
│ TOOLS: none                              │
│ PROTOCOL: none (single-shot response)    │
│ MAX_ITERATIONS: 1                        │
│ SYSTEM PROMPT: < 200 tokens              │
└─────────────────────────────────────────┘
```

**Architecture**: Strip the agentic loop entirely. Inject RAG results server-side before calling the LLM:

```python
# Simplified flow for micro models:
rag_context = await rag_search(user_query, kb_name)
system_prompt = f"You are a study coach. Use this context:\n{rag_context}"
response = await llm.complete(user_message, system_prompt=system_prompt)
# No parsing, no labels, no tools — just emit the response
await stream.content(response, source="chat")
```

**What works**: Basic Q&A with RAG context pre-injected. No agency.

### Small Models (3-8B) — "Basic Study Coach"

```text
┌─────────────────────────────────────────┐
│ CAPABILITIES: chat (simplified)          │
│ TOOLS: [rag] (single tool only)          │
│ PROTOCOL: 2-label (ANSWER / TOOL)        │
│ MAX_ITERATIONS: 2-3                      │
│ SYSTEM PROMPT: < 500 tokens              │
│ CONTEXT WINDOW: 4096-8192                │
└─────────────────────────────────────────┘
```

**Architecture**: Simplified agentic loop with binary protocol:

```python
_SMALL_MODEL_PROTOCOL = LabelProtocol(
    allowed=("ANSWER", "TOOL"),
    terminal=frozenset({"ANSWER"}),
    intermediate=frozenset(),
    final=frozenset({"ANSWER"}),
    tool_label="TOOL",
)
```

The LLM either answers directly or calls one tool (RAG), then answers.

### Medium Models (7-14B) — "Capable Study Coach"

```text
┌─────────────────────────────────────────┐
│ CAPABILITIES: chat, deep_solve (basic)   │
│ TOOLS: [rag, web_search, code_execution] │
│ PROTOCOL: 3-label (FINISH/TOOL/THINK)    │
│ MAX_ITERATIONS: 5-8                      │
│ SYSTEM PROMPT: < 1500 tokens             │
│ CONTEXT WINDOW: 8192-32768              │
└─────────────────────────────────────────┘
```

**Architecture**: Standard agentic loop but with reduced tool palette and shorter iteration budget. Deep_solve with no REPLAN (forward-only).

### Large Models (14-70B) — "Full Tutor"

```text
┌─────────────────────────────────────────┐
│ CAPABILITIES: all core (chat, solve, quiz)│
│ TOOLS: all 14 built-in                    │
│ PROTOCOL: full 4-label                    │
│ MAX_ITERATIONS: 20                        │
│ CONTEXT WINDOW: 32K-128K                 │
└─────────────────────────────────────────┘
```

**Architecture**: Full DeepTutor as designed. Optional capabilities (auto, visualize, research) become viable.

---

## Simplified AI Study Coach Blueprint

### Goal

Strip DeepTutor to its essentials for a simple, fast, low-cost AI Study Coach that works with 7B-14B local/cloud models.

### What a Study Coach NEEDS

| Feature | How It Maps to DeepTutor |
| ------- | ----------------------- |
| Answer questions about study material | `chat` capability + `rag` tool |
| Explain concepts when asked | `chat` capability (no special tool needed) |
| Quiz the student | `deep_question` capability (simplified) |
| Show problem-solving steps | `deep_solve` capability (simplified) |
| Remember student preferences | `read_memory` + `write_memory` tools |
| Search for current info | `web_search` tool |

### What a Study Coach DOESN'T NEED

| Feature | Why Remove |
| ------- | --------- |
| Auto-routing between capabilities | Users select mode explicitly |
| Math animations (Manim) | Overkill — text + code_execution plots suffice |
| Multi-format visualization (6 types) | SVG/Mermaid can be done inline in chat |
| Deep Research (30-call pipeline) | Chat + web_search covers 90% of cases |
| GeoGebra vision pipeline | Niche geometry use case |
| Paper search (arXiv) | Specialized academic tool |
| GitHub integration | Not relevant for studying |
| Notebook save/list | Can be external (notes app) |
| ask_user mid-turn pause | Complex UX, unnecessary for simple coach |
| Source manifest reading | Simplify to direct RAG |

---

## What to Remove at Each Tier

### Tier 1: Remove Optional Capabilities (~6000 lines saved)

```python
# REMOVE from builtin_capabilities.py:
# "auto"           — router agent (3-7 LLM calls wasted)
# "math_animator"  — Manim dependency (100MB + render time)
# "visualize"      — multi-format viz (3 LLM calls per diagram)
# "deep_research"  — heavy pipeline (15-30 LLM calls)

BUILTIN_CAPABILITY_CLASSES = {
    "chat": "deeptutor.capabilities.chat:ChatCapability",
    "deep_solve": "deeptutor.capabilities.deep_solve:DeepSolveCapability",
    "deep_question": "deeptutor.capabilities.deep_question:DeepQuestionCapability",
}
```

**Impact**: Core learning loop intact. Saves 6000 lines + optional deps.

### Tier 2: Remove Optional Tools (~4000 lines saved)

```python
# REMOVE from BUILTIN_TOOL_TYPES:
# GeoGebraAnalysisTool    — vision pipeline, needs vision model
# PaperSearchToolWrapper  — arXiv API, academic niche
# GithubTool              — developer tool, not for studying
# ListNotebookTool        — external notes app covers this
# WriteNoteTool           — external notes app covers this
# WebFetchTool            — web_search already finds+summarizes

BUILTIN_TOOL_TYPES = (
    BrainstormTool,       # Keep: helps explore study topics
    RAGTool,              # Keep: core KB retrieval
    WebSearchTool,        # Keep: current info lookup
    CodeExecutionTool,    # Keep: verify calculations
    ReasonTool,           # Keep: deep thinking for solve steps
    ReadMemoryTool,       # Keep: personalization
    WriteMemoryTool,      # Keep: preference persistence
    AskUserTool,          # Keep: clarification (or remove for small models)
)
```

**Reduced tool set: 8 tools** (down from 14). Simpler system prompts, less confusion for smaller models.

### Tier 3: Simplify Remaining Capabilities

#### Simplified Chat (for 7B models)

```python
# Reduce label protocol
_SIMPLE_CHAT_PROTOCOL = LabelProtocol(
    allowed=("FINISH", "TOOL", "THINK"),
    terminal=frozenset({"FINISH"}),
    intermediate=frozenset({"THINK"}),
    final=frozenset({"FINISH"}),
    tool_label="TOOL",
)

# Reduce iterations
DEFAULT_MAX_ITERATIONS = 8  # Down from 20

# Remove PAUSE label (visible reasoning) — unnecessary complexity
# Remove ask_user tool for models < 14B
```

#### Simplified Deep Solve (for 7B models)

```python
# Remove REPLAN back-edge
_SIMPLE_SOLVE_STEP = LabelProtocol(
    allowed=("THINK", "TOOL", "FINISH"),
    terminal=frozenset({"FINISH"}),
    intermediate=frozenset({"THINK"}),
    final=frozenset({"FINISH"}),
    tool_label="TOOL",
)

# Remove Phase 0 (pre-retrieve) — inject RAG server-side instead
# Remove explain judge (post-step elaboration check)
# Reduce max_iterations_per_step: 7 → 4
# Reduce max_replans: 2 → 0 (no replanning)
```

#### Simplified Deep Question (for 7B models)

```python
# Remove mimic mode (PDF parsing + MinerU dependency)
# Remove followup mode (single-call is fine without it)
# Simplify to: explore → plan → generate (no repair loop)
# Reduce question types: only choice + short_answer
# Reduce max questions per turn: 5 → 3
# Remove tool_summarizer sidecar (saves 1 LLM call per tool result)
```

### Tier 4: Absolute Minimum (for 3-8B local models)

```python
# Single capability, no tools, no agentic loop
BUILTIN_CAPABILITY_CLASSES = {
    "chat": "deeptutor.capabilities.simple_chat:SimpleChatCapability",
}
BUILTIN_TOOL_TYPES = ()  # No tools at all

# SimpleChatCapability: single LLM call with server-side RAG injection
class SimpleChatCapability(BaseCapability):
    manifest = CapabilityManifest(name="chat", stages=["responding"], tools_used=[])

    async def run(self, context, stream):
        # Server-side RAG (no tool calling)
        rag_context = ""
        if context.knowledge_bases:
            rag_context = await self._retrieve(context)

        system = f"You are a study coach.\n\nRelevant material:\n{rag_context}"
        response = await complete(context.user_message, system_prompt=system)
        await stream.content(response, source="chat")
        await emit_capability_result(stream, {"response": response}, source="chat")
```

---

## Minimal Viable Configuration

### Config for "Simple AI Study Coach" (7B model, local)

```yaml
# main.yaml
llm:
  provider: ollama
  model: qwen2.5-7b-instruct
  base_url: http://localhost:11434/v1
  context_window: 8192
  max_tokens: 2048
  temperature: 0.7

capabilities:
  enabled: [chat, deep_solve, deep_question]
  chat:
    max_iterations: 8
    label_protocol: simple  # FINISH/TOOL/THINK only
  solve:
    max_iterations_per_step: 4
    max_replans: 0
  question:
    max_explore_iterations: 4
    max_quiz_iterations: 3
    question_types: [choice, short_answer]

tools:
  enabled: [rag, web_search, code_execution, reason, read_memory, write_memory]
  # Disabled: geogebra, paper_search, github, notebook, web_fetch, ask_user
```

### Config for "Budget Cloud Study Coach" (DeepSeek-V3)

```yaml
llm:
  provider: deepseek
  model: deepseek-chat
  context_window: 64000
  max_tokens: 4096
  temperature: 0.7

capabilities:
  enabled: [chat, deep_solve, deep_question]
  chat:
    max_iterations: 12
  solve:
    max_iterations_per_step: 5
    max_replans: 1

tools:
  enabled: [rag, web_search, code_execution, reason, brainstorm, 
            read_memory, write_memory, ask_user]
```

### Config for "Full Tutor" (GPT-4o / Claude-4)

```yaml
llm:
  provider: openai
  model: gpt-4o
  context_window: 128000
  max_tokens: 4096

capabilities:
  enabled: [chat, deep_solve, deep_question, deep_research, visualize]
  # auto and math_animator still optional even at this tier

tools:
  enabled: all
```

---

## Implementation Roadmap

### Phase 1: Feature Flags (Zero Code Removal)

Add configuration-driven capability/tool gating without deleting code:

```python
# In CapabilityRegistry.load_builtins():
enabled = config.get("capabilities.enabled", list(BUILTIN_CAPABILITY_CLASSES.keys()))
for name, path in BUILTIN_CAPABILITY_CLASSES.items():
    if name not in enabled:
        continue
    # ... register

# In ToolRegistry.load_builtins():
enabled_tools = config.get("tools.enabled", "all")
for tool_type in BUILTIN_TOOL_TYPES:
    tool = tool_type()
    if enabled_tools != "all" and tool.name not in enabled_tools:
        continue
    self.register(tool)
```

**Benefit**: Same codebase serves all tiers. Configuration selects the profile.

### Phase 2: Model-Aware Presets

Auto-detect model tier and apply appropriate constraints:

```python
def get_model_preset(model: str, binding: str) -> dict:
    """Return configuration preset based on detected model size."""
    if is_micro_model(model):
        return PRESET_MICRO
    elif is_small_model(model):
        return PRESET_SMALL
    elif is_medium_model(model):
        return PRESET_MEDIUM
    else:
        return PRESET_FULL
```

### Phase 3: SimpleChatCapability (for ≤ 8B)

Create a new lightweight capability that bypasses the agentic loop:

```text
deeptutor/capabilities/simple_chat.py  (~100 lines)
```

Single LLM call with server-side RAG. No tools, no labels, no loop.

### Phase 4: Simplified Protocol Mode

Add a "simple protocol" that uses 2-3 labels instead of 4:

```text
deeptutor/core/agentic/simple_protocol.py  (~50 lines)
```

Binary ANSWER/TOOL for small models. Fewer parse failures.

---

## Decision Flowchart

```text
                    ┌──────────────────────────┐
                    │  What's your budget?      │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ↓                         ↓
              $0 (local)               $5-200/mo (cloud)
                    │                         │
         ┌──────────┴──────────┐    ┌────────┴────────┐
         ↓                     ↓    ↓                  ↓
    CPU Only              GPU Avail  Budget ($5-30)    Full ($50+)
         │                     │         │                  │
         ↓                     ↓         ↓                  ↓
    Phi-3-mini          Qwen2.5-7B   DeepSeek-V3      GPT-4o/Claude-4
    (Tier: Micro)       (Tier: Med)  (Tier: Large)    (Tier: Frontier)
         │                     │         │                  │
         ↓                     ↓         ↓                  ↓
    SimpleChatOnly      SimpleCoach  Full Core          All Features
    No tools            3 tools      3 caps + 8 tools   7 caps + 14 tools
    No agentic          3 labels     4 labels           Full protocol
```

---

## Summary: Recommended Stack for "Simple AI Study Coach"

| Component | Choice | Rationale |
| --------- | ------ | --------- |
| **Model** | Qwen2.5-7B-Instruct (local) or DeepSeek-V3 (cloud) | Best quality/cost at 7B tier; DeepSeek best budget cloud |
| **Provider** | Ollama (local) or DeepSeek API (cloud) | Zero cost / $10-30/mo |
| **Capabilities** | chat + deep_solve + deep_question | Core teach-assess-solve loop |
| **Tools** | rag + web_search + code_execution + reason + memory | Essential 6 tools |
| **Protocol** | FINISH / TOOL / THINK (3-label) | Reliable at 7B without PAUSE |
| **Max Iterations** | 8 (chat), 4 (solve steps), 3 (quiz) | Fast responses, less drift |
| **Remove** | auto, visualize, math_animator, deep_research, geogebra, paper_search, github, notebook tools | Non-essential for studying |
| **Context Window** | 8K (local) or 64K (DeepSeek cloud) | Adequate for study sessions |

This configuration delivers 80% of DeepTutor's educational value at 20% of the complexity and cost.
