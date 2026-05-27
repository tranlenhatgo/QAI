# TC-05: AI Question Generation

## Preconditions

- User is logged in
- All services running (including LLM)

## TC-05-01: Generate Questions from Topics (Coach Dashboard)

**Steps:**

1. On Home page, click **"AI Coach"** button
2. Click the **"Generate"** tab on Coach Dashboard
3. Click the topic input field
4. Type: `Linear Algebra`
5. Set count to 5 (via slider or input)
6. Click the **Generate** button
7. Wait for AI to produce questions (up to 60s)

**Expected:**

- Loading/spinner indicator shown while generating
- 5 questions appear with question text + 4 options each
- Each question has a marked correct answer
- Questions relate to linear algebra

## TC-05-02: Generate Questions from File Upload (Create Page)

**Steps:**

1. Click **logo** to return Home
2. Click **"Create"** button
3. On the Create page, find the file upload area
4. Click the upload button/zone or drag a text file
5. Upload a document (e.g., a short .txt about history)
6. Wait for AI to generate questions from the content
7. Verify questions populate the question editor

**Expected:**

- File accepted (upload progress shown)
- AI processes content and generates questions
- Questions appear in the editor section
- Questions relevant to uploaded content
- User can edit/delete generated questions

## TC-05-03: Generate Single Question

**Steps:**

1. On the Create page question editor
2. Look for an "AI Generate" or single-question generate button
3. Provide a topic/context if prompted
4. Click generate
5. Verify one question is added

**Expected:**

- Single question generated and added to editor
- Has 4 options and correct answer
- Editable by user

## TC-05-04: Generation with Empty Topic

**Steps:**

1. Go to Coach Dashboard → **Generate** tab
2. Leave topic field empty
3. Click **Generate** button

**Expected:**

- Validation prevents empty submission
- Error/warning message shown near the input
- No API request sent

## TC-05-05: Generated Questions Have Correct Structure

**Steps:**

1. On Generate tab, enter topic: `Photosynthesis`
2. Set count: 3
3. Click Generate, wait for completion
4. Inspect each generated question

**Expected:**

- Each question has non-empty question text
- Each has exactly 4 answer options
- One answer marked as correct
- Options are plausible (good distractors)

## TC-05-06: Large Count Generation

**Steps:**

1. Enter topic: `World History`
2. Set count to maximum (e.g., 10)
3. Click Generate
4. Wait for all questions to appear

**Expected:**

- All questions generated (no partial failure)
- No duplicate questions
- Reasonable generation time (< 90s)
- All have valid structure
