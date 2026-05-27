# AutoTest Guide Agent

## Purpose

Automated end-to-end testing of QAI platform AI features using **Playwright MCP** (Microsoft Playwright browser automation). Tests all AI-powered features from the user/UI perspective to detect conflicts, regressions, and integration problems across the 3-service architecture.

## Architecture

```text
AutoTest Agent (Playwright MCP)
  → Browser automation against running services
  → Frontend (localhost:3000) — UI interactions
  → Validates AI Coach responses (WebSocket streaming)
  → Validates Spring Boot data persistence (via UI state changes)
  → Captures screenshots as evidence

Prerequisites:
  - Frontend running on :3000
  - Spring Boot running on :8080
  - AI Study Coach running on :8000
  - LM Studio running on :1234 (Lite tier) OR DeepSeek API key configured (Full tier)
```

## Test Organization

| File | Scope | Tests |
| --- | --- | --- |
| `tests/01-quiz-creation.md` | Quiz CRUD | Create quiz with single category, validation errors |
| `tests/02-quiz-play.md` | Quiz gameplay | Play generated quiz, answer questions, see results |
| `tests/03-quiz-browser.md` | Browse/filter | Category dropdown filter, text search, select quiz |
| `tests/04-ai-chat.md` | AI Coach Chat | WebSocket chat, Lite/Full tiers, Simple/Agentic modes |
| `tests/05-ai-generation.md` | Question generation | From topics, from file upload, single question |
| `tests/06-ai-solver.md` | Step solver | Submit problem, receive steps |
| `tests/07-spaced-repetition.md` | SR cycle | Due reviews display, review quiz, schedule update |
| `tests/08-progress-tracking.md` | Progress | Mastery bars, weakness cards, score trends |
| `tests/09-notifications.md` | Notifications | Bell badge, dismiss, mark read |
| `tests/10-cross-service.md` | Integration | Quiz completion → webhook → SR → notification cycle |

## Running Tests

**MANDATORY**: Before executing any test suite, the agent MUST first read the relevant source code and documentation as specified in [`PRE-TEST-READING.md`](PRE-TEST-READING.md). This ensures tests validate against the **intended behavior** (from code) rather than assumed behavior. The agent compares what the code says SHOULD happen vs what ACTUALLY happens in the browser.

Tests are executed via Playwright MCP commands in VS Code Copilot Chat. Each test file contains step-by-step instructions that the agent follows using browser automation.

```text
# Execute a single test suite (agent reads code first, then tests)
@agent AutoTest: Run tests/04-ai-chat.md

# Execute all tests
@agent AutoTest: Run all test suites in order

# Execute with screenshot evidence
@agent AutoTest: Run tests/01-quiz-creation.md with screenshots
```

## Conventions

- **UI-driven navigation**: The agent navigates ONLY by clicking UI elements (buttons, links, tabs, icons). Direct URL navigation (`browser_navigate`) is used ONLY ONCE at session start (`http://localhost:3000`). All subsequent page changes happen through user-like interactions (click "Create" button, click profile icon, click "AI Coach" button, click logo to go home, etc.)
- Each test case has: **Preconditions**, **Steps**, **Expected Results**, **Evidence** (screenshot)
- Test data uses prefix `[AUTOTEST]` in titles to identify test artifacts
- Tests are idempotent — clean up created data after each suite
- Timeout: 30s per LLM response, 10s per UI interaction
- On failure: capture screenshot + DOM snapshot + console errors

## Service URLs (configurable)

| Service | Default URL | Env Var |
| --- | --- | --- |
| Frontend | `http://localhost:3000` | `AUTOTEST_FRONTEND_URL` |
| Spring Boot | `http://localhost:8080` | `AUTOTEST_BACKEND_URL` |
| AI Study Coach | `http://localhost:8000` | `AUTOTEST_COACH_URL` |
