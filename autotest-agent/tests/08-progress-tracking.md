# TC-08: Progress Tracking

## Preconditions

- User is logged in with quiz history (multiple completed quizzes)
- All services running

## TC-08-01: View Progress Overview

**Steps:**

1. On Home page, click **"AI Coach"** button
2. Verify Overview tab is active (default)
3. Look for the ProgressOverview section
4. Check for a score trend chart (SVG or canvas)
5. Check for mastery breakdown bars

**Expected:**

- ProgressOverview renders without errors
- Trend chart visible (line/area chart with data points)
- If sufficient history: multiple points plotted
- If new user: empty state or minimal data

## TC-08-02: Mastery Breakdown by Category

**Steps:**

1. On Coach Overview, find the MasteryBreakdown section
2. Observe per-category progress bars
3. Verify categories match those the user has played

**Expected:**

- Each played category shows a progress bar (0-100%)
- Mastery percentage reflects quiz performance
- Categories displayed in lowercase
- Higher scores → higher mastery bar

## TC-08-03: View Weaknesses

**Steps:**

1. Click the **"Weaknesses"** tab on Coach Dashboard
2. Observe MyWeaknesses component
3. Look for weak category cards

**Expected:**

- Weak categories identified (mastery below threshold)
- Each card shows: category name, mastery level, [Practice] button
- If no weaknesses: positive message (e.g., "Great job!")

## TC-08-04: Practice a Weak Category

**Steps:**

1. On Weaknesses tab, find a weak category card
2. Click the **[Practice]** button
3. Observe what happens (quiz starts or generation begins)

**Expected:**

- [Practice] triggers a quiz for that weak category
- Either starts an existing quiz or generates new questions
- Gameplay begins after clicking Practice

## TC-08-05: Progress Updates After New Quiz

**Steps:**

1. Note current mastery for a category (e.g., Math: 60%)
2. Go Home → Play a math quiz → score perfectly (all correct)
3. Return to Coach Dashboard → Overview
4. Check mastery bar for math

**Expected:**

- Mastery percentage increased after perfect score
- Trend chart shows new data point
- Change visible on Dashboard

## TC-08-06: Study Streak

**Steps:**

1. Complete at least one quiz today
2. Check Coach Overview for streak indicator
3. Note the streak count

**Expected:**

- Streak shows consecutive days of activity
- Today's quiz counts toward the streak
- Displayed somewhere in progress area
