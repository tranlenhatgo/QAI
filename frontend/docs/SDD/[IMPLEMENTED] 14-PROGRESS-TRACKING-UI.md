# 14 — Progress Tracking UI

## Purpose

Enhance the existing Progress Overview section with real data from the AI Coach progress API. Display mastery levels per category, learning velocity trends, study streak, and historical progress chart with actual computed metrics.

**Status: ✅ Implemented** — `MasteryBreakdown.jsx` component with color-coded bars and trend arrows. `ProgressOverview.jsx` fetches real data via `fetchProgress` on mount. Store: `progressData`, `isLoadingProgress`.

**Depends on**: AI Coach `GET /progress/{user_id}` endpoint (SDD 15) being implemented.

---

## Current State

The `ProgressOverview.jsx` component exists and renders a basic SVG trend chart, but:

- Data is either hardcoded or fetched from raw quiz history
- No mastery calculation (exponential decay weighting)
- No learning velocity metrics
- No integration with AI Coach progress API

---

## Enhanced Layout

```text
┌─────────── Progress Overview (Enhanced) ───────────────────────────┐
│                                                                     │
│  ┌── Overall Mastery ──┐  ┌── Study Streak ──┐  ┌── Velocity ──┐ │
│  │   ████████░░ 72%    │  │    🔥 12 days    │  │  ↗ Improving │ │
│  │   "Intermediate"    │  │    Best: 21 days  │  │  +5%/week    │ │
│  └─────────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                     │
│  ┌── Mastery by Category ────────────────────────────────────────┐ │
│  │  Math      ████████████████░░░░  80%  ↗ improving            │ │
│  │  Physics   ██████████░░░░░░░░░░  50%  → stable               │ │
│  │  Chemistry ████████████░░░░░░░░  60%  ↗ improving            │ │
│  │  Biology   ██████░░░░░░░░░░░░░░  30%  ↘ declining            │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌── Score Trend (30 days) ─────────────────────────────────────┐ │
│  │         ·  ·                                                  │ │
│  │     ·  · ·  ·  ·                                             │ │
│  │  ·       ·       ·  ·                                        │ │
│  │  ────────────────────────────── time →                       │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```text
src/components/Coach/
├── ProgressOverview.jsx       # MODIFY — add real data integration
├── MasteryBar.jsx             # NEW — single category mastery bar
├── MasteryBreakdown.jsx       # NEW — list of all category mastery bars
├── VelocityIndicator.jsx      # NEW — learning speed indicator
└── StreakCounter.jsx           # NEW — study streak with animation
```

---

## Component Specifications

### ProgressOverview.jsx (Enhanced)

```jsx
/**
 * Enhanced progress overview with real AI Coach data.
 * 
 * On mount: calls fetchProgress(userId) from useCoach store
 * 
 * Renders:
 *   - Top row: OverallMastery | StreakCounter | VelocityIndicator
 *   - Middle: MasteryBreakdown (all categories)
 *   - Bottom: ScoreTrendChart (existing SVG, now with real data)
 * 
 * Loading state: Skeleton with animated pulse
 * Error state: "Unable to load progress" with retry button
 */
```

### MasteryBar.jsx

```jsx
/**
 * Single category mastery progress bar.
 * 
 * Props:
 *   category: string
 *   mastery: number (0.0 - 1.0)
 *   trend: "improving" | "stable" | "declining"
 *   attempts: number
 * 
 * Renders:
 *   - Category name (left)
 *   - Filled progress bar (color based on mastery: red < 40%, yellow 40-70%, green > 70%)
 *   - Percentage (right of bar)
 *   - Trend arrow (↗ ↘ →)
 * 
 * Interactions:
 *   - Hover → tooltip with details: "12 attempts, last: 2 days ago"
 *   - Click → opens Generate Questions for that category
 */
```

### VelocityIndicator.jsx

```jsx
/**
 * Shows learning speed (rate of improvement).
 * 
 * Props:
 *   velocity: number (change per week, e.g., 0.05 = +5%/week)
 *   direction: "accelerating" | "steady" | "decelerating"
 * 
 * Renders:
 *   - Arrow icon (up = accelerating, flat = steady, down = decelerating)
 *   - Color (green/gray/red)
 *   - Text: "+5%/week" or "Steady" or "-3%/week"
 */
```

### StreakCounter.jsx

```jsx
/**
 * Study streak counter with fire animation.
 * 
 * Props:
 *   currentStreak: number (days)
 *   bestStreak: number (all-time best)
 * 
 * Renders:
 *   - 🔥 emoji (animated if streak > 0)
 *   - "{N} days" large text
 *   - "Best: {M} days" smaller text below
 *   - Gray/inactive if streak = 0
 * 
 * Animation: Fire emoji scales up on page load if streak > 5
 */
```

---

## State Management

Addition to `useCoach` Zustand slice:

```javascript
{
  // ... existing state ...

  // Progress Tracking (Enhanced)
  progress: null,            // Full ProgressResponse from AI Coach
  isLoadingProgress: false,
  progressError: null,

  // Derived (computed from progress)
  overallMastery: 0,         // 0.0 - 1.0
  categoryMasteries: [],     // [{ category, mastery, trend, attempts }]
  studyStreak: 0,
  bestStreak: 0,
  velocity: null,            // { value, direction }

  // Actions
  fetchProgress: async (userId) => {
    set({ isLoadingProgress: true, progressError: null });
    try {
      const data = await coachHelpers.fetchProgress(userId);
      set({
        progress: data,
        overallMastery: data.overall_mastery,
        categoryMasteries: data.categories,
        studyStreak: data.study_streak,
        velocity: data.velocities?.[0] || null,
        isLoadingProgress: false,
      });
    } catch (err) {
      set({ progressError: err.message, isLoadingProgress: false });
    }
  },
}
```

---

## API Layer

New helper in `src/helpers/coach.js`:

```javascript
/**
 * Fetch full progress report from AI Coach.
 * 
 * Calls: GET /api/coach/progress/{userId}
 * Returns: ProgressResponse { overall_mastery, categories, study_streak, ... }
 */
export async function fetchProgress(userId) {
  const res = await fetch(`/api/coach/progress/${userId}`);
  if (!res.ok) throw new Error(`Progress fetch failed: ${res.status}`);
  return res.json();
}
```

BFF route:

```javascript
// src/pages/api/coach/progress/[userId].js
export default async function handler(req, res) {
  const { userId } = req.query;
  const coachUrl = process.env.COACH_API_URL || 'http://localhost:8000';
  
  try {
    const response = await fetch(`${coachUrl}/progress/${userId}`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(502).json({ message: 'AI Coach unavailable' });
  }
}
```

---

## Visual Design

| Mastery Level | Color | Label |
| --------------- | ------- | ------- |
| 0% – 39% | Red (#EF4444) | Needs Work |
| 40% – 69% | Yellow (#F59E0B) | Developing |
| 70% – 89% | Blue (#3B82F6) | Proficient |
| 90% – 100% | Green (#10B981) | Mastered |

| Trend | Icon | Color |
| ------- | ------ | ------- |
| Improving | ↗ | Green |
| Stable | → | Gray |
| Declining | ↘ | Red |

---

## Acceptance Criteria

- [ ] ProgressOverview fetches real data from AI Coach progress endpoint
- [ ] Overall mastery shown as percentage with circular progress or bar
- [ ] Each category displays mastery bar with color coding
- [ ] Trend indicators (↗→↘) shown per category
- [ ] Study streak counter with fire emoji animation
- [ ] Learning velocity shown with direction arrow
- [ ] Score trend chart renders real historical data points
- [ ] Loading skeleton shown during fetch
- [ ] Error state with retry button if API fails
- [ ] Graceful fallback when AI Coach is unavailable (show raw quiz history)
- [ ] Responsive layout: stack vertically on mobile
