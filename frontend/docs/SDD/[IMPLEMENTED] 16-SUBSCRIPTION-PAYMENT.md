# 16 — Subscription Payment UI

## Purpose
Provide a protected mock checkout flow that upgrades Lite users to Full while keeping subscription writes owned by Spring Boot.

## Interface Contract
- Page: `/payment` requires Firebase auth via `PaymentPage.requireAuth = true`.
- BFF routes:
  - `GET /api/subscription/current`
  - `POST /api/subscription/signup`
  - `POST /api/subscription/checkout` with `{ plan: "monthly" | "yearly" | "forever" }`
- Store actions:
  - `loadSubscriptionForUser()`
  - `createLiteSubscriptionForNewUser()`
  - `checkoutSubscription(plan)`
  - `requestCoachTier(tier)`

## Behavior Specification
- New signups call `/api/subscription/signup`, which forwards the Firebase ID token to Spring Boot.
- Subscription reads call `/api/subscription/current`; missing backend docs are returned as legacy Full access.
- Locked users requesting Full stay on Lite and see the global subscription modal.
- The modal routes users to `/payment` through `View plans`.
- The payment page displays monthly `$2`, yearly `$20`, and forever `$100` plans. Choosing a plan performs mock checkout, enables Full immediately, and offers navigation back to `/coach`.
- Coach BFF routes still coerce unauthorized `tier: "full"` requests to Lite before forwarding to the AI Coach.

## Acceptance Criteria
- Lite signup and checkout never write `users/{uid}/subscription/current` directly from browser Firestore SDK.
- Locked users cannot briefly enter Full while subscription state is loading.
- Successful mock checkout sets `canUseFull=true`, `coachTier="full"`, and chat config tier `"full"`.
- `npm run lint` and `npm run build` pass.
