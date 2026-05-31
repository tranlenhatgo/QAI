# 18 — Subscription Entitlement Boundary

## Purpose
Clarify how Lite/Full subscription enforcement wraps the AI Coach without adding payment logic inside the FastAPI service.

## Interface Contract
- The coach still receives `tier: "lite" | "full"` in WebSocket `session_start` and HTTP request bodies.
- Next.js BFF and Spring Boot are responsible for verifying Firebase users and resolving whether Full access is allowed.
- Unauthorized Full HTTP requests are coerced to Lite before forwarding to the coach.
- Full-only document ingestion is blocked by the BFF when the subscription does not allow Full access.

## Behavior Specification
- The coach treats `tier` as a model-routing input only.
- Lite routes use local LM Studio behavior.
- Full routes use DeepSeek and Full-only tools when the caller has already passed entitlement checks.
- No Firebase token verification, Firestore subscription reads, or payment state is added to FastAPI.

## Acceptance Criteria
- Existing AI Coach tests continue to pass without Firebase credentials.
- WebSocket and HTTP schemas remain unchanged.
- Subscription/payment failures are handled in frontend/backend layers, not in coach capabilities.
