# AGENTS.md — AI Agent Rules for SDD Implementation

> Rules and reference material for AI coding agents working on the AI Study Coach project,
> using DeepTutor as the reference implementation.

---

## Quick Reference

| Need | File |
| ------ | ------ |
| How to search/find code in DeepTutor | [agent-rules/01-NAVIGATION.md](./agent-rules/01-NAVIGATION.md) |
| DeepTutor project structure map | [agent-rules/02-DEEPTUTOR-STRUCTURE.md](./agent-rules/02-DEEPTUTOR-STRUCTURE.md) |
| Patterns to replicate from DeepTutor | [agent-rules/03-PATTERNS-TO-FOLLOW.md](./agent-rules/03-PATTERNS-TO-FOLLOW.md) |
| Implementation rules for the Study Coach | [agent-rules/04-IMPLEMENTATION-RULES.md](./agent-rules/04-IMPLEMENTATION-RULES.md) |
| SDD spec ↔ DeepTutor source file mapping | [agent-rules/05-REFERENCE-MAP.md](./agent-rules/05-REFERENCE-MAP.md) |

---

## Core Principles

1. **DeepTutor is reference, not copy-paste** — Study the patterns, understand WHY they work, then implement a simplified version.
2. **SDD specs are the source of truth** — When SDD conflicts with DeepTutor's implementation, follow the SDD.
3. **Simpler is better** — DeepTutor supports 13+ providers, 14 tools, 7 capabilities. The Study Coach has 2 providers, 5 tools, 4 modes.
4. **600-line rule** — No single file should exceed 600 lines. Split into modules if approaching this limit.

---

## Workflow for Implementing an SDD Spec

```text
1. Read the SDD spec file (e.g., 05-AGENTIC-LOOP.md)
2. Check the "DeepTutor Reference" table at the bottom
3. Use agent-rules/05-REFERENCE-MAP.md to find exact source files
4. Read DeepTutor source to understand the implementation approach
5. Implement the SIMPLIFIED version described in the SDD spec
6. Verify against Acceptance Criteria in the spec
```

---

## File Size Rule

**IF any file exceeds 600 lines → split it into a folder with sub-modules.**

Example:

```text
# Instead of one large file:
server/capabilities/agentic.py  (800 lines) ❌

# Split into a package:
server/capabilities/agentic/
├── __init__.py          (exports)
├── capability.py        (main class, run method)
├── tool_executor.py     (tool execution logic)
└── prompts.py           (system prompts)
```
