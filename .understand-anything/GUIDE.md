# QAI — Understand-Anything Guide

This document explains how to use the [Understand-Anything](https://github.com/Lum1104/Understand-Anything) knowledge graph for the QAI project.

---

## Quick Start

The knowledge graph is already generated at `.understand-anything/knowledge-graph.json`.

### View the Dashboard

```powershell
Push-Location "$HOME\.understand-anything\repo\understand-anything-plugin\packages\dashboard"
$env:GRAPH_DIR = "c:\codespace\graduation thesis\QAI"
npx vite --host 127.0.0.1
```

Open the URL printed in the terminal (includes a `?token=` parameter).

### Available Commands (in Copilot Chat)

| Command | Purpose |
|---------|---------|
| `/understand` | Re-analyze the codebase (incremental — only re-scans changed files) |
| `/understand-dashboard` | Launch the interactive visual graph |
| `/understand-chat <question>` | Ask questions about the codebase |
| `/understand-diff` | Analyze impact of current git changes |
| `/understand-domain` | Extract business domain flows |
| `/understand-explain <file>` | Deep-dive into a specific file |
| `/understand-onboard` | Generate onboarding guide for new team members |

---

## Knowledge Graph Stats

| Metric | Value |
|--------|-------|
| Total nodes | 1020 |
| Total edges | 1122 |
| Files | 269 |
| Functions | 450 |
| Classes | 175 |
| Documents | 91 |
| Config files | 35 |
| Layers | 12 |
| Tour steps | 10 |

### Edge Types

| Type | Count | Meaning |
|------|-------|---------|
| `contains` | 647 | File → function/class it defines |
| `calls` | 262 | Function/file → function/file it calls |
| `imports` | 209 | File → file it imports from |
| `depends_on` | 3 | Cross-service runtime dependency (HTTP) |
| `triggers` | 1 | Webhook trigger between services |

---

## Architecture Layers

The project is organized into 12 layers:

### Frontend (Next.js + React)

| Layer | Files | Description |
|-------|-------|-------------|
| **Frontend Pages** | 44 | Next.js pages and API routes (`/pages/**`) |
| **Frontend Components** | 57 | React UI components (`/components/**`) |
| **Frontend State & Helpers** | 30 | Zustand stores, auth helpers, utilities |

Key entry: `frontend/src/pages/_app.js` — Firebase auth listener, global dialogs, coach widget mount.

### Spring Boot Backend (Java)

| Layer | Files | Description |
|-------|-------|-------------|
| **Spring Boot API** | 9 | REST controllers (Quiz, Question, TakeQuiz, ReviewSchedule, Notification, User, Subscription, AdaptivePractice) |
| **Spring Boot Services** | 20 | Business logic (QuizService, WebhookService, TakeQuizService, SubscriptionService, AdaptivePracticeService) |
| **Spring Boot Data** | 38 | Models, DTOs, config, Firestore access |

Key entry: `QuizaiSpringApplication.java` — Spring Boot main class.

### AI Study Coach (Python FastAPI)

| Layer | Files | Description |
|-------|-------|-------------|
| **AI Coach API** | 14 | FastAPI routes, WebSocket handler, HTTP endpoints |
| **AI Coach Agent** | 33 | Agentic loop, capabilities, LLM client, tools |
| **AI Coach Learning** | 6 | SM-2 spaced repetition, progress tracking, scheduler |

Key entry: `ai-study-coach/server/main.py` — FastAPI app with CORS, routes, background scheduler.

### Supporting

| Layer | Files | Description |
|-------|-------|-------------|
| **Documentation** | 96 | READMEs, SDDs, guides, agent rules, thesis material |
| **Configuration** | 35 | package.json, pom.xml, requirements.txt, .properties, generated graph metadata |
| **Testing** | 13 | Unit tests, manual test specs, and E2E documentation |

---

## Guided Tour (10 Steps)

Follow this order to understand the codebase:

1. **Project Overview** — `README.md`, `GUIDE.md`
2. **Frontend Entry Point** — `_app.js` (auth, dialogs, widget)
3. **Quiz Gameplay Flow** — `/play`, Questions component, QuestionSlider
4. **State Management** — `useBoundStore`, `useAuth`, `useQuestions`
5. **Spring Boot API Layer** — Controllers (Quiz, Question, TakeQuiz, ReviewSchedule)
6. **Spring Boot Services** — QuizService, WebhookService, TakeQuizService
7. **AI Coach WebSocket Chat** — `main.py`, `router.py`
8. **AI Coach Agent & Capabilities** — `coach.py`, `agentic.py`, `lite_orchestrator.py`
9. **AI Coach Learning Algorithms** — `spaced_repetition.py`, `progress.py`, scheduler
10. **Integration: Webhook & Notifications** — WebhookService → AI Coach → notifications

---

## Cross-Service Integration

```
Frontend ──imports──→ BFF API Routes ──depends_on──→ Spring Boot Controllers
                                                          │
                                                     triggers (webhook)
                                                          │
                                                          ▼
                                                    AI Coach Routes
                                                          │
                                                     depends_on
                                                          │
                                                          ▼
                                                 Spring Boot (review-schedule)
```

Key integration edges in the graph:
- `frontend/src/pages/api/quiz/list-all.js` → `QuizController.java` (depends_on)
- `WebhookService.java` → `ai-study-coach/server/routes/webhook.py` (triggers)
- `ai-study-coach/server/learning/spaced_repetition.py` → `ReviewScheduleController.java` (depends_on)

---

## Dashboard Guidelines

### Launching

```powershell
Push-Location "$HOME\.understand-anything\repo\understand-anything-plugin\packages\dashboard"
$env:GRAPH_DIR = "c:\codespace\graduation thesis\QAI"
npx vite --host 127.0.0.1
```

The dashboard opens at `http://127.0.0.1:5173/?token=<generated-token>`. Keep the terminal running.

### Navigation

| Panel | What it shows | How to use |
|-------|--------------|------------|
| **Graph View** | Force-directed node graph | Click nodes to select, drag to move, scroll to zoom |
| **Layers** | 12 architectural layers | Click a layer to filter the graph to only those nodes |
| **Tour** | 10-step guided walkthrough | Click "Next" to walk through the codebase in logical order |
| **Search** | Find any node by name | Type file/function/class names to locate them |
| **Details** | Selected node info | Shows summary, tags, complexity, connected edges |

### Reading the Graph

**Node colors by type:**
- 🟦 Blue = Files (`.js`, `.py`, `.java`)
- 🟩 Green = Functions/Methods
- 🟨 Yellow = Classes
- 🟪 Purple = Documents (`.md`)
- ⬜ Gray = Config files

**Edge meanings:**
| Edge | Line style | What it means |
|------|-----------|---------------|
| `contains` | Solid, thick | File defines this function/class |
| `exports` | Solid, thin | File publicly exposes this symbol |
| `imports` | Dashed | File imports from another file |
| `calls` | Solid, medium | Function/file calls another function/file |
| `depends_on` | Dotted, red | Cross-service runtime dependency (HTTP) |
| `triggers` | Dotted, orange | Webhook trigger between services |
| `configures` | Dotted, blue | Config file controls this module |
| `tested_by` | Dotted, green | Production code tested by this file |
| `documents` | Dotted, gray | Doc describes this code |

### Tips

1. **Start with Layers** — Click a layer (e.g., "AI Coach API") to see only that subsystem
2. **Follow `calls` edges** — These show the actual execution flow
3. **Find cross-service connections** — Look for `depends_on` and `triggers` edges (red/orange dotted lines)
4. **Use the Tour** — Best for first-time exploration; it walks you through all 3 services in logical order
5. **Click a node, then "Show connections"** — Reveals all incoming/outgoing edges for that node
6. **Filter by edge type** — If the graph is too dense, hide `contains` and `exports` to see only meaningful relationships
7. **Search for patterns** — Type "Controller" to see all Spring Boot controllers, "use" to find all Zustand stores

### Troubleshooting

| Issue | Fix |
|-------|-----|
| Dashboard shows "No graph found" | Check `GRAPH_DIR` env var points to the QAI root (not `.understand-anything/`) |
| "264 auto-corrections" warning | Run `/understand` to regenerate — edges need `direction` and `weight` fields |
| Graph too dense/slow | Click a Layer to filter, or hide `contains`/`exports` edges |
| Node has no summary | Run `/understand` to re-analyze — that file hasn't been processed yet |
| Changes not showing | Run `/understand` then refresh the browser |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+F` | Focus search box |
| `Escape` | Deselect current node |
| `+` / `-` | Zoom in/out |
| `Space` | Toggle physics simulation (freeze/unfreeze) |

---

## Updating the Graph

After making code changes:

```powershell
# In Copilot Chat, type:
/understand
```

This runs incrementally — only files changed since the last commit are re-analyzed. The dashboard auto-reloads.

### Force Full Rebuild

```
/understand --full
```

### Check Impact of Changes

```
/understand-diff
```

---

## File Structure

```
.understand-anything/
├── knowledge-graph.json    # Main graph (commit this for team sharing)
├── meta.json               # Last analysis metadata
├── config.json             # Settings (autoUpdate, language)
├── intermediate/           # Build artifacts (gitignore these)
│   ├── scan-result.json
│   ├── batches.json
│   ├── assembled-graph.json
│   ├── layers.json
│   ├── tour.json
│   └── batch-*.json
└── tmp/                    # Temp files (gitignore these)
```

### What to Commit

Commit `.understand-anything/knowledge-graph.json`, `.understand-anything/meta.json`, and `.understand-anything/fingerprints.json` so team members can view the graph without re-running analysis and future incremental updates have a structural baseline.

Add to `.gitignore`:
```
.understand-anything/intermediate/
.understand-anything/tmp/
```

---

## Prerequisites

- **Node.js** ≥ 22 (for tree-sitter parsing)
- **pnpm** (installed globally: `npm i -g pnpm`)
- Plugin installed at `~/.understand-anything/repo`
- Skills linked at `~/.copilot/skills/understand*`

### Verify Installation

```powershell
node --version   # v22+
pnpm --version   # 10+
Test-Path "$HOME\.understand-anything\repo\understand-anything-plugin\packages\core\dist\index.js"  # True
```
