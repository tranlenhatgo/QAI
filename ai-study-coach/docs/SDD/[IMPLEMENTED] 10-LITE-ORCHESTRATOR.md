# 10 — Lite Orchestrator (Code-Driven Agentic)

## Purpose

Implement the agentic mode for Lite tier where the **code decides what to do** (not the LLM). The local model is too weak for reliable tool calling, so the orchestration logic uses intent classification + hardcoded workflows to gather data and compose prompts before calling the LLM.

---

## Design Philosophy

```text
FULL AGENTIC (Cloud):   LLM decides → calls tools → LLM synthesizes
LITE AGENTIC (Local):   Code classifies intent → code gathers data → LLM analyzes
```

The LLM in Lite mode only does **one thing**: generate text given a well-crafted prompt with pre-gathered context. It never picks tools, never emits JSON, never makes decisions about what to call.

---

## Interface Contract

```python
class LiteOrchestrator:
    """
    Code-driven orchestration for Lite Agentic mode.
    
    1. Classify user intent (code-based, not LLM-based)
    2. Execute the appropriate workflow (fetch data, gather context)
    3. Build a rich prompt with all context
    4. Call LLM once for the final response
    """

    async def run(
        self,
        messages: list[Message],
        on_event: Callable[[dict], Awaitable[None]],
        cancelled: Callable[[], bool],
    ) -> None:
        """Same interface as AgenticCapability for interchangeability."""
```

---

## Data Shapes

```python
class Intent(str, Enum):
    """User intent categories that the orchestrator can handle."""
    GENERAL_CHAT = "general_chat"        # Normal conversation
    WEAKNESS_ANALYSIS = "weakness"       # "What are my weak points?"
    QUIZ_RECOMMEND = "recommend"         # "What should I study next?"
    EXPLAIN_TOPIC = "explain"            # "Explain X from my notes"
    SUMMARIZE = "summarize"              # "Summarize chapter 3"
    QUIZ_REQUEST = "quiz"                # "Quiz me on photosynthesis"
    SOLVE_PROBLEM = "solve"              # "Solve this equation"

@dataclass
class IntentResult:
    """Result of intent classification."""
    intent: Intent
    confidence: float         # 0.0 - 1.0
    extracted_params: dict    # e.g., {"topic": "photosynthesis", "subject": "biology"}
```

---

## Behavior Specification

### Main Loop

```python
# server/capabilities/lite_orchestrator.py

class LiteOrchestrator:
    def __init__(
        self,
        llm: LLMService,
        java_client: JavaClient,
        config: AppConfig,
    ):
        self.llm = llm
        self.java_client = java_client
        self.classifier = IntentClassifier()
        self.config = config
    
    def tool_names(self) -> list[str]:
        return ["weakness_analysis", "recommendations", "explain", "quiz", "solve"]
    
    async def run(self, messages, on_event, cancelled):
        user_message = messages[-1].content
        
        # Step 1: Classify intent
        intent_result = self.classifier.classify(user_message)
        
        # Step 2: Route to workflow
        if intent_result.intent == Intent.GENERAL_CHAT:
            await self._simple_chat(messages, on_event, cancelled)
        
        elif intent_result.intent == Intent.WEAKNESS_ANALYSIS:
            await self._weakness_workflow(messages, intent_result, on_event, cancelled)
        
        elif intent_result.intent == Intent.QUIZ_RECOMMEND:
            await self._recommend_workflow(messages, intent_result, on_event, cancelled)
        
        elif intent_result.intent == Intent.EXPLAIN_TOPIC:
            await self._explain_workflow(messages, intent_result, on_event, cancelled)
        
        elif intent_result.intent == Intent.QUIZ_REQUEST:
            await self._quiz_workflow(messages, intent_result, on_event, cancelled)
        
        elif intent_result.intent == Intent.SOLVE_PROBLEM:
            await self._solve_workflow(messages, intent_result, on_event, cancelled)
        
        else:
            await self._simple_chat(messages, on_event, cancelled)
```

### Intent Classifier (Rule-Based)

```python
# server/capabilities/lite_orchestrator.py

class IntentClassifier:
    """
    Rule-based intent classification.
    Uses keyword matching + patterns — no LLM needed.
    Fast, deterministic, works offline.
    """
    
    PATTERNS = {
        Intent.WEAKNESS_ANALYSIS: [
            r"weak\s*(point|area|spot|ness)",
            r"what.*(struggle|bad at|improve|failing)",
            r"(my|which).*(mistakes|errors|wrong)",
            r"(analyze|review).*(performance|results|history)",
            r"where.*(need|should).*(improve|focus|work)",
        ],
        Intent.QUIZ_RECOMMEND: [
            r"(what|which).*(should|can|do).*(study|review|practice|take)",
            r"recommend.*(quiz|topic|subject|study)",
            r"(next|suggest).*(quiz|topic|study|lesson)",
            r"what.*(next|focus on)",
        ],
        Intent.EXPLAIN_TOPIC: [
            r"explain\s+",
            r"what\s+(is|are|does|do)\s+",
            r"how\s+(does|do|is|are)\s+",
            r"(tell|teach)\s+me\s+about",
            r"(define|describe|clarify)\s+",
        ],
        Intent.QUIZ_REQUEST: [
            r"quiz\s+me",
            r"(test|assess|check)\s+(my|me)",
            r"(give|create|generate|make).*(quiz|question|test)",
            r"practice\s+question",
        ],
        Intent.SOLVE_PROBLEM: [
            r"solve\s+",
            r"(calculate|compute|find|determine)\s+",
            r"(how|help).*(solve|answer|work out)",
            r"step.*(by|-).*step",
            r"(what|find)\s+(is|are)\s+.*\?",
        ],
    }
    
    def classify(self, text: str) -> IntentResult:
        """Classify user message into an intent."""
        text_lower = text.lower().strip()
        
        best_intent = Intent.GENERAL_CHAT
        best_confidence = 0.0
        extracted_params = {}
        
        for intent, patterns in self.PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    # Multiple pattern matches increase confidence
                    confidence = 0.7
                    matches = sum(1 for p in patterns if re.search(p, text_lower))
                    confidence = min(0.95, 0.5 + matches * 0.15)
                    
                    if confidence > best_confidence:
                        best_confidence = confidence
                        best_intent = intent
        
        # Extract topic/subject from the message
        extracted_params = self._extract_params(text_lower, best_intent)
        
        return IntentResult(
            intent=best_intent,
            confidence=best_confidence,
            extracted_params=extracted_params,
        )
    
    def _extract_params(self, text: str, intent: Intent) -> dict:
        """Extract relevant parameters from the message."""
        params = {}
        
        # Extract topic after key verbs
        topic_match = re.search(
            r"(?:explain|about|on|quiz me on|study|review|solve)\s+(.+?)(?:\?|$|\.)",
            text
        )
        if topic_match:
            params["topic"] = topic_match.group(1).strip()
        
        # Extract subject mentions
        subjects = ["math", "physics", "chemistry", "biology", "history", "english", "computer science"]
        for subject in subjects:
            if subject in text:
                params["subject"] = subject
                break
        
        return params
```

### Workflow: Weakness Analysis

```python
async def _weakness_workflow(self, messages, intent_result, on_event, cancelled):
    """
    1. Fetch quiz history from Java BE
    2. Build analysis prompt with data
    3. LLM analyzes and suggests improvements
    """
    await on_event({"type": "stage", "stage": "fetching_data", "status": "start"})
    
    # Code fetches data (not LLM)
    quiz_history = await self.java_client.get(
        "/api/quiz-history",
        params={"userId": self.user_id, "limit": 20}
    )
    
    await on_event({"type": "stage", "stage": "fetching_data", "status": "end"})
    await on_event({"type": "stage", "stage": "analyzing", "status": "start"})
    
    # Build rich prompt with all data pre-gathered
    subject = intent_result.extracted_params.get("subject", "all subjects")
    
    analysis_prompt = f"""Analyze this student's quiz history and identify their weak areas.

Quiz History (last 20 results):
{self._format_quiz_history(quiz_history)}

Student's question: {messages[-1].content}
Focus area: {subject}

Provide:
1. Top 3 weak areas (with evidence from quiz scores)
2. Specific topics to review
3. Recommended study strategy
4. Encouragement based on their progress

Be specific — reference actual quiz scores and topics."""
    
    # Single LLM call with all context
    full_messages = [
        Message(role=Role.SYSTEM, content="You are a supportive study coach analyzing a student's performance."),
        Message(role=Role.USER, content=analysis_prompt),
    ]
    
    response_content = ""
    async for chunk in self.llm.complete(full_messages):
        if cancelled():
            break
        if chunk.type == ChunkType.CONTENT:
            response_content += chunk.content
            await on_event({"type": "content", "content": chunk.content})
    
    await on_event({"type": "stage", "stage": "analyzing", "status": "end"})
    messages.append(Message(role=Role.ASSISTANT, content=response_content))
```

### Workflow: Quiz Recommendation

```python
async def _recommend_workflow(self, messages, intent_result, on_event, cancelled):
    """
    1. Fetch quiz history + available quizzes from Java BE
    2. Build recommendation prompt
    3. LLM generates personalized recommendations
    """
    await on_event({"type": "stage", "stage": "fetching_data", "status": "start"})
    
    # Fetch both history and available quizzes
    quiz_history = await self.java_client.get(
        "/api/quiz-history", params={"userId": self.user_id, "limit": 10}
    )
    available_quizzes = await self.java_client.get(
        "/api/quizzes/available", params={"userId": self.user_id}
    )
    
    await on_event({"type": "stage", "stage": "fetching_data", "status": "end"})
    await on_event({"type": "stage", "stage": "recommending", "status": "start"})
    
    goal = intent_result.extracted_params.get("topic", "general improvement")
    
    prompt = f"""Based on this student's history and available quizzes, recommend what they should study next.

Recent Quiz History:
{self._format_quiz_history(quiz_history)}

Available Quizzes:
{self._format_available_quizzes(available_quizzes)}

Student's goal: {goal}

Recommend 3-5 specific actions (quizzes to take, topics to review).
For each recommendation, explain WHY based on their history."""
    
    full_messages = [
        Message(role=Role.SYSTEM, content="You are a study advisor making personalized recommendations."),
        Message(role=Role.USER, content=prompt),
    ]
    
    response_content = ""
    async for chunk in self.llm.complete(full_messages):
        if cancelled():
            break
        if chunk.type == ChunkType.CONTENT:
            response_content += chunk.content
            await on_event({"type": "content", "content": chunk.content})
    
    await on_event({"type": "stage", "stage": "recommending", "status": "end"})
    messages.append(Message(role=Role.ASSISTANT, content=response_content))
```

### Workflow: Simple Chat (Fallback)

```python
async def _simple_chat(self, messages, on_event, cancelled):
    """Fallback: just chat with the LLM, no data gathering."""
    await on_event({"type": "stage", "stage": "responding", "status": "start"})
    
    full_messages = [
        Message(role=Role.SYSTEM, content=LITE_SYSTEM_PROMPT),
        *messages[-10:],  # Last 5 turns
    ]
    
    response_content = ""
    async for chunk in self.llm.complete(full_messages):
        if cancelled():
            break
        if chunk.type == ChunkType.CONTENT:
            response_content += chunk.content
            await on_event({"type": "content", "content": chunk.content})
    
    await on_event({"type": "stage", "stage": "responding", "status": "end"})
    messages.append(Message(role=Role.ASSISTANT, content=response_content))
```

---

## Comparison: Lite vs Full Agentic

| Aspect | Lite (Code-Driven) | Full (LLM-Driven) |
| -------- | ------------------- | ------------------- |
| Who picks the action? | Code (regex classifier) | LLM (function calling) |
| Tool execution | Code calls APIs directly | LLM requests tool call, engine executes |
| LLM calls per turn | 1 (final response) | 2-5 (think + tools + respond) |
| Reliability | High (deterministic routing) | Medium (LLM may misuse tools) |
| Flexibility | Low (only handles known intents) | High (handles novel requests) |
| Latency | Fast (1 LLM call) | Slower (multiple LLM calls) |
| Model requirement | Any model (even 2B) | Needs function-calling capable model |
| Cost | Minimal | 2-5× more tokens |

---

## Extending with New Workflows

To add a new capability to Lite mode:

```python
# 1. Add intent pattern
Intent.NEW_WORKFLOW = "new_workflow"

# 2. Add patterns to IntentClassifier.PATTERNS
PATTERNS[Intent.NEW_WORKFLOW] = [
    r"pattern1",
    r"pattern2",
]

# 3. Add workflow method
async def _new_workflow(self, messages, intent_result, on_event, cancelled):
    # Fetch data from Java BE
    data = await self.java_client.get("/api/some-endpoint")
    # Build prompt
    prompt = f"Analyze this data: {data}"
    # Call LLM once
    await self._llm_respond(prompt, messages, on_event, cancelled)

# 4. Add routing in run()
elif intent_result.intent == Intent.NEW_WORKFLOW:
    await self._new_workflow(messages, intent_result, on_event, cancelled)
```

---

## Acceptance Criteria

- [ ] Intent classifier correctly identifies all 6 intent types
- [ ] `GENERAL_CHAT` is the fallback for unrecognized messages
- [ ] Weakness workflow fetches quiz history from Java BE before calling LLM
- [ ] Recommend workflow fetches both history and available quizzes
- [ ] LLM is called exactly ONCE per workflow (after all data is gathered)
- [ ] Stage events show what the system is doing (fetching, analyzing, etc.)
- [ ] Content is streamed from the LLM call
- [ ] Cancel works at any point during the workflow
- [ ] Java BE unavailable → graceful error (not crash)
- [ ] Same `run()` interface as `AgenticCapability` (interchangeable)
- [ ] Works with LM Studio (no tool definitions sent to model)
- [ ] Conversation history is maintained across turns
- [ ] Intent extraction captures topic/subject parameters

---

## Dependencies

- `server/llm/base.py` — LLMService
- `server/services/java_client.py` — Java BE HTTP client
- `re` (stdlib) — regex for intent classification

---

## DeepTutor Reference

| This Module | DeepTutor Equivalent | What Changed |
| ------------- | --------------------- | -------------- |
| `LiteOrchestrator` | N/A (new concept) | DeepTutor assumes all models can call tools |
| `IntentClassifier` | `deeptutor/capabilities/auto/` auto-router | LLM-based routing → regex-based routing |
| Workflow pattern | `deeptutor/capabilities/deep_solve/` (phase-based) | Same concept: gather → process → respond |
| Data gathering | Tool execution in agentic loop | Code does it directly, not via tool protocol |

### Why This Pattern Exists

DeepTutor's agentic loop requires the LLM to:

1. Understand tool definitions
2. Decide WHEN to call tools
3. Format tool call arguments as JSON
4. Interpret tool results
5. Decide when it has enough info to answer

A 2-4B local model (Gemma 4 E2B) **cannot reliably do any of these**. The Lite Orchestrator solves this by moving all decision-making to deterministic code, leaving the LLM to do what it's good at: generating natural language from a well-structured prompt.
