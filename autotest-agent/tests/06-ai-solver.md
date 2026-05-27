# TC-06: AI Step-by-Step Solver

## Preconditions

- User is logged in
- All services running (including LLM)

## TC-06-01: Solve a Math Problem

**Steps:**

1. On Home page, click **"AI Coach"** button
2. Click the **"Solver"** tab on Coach Dashboard
3. Click the problem textarea
4. Type: `Solve the equation: 2x + 5 = 15`
5. Click the **Solve** button
6. Wait for solution steps to appear

**Expected:**

- Loading indicator while solving
- Solution displayed as numbered steps (e.g.):
  1. Subtract 5 from both sides: 2x = 10
  2. Divide both sides by 2: x = 5
- Steps appear progressively (streaming)
- Final answer clearly stated

## TC-06-02: Solve a Science Problem

**Steps:**

1. Clear the previous problem (select all + delete in textarea)
2. Type: `Calculate kinetic energy of a 2kg object at 3 m/s`
3. Click **Solve**
4. Wait for steps

**Expected:**

- Shows formula: KE = ½mv²
- Shows substitution and calculation
- Final answer: 9 J (or equivalent)
- Steps logically ordered

## TC-06-03: Solve with Empty Input

**Steps:**

1. Clear the textarea completely
2. Click **Solve** button

**Expected:**

- Validation prevents empty submission
- Error or warning message shown
- No request sent to backend

## TC-06-04: Complex Multi-Step Problem

**Steps:**

1. Type: `A train leaves A at 60 km/h. Another leaves B (200 km away) at 80 km/h toward A. When do they meet?`
2. Click **Solve**
3. Wait for full solution

**Expected:**

- Multiple clear reasoning steps
- Variables defined, equation set up
- Correct solution (~1.43 hours or 85.7 minutes)
- Final answer stated

## TC-06-05: Non-Mathematical Problem

**Steps:**

1. Type: `Explain the causes of World War I`
2. Click **Solve**

**Expected:**

- AI provides structured explanation
- Uses step format or paragraph format
- Content is relevant and educational
- No error — handles gracefully

## TC-06-06: Verify Streaming (Progressive Display)

**Steps:**

1. Type any problem and click Solve
2. Watch the output area immediately after clicking
3. Observe text appearing incrementally

**Expected:**

- First content appears within ~5-10s
- Text grows progressively (not all at once)
- Complete solution within 30s
- No blank/frozen state during generation
