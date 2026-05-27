# AGENT_ANSWER: How Does the LLM "Decide" to Call a Tool?

## The Mechanism

The **AI Coach code does NOT decide** which tool to call. The **LLM (DeepSeek) decides** — the AI Coach just executes whatever the LLM requests.

Here's exactly how it works:

## Step 1: AI Coach Sends Everything to DeepSeek

```python
# agentic.py → AgenticCapability.run()
tool_defs = [t.definition() for t in self.tools.values()]  # all tool schemas

async for chunk in self.llm.complete(full_messages, tools=tool_defs):
    # wait for LLM to respond...
```

## Step 2: DeepSeek Provider Builds the API Request

```python
# deepseek.py → DeepSeekProvider.complete()
payload = {
    "model": "deepseek-chat",
    "messages": [...],      # system prompt + context + history + user message
    "tools": [              # ALL tool schemas sent every time
        {
            "type": "function",
            "function": {
                "name": "quiz_history",
                "description": "Fetch the student's quiz history...",
                "parameters": { "type": "object", ... }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "recommend",
                "description": "Suggest study topics...",
                "parameters": { "type": "object", ... }
            }
        },
        # ... all other tools
    ],
    "tool_choice": "auto",  # KEY: LLM chooses freely
    "stream": True,
}
```

## Step 3: DeepSeek LLM Makes the Decision

The LLM (running on DeepSeek's servers) reads:

1. **System prompt** — says "Use 'recommend' after analyzing weaknesses"
2. **Tool definitions** — names, descriptions, parameter schemas
3. **User message** — e.g., "What should I study?"

Based on its training on function-calling datasets, the LLM outputs either:

- **Content tokens** (a text response), OR
- **A `tool_calls` instruction** (asking the AI Coach to execute a tool)

The LLM returns something like:

```json
{
  "choices": [{
    "delta": {
      "tool_calls": [{
        "id": "call_abc123",
        "function": {
          "name": "quiz_history",
          "arguments": "{\"limit\": 10}"
        }
      }]
    },
    "finish_reason": "tool_calls"
  }]
}
```

## Step 4: AI Coach Blindly Executes

```python
# agentic.py (simplified loop)
if tool_calls:  # LLM requested tools
    for tc in tool_calls:
        tool = self.tools.get(tc["name"])     # find the tool by name
        result = await tool.execute(tc["arguments"])  # run it
        # Send result back to LLM as a "tool" message
    # Loop: call LLM again with the tool result -> LLM may call another tool or respond
else:
    # No tool calls -> LLM gave a text response -> stream to user
    return
```

## The "Decision" is Pure LLM Inference

There is NO rule engine, NO if/else chain, NO code logic choosing tools. The decision process is:

```text
+----------------------------------------------+
| DeepSeek LLM (neural network)                |
|                                              |
| Input:                                       |
|   system: "Use 'recommend' after analyzing   |
|            weaknesses..."                    |
|   tools:  [quiz_history, recommend, ...]     |
|   user:   "What should I study?"             |
|                                              |
| The model was trained on millions of         |
| function-calling examples. It learned:       |
|   - "What should I study?" -> needs data     |
|   - quiz_history has relevant data           |
|   - Call quiz_history first                  |
|                                              |
| Output: tool_calls: [{name: "quiz_history"}] |
+----------------------------------------------+
```

## The `tool_choice: "auto"` Setting

```python
payload["tool_choice"] = "auto"
```

This tells DeepSeek: "You may call zero, one, or more tools — your choice."

Other options (not used):

- `"none"` — never call tools (just respond with text)
- `{"type": "function", "function": {"name": "quiz_history"}}` — force a specific tool

## Why It Calls quiz_history Before recommend

The system prompt in `agentic.py` says:

> "Use 'recommend' after analyzing weaknesses"

And `quiz_history`'s description says:

> "Fetch the student's quiz history including scores, categories, and recent performance. Use this to understand what the student has studied and where they need help."

The LLM reads these and infers the logical order:

1. Need data first → call `quiz_history`
2. Got data → can now identify weak areas
3. Have weak areas → call `recommend(weak_categories=[...])`

**This is emergent behavior from the LLM's training**, not programmed logic.

## The Agentic Loop (Up to 10 Iterations)

```python
MAX_TOOL_ITERATIONS = 10

for iteration in range(MAX_TOOL_ITERATIONS):
    response = await self.llm.complete(full_messages, tools=tool_defs)

    if no_tool_calls:
        stream_final_answer()
        return  # Done

    # Execute tools, append results, loop again
```

Each iteration:

1. Send all messages (including previous tool results) to LLM
2. LLM either responds with text (done) or requests more tools
3. Execute requested tools, add results to message history
4. Repeat until LLM gives a text response or 10 iterations exhausted

## Summary

| Component | Role |
| --- | --- |
| AI Coach code | Sends tool schemas to LLM, executes whatever comes back |
| DeepSeek LLM | Decides WHICH tool to call and WHEN, based on training |
| System prompt | Guides the LLM's decision (soft instructions, not hard rules) |
| `tool_choice: "auto"` | Gives LLM freedom to choose |
| Tool descriptions | Help LLM understand what each tool does |

The AI Coach is a **tool executor**, not a **decision maker**. The intelligence lives entirely in the LLM.
