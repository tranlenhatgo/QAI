# 12 — Testing Strategy & Checklist

> Test scenarios, prompts to validate, and acceptance checklist for the AI Study Coach.

---

## Testing Layers

```text
┌────────────────────────────────────────────────────────┐
│  Layer 4: End-to-End (WebSocket full flow)              │
├────────────────────────────────────────────────────────┤
│  Layer 3: Integration (capability + real/mock LLM)      │
├────────────────────────────────────────────────────────┤
│  Layer 2: Unit (individual tools, classifiers, parsers) │
├────────────────────────────────────────────────────────┤
│  Layer 1: Smoke (server starts, WS connects)            │
└────────────────────────────────────────────────────────┘
```

---

## Layer 1: Smoke Tests

### S-1: Server Startup

```text
Given: App is configured with valid .env
When:  uvicorn starts
Then:  Server accepts connections on port 8000
       GET /health returns 200
       WebSocket /ws accepts connection
```

### S-2: WebSocket Handshake

```text
Given: Server is running
When:  Client connects to /ws and sends session_start
Then:  Server responds with session_ack containing session_id, tier, mode
```

### S-3: Provider Availability Check

```text
Given: LM Studio is NOT running
When:  Client sends session_start with tier=lite
Then:  Server detects unavailability within 5s
       Returns error event with code "provider_unavailable"
```

---

## Layer 2: Unit Tests

### U-1: Intent Classifier

| Input | Expected Intent | Confidence |
| ------- | ---------------- | ------------ |
| "What are my weak areas?" | WEAKNESS_ANALYSIS | ≥ 0.7 |
| "What are my weaknesses in math?" | WEAKNESS_ANALYSIS | ≥ 0.8 |
| "Where should I improve?" | WEAKNESS_ANALYSIS | ≥ 0.7 |
| "What quiz should I take next?" | QUIZ_RECOMMEND | ≥ 0.7 |
| "Recommend something to study" | QUIZ_RECOMMEND | ≥ 0.7 |
| "Explain photosynthesis" | EXPLAIN_TOPIC | ≥ 0.7 |
| "What is a derivative?" | EXPLAIN_TOPIC | ≥ 0.7 |
| "Quiz me on chapter 3" | QUIZ_REQUEST | ≥ 0.8 |
| "Give me some practice questions" | QUIZ_REQUEST | ≥ 0.7 |
| "Solve x² - 4 = 0" | SOLVE_PROBLEM | ≥ 0.7 |
| "Calculate 2+2" | SOLVE_PROBLEM | ≥ 0.7 |
| "Hi, how are you?" | GENERAL_CHAT | default |
| "Thanks!" | GENERAL_CHAT | default |
| "Tell me a joke" | GENERAL_CHAT | default |

```python
# Test file: tests/test_intent_classifier.py

@pytest.mark.parametrize("input_text,expected_intent", [
    ("What are my weak areas?", Intent.WEAKNESS_ANALYSIS),
    ("Quiz me on photosynthesis", Intent.QUIZ_REQUEST),
    ("Solve x^2 - 4 = 0", Intent.SOLVE_PROBLEM),
    ("Hi there", Intent.GENERAL_CHAT),
])
def test_intent_classification(input_text, expected_intent):
    classifier = IntentClassifier()
    result = classifier.classify(input_text)
    assert result.intent == expected_intent
    if expected_intent != Intent.GENERAL_CHAT:
        assert result.confidence >= 0.7
```

### U-2: Quiz JSON Parsing

| Input | Expected |
| ------- | ---------- |
| Valid JSON array of questions | Quiz object with correct question count |
| JSON wrapped in ```json code block | Still parses correctly |
| Malformed JSON with extra text | Repair: find `[...]` bounds |
| MC question with 0 correct answers | Auto-fix: mark first option correct |
| MC question with 2 correct answers | Auto-fix: keep only first correct |

```python
# Test file: tests/test_quiz_parser.py

def test_parse_valid_json():
    response = '[{"type": "multiple_choice", "question": "What is 2+2?", ...}]'
    quiz = parser._parse_quiz_response(response, "Math", "easy")
    assert len(quiz.questions) == 1

def test_parse_json_in_code_block():
    response = '```json\n[{"type": "multiple_choice", ...}]\n```'
    quiz = parser._parse_quiz_response(response, "Math", "easy")
    assert len(quiz.questions) >= 1

def test_repair_malformed_json():
    response = 'Here are the questions:\n[{"type": "short_answer", ...}]\nHope this helps!'
    quiz = parser._parse_quiz_response(response, "Math", "easy")
    assert len(quiz.questions) >= 1
```

### U-3: Tool Definition Schemas

```python
# Test file: tests/test_tools.py

def test_all_tools_have_valid_schemas():
    registry = create_full_registry(mock_config)
    for tool in registry.all_tools():
        defn = tool.definition()
        assert defn.name  # Non-empty
        assert defn.description  # Non-empty
        assert defn.parameters["type"] == "object"
        assert "properties" in defn.parameters
        assert "required" in defn.parameters
```

### U-4: Message Formatting

```python
def test_quiz_history_formatting():
    tool = QuizHistoryTool(mock_config)
    results = [
        {"quiz_title": "Math Quiz", "score": 7, "total": 10, "percentage": 70, ...}
    ]
    formatted = tool._format_quiz_results(results)
    assert "Math Quiz" in formatted
    assert "7/10" in formatted
    assert "70%" in formatted

def test_empty_quiz_history():
    tool = QuizHistoryTool(mock_config)
    formatted = tool._format_quiz_results([])
    assert "No quiz history" in formatted
```

---

## Layer 3: Integration Tests

### I-1: Chat Flow (Mock LLM)

```python
# Test file: tests/test_chat_integration.py

async def test_chat_streams_response():
    mock_llm = MockLLM(chunks=["Hello", " there", "!"])
    capability = SimpleChatCapability(provider=mock_llm)
    
    events = []
    await capability.run(
        messages=[Message(role=Role.USER, content="Hi")],
        on_event=events.append,
        cancelled=lambda: False,
    )
    
    content_events = [e for e in events if e["type"] == "content"]
    assert len(content_events) == 3
    assert "".join(e["content"] for e in content_events) == "Hello there!"
    
    stage_events = [e for e in events if e["type"] == "stage"]
    assert stage_events[0] == {"type": "stage", "stage": "responding", "status": "start"}
    assert stage_events[1] == {"type": "stage", "stage": "responding", "status": "end"}
```

### I-2: Agentic Loop (Mock LLM + Mock Tools)

```python
async def test_agentic_calls_tool_then_responds():
    # LLM first requests a tool, then responds with text
    mock_llm = MockLLM(responses=[
        # Iteration 1: tool call
        [StreamChunk(type=ChunkType.TOOL_CALL, tool_calls=[
            ToolCall(id="1", name="rag", arguments={"query": "test"})
        ])],
        # Iteration 2: final text
        [StreamChunk(type=ChunkType.CONTENT, content="Based on your notes, ...")],
    ])
    
    mock_rag = MockTool(name="rag", result="Relevant chunk: XYZ")
    
    capability = AgenticCapability(
        provider=mock_llm,
        tools=[mock_rag],
        config=AgenticConfig(max_iterations=5),
    )
    
    events = []
    await capability.run(
        messages=[Message(role=Role.USER, content="What is X?")],
        on_event=events.append,
        cancelled=lambda: False,
    )
    
    # Verify tool was called
    tool_events = [e for e in events if e["type"] == "tool"]
    assert tool_events[0]["status"] == "calling"
    assert tool_events[1]["status"] == "result"
    
    # Verify final response was streamed
    content_events = [e for e in events if e["type"] == "content"]
    assert len(content_events) > 0
```

### I-3: Agentic Loop — Max Iterations

```python
async def test_agentic_forces_answer_at_max_iterations():
    # LLM always calls tools (never finishes)
    mock_llm = MockLLM(always_tool_call=True, forced_final="I ran out of steps")
    
    capability = AgenticCapability(
        provider=mock_llm,
        tools=[mock_tool],
        config=AgenticConfig(max_iterations=3),
    )
    
    events = []
    await capability.run(messages, on_event=events.append, cancelled=lambda: False)
    
    # Should have exactly 3 tool calls then a forced answer
    tool_events = [e for e in events if e["type"] == "tool" and e["status"] == "calling"]
    assert len(tool_events) == 3
    
    content_events = [e for e in events if e["type"] == "content"]
    assert len(content_events) > 0  # Forced final answer
```

### I-4: Lite Orchestrator Workflows

```python
async def test_lite_weakness_fetches_from_java_be():
    mock_llm = MockLLM(chunks=["Your weak areas are..."])
    mock_java = MockJavaClient(quiz_history=[
        {"quiz_title": "Algebra", "score": 3, "total": 10, ...}
    ])
    
    orchestrator = LiteOrchestrator(llm=mock_llm, java_client=mock_java)
    
    events = []
    await orchestrator.run(
        messages=[Message(role=Role.USER, content="What are my weak points?")],
        on_event=events.append,
        cancelled=lambda: False,
    )
    
    # Verify Java BE was called
    assert mock_java.get_called_with("/api/quiz-history")
    
    # Verify stage events
    stages = [e for e in events if e["type"] == "stage"]
    assert any(s["stage"] == "fetching_data" for s in stages)
    assert any(s["stage"] == "analyzing" for s in stages)
```

### I-5: Cancel Mid-Stream

```python
async def test_cancel_stops_streaming():
    mock_llm = MockLLM(chunks=["word"] * 100)  # Very long response
    capability = SimpleChatCapability(provider=mock_llm)
    
    cancel_flag = False
    events = []
    
    async def on_event(e):
        nonlocal cancel_flag
        events.append(e)
        if len([ev for ev in events if ev.get("type") == "content"]) >= 5:
            cancel_flag = True
    
    await capability.run(
        messages=[Message(role=Role.USER, content="Tell me everything")],
        on_event=on_event,
        cancelled=lambda: cancel_flag,
    )
    
    content_count = len([e for e in events if e["type"] == "content"])
    assert content_count < 100  # Stopped early
```

---

## Layer 4: End-to-End Tests

### E-1: Full WebSocket Conversation

```python
# Test file: tests/test_e2e.py

async def test_full_chat_conversation():
    async with websocket_connect("ws://localhost:8000/ws") as ws:
        # Handshake
        await ws.send_json({"type": "session_start", "tier": "full", "mode": "chat"})
        ack = await ws.receive_json()
        assert ack["type"] == "session_ack"
        assert ack["tier"] == "full"
        assert ack["mode"] == "chat"
        
        # Send message
        await ws.send_json({"type": "user_message", "content": "Hello"})
        
        # Collect response
        events = []
        while True:
            event = await ws.receive_json()
            events.append(event)
            if event["type"] == "done":
                break
        
        # Verify response structure
        assert any(e["type"] == "stage" for e in events)
        assert any(e["type"] == "content" for e in events)
        assert events[-1]["type"] == "done"
```

### E-2: Mode Switch

```python
async def test_mode_switch_preserves_history():
    async with websocket_connect("ws://localhost:8000/ws") as ws:
        await ws.send_json({"type": "session_start", "tier": "full", "mode": "chat"})
        await ws.receive_json()  # ack
        
        # Chat message
        await ws.send_json({"type": "user_message", "content": "I'm studying biology"})
        await collect_until_done(ws)
        
        # Switch to agentic
        await ws.send_json({"type": "mode_switch", "mode": "agentic"})
        ack = await ws.receive_json()
        assert ack["mode"] == "agentic"
        assert "available_tools" in ack
        
        # Agentic message (should remember biology context)
        await ws.send_json({"type": "user_message", "content": "Quiz me"})
        events = await collect_until_done(ws)
        # Should reference biology from earlier
```

---

## Test Prompts — Manual Validation

### Prompts for Chat Mode

| # | Prompt | Expected Behavior |
| --- | -------- | ------------------ |
| C-1 | "Hi" | Friendly greeting, asks how it can help |
| C-2 | "What is photosynthesis?" | Clear explanation, maybe asks if student wants more detail |
| C-3 | "I don't understand derivatives" | Patient explanation with examples |
| C-4 | "Thanks, that makes sense!" | Acknowledges, offers to continue |
| C-5 | "" (empty) | Handles gracefully (asks what they need help with) |
| C-6 | Very long message (5000 chars) | Handles without crashing, responds relevantly |
| C-7 | Non-English: "Bonjour" | Responds in same language or asks to clarify |

### Prompts for Lite Agentic Mode

| # | Prompt | Expected Intent | Expected Behavior |
| --- | -------- | ---------------- | ------------------ |
| LA-1 | "What are my weak areas?" | WEAKNESS | Fetches history, analyzes, recommends |
| LA-2 | "What should I study next?" | RECOMMEND | Fetches history + quizzes, recommends |
| LA-3 | "Explain mitosis" | EXPLAIN | Direct LLM response about mitosis |
| LA-4 | "Quiz me on history" | QUIZ | Generates quiz (via code workflow) |
| LA-5 | "Solve 2x + 3 = 7" | SOLVE | Step-by-step solution |
| LA-6 | "How's the weather?" | GENERAL | Chat response (no data fetch) |
| LA-7 | "My weak points in physics" | WEAKNESS | Subject param extracted: "physics" |

### Prompts for Full Agentic Mode

| # | Prompt | Expected Tools Called | Expected Output |
| --- | -------- | --------------------- | ---------------- |
| FA-1 | "What does chapter 3 say about X?" | rag | Response citing KB |
| FA-2 | "Quiz me on photosynthesis" | rag → generate_quiz | 5-question quiz |
| FA-3 | "Solve x² - 5x + 6 = 0" | solve_problem | Step-by-step solution |
| FA-4 | "How am I doing in math?" | quiz_history | Performance analysis |
| FA-5 | "What should I focus on?" | quiz_history → recommend | Personalized recommendations |
| FA-6 | "What is the current GDP of Japan?" | web_search | Answer with source |
| FA-7 | "Think carefully: is 0.999... = 1?" | reason | Deep analysis with proof |

### Edge Case Prompts

| # | Prompt | What It Tests |
| --- | -------- | -------------- |
| E-1 | "Solve" (just the word) | Handles vague input |
| E-2 | "Quiz me quiz me quiz me" | Doesn't duplicate/loop |
| E-3 | Rapid-fire 5 messages in 1 second | Rate limiting / queueing |
| E-4 | Message during active streaming | Queued or rejected properly |
| E-5 | XSS attempt: `<script>alert('x')</script>` | Input sanitized |
| E-6 | SQL injection: `'; DROP TABLE users; --` | Input treated as plain text |
| E-7 | Extremely long message (50KB) | Rejected with error (max size) |
| E-8 | Unicode/emoji: "Explain 数学 🧮" | Handles correctly |

---

## Acceptance Checklist

### Phase 1: Foundation

- [ ] FastAPI app starts without errors
- [ ] `GET /health` returns 200
- [ ] WebSocket accepts connection at `/ws`
- [ ] `session_start` returns `session_ack`
- [ ] Invalid `session_start` returns error
- [ ] LM Studio provider connects (or fails gracefully)
- [ ] DeepSeek provider authenticates (or fails gracefully)
- [ ] Config loads from environment variables

### Phase 2: Core Chat

- [ ] Full Chat: sends message → receives streamed response
- [ ] Lite Chat: sends message → receives streamed response (local model)
- [ ] Multi-turn: 3+ messages maintain context
- [ ] Cancel: stop message halts generation
- [ ] RAG injection: KB context appears in response (Full mode)
- [ ] History trimming: doesn't crash with 50+ messages
- [ ] Empty message handled gracefully

### Phase 3: Agentic Engine

- [ ] Agentic loop: LLM calls a tool, gets result, responds
- [ ] RAG tool: searches Supabase, returns results
- [ ] Reason tool: makes thinking call, returns analysis
- [ ] Quiz history tool: calls Java BE, returns formatted data
- [ ] Recommend tool: calls Java BE, returns recommendations
- [ ] Web search tool: searches web, returns results
- [ ] Max iterations: loop terminates with forced answer
- [ ] Tool error: returns error string (doesn't crash)
- [ ] Tool timeout: 30s limit enforced
- [ ] Argument augmentation: user_id/kb_id injected

### Phase 4: Learning Features

- [ ] Quiz generation: produces valid Quiz JSON (5 questions)
- [ ] Quiz: MC has exactly 4 options, 1 correct
- [ ] Quiz: JSON repair handles malformed LLM output
- [ ] Step solver: creates 3-7 step plan
- [ ] Step solver: executes each step with reasoning
- [ ] Step solver: produces final answer with confidence
- [ ] Lite Orchestrator: classifies intents correctly (all 6 types)
- [ ] Lite Orchestrator: weakness workflow fetches data + analyzes
- [ ] Lite Orchestrator: recommend workflow fetches data + suggests
- [ ] Mode switch: changes capability, preserves history

### Cross-Cutting

- [ ] No unhandled exceptions kill the WebSocket
- [ ] Stage events bracket all operations
- [ ] Content events stream tokens individually
- [ ] Error events have code + message
- [ ] Done event sent after every response
- [ ] Max message size enforced (64KB)
- [ ] API keys never logged
- [ ] Conversation history doesn't grow unbounded

---

## Mock Objects for Testing

```python
# tests/mocks.py

class MockLLM(LLMService):
    """Mock LLM that returns predefined responses."""
    
    def __init__(self, chunks=None, responses=None, always_tool_call=False):
        self.chunks = chunks or ["Mock response"]
        self.responses = responses  # For multi-iteration tests
        self.call_count = 0
    
    async def complete(self, messages, tools=None, **kwargs):
        if self.responses:
            response = self.responses[min(self.call_count, len(self.responses) - 1)]
            self.call_count += 1
            for chunk in response:
                yield chunk
        else:
            for text in self.chunks:
                yield StreamChunk(type=ChunkType.CONTENT, content=text)
            yield StreamChunk(type=ChunkType.FINISH, finish_reason="stop")


class MockTool(BaseTool):
    """Mock tool that returns a predefined result."""
    
    def __init__(self, name="mock_tool", result="Mock result"):
        self._name = name
        self._result = result
    
    @property
    def name(self): return self._name
    @property
    def description(self): return f"Mock {self._name}"
    def parameters_schema(self): return {"type": "object", "properties": {}, "required": []}
    async def execute(self, arguments): return self._result


class MockJavaClient:
    """Mock Java BE client."""
    
    def __init__(self, quiz_history=None, recommendations=None, available_quizzes=None):
        self.quiz_history = quiz_history or []
        self.recommendations = recommendations or []
        self.available_quizzes = available_quizzes or []
        self.calls = []
    
    async def get(self, path, params=None):
        self.calls.append((path, params))
        if "quiz-history" in path:
            return MockResponse(self.quiz_history)
        elif "recommendations" in path:
            return MockResponse(self.recommendations)
        elif "available" in path:
            return MockResponse(self.available_quizzes)
        return MockResponse([])
    
    def get_called_with(self, path):
        return any(p == path for p, _ in self.calls)
```

---

## Test File Structure

```text
tests/
├── conftest.py              ← Shared fixtures (mock_llm, mock_config, etc.)
├── mocks.py                 ← MockLLM, MockTool, MockJavaClient
├── test_smoke.py            ← Layer 1: startup, health, WS connect
├── test_intent_classifier.py ← Layer 2: intent classification
├── test_quiz_parser.py      ← Layer 2: quiz JSON parsing
├── test_tools.py            ← Layer 2: tool schemas + formatting
├── test_chat.py             ← Layer 3: chat capability integration
├── test_agentic.py          ← Layer 3: agentic loop integration
├── test_lite_orchestrator.py ← Layer 3: lite workflows
├── test_cancel.py           ← Layer 3: cancellation behavior
└── test_e2e.py              ← Layer 4: full WebSocket flows
```
