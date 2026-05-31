# 10 — Subscription Payment Backend

## Purpose
Own Lite/Full subscription state and mock checkout writes so clients cannot directly grant Full access in Firestore.

## Interface Contract
- `GET /subscription/current`
  - Auth: `Authorization: Bearer <Firebase ID token>`
  - Returns current subscription or legacy Full access when no subscription doc exists.
- `POST /subscription/signup`
  - Auth: Firebase bearer token.
  - Creates Lite subscription only if `users/{uid}/subscription/current` is missing.
- `POST /subscription/checkout`
  - Auth: Firebase bearer token.
  - Body: `{ "plan": "monthly" | "yearly" | "forever" }`
  - Writes an active Full subscription for the authenticated user.

## Firestore Schema
Path: `users/{uid}/subscription/current`

| Field | Type | Notes |
| --- | --- | --- |
| `plan` | string | `lite`, `monthly`, `yearly`, `forever`, or virtual `legacy` response |
| `fullAccess` | boolean | Enables Full mode when true |
| `subscriptionStatus` | string | `none`, `active`, `expired`, `legacy`, `unavailable` |
| `source` | string | `signup`, `mock_payment`, `missing_subscription_record` |
| `priceUsd` | number | `2`, `20`, `100` for mock paid plans |
| `startedAt` | timestamp | Checkout start time |
| `expiresAt` | timestamp/null | Monthly/yearly expiry; forever has no expiry |
| `createdAt` | timestamp | First subscription doc creation |
| `updatedAt` | timestamp | Last subscription update |

## Behavior Specification
- The controller verifies Firebase ID tokens using Firebase Admin and derives `uid` from the token.
- The service reads/writes only the authenticated user path.
- Missing subscription docs are treated as legacy Full access and are not created by `GET /subscription/current`.
- Monthly expires after one month; yearly expires after one year; forever does not expire.
- Expired active subscriptions are updated to `subscriptionStatus="expired"` and `fullAccess=false` before the response is returned.
- Existing ISO-string timestamp fields from earlier client-created docs are tolerated when mapping old data.

## Acceptance Criteria
- Invalid or missing bearer tokens return `{ message, statusCode }`.
- Invalid checkout plan returns 400.
- Firestore writes happen only in `POST /subscription/signup` and `POST /subscription/checkout`, plus expiry normalization during reads.
- `.\mvnw.cmd -q -DskipTests compile` passes.
