# TC-09: Notifications

## Preconditions

- User is logged in
- All services running (scheduler creates notifications)

## TC-09-01: Notification Bell Visible

**Steps:**

1. On Home page, click **"AI Coach"** button
2. On Coach Dashboard, look for the **NotificationBell** (bell icon)
3. Observe if a badge with count is shown

**Expected:**

- Bell icon visible on the Dashboard
- If unread notifications: numeric badge displayed
- If no notifications: bell visible but no badge (or 0)

## TC-09-02: Open Notification List

**Steps:**

1. Click on the **bell icon**
2. Verify a dropdown/list of notifications appears

**Expected:**

- Notification list opens
- Each notification shows: title, message, type
- Ordered by most recent first
- Unread items visually distinct (bold, different background)

## TC-09-03: Dismiss a Notification

**Steps:**

1. With notification list open, find an unread notification
2. Click the **dismiss/X** button or mark-read action
3. Observe the notification state change

**Expected:**

- Notification visually marked as read (dimmed/removed)
- Badge count decrements by 1
- On page refresh: stays marked as read (persisted)

## TC-09-04: Notification from Due Review

**Steps:**

1. Have a review that's past its scheduled date (overdue)
2. Wait for scheduler to run (hourly) or verify notification already exists
3. Check NotificationBell for review reminder

**Expected:**

- Notification created for overdue review
- Message mentions the category/quiz and review action
- Clicking the notification (if actionable) leads to review

## TC-09-05: Multiple Notifications

**Steps:**

1. Have several overdue reviews or scheduled notifications
2. Click the bell icon
3. Count notifications in list

**Expected:**

- Badge shows correct total unread count
- All notifications listed
- Dismissing one doesn't affect others
- Can dismiss multiple one by one

## TC-09-06: Empty Notification State

**Steps:**

1. Dismiss ALL notifications one by one
2. Verify bell state after all cleared

**Expected:**

- Badge disappears (or shows 0)
- Clicking bell shows "No notifications" empty state
- Clean UI, no broken elements
