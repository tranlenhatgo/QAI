# DeepTutor Documentation

> Complete documentation for understanding the DeepTutor project —
> from ML basics to implementation specifications.

---

## Folder Structure

```text
docs/
├── README.md            ← You are here
├── beginner/            ← ML beginner learning materials
│   └── README.md        ← Reading order & summaries
├── coder/               ← Developer reference (assumes ML knowledge)
│   └── README.md        ← File index & purpose
└── SDD/                 ← Software Design Document (AI Study Coach specs)
    └── README.md        ← Implementation guide for the AI coder
```

---

## Who Should Read What?

| You are... | Start with | Then read |
| ------------ | --------- | --------- |
| **ML beginner** — new to AI concepts | `beginner/` folder | `coder/` when ready |
| **Developer** — knows ML, wants to understand DeepTutor | `coder/` folder | `SDD/` for implementation |
| **AI coding agent** — implementing the Study Coach | `SDD/` folder | `coder/` for reference patterns |

---

## Quick Links

### Beginner (ML Fundamentals + DeepTutor Context)

| File | What You'll Learn |
| ------ | --- |
| [beginner/GLOSSARY.md](beginner/GLOSSARY.md) | Every AI/ML term used in this project |
| [beginner/HOW_LLMS_WORK.md](beginner/HOW_LLMS_WORK.md) | How LLMs generate text, tokens, temperature |
| [beginner/RAG_EXPLAINED.md](beginner/RAG_EXPLAINED.md) | How AI reads your documents (the RAG pipeline) |
| [beginner/AGENTIC_AI_EXPLAINED.md](beginner/AGENTIC_AI_EXPLAINED.md) | Why DeepTutor is more than a chatbot |
| [beginner/VISUAL_ARCHITECTURE.md](beginner/VISUAL_ARCHITECTURE.md) | System diagrams — how pieces connect |

### Coder (Developer Deep Dives)

| File | What You'll Learn |
| ------ | --- |
| [coder/ARCHITECTURE_DEEP_DIVE.md](coder/ARCHITECTURE_DEEP_DIVE.md) | Full architecture: layers, flows, design decisions |
| [coder/LEVEL1_TOOLS_DEEP_DIVE.md](coder/LEVEL1_TOOLS_DEEP_DIVE.md) | All 14 tools: interfaces, parameters, execution |
| [coder/LEVEL2_CORE_CAPABILITIES.md](coder/LEVEL2_CORE_CAPABILITIES.md) | Essential capabilities: chat, deep_solve, deep_question |
| [coder/LEVEL2_OPTIONAL_CAPABILITIES.md](coder/LEVEL2_OPTIONAL_CAPABILITIES.md) | Optional capabilities: auto, visualize, research |
| [coder/AI_MODEL_SELECTION_GUIDE.md](coder/AI_MODEL_SELECTION_GUIDE.md) | Providers, tiers, model comparison, cost strategy |

### SDD (Implementation Specs for AI Study Coach)

| File | What You'll Learn |
| ------ | --- |
| [SDD/README.md](SDD/README.md) | Implementation order, tech stack, 4-phase plan |
| [SDD/01-ARCHITECTURE.md](SDD/01-ARCHITECTURE.md) → [SDD/12-TESTING-STRATEGY.md](SDD/12-TESTING-STRATEGY.md) | 12 specification files |
| [SDD/AGENTS.md](SDD/AGENTS.md) | Rules for the AI coding agent |
