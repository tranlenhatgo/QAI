# Conflict Detection Checklist

## Purpose

Identifies potential conflicts and integration issues between the 3 services that automated tests should expose.

---

## Category Data Conflicts

| # | Conflict Area | Risk | Test Coverage |
| --- | --- | --- | --- |
| 1 | Frontend sends UPPERCASE, backend returns lowercase | Category mismatch in UI display | TC-10-02 |
| 2 | Multi-category payload bypasses frontend radio | Backend validation is the last line of defense | TC-10-03 |
| 3 | AI Coach receives "unknown" category from webhook | Quiz without category stored in Firestore | TC-10-02, TC-07-03 |
| 4 | Progress tracking uses wrong category key | Mastery attributed to wrong category | TC-08-02 |
| 5 | Weakness analysis aggregates mismatched categories | Mixed case → separate entries for same category | TC-08-03 |

## WebSocket/Streaming Conflicts

| # | Conflict Area | Risk | Test Coverage |
| --- | --- | --- | --- |
| 6 | WebSocket disconnects during LLM streaming | Partial response, lost context | TC-04-05 |
| 7 | Mode switch while response is streaming | Race condition, mixed mode output | TC-04-04 |
| 8 | Multiple rapid messages before response completes | Queue overflow, out-of-order responses | TC-04-02 |
| 9 | Chat + Quiz play concurrent WebSocket usage | Port/connection conflicts | TC-10-05 |

## Service Dependency Conflicts

| # | Conflict Area | Risk | Test Coverage |
| --- | --- | --- | --- |
| 10 | AI Coach down → frontend quiz generation fails | No fallback for AI-generated games | TC-10-06 |
| 11 | Spring Boot down → AI Coach can't persist schedules | SR updates lost, silent failure | TC-10-06 |
| 12 | LM Studio not loaded → Lite tier returns error | Chat unusable without model | TC-04-07 |
| 13 | Webhook timeout → Spring Boot retries? | Duplicate SR updates if not idempotent | TC-10-01 |

## Data Flow Conflicts

| # | Conflict Area | Risk | Test Coverage |
| --- | --- | --- | --- |
| 14 | Quiz deleted after SR schedule created | Review references non-existent quiz | TC-07-02 |
| 15 | Score format parsing: "3/5" vs numeric | AI Coach `_parse_score()` fails on edge cases | TC-10-07 |
| 16 | Concurrent quiz completions → webhook race | Two webhooks for same quiz → double update | TC-10-07 |
| 17 | User ID mismatch between Firebase and AI Coach | Progress/reviews attributed to wrong user | TC-10-01 |

## UI/UX Conflicts

| # | Conflict Area | Risk | Test Coverage |
| --- | --- | --- | --- |
| 18 | Category filter shows all categories but DB has none | Empty results confuse user | TC-03-02 |
| 19 | DueReviews shows card but quiz was deleted | Click [Review] → 404 error | TC-07-02 |
| 20 | Notification bell count doesn't update after dismiss | Stale state until refresh | TC-09-03 |
| 21 | Chat response references non-existent quiz | Agent tool returns outdated data | TC-04-06 |

---

## Priority for Testing

**Critical (test first):**

- Category consistency (#1-5) — data integrity
- Webhook flow (#13, 16, 17) — cross-service data
- Service failure (#10-12) — user experience

**High (test next):**

- WebSocket stability (#6-9) — core chat feature
- Data flow integrity (#14-15) — edge cases

**Medium (test later):**

- UI/UX issues (#18-21) — polish
