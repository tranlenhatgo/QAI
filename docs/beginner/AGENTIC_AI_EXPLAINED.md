# Agentic AI Explained — How DeepTutor Thinks and Acts

> **Audience**: ML beginners who want to understand why DeepTutor is different
> from a regular chatbot.  
> **Key insight**: A regular chatbot just generates text. An agentic AI
> **decides what to do**, does it, reads the result, and keeps going until
> the task is done.

---

## 1. The Fundamental Difference

### Regular Chatbot (Non-Agentic)

```text
User: "What's in Chapter 3 of my textbook?"
     ↓
LLM generates text based on what it was trained on
     ↓
Response: "I don't have access to your textbook." ← stuck!
```

### Agentic AI (DeepTutor)

```text
User: "What's in Chapter 3 of my textbook?"
     ↓
LLM THINKS: "I need to search the user's knowledge base"
     ↓
LLM CALLS TOOL: rag(query="Chapter 3 content", kb_name="textbook")
     ↓
Tool returns: relevant passages from Chapter 3
     ↓
LLM READS the result and generates an informed answer
     ↓
Response: "Chapter 3 covers photosynthesis. Specifically..." ← grounded!
```

The magic is that **the LLM itself decides** to call the tool. No one
hard-coded "if user mentions chapter → search KB". The model understands
the intent and picks the right action.

---

## 2. The Agentic Loop — Step by Step

DeepTutor's core agentic engine (`deeptutor/core/agentic/loop.py`) works like
this:

```text
┌─────────────────────────────────────────────────────┐
│                   AGENTIC LOOP                       │
│                                                     │
│  ┌───────────┐    ┌──────────┐    ┌─────────────┐ │
│  │   THINK   │───→│   ACT    │───→│   OBSERVE   │ │
│  │ (reason)  │    │(call tool)│    │(read result)│ │
│  └───────────┘    └──────────┘    └─────────────┘ │
│       ↑                                    │       │
│       └────────────────────────────────────┘       │
│                 repeat until done                   │
│                                                     │
│  Exit conditions:                                   │
│    • LLM emits ``FINISH`` label → done             │
│    • Max iterations reached → forced finalization   │
│    • Error / cancellation                           │
└─────────────────────────────────────────────────────┘
```

### Each Iteration

1. **LLM receives**: conversation history + tool results from last iteration
2. **LLM responds** with a label on the first line:
   - `` `THINK` `` → reasoning out loud (no action, continues loop)
   - `` `TOOL` `` → wants to call one or more tools
   - `` `FINISH` `` → ready to give the final answer
3. **System processes** the label:
   - THINK: saves the reasoning text, goes to next iteration
   - TOOL: executes the requested tools, appends results, goes to next iteration
   - FINISH: streams the answer to the user, loop ends

---

## 3. What Are "Tools"? (Level 1)

A tool is a **function** the LLM can call. Think of it like giving a student
access to a calculator, a dictionary, and a library card — they decide when
to use each one.

### Anatomy of a Tool

```python
class RAGTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="rag",
            description="Retrieve passages from a knowledge base.",
            parameters=[
                ToolParameter(name="query", type="string", description="Search query."),
                ToolParameter(name="kb_name", type="string", description="KB to search."),
            ],
        )

    async def execute(self, **kwargs) -> ToolResult:
        # Actually search the knowledge base
        result = await rag_search(query=kwargs["query"], kb_name=kwargs["kb_name"])
        return ToolResult(content=result["answer"], sources=result["sources"])
```

### How the LLM Knows About Tools

Before the agentic loop starts, DeepTutor sends the LLM a **tool schema**:

```json
{
  "type": "function",
  "function": {
    "name": "rag",
    "description": "Retrieve passages from a knowledge base.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {"type": "string"},
        "kb_name": {"type": "string"}
      },
      "required": ["query", "kb_name"]
    }
  }
}
```

The LLM reads this and understands: "I can call `rag` with a `query` and
`kb_name` to get information."

### DeepTutor's Built-in Tools

| Tool | What It Does | Analogy |
| ------ | ------------- | --------- |
| `rag` | Search user's uploaded documents | Library card |
| `web_search` | Search the internet | Google |
| `code_execution` | Run Python code in sandbox | Calculator |
| `reason` | Deep thinking via dedicated LLM call | Quiet thinking time |
| `brainstorm` | Generate multiple ideas | Whiteboard |
| `paper_search` | Search academic papers (arXiv) | Academic database |

---

## 4. What Are "Capabilities"? (Level 2)

Capabilities are **multi-step pipelines** that coordinate multiple LLM calls
and tools to solve complex problems.

### Capability vs. Tool

| | Tool (Level 1) | Capability (Level 2) |
| --- | --- | --- |
| Complexity | One function | Multi-step pipeline |
| Who calls it? | The LLM decides | The user selects |
| Duration | Milliseconds–seconds | Seconds–minutes |
| Example | `web_search("climate change")` | `deep_solve("Prove theorem X")` |

### DeepTutor's Capabilities

```text
┌─────────────────────────────────────────────────────────┐
│ chat          │ Default. LLM responds, calling tools    │
│               │ as needed via the agentic loop.         │
├───────────────┼─────────────────────────────────────────┤
│ deep_solve    │ Plan → Solve each step → Synthesize.   │
│               │ Like a math tutor showing their work.   │
├───────────────┼─────────────────────────────────────────┤
│ deep_question │ Generate → Evaluate → Refine questions.│
│               │ Creates practice problems from content. │
├───────────────┼─────────────────────────────────────────┤
│ deep_research │ Multi-agent research + full report.    │
│               │ Like having a research assistant.       │
└───────────────┴─────────────────────────────────────────┘
```

### Example: deep_solve Pipeline

```text
User: "Solve the integral of x²·sin(x) dx"
      ↓
Stage 1: PLANNING
  LLM creates a plan:
    Step 1: Identify integration technique (integration by parts)
    Step 2: Apply IBP formula
    Step 3: Solve remaining integral
    Step 4: Combine and simplify
      ↓
Stage 2: REASONING (for each step)
  Step 1: [THINK] → [TOOL: code_execution] → [FINISH: step result]
  Step 2: [THINK] → [FINISH: step result]
  Step 3: [THINK] → [TOOL: code_execution] → [FINISH: step result]
  Step 4: [THINK] → [FINISH: step result]
      ↓
Stage 3: WRITING
  LLM synthesizes all step results into a coherent explanation
      ↓
Final response streamed to user
```

---

## 5. The Label Protocol — How DeepTutor Controls the LLM

Regular LLMs produce free-form text. But in an agentic system, we need the
model to clearly signal its *intent*. DeepTutor uses a **label protocol**:

### The Rule

Every LLM response in the agentic loop must start with a backtick-wrapped
label:

```text
``THINK``
I need to figure out what integration technique to use. The integrand is
x²·sin(x), which is a product of polynomial and trigonometric functions.
Integration by parts seems appropriate.
```

```text
``TOOL``
[calls: code_execution(code="from sympy import *; x = Symbol('x'); integrate(x**2 * sin(x), x)")]
```

```text
``FINISH``
The integral of x²·sin(x) dx = -x²·cos(x) + 2x·sin(x) + 2·cos(x) + C
```

### Why Labels?

Without labels, the system can't tell if the model is:

- Thinking out loud (don't show to user, don't execute anything)
- Requesting a tool call (need to execute and feed result back)
- Done (stop the loop, stream answer to user)

Labels make the LLM's intent machine-readable.

### Label Sets by Capability

| Capability | Labels | Meaning |
| --- | --- | --- |
| chat | `FINISH`, `TOOL`, `THINK` | Answer / Call tool / Reason |
| deep_solve (step) | `FINISH`, `TOOL`, `THINK`, `REPLAN` | + Request plan revision |
| deep_solve (plan) | `PLAN` | Output the plan |
| deep_question | `FINISH`, `TOOL`, `THINK`, `APPEND` | + Add to queue |

---

## 6. Streaming — Real-Time Communication

Instead of waiting for the entire response, DeepTutor streams events to the
user in real-time:

```text
Event 1: {type: "stage_start", stage: "thinking", source: "chat"}
Event 2: {type: "thinking", content: "Searching knowledge base..."}
Event 3: {type: "tool_call", content: "rag", metadata: {query: "..."}}
Event 4: {type: "tool_result", content: "Found 3 passages..."}
Event 5: {type: "content", content: "Based on your textbook, "}
Event 6: {type: "content", content: "Chapter 3 covers..."}
Event 7: {type: "stage_end", stage: "thinking"}
Event 8: {type: "done"}
```

Each event flows through the `StreamBus`:

```text
LLM → StreamBus → [CLI renderer | WebSocket pusher | JSON writer]
```

Multiple consumers can subscribe to the same stream simultaneously.

---

## 7. Non-Agentic vs. Agentic — Decision Tree

```text
User message arrives
       ↓
Does the user have a capability selected?
  ├── YES → Route to that capability (deep_solve, deep_question, etc.)
  └── NO → Route to "chat" capability
              ↓
         Does chat have tools enabled?
           ├── YES → Run agentic loop (LLM can call tools)
           └── NO → Simple completion (just generate text)
```

### When is Agentic Better?

| Scenario | Non-Agentic | Agentic |
| ---------- | ------------ | --------- |
| "Hi, how are you?" | ✅ Fine | ❌ Overkill |
| "What does my textbook say about X?" | ❌ Can't access docs | ✅ Calls RAG |
| "Solve this equation step by step" | ⚠️ May hallucinate | ✅ Verifies with code |
| "Find recent papers on topic Y" | ❌ Knowledge cutoff | ✅ Searches arXiv |

---

## 8. Safety Mechanisms

### Max Iterations

The loop has a hard limit (typically 10–15 iterations). If the LLM keeps
calling tools without reaching `FINISH`, the system forces finalization:

```python
if iteration >= max_iterations:
    # Ask LLM one final time: "Answer now with what you have"
    force_finalize()
```

### Protocol Violations

If the LLM doesn't start with a valid label, DeepTutor:

1. Marks it as a protocol violation
2. Sends a repair message explaining the correct format
3. Retries the iteration (up to a limit)

### Tool Execution Sandboxing

Tools like `code_execution` run in sandboxed environments. The LLM can't
access the filesystem or network from inside code execution.

---

## 9. The Big Picture

```text
┌─────────── DeepTutor Architecture (Agentic View) ──────────────┐
│                                                                  │
│  User ←──WebSocket──→ Orchestrator ←→ Capability (e.g., chat)  │
│                                              ↓                   │
│                                     ┌─── Agentic Loop ────┐     │
│                                     │                      │     │
│                                     │  LLM ←→ Labels       │     │
│                                     │   ↓                  │     │
│                                     │  Tool Dispatch       │     │
│                                     │   ↓         ↓        │     │
│                                     │  RAG    WebSearch    │     │
│                                     │   ↓         ↓        │     │
│                                     │  VectorDB  Internet  │     │
│                                     │                      │     │
│                                     └──────────────────────┘     │
│                                              ↓                   │
│                                     StreamBus → User             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 10. Key Takeaways for Beginners

1. **Agentic ≠ magic** — it's a while-loop where the LLM decides each iteration
2. **Tools are just functions** with a JSON schema describing their inputs
3. **Labels are the control mechanism** — they tell the system what the LLM wants
4. **Streaming makes it feel fast** — events flow token by token
5. **Safety limits prevent infinite loops** — max iterations + forced finalization
6. **The LLM reads tool results** — it's a conversation between the model and the tools
7. **Capabilities orchestrate multiple loops** — deep_solve runs separate agentic loops for each step of a problem

---

## Further Reading

| Topic | File |
| ------- | ------ |
| Full glossary of terms | [GLOSSARY.md](GLOSSARY.md) |
| RAG in depth | [RAG_EXPLAINED.md](RAG_EXPLAINED.md) |
| How LLMs actually work | [HOW_LLMS_WORK.md](HOW_LLMS_WORK.md) |
| Architecture diagrams | [VISUAL_ARCHITECTURE.md](VISUAL_ARCHITECTURE.md) |
| Tool implementation details | [../coder/LEVEL1_TOOLS_DEEP_DIVE.md](../coder/LEVEL1_TOOLS_DEEP_DIVE.md) |
| Capability details | [../coder/LEVEL2_CORE_CAPABILITIES.md](../coder/LEVEL2_CORE_CAPABILITIES.md) |
