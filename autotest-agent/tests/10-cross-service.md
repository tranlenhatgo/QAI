# TC-10: Cross-Service Integration

## Purpose

End-to-end flows that traverse all 3 services. Detects integration conflicts, data inconsistencies, and timing issues.

## Preconditions

- User is logged in
- ALL services running: Frontend, Spring Boot, AI Study Coach, LLM

## TC-10-01: Full Lifecycle — Create → Play → Coach Update

**Steps:**

1. **Create**: Home → click "Create" → make quiz titled `[AUTOTEST] Integration Quiz`, category: Math, 3 questions
2. **Play**: Home → click "Play" → find quiz in browser → select and play → score 2/3
3. **Coach check**: Home → click "AI Coach" → Overview tab → verify progress updated
4. **SR check**: Scroll to DueReviews → verify new review scheduled for math
5. **Review**: Click [Review] on the card → play again → score 3/3
6. **Final check**: Return to Coach → verify interval increased

**Expected:**

- Quiz flows through all 3 services without error
- Score saved, webhook fires, SM-2 schedule created
- Progress reflects new data
- Review cycle completes end-to-end

## TC-10-02: Category Consistency Across Services

**Steps:**

1. **Create**: Make a quiz with category `SCIENCE` (frontend sends UPPERCASE)
2. **Read**: Go to Profile → click the quiz → verify category shown as `science` (lowercase)
3. **Play & Complete**: Play the quiz, finish with any score
4. **Coach**: Go to Coach Dashboard → check progress → verify `science` category in mastery
5. **Chat**: Open Chat tab → ask "How am I doing in science?" → verify agent uses correct category

**Expected:**

- Frontend sends UPPERCASE on create → backend stores as enum
- API response returns lowercase: `science`
- AI Coach receives lowercase from webhook
- Progress/mastery uses lowercase: `science`
- **No case mismatch anywhere** (no "SCIENCE" vs "science" vs "Science" confusion)

## TC-10-03: Single Category Enforcement End-to-End

**Steps:**

1. **UI enforcement**: On Create page, verify radio buttons (can't select 2 categories)
2. **Backend enforcement**: Open browser DevTools console, manually call:

   ```javascript
   fetch('/api/quiz/save-quiz', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({host_id:"test",title:"Hack",description:"x",categories:["MATH","SCIENCE"]})
   }).then(r => r.json()).then(console.log)
   ```

3. Verify backend rejects with 400 error

**Expected:**

- UI: only 1 radio selectable (physical constraint)
- Backend: returns `{ message: "A quiz must have at most one category", statusCode: 400 }`
- Quiz NOT created with multiple categories

## TC-10-04: Agentic Chat Triggers UI Navigation

**Steps:**

1. Go to Coach Dashboard → Chat tab
2. Set Agentic + Full mode
3. Type: `Find me a science quiz and start it`
4. Send and observe agent response
5. If agent navigates: verify you land on play page with correct quiz

**Expected:**

- Agent searches for science quizzes (tool call visible)
- If found: action dispatched, page navigates to /play
- Quiz loaded and playable
- If not found: agent reports gracefully

## TC-10-05: Service Failure — AI Coach Down

**Steps:**

1. (Prerequisite: Stop AI Study Coach service)
2. On Home, click "Play" → select a category → click Start
3. Observe error when trying to generate questions
4. Click logo → click "AI Coach" → observe dashboard state
5. (Restart AI Coach service after test)

**Expected:**

- Question generation fails gracefully (error message, not white screen)
- Coach Dashboard shows connection error or loading state
- Existing quizzes from Spring Boot still accessible via QuizBrowser
- After restart: features recover without page reload

## TC-10-06: Service Failure — Spring Boot Down

**Steps:**

1. (Prerequisite: Stop Spring Boot service)
2. On Home, try to play an existing quiz from browser
3. Try to go to Profile (requires Spring Boot data)
4. (Restart Spring Boot after test)

**Expected:**

- Quiz browser fails to load quizzes (error state)
- Profile shows error or empty state
- AI Coach chat still works (direct WebSocket, doesn't need Spring Boot for basic chat)
- After restart: features recover

## TC-10-07: Multiple Quiz Completions — Data Consistency

**Steps:**

1. Play the same quiz 3 times with different scores:
   - First: answer 1/3 correct
   - Second: answer 2/3 correct
   - Third: answer 3/3 correct
2. Go to Profile → check quiz history
3. Go to Coach → check score trend
4. Check mastery bar for the quiz's category

**Expected:**

- Profile shows all 3 attempts with correct scores (1/3, 2/3, 3/3)
- Score trend chart shows 3 data points (improving)
- Mastery reflects cumulative performance (weighted toward recent)
- No duplicates or missing records
- SM-2 schedule recalculated each time

## Cleanup

- Delete `[AUTOTEST] Integration Quiz` and test artifacts
