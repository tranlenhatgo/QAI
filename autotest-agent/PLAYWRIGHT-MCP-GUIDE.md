# Playwright MCP Execution Guide

## Overview

This guide explains how to execute the test cases using **Playwright MCP** (Model Context Protocol) browser automation tools available in VS Code GitHub Copilot.

## Available Playwright MCP Tools

| Tool | Purpose |
| --- | --- |
| `mcp_microsoft_pla_browser_navigate` | Navigate to a URL |
| `mcp_microsoft_pla_browser_click` | Click an element |
| `mcp_microsoft_pla_browser_fill_form` | Fill form inputs |
| `mcp_microsoft_pla_browser_type` | Type text into focused element |
| `mcp_microsoft_pla_browser_snapshot` | Get accessibility tree (DOM snapshot) |
| `mcp_microsoft_pla_browser_take_screenshot` | Capture screenshot evidence |
| `mcp_microsoft_pla_browser_evaluate` | Run JavaScript in browser context |
| `mcp_microsoft_pla_browser_press_key` | Press keyboard keys |
| `mcp_microsoft_pla_browser_select_option` | Select dropdown option |
| `mcp_microsoft_pla_browser_hover` | Hover over element |
| `mcp_microsoft_pla_browser_wait_for` | Wait for element/condition |
| `mcp_microsoft_pla_browser_network_requests` | Monitor network requests |
| `mcp_microsoft_pla_browser_console_messages` | Read browser console |

## Execution Flow

```text
1. Start all services (Spring Boot, Frontend, AI Coach)
2. Navigate to http://localhost:3000 ONCE (initial entry point only)
3. All subsequent navigation uses UI clicks (buttons, links, tabs)
4. Load test file (e.g., tests/04-ai-chat.md)
5. For each test case:
   a. Execute Preconditions via UI interactions (click buttons to navigate)
   b. Follow Steps using Playwright MCP tools (click, type, select)
   c. After each step: snapshot or screenshot for evidence
   d. Verify Expected Results against DOM state
   e. Record PASS/FAIL with evidence
6. Generate test report
```

**CRITICAL RULE**: Never use `browser_navigate` to go to a specific path (e.g., `/coach`, `/create`) after initial page load. Instead, simulate real user behavior:

- To go to Create page → click the "Create" button on Home
- To go to Coach → click the "AI Coach" button on Home
- To go to Profile → click the profile icon in header
- To go Home → click the logo/brand link
- To switch tabs → click the tab button
- To open modals → click the trigger button

## Login Helper Flow

Most tests require authentication. Execute this ONCE at test session start:

```text
1. browser_navigate → http://localhost:3000 (ONLY direct URL in the entire session)
2. browser_snapshot → find Login/Auth button in header
3. browser_click → Login button (triggers AuthForm modal)
4. browser_snapshot → find email + password fields in modal
5. browser_fill_form → email field
6. browser_fill_form → password field
7. browser_click → Submit/Login button in modal
8. browser_wait_for → modal closes, authenticated UI appears (profile icon visible)
9. browser_snapshot → Verify logged-in state
```

After login, ALL navigation is done by clicking UI elements (buttons, links, tabs).

## Common Patterns

### Verify Element Exists

```text
browser_snapshot → search for element in accessibility tree
```

### Fill and Submit Form

```text
browser_click → input field
browser_type → text content
browser_click → submit button
browser_wait_for → response/navigation
```

### Verify WebSocket Connection

```text
browser_evaluate → `document.querySelector('[data-connection-status]')?.textContent`
```

### Wait for AI Response (Streaming)

```text
browser_wait_for → AI response container not empty (timeout: 30s)
browser_snapshot → Read streamed content
```

### Capture Evidence

```text
browser_take_screenshot → saves to evidence/ folder
```

## Test Report Format

After execution, generate a report:

```markdown
# Test Execution Report — [Date]

## Summary
- Total: X test cases
- Passed: Y
- Failed: Z
- Skipped: W

## Results

| TC ID | Title | Status | Notes |
| --- | --- | --- | --- |
| TC-01-01 | Create Quiz Single Category | PASS | Screenshot: evidence/tc-01-01.png |
| TC-04-02 | Chat Simple Mode | FAIL | Timeout waiting for response |

## Failures Detail
### TC-04-02: Chat Simple Mode
- **Step failed**: Step 4 — Wait for response
- **Expected**: AI response streams within 30s
- **Actual**: No response received (timeout)
- **Evidence**: evidence/tc-04-02-fail.png
- **Possible cause**: LM Studio not running or model not loaded
```

## Environment Checklist

Before running tests, verify:

- [ ] Spring Boot compiles and runs: `cd spring-backend && .\mvnw.cmd spring-boot:run`
- [ ] Frontend starts: `cd frontend && npm run dev`
- [ ] AI Coach starts: `cd ai-study-coach && python -m uvicorn server.main:app --reload --port 8000`
- [ ] LM Studio running with model loaded (Lite tier)
- [ ] OR DeepSeek API key configured in `.env` (Full tier)
- [ ] Firestore credentials configured (`serviceAccountKey.json`)
- [ ] Test user account exists in Firebase Auth

## Timeouts

| Operation | Timeout |
| --- | --- |
| Page navigation | 10s |
| UI interaction (click, type) | 5s |
| API response | 15s |
| LLM generation (short) | 30s |
| LLM generation (long/file) | 60s |
| WebSocket connection | 10s |
| WebSocket message | 30s |
