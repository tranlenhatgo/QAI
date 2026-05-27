# TC-03: Quiz Browser

## Preconditions

- User is logged in
- At least one quiz exists (created in TC-01)
- All services running

## TC-03-01: Open Quiz Browser from Home

**Steps:**

1. On Home page, click the **"Play"** button
2. Verify the QuizBrowser UI loads (grid/list of quizzes)
3. Observe the filter controls:
   - Category dropdown
   - Search input
4. Verify quiz cards are displayed

**Expected:**

- Search input visible and focusable
- Category dropdown defaults to "All categories"
- Quiz cards show: title, category badge, question count
- List populated from Spring Boot API

## TC-03-02: Filter by Category Dropdown

**Steps:**

1. In QuizBrowser, click the **category dropdown**
2. Verify all categories listed
3. Select **Math**
4. Wait for list to filter

**Expected:**

- Dropdown contains: All categories, Science, History, Geography, Literature, Technology, Sports, Entertainment, Math, Art, Space, General Culture
- After selecting Math: only quizzes with `math` category shown
- Quiz count updates

## TC-03-03: Search by Title

**Steps:**

1. Clear category filter (select "All categories")
2. Click the **search input** field
3. Type `AUTOTEST`
4. Verify results filter in real-time (or press Enter)

**Expected:**

- `[AUTOTEST] Math Basics Quiz` appears in results
- Quizzes without "AUTOTEST" in title are hidden
- Search is case-insensitive

## TC-03-04: Combined Filter (Category + Search)

**Steps:**

1. Set category dropdown to **Science**
2. Type `AUTOTEST` in search field
3. Observe results

**Expected:**

- No results (test quiz is category `math`, not `science`)
- "No quizzes found" or empty state shown
- Clear filters shows all quizzes again

## TC-03-05: Select Quiz and Play

**Steps:**

1. Reset filters (All categories, clear search)
2. Find `[AUTOTEST] Math Basics Quiz`
3. Click the quiz card or its Play button
4. Verify quiz detail or play starts
5. Confirm the correct quiz loaded (title matches)

**Expected:**

- Clicking quiz card opens quiz detail or starts play
- Quiz title shown matches `[AUTOTEST] Math Basics Quiz`
- Navigation stays within app (no new tabs)
