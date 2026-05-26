# 13 — Spaced Repetition UI

## Purpose

Display due review notifications, review schedule, and provide a review flow where students revisit topics flagged by the AI Coach's SM-2 spaced repetition scheduler.

**Status: ✅ Implemented** — `DueReviews.jsx`, `ReviewCard.jsx` components. Store actions: `fetchDueReviews`, `startReview`, `completeReview`. BFF: `/api/coach/progress/[userId]`, `/api/coach/review-completed`.

**Depends on**: AI Coach `GET /progress/{user_id}` endpoint (SDD 15) and `ChatResponse.due_reviews` field.

---

## Route

| Route | File | Auth Required |
| --- | --- | --- |
| `/coach` (section) | Integrated into CoachDashboard | Yes |

This is NOT a separate page. It integrates as a new section in the existing Coach Dashboard (`/coach`) between Progress Overview and Generate Questions.

---

## Page Layout Addition

```text
┌──────────────────────────────────────────────────────────────────┐
│  AI Coach Dashboard                                              │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────── Progress Overview ───────────────────────────────┐ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────── Due Reviews (NEW) ──────────────────────────────┐ │
│  │  🔔 3 topics due for review                                  │ │
│  │                                                               │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │ │
│  │  │ 🔴 Math  │  │ 🟡 Phys  │  │ 🟡 Chem  │                  │ │
│  │  │ Overdue  │  │ Due today │  │ Due today │                  │ │
│  │  │ 2 days   │  │           │  │           │                  │ │
│  │  │[Review]  │  │ [Review]  │  │ [Review]  │                  │ │
│  │  └──────────┘  └──────────┘  └──────────┘                  │ │
│  │                                                               │ │
│  │  Next review: "Science" in 3 days                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─── Generate Questions ───┐  ┌─── Step-by-Step Solver ──────┐ │
│  ...                                                              │
```

---

## Component Architecture

```text
src/components/Coach/
├── DueReviews.jsx              # NEW — Due reviews section
├── ReviewCard.jsx              # NEW — Single review item card
└── ReviewQuizModal.jsx         # NEW — Modal for taking a review quiz
```

---

## Component Specifications

### DueReviews.jsx

```jsx
/**
 * Shows categories due for spaced repetition review.
 * Fetches due reviews from AI Coach progress endpoint.
 * 
 * Props: none (reads from useCoach store)
 * 
 * Displays:
 * - Alert banner with count of due reviews
 * - Horizontal scrollable list of ReviewCards
 * - "Next review" indicator for upcoming items
 * - Empty state when nothing is due ("You're all caught up! 🎉")
 */

// Data fetch on mount:
// GET /api/coach/progress/{userId} → extracts due_reviews array

// State from useCoach:
// dueReviews: [{ category, daysOverdue, priority }]
// nextReview: { category, daysUntil }
// isLoadingReviews: boolean
```

### ReviewCard.jsx

```jsx
/**
 * A single review item card.
 * 
 * Props:
 *   category: string
 *   priority: "high" | "normal"     // high = overdue, normal = due today
 *   daysOverdue: number             // 0 = due today, >0 = overdue
 *   lastScore: number               // 0.0 - 1.0 from last attempt
 * 
 * Displays:
 *   - Color-coded icon (red = overdue, yellow = due today)
 *   - Category name
 *   - "Overdue by X days" or "Due today" label
 *   - Last score badge
 *   - [Review] button
 * 
 * Interactions:
 *   - Click [Review] → opens ReviewQuizModal for that category
 *   - Hover → shows tooltip "Take a quick quiz to reinforce this topic"
 */
```

### ReviewQuizModal.jsx

```jsx
/**
 * Modal that generates and presents a quick review quiz (5 questions).
 * 
 * Props:
 *   category: string
 *   isOpen: boolean
 *   onClose: () => void
 * 
 * Flow:
 *   1. Opens → calls POST /api/coach/generate/from-topics { topic: category, count: 5 }
 *   2. Shows loading spinner during generation
 *   3. Presents questions one at a time (similar to Play mode)
 *   4. On completion → shows score
 *   5. Score is sent to AI Coach (updates spaced repetition schedule)
 *   6. Card is removed from DueReviews list
 * 
 * After completion:
 *   POST /api/coach/webhook/quiz-completed (internal, for schedule update)
 */
```

---

## State Management

Addition to `useCoach` Zustand slice:

```javascript
// In src/store/useCoach.js — add to existing slice:
{
  // ... existing state ...

  // Spaced Repetition Reviews
  dueReviews: [],           // [{ category, daysOverdue, priority, lastScore }]
  upcomingReviews: [],      // [{ category, daysUntil }]
  isLoadingReviews: false,
  reviewQuizActive: null,   // category name if review quiz is open

  // Actions
  fetchDueReviews: async (userId) => { /* GET /api/coach/progress/{userId} */ },
  startReview: (category) => { /* open ReviewQuizModal */ },
  completeReview: async (category, score) => { /* notify AI Coach, remove from due */ },
}
```

---

## API Layer

New helper in `src/helpers/coach.js`:

```javascript
/**
 * Fetch due reviews for the current user.
 * Calls: GET /api/coach/progress/{userId}
 * Returns: { due: [...], upcoming: [...] }
 */
export async function fetchDueReviews(userId) {
  const res = await fetch(`/api/coach/progress/${userId}`);
  const data = await res.json();
  return {
    due: data.categories
      .filter(c => c.mastery_level < 0.6 || c.daysOverdue > 0)
      .map(c => ({
        category: c.category,
        daysOverdue: c.daysOverdue || 0,
        priority: c.daysOverdue > 1 ? 'high' : 'normal',
        lastScore: c.accuracy,
      })),
    upcoming: data.upcoming || [],
  };
}

/**
 * Notify AI Coach that a review quiz was completed.
 * POST /api/coach/review-completed
 */
export async function notifyReviewCompleted(userId, category, score) {
  return fetch('/api/coach/review-completed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, category, score }),
  });
}
```

BFF route:

```javascript
// src/pages/api/coach/progress/[userId].js
export default async function handler(req, res) {
  const { userId } = req.query;
  const response = await fetch(`${process.env.COACH_API_URL}/progress/${userId}`);
  const data = await response.json();
  res.status(response.status).json(data);
}
```

---

## Visual Design

| State | Appearance |
| ------- | ----------- |
| Overdue (>1 day) | Red border, pulsing dot, "⚠️ Overdue" badge |
| Due today | Yellow border, "📅 Due today" badge |
| Upcoming | Gray, shown as text "Next: {category} in {N} days" |
| All caught up | Green checkmark, celebratory message |
| Loading | Skeleton cards (3 placeholders) |

---

## Acceptance Criteria

- [ ] DueReviews section appears in Coach Dashboard between Progress and Generate
- [ ] Due categories fetched from AI Coach progress endpoint
- [ ] Cards color-coded by priority (red = overdue, yellow = due today)
- [ ] [Review] button opens ReviewQuizModal with 5 generated questions
- [ ] Completing review quiz updates spaced repetition schedule
- [ ] Completed reviews disappear from the due list
- [ ] Empty state shows "You're all caught up!" when nothing is due
- [ ] Section hidden entirely when no reviews are due AND no upcoming reviews
- [ ] Responsive: horizontal scroll on mobile, grid on desktop
