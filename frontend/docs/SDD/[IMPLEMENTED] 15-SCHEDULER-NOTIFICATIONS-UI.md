# 15 — Scheduler Notifications UI

## Purpose

Display proactive coaching notifications in the frontend when the AI Coach's background scheduler identifies actions needed (due reviews, progress milestones, inactivity nudges). Notifications appear as a non-intrusive banner or badge in the Coach Dashboard.

**Status: ✅ Implemented** — `NotificationBell.jsx` component renders unread notifications with dismiss action. Store: `notifications`, `fetchNotifications`, `markNotificationRead`. BFF: `/api/coach/notifications/[userId]`, `/api/coach/notifications/[id]/read`. Data from Firestore `notification` collection via Spring Boot.

**Depends on**: AI Coach Scheduler (SDD 16) and WebSocket notification push.

---

## Notification Types

| Type | Trigger | Display |
| ------ | --------- | --------- |
| `review_due` | Spaced repetition item due | "3 topics ready for review" |
| `milestone` | Mastery threshold crossed | "🎉 You mastered Mathematics!" |
| `streak_risk` | No activity for 24h (streak > 3) | "Don't break your 7-day streak!" |
| `weekly_report` | Weekly progress computed | "This week: +12% in Physics" |

---

## Layout Integration

```text
┌──────────────────────────────────────────────────────────────────┐
│  AI Coach Dashboard                          🔔 (2) [Settings]  │
├──────────────────────────────────────────────────────────────────┤
│  ┌─── Notification Banner (dismissible) ───────────────────────┐ │
│  │  🔔 You have 3 topics due for review.  [Start Review]  [×]  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ...                                                              │
```

---

## Component Architecture

```text
src/components/Coach/
├── NotificationBanner.jsx     # NEW — Top banner for active notifications
├── NotificationBadge.jsx      # NEW — Bell icon with count
└── NotificationList.jsx       # NEW — Dropdown list of all notifications
```

---

## Component Specifications

### NotificationBanner.jsx

```jsx
/**
 * Dismissible banner at top of Coach Dashboard for the most urgent notification.
 * 
 * Props: none (reads from useCoach store)
 * 
 * Displays:
 *   - Icon + message text
 *   - Action button (contextual: "Start Review", "View Report", etc.)
 *   - Dismiss [×] button
 * 
 * Behavior:
 *   - Shows only the highest-priority unread notification
 *   - Dismissing removes it from banner but keeps in notification list
 *   - Auto-fetched on page load via WebSocket or polling
 */
```

### NotificationBadge.jsx

```jsx
/**
 * Bell icon in the dashboard header with unread count.
 * 
 * Props:
 *   count: number (unread notifications)
 *   onClick: () => void (toggles NotificationList)
 * 
 * Renders:
 *   - 🔔 icon
 *   - Red badge with count (hidden if 0)
 *   - Pulse animation when new notification arrives
 */
```

### NotificationList.jsx

```jsx
/**
 * Dropdown list of all recent notifications.
 * 
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 * 
 * Displays:
 *   - List of notification items (last 20)
 *   - Each item: icon, message, time ago, read/unread state
 *   - "Mark all as read" button
 *   - Empty state: "No notifications yet"
 * 
 * Interactions:
 *   - Click notification → execute its action (navigate, open modal)
 *   - Swipe left (mobile) → dismiss
 */
```

---

## State Management

Addition to `useCoach` Zustand slice:

```javascript
{
  // ... existing state ...

  // Notifications
  notifications: [],          // [{ id, type, message, action, createdAt, read }]
  unreadCount: 0,
  showNotificationList: false,

  // Actions
  fetchNotifications: async (userId) => {
    const data = await coachHelpers.fetchNotifications(userId);
    set({ notifications: data, unreadCount: data.filter(n => !n.read).length });
  },
  dismissNotification: (id) => { /* mark as read, remove from banner */ },
  markAllRead: () => { /* mark all as read */ },
}
```

---

## Data Source

### Option A: Polling (MVP)

```javascript
// In CoachDashboard.jsx — poll every 60 seconds
useEffect(() => {
  const interval = setInterval(() => fetchNotifications(userId), 60000);
  return () => clearInterval(interval);
}, [userId]);
```

### Option B: WebSocket Push (Production)

```javascript
// Extend existing WebSocket connection to handle notification events
// AI Coach pushes: { type: "notification", payload: { ... } }
// useChat store already has WebSocket — extend message handler
```

---

## API Layer

```javascript
// src/helpers/coach.js
export async function fetchNotifications(userId) {
  const res = await fetch(`/api/coach/notifications/${userId}`);
  return res.json();
}

// src/pages/api/coach/notifications/[userId].js
export default async function handler(req, res) {
  const { userId } = req.query;
  const coachUrl = process.env.COACH_API_URL || 'http://localhost:8000';
  const response = await fetch(`${coachUrl}/notifications/${userId}`);
  res.status(response.status).json(await response.json());
}
```

---

## Acceptance Criteria

- [ ] Notification banner appears when there are unread notifications
- [ ] Bell badge shows unread count
- [ ] Clicking bell opens notification list dropdown
- [ ] Notifications categorized by type with appropriate icons
- [ ] Dismiss button removes notification from banner
- [ ] "Mark all as read" clears unread count
- [ ] Action buttons on notifications work (navigate to reviews, show report)
- [ ] Notifications fetched on page load and periodically refreshed
- [ ] Empty state shown when no notifications exist
- [ ] Responsive: banner full-width, list dropdown positioned correctly on mobile
