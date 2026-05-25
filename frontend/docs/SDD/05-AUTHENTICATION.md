# 05 — Authentication

## Overview

Authentication uses **Firebase Auth** (client-side SDK) with **HttpOnly cookie** session management via Next.js API routes.

---

## Flow

```
1. User clicks Login → AuthForm.jsx opens (DOM id trigger)
2. Firebase signInWithEmailAndPassword() → returns user + token
3. Token → POST /api/auth/set-token → stored in HttpOnly cookie
4. sessionStorage.user set for client-side checks
5. Protected actions (create, profile) check session → redirect to auth if missing
6. Logout: clear sessionStorage + POST /api/auth/clear-token
```

---

## Token Management

| Storage | Purpose | Access |
|---------|---------|--------|
| HttpOnly cookie | Firebase JWT for server-side API route auth | Server only |
| sessionStorage (`user`) | Client-side auth check (existence only) | Client only |

---

## Protected Routes

No server-side route protection currently — protection is client-side:
- Components check `sessionStorage.user` existence
- Missing session → triggers auth modal (via DOM id)
- No middleware-level enforcement

---

## Firebase Configuration

Client-side Firebase is initialized via environment variables in `src/lib/firebase.js`:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
