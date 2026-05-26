# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. AGENT.md Protocol

**Read AGENT.md files before working. Update them after major changes.**

Each folder in this project may contain an `AGENT.md` file describing the purpose, structure, and conventions of that folder. These files are the map of the codebase.

Before starting any task:
- Read `AGENT.md` at the project root (if it exists).
- Read every `AGENT.md` in subdirectories relevant to the task.
- If no `AGENT.md` exists in the area you're working in, note what you learned while working there — you may be asked to create one.

After completing a major change:
- Ask yourself: "Would someone working in this folder next week need to know what I just did?"
- If yes, update the nearest `AGENT.md` (or create one) with:
  - The folder's purpose and what belongs there.
  - Key files and their roles.
  - Any conventions or patterns introduced.
  - Cross-folder dependencies (what this folder consumes, what consumes it).
- Keep entries concise — a few bullets, not essays.
- Remove outdated information that no longer reflects reality.

## 5. CodeGraph Usage

**Use CodeGraph for non-trivial codebase questions and edits.**

Before changing code:
- Use CodeGraph to find relevant files, symbols, callers, routes, and dependencies.
- Prefer CodeGraph over manual grep when tracing flows across components.
- For simple single-file edits, CodeGraph is optional.

After changing files:
- Run `codegraph sync .` if the index may be stale.

## 6. Firestore MCP Usage

**AI agents can use the local `firestore-mcp` server for QAI Firestore CRUD.**

This project includes a Python MCP server in `firestore-mcp/` that exposes direct Firestore tools for the allowed QAI collections:
- `quiz`
- `question`
- `take_quiz`
- `take_question`
- `review_schedule`
- `notification`

Available tools:
- `firestore_list_collections`
- `firestore_get_document`
- `firestore_query_documents`
- `firestore_create_document`
- `firestore_update_document`
- `firestore_delete_document`

Local setup:
- Dependencies are installed in `firestore-mcp/.venv/`.
- VS Code/Copilot workspace config lives at `.vscode/mcp.json`.
- Codex user config can register the same server from `C:\Users\miumu\.codex\config.toml`.
- Default Firebase credential path is `spring-backend/src/main/resources/serviceAccountKey.json`.

Safety rules:
- Treat `firestore-mcp` as direct database access. It bypasses Spring Boot validation.
- Preserve QAI Firestore field names exactly, including snake_case and camelCase fields already used by the schema.
- Prefer read-only tools first when investigating data.
- Use create/update/delete only when the user explicitly asks for database mutation or the task clearly requires it.
- `firestore_delete_document` is a permanent delete. Confirm the target collection and document ID before using it.

Example agent requests:
```text
Use qai-firestore to list the allowed Firestore collections.
Use qai-firestore to query notification where user_id == "abc123", limit 10.
Use qai-firestore to update notification a1b2c3d4 with read=true.
```

## 7. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
