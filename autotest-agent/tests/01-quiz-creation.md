# TC-01: Quiz Creation (Single Category)

## Preconditions

- User is logged in (via Login button on Home header)
- All services running

## TC-01-01: Create Quiz with Single Category Selection

**Steps:**

1. On the Home page, click the **"Create"** button
2. Verify the Create page loads (title input visible)
3. Enter title: `[AUTOTEST] Math Basics Quiz`
4. Enter description: `Automated test quiz for math category`
5. In the Category section, verify radio buttons are displayed (NOT checkboxes)
6. Click the `Math` radio button
7. Verify only one category can be selected — click `Science`, verify `Math` deselects
8. Click `Math` again to re-select it
9. Add a question:
   - Click "Add Question" button
   - Type question text: `What is 2 + 2?`
   - Fill Answer A: `3` | Answer B: `4` | Answer C: `5` | Answer D: `6`
   - Click the correct-answer indicator on Answer B
10. Click the Save/Create button
11. Verify success (redirect or success toast)

**Expected:**

- Category inputs are type="radio" (not checkbox)
- Only 1 category selectable at a time
- Quiz created successfully

## TC-01-02: Verify Created Quiz in Profile

**Steps:**

1. Click the **profile icon** in the header
2. Find `[AUTOTEST] Math Basics Quiz` in the quiz list
3. Click on it to view details
4. Verify category shows `math` (lowercase)

**Expected:**

- Quiz exists with exactly 1 category: `math`

## TC-01-03: Category Cannot Be Empty on Create

**Steps:**

1. Click the **logo** to return to Home
2. Click the **"Create"** button
3. Fill in title and description
4. Do NOT select any category radio
5. Add a question with answers
6. Click Save/Create

**Expected:**

- Creation blocked or validation error shown
- Quiz NOT saved

## TC-01-04: Update Quiz Preserves Single Category

**Steps:**

1. Go to Profile (click profile icon)
2. Find `[AUTOTEST] Math Basics Quiz`, click Edit
3. Verify `Math` radio is currently selected
4. Click `Science` radio to change
5. Click Save/Update
6. Re-open quiz — verify category is now `science`

**Expected:**

- Single category updated successfully
- Old category replaced, not appended

## Cleanup

- Delete test quiz via UI or database
