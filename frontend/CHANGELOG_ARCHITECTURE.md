# Frontend — Architecture Changelog

## 2025-05-26 — Notification System (SDD 15)

**Added notification bell and Firestore-backed notification display.**

### New Files

| File | Purpose |
| --- | --- |
| `src/components/Coach/NotificationBell.jsx` | Renders unread notification count + list with dismiss buttons |
| `src/pages/api/coach/notifications/[userId].js` | BFF proxy → Spring Boot `GET /notification/user/{userId}/unread` |
| `src/pages/api/coach/notifications/[notificationId]/read.js` | BFF proxy → Spring Boot `PATCH /notification/{id}/read` |

### Modified Files

| File | Change |
| --- | --- |
| `src/store/useCoach.js` | Added `notifications` state, `fetchNotifications()`, `markNotificationRead()` |
| `src/components/Coach/CoachDashboard.jsx` | Added `NotificationBell` import + render in overview tab (above ProgressOverview) |

---

## 2025-05-26 — Adaptive Learning UI (SDD 13, 14)

**Implemented spaced repetition due reviews UI and enhanced progress tracking display.**

### New Files (Adaptive Learning)

| File | Purpose |
| --- | --- |
| `src/components/Coach/DueReviews.jsx` | Due reviews section: alert banner, horizontal card list, empty state ("All caught up!"), upcoming review indicator |
| `src/components/Coach/ReviewCard.jsx` | Individual review card: priority coloring (red=overdue, yellow=due today), days overdue, last score, [Review] button |
| `src/components/Coach/MasteryBreakdown.jsx` | Category mastery bars with color coding (red/yellow/blue/green) and trend arrows (↗→↘) |
| `src/pages/api/coach/progress/[userId].js` | BFF proxy route → AI Coach `GET /progress/{userId}` |
| `src/pages/api/coach/review-completed.js` | BFF proxy route → AI Coach `POST /webhook/quiz-completed` (for review quiz completions) |

### Modified Files (Adaptive Learning)

| File | Change |
| --- | --- |
| `src/store/useCoach.js` | Added state: `progressData`, `isLoadingProgress`, `progressError`, `dueReviews`, `upcomingReviews`, `isLoadingReviews`, `reviewQuizActive`. Added actions: `fetchProgress`, `fetchDueReviews`, `startReview`, `completeReview` |
| `src/components/Coach/CoachDashboard.jsx` | Added `DueReviews` import + render in overview tab (below ProgressOverview) |
| `src/components/Coach/ProgressOverview.jsx` | Added `useEffect` import, `MasteryBreakdown` integration, `fetchProgress` call on mount |

### User Flow

1. User visits `/coach` → ProgressOverview fetches progress data from AI Coach
2. If categories have mastery data → MasteryBreakdown shows bars with trends
3. If spaced repetition has due items → DueReviews section appears with cards
4. User clicks [Review] → generates 5 questions for that category (reuses GenerateQuestions)
5. After review quiz → `completeReview()` notifies AI Coach, removes card from due list

### Visual Design

| Mastery Level | Color | Bar |
| --- | --- | --- |
| 0-39% | Red | `bg-red-500` |
| 40-69% | Amber | `bg-amber-500` |
| 70-89% | Blue | `bg-blue-500` |
| 90-100% | Green | `bg-emerald-500` |

| Priority | Card Style |
| --- | --- |
| Overdue (>0 days) | Red border, red dot, "Overdue Xd" |
| Due today | Amber border, amber dot, "Due today" |
| All caught up | Green banner with checkmark |
