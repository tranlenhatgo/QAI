# TC-07: Spaced Repetition Cycle

## Preconditions

- User is logged in with at least 1 completed quiz
- All services running

## TC-07-01: View Due Reviews on Coach Dashboard

**Steps:**

1. On Home page, click **"AI Coach"** button
2. On Coach Dashboard, verify the **Overview** tab is active (default)
3. Scroll to find the DueReviews section
4. Observe whether any review cards are displayed

**Expected:**

- DueReviews section renders
- If reviews due: cards show quiz title, category, scheduled date, and [Review] button
- If no reviews: "No reviews due" or similar empty state message

## TC-07-02: Start a Review Quiz

**Steps:**

1. Find a due review card (from TC-07-01)
2. Click the **[Review]** button on that card
3. Verify quiz gameplay starts (questions load)
4. Answer all questions
5. Complete the quiz (reach Game Over screen)

**Expected:**

- [Review] button navigates to play page with the review quiz
- Questions loaded from Spring Boot
- Normal gameplay (answers, scoring, Game Over)
- Score shown at completion

## TC-07-03: Verify Schedule Updates After Review

**Steps:**

1. After completing review (TC-07-02), note the score
2. Click **logo** to return Home
3. Click **"AI Coach"** button to return to Dashboard
4. Check DueReviews section again

**Expected:**

- Completed review no longer shows as "due now"
- Next review date pushed forward (SM-2 interval increase for good scores)
- Or: interval shortened if score was poor
- Schedule persisted (survives page refresh)

## TC-07-04: First Quiz Creates Initial Schedule

**Steps:**

1. Go Home → click **"Create"** → make a new quiz with unique category
2. Go Home → Play the newly created quiz via QuizBrowser
3. Complete it with any score
4. Go to Coach Dashboard → Overview → DueReviews
5. Look for the new category in upcoming reviews

**Expected:**

- First completion creates initial SM-2 schedule entry
- Default: easiness=2.5, interval=1 day
- Review scheduled approximately 1 day from now
- Visible in DueReviews (or upcoming section)

## TC-07-05: Poor Score Reduces Next Interval

**Steps:**

1. Start a review quiz (click [Review] on a due card)
2. Intentionally answer most questions **wrong** (e.g., 1/5)
3. Complete the quiz
4. Return to Coach Dashboard
5. Check when next review is scheduled

**Expected:**

- Low score → interval resets (becomes shorter)
- Next review scheduled sooner (e.g., 1 day instead of growing)
- Easiness factor decreased

## TC-07-06: Good Score Increases Next Interval

**Steps:**

1. Start a review quiz
2. Answer all questions **correctly** (perfect score)
3. Complete the quiz
4. Return to Coach Dashboard
5. Check next review date

**Expected:**

- High score → interval grows (SM-2: previous interval × easiness)
- Next review date further out than before
- Easiness factor maintained or slightly increased
