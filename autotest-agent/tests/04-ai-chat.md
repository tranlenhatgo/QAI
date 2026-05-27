# TC-04: AI Coach Chat

## Preconditions

- User is logged in
- All services running (including LLM — LM Studio or DeepSeek)

## TC-04-01: Open Coach Dashboard and Navigate to Chat Tab

**Steps:**

1. On Home page, click the **"AI Coach"** button (or Coach navigation element)
2. Verify Coach Dashboard loads with tabs visible
3. Click the **"Chat"** tab
4. Verify chat interface appears with message input
5. Look for connection status indicator (green dot = connected)

**Expected:**

- Coach Dashboard loads with tab navigation
- Chat tab shows input field and message area
- Connection indicator shows green (WebSocket connected)

## TC-04-02: Send Message in Simple Mode (Lite Tier)

**Steps:**

1. Verify tier toggle shows **Lite** (click it if not)
2. Verify mode is **Simple** (not Agentic)
3. Click the message input field
4. Type: `What is photosynthesis?`
5. Press Enter or click Send button
6. Wait for response to appear (up to 30s)

**Expected:**

- User message appears as a chat bubble
- AI response streams in token-by-token (progressive display)
- Response is relevant to photosynthesis
- No error messages or disconnection
- Uses LM Studio (local model)

## TC-04-03: Send Message in Agentic Mode (Full Tier)

**Steps:**

1. Click the **tier toggle** to switch to **Full**
2. Click the **mode toggle** to switch to **Agentic**
3. Click message input
4. Type: `Show me my weaknesses`
5. Press Enter/Send
6. Wait for response (may include tool-use stages)

**Expected:**

- Stage indicators may appear during processing (tool invocations)
- Agent may call `show_weakness_report` tool
- Response includes analysis or "insufficient data" message
- No crashes or unhandled errors

## TC-04-04: Mode Switch Mid-Conversation

**Steps:**

1. Send a message in Simple/Lite mode, wait for response
2. Click the **mode toggle** to switch to Agentic
3. Send another message: `What quizzes have I taken?`
4. Observe response uses agentic mode (may invoke tools)

**Expected:**

- Mode switch doesn't disconnect WebSocket
- New message processed in agentic mode
- Conversation history preserved
- Response reflects tool usage (if applicable)

## TC-04-05: WebSocket Reconnection (Manual)

**Steps:**

1. Establish chat connection (send a message, get response)
2. Open browser DevTools → Network → WebSocket tab
3. Note the active WS connection
4. Close the WebSocket manually (or briefly stop AI Coach)
5. Observe connection indicator change
6. Wait for auto-reconnect (or restart AI Coach)
7. Send a new message after reconnection

**Expected:**

- Indicator changes to disconnected state (amber/red)
- Auto-reconnect attempts visible (or manual reconnect button)
- After reconnection: green indicator, chat functional

## TC-04-06: Agentic Tool Execution (Start Quiz)

**Steps:**

1. Set Agentic + Full mode
2. Type: `Start a math quiz for me`
3. Send and observe agent behavior
4. If agent finds a quiz: observe navigation action

**Expected:**

- Agent calls `search_quizzes` or `start_quiz` tool
- Tool result shown in chat (stage: "tool")
- If quiz found: may navigate to play page
- If no quiz: agent reports and may offer alternatives

## TC-04-07: Error — LLM Unavailable

**Steps:**

1. (Prerequisite: Stop LM Studio if testing Lite tier)
2. Switch to Lite tier
3. Type a message and send
4. Observe error handling

**Expected:**

- User-friendly error message (not raw stack trace)
- Connection may show issue state
- Suggests checking LLM availability
- App doesn't crash or freeze
