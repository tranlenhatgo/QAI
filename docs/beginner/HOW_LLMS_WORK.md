# How LLMs Work — A Beginner's Guide for Understanding DeepTutor

> **Audience**: ML beginners who want to understand what happens inside
> a Large Language Model when DeepTutor calls it.  
> **Key insight**: An LLM is a very sophisticated pattern-completion machine.
> It predicts the next word based on everything before it — and it's
> *shockingly good* at it because it's seen trillions of words.

---

## 1. What Is a Large Language Model?

An LLM is a computer program that:

1. Takes text as input (the "prompt")
2. Outputs text one token at a time (the "completion")
3. Was trained on massive amounts of text data
4. Has billions of tunable numbers (parameters/weights)

Think of it like autocomplete on your phone — but trained on the entire
internet and scaled up by a million times.

---

## 2. The Core Mechanism: Next-Token Prediction

At its heart, every LLM does one thing:

> **Given all the text so far, predict the most likely next word (token).**

```text
Input:  "The capital of France is"
         ↓ LLM calculates probabilities
Output: "Paris" (97%)  "Lyon" (1%)  "London" (0.5%)  ...
```

Then it adds "Paris" to the input and predicts again:

```text
Input:  "The capital of France is Paris"
         ↓
Output: "." (60%)  "," (25%)  "and" (5%)  ...
```

This repeats until:

- A stop token is generated
- `max_tokens` limit is reached
- The application stops it

---

## 3. What Are Tokens?

LLMs don't process individual characters or even whole words. They work with
**tokens** — pieces of text that the model has learned are useful units.

### Tokenization Examples

```text
"Hello world"          → ["Hello", " world"]           (2 tokens)
"Photosynthesis"       → ["Photo", "syn", "thesis"]    (3 tokens)
"DNA replication"      → ["DNA", " replication"]       (2 tokens)
"こんにちは"             → ["こん", "にち", "は"]          (3 tokens)
"x² + 2x + 1 = 0"     → ["x", "²", " +", " 2", "x", " +", " 1", " =", " 0"]
```

### Rules of Thumb

- 1 token ≈ 4 characters in English
- 1 token ≈ 0.75 words
- 100 tokens ≈ 75 words
- A page of text ≈ 300–400 tokens

### Why Tokens Matter in DeepTutor

| Concern | Impact |
| --------- | -------- |
| **Context window** | Max tokens the model can read + write combined |
| **Cost** | You pay per input token + output token |
| **Speed** | More tokens = more compute time |
| **Chunking** | RAG chunks are measured in tokens |

**In DeepTutor**: `TutorResponse.usage` tracks `prompt_tokens` and
`completion_tokens` for every call.

---

## 4. The Messages Format — How DeepTutor Talks to LLMs

DeepTutor sends a structured conversation to the LLM:

```json
[
  {
    "role": "system",
    "content": "You are a patient tutor. Answer questions clearly."
  },
  {
    "role": "user",
    "content": "What is mitosis?"
  },
  {
    "role": "assistant",
    "content": "Mitosis is the process of cell division..."
  },
  {
    "role": "user",
    "content": "What are its phases?"
  }
]
```

### Role Types

| Role | Purpose | Who writes it? |
| ------ | --------- | --------------- |
| `system` | Instructions for the model's behavior | DeepTutor (invisible to user) |
| `user` | The human's messages | User |
| `assistant` | The model's previous responses | LLM (stored for context) |
| `tool` | Results from tool calls | DeepTutor's tool system |

The LLM reads the entire message array and generates the next `assistant`
response.

---

## 5. Key Parameters That Control Output

### Temperature (0.0 – 2.0)

Controls randomness in token selection:

```text
Temperature = 0.0:
  "The capital of France is" → "Paris" (ALWAYS)
  Deterministic, safe, repetitive

Temperature = 0.7 (DeepTutor default):
  "The capital of France is" → "Paris" (usually, sometimes creative phrasing)
  Balanced creativity and accuracy

Temperature = 1.5:
  "The capital of France is" → "Paris" / "a city of lights" / "known for..."
  Very creative, less predictable
```

**In DeepTutor**: `LLMConfig.temperature = 0.7`

### Max Tokens

Maximum output length:

```text
max_tokens = 100  → short answers (cuts off if longer)
max_tokens = 4096 → detailed responses (DeepTutor default)
max_tokens = 16384 → very long outputs (essays, code)
```

**In DeepTutor**: `LLMConfig.max_tokens = 4096`

### Top-P (Nucleus Sampling)

Alternative to temperature. Only consider tokens whose cumulative probability
exceeds threshold P:

```text
top_p = 0.1 → only the very top choices (conservative)
top_p = 0.9 → most choices included (creative)
```

---

## 6. Training — How LLMs Learn (Simplified)

### Phase 1: Pre-training

Feed the model trillions of tokens from the internet, books, code:

```text
Input:  "The cat sat on the"
Target: "mat"

Input:  "def fibonacci(n):\n    if n <= 1:\n        return"
Target: "n"
```

The model adjusts its billions of parameters to get better at predicting
the next token. After training on trillions of tokens, it develops an
incredible "understanding" of language, logic, and world knowledge.

### Phase 2: Fine-tuning (Instruction Tuning)

Raw pre-trained models just complete text. They don't know how to *follow
instructions*. Fine-tuning teaches them to be helpful:

```text
Before fine-tuning:
  "What is 2+2?" → "What is 2+3? What is 2+4? What is..."  (just continues)

After fine-tuning:
  "What is 2+2?" → "2+2 = 4"  (actually answers!)
```

### Phase 3: RLHF (Reinforcement Learning from Human Feedback)

Humans rate model outputs. The model learns to produce responses humans prefer:
more helpful, less harmful, more accurate.

---

## 7. Model Sizes and Trade-offs

| Model | Parameters | Speed | Quality | Memory |
| ------- | ----------- | ------- | --------- | -------- |
| Gemma 2B | 2 billion | ⚡ Very fast | ⭐⭐ Basic | 2GB |
| Gemma 9B | 9 billion | 🚀 Fast | ⭐⭐⭐ Good | 6GB |
| Llama 70B | 70 billion | 🐢 Slow | ⭐⭐⭐⭐ Great | 40GB |
| GPT-4o | ~200B (est.) | Cloud | ⭐⭐⭐⭐⭐ Best | Cloud |

**In DeepTutor**: Supports the full range — from tiny local models (LM Studio)
to powerful cloud models (OpenAI, Anthropic, Google).

---

## 8. Local Models vs. Cloud Models

### Cloud Models (OpenAI, Anthropic, Google)

```text
Your computer  ───internet───→  Cloud GPU cluster
                                 (runs the model)
                ←── response ───
```

- ✅ Best quality (biggest models)
- ✅ No local hardware needed
- ✅ Supports tool/function calling
- ❌ Costs money per token
- ❌ Data leaves your machine
- ❌ Needs internet

### Local Models (LM Studio, Ollama, vLLM)

```text
Your computer (runs the model locally)
  ↓
Response generated on YOUR hardware
```

- ✅ Free (no API costs)
- ✅ Private (data never leaves your machine)
- ✅ Works offline
- ❌ Smaller models = lower quality
- ❌ Need decent GPU (8GB+ VRAM)
- ❌ Most don't support tool calling reliably

**In DeepTutor**: Local providers (`lm_studio`, `ollama`, `vllm`, `llama_cpp`)
all have `supports_tools: False` — they can generate text but can't do
native function calling. DeepTutor works around this with its label protocol.

---

## 9. Streaming — Why Responses Appear Word by Word

### Without Streaming

```text
User asks question → [wait 5 seconds] → Entire response appears at once
```

### With Streaming

```text
User asks question → "The" → "capital" → "of" → "France" → "is" → "Paris"
                     (each word appears as generated)
```

**How it works technically**:

```python
# Non-streaming (complete)
response = await client.complete("What is mitosis?")
print(response.content)  # prints all at once after waiting

# Streaming
async for chunk in client.stream("What is mitosis?"):
    print(chunk.delta, end="")  # prints each piece immediately
    # chunk.delta = "Mitosis", " is", " the", " process"...
```

**In DeepTutor**: `TutorStreamChunk` carries each delta:

```python
class TutorStreamChunk:
    delta: str       # new text fragment ("Mitosis")
    content: str     # accumulated text so far ("Mitosis is the")
    is_complete: bool  # True on final chunk
```

The `StreamBus` broadcasts these chunks to all connected consumers
(CLI, WebSocket, etc.) in real-time.

---

## 10. Function/Tool Calling — How LLMs Take Actions

Modern LLMs can do more than generate text. They can say:
"I want to call a function."

### Without Tool Calling (text-only)

```text
System: "You have a calculator tool. To use it, output: CALC(expression)"
User: "What's 15782 × 9341?"
LLM: "CALC(15782 * 9341)"
Application: [parses text, runs calculator, sends result back]
```

This is fragile — the model might not format it correctly.

### With Native Tool Calling

```text
System: [tool schemas provided]
User: "What's 15782 × 9341?"
LLM response: {
  "tool_calls": [{
    "function": {"name": "calculator", "arguments": "{\"expression\": \"15782 * 9341\"}"}
  }]
}
Application: [structured call, much more reliable]
```

**In DeepTutor**: Tool schemas are provided via `ToolDefinition.to_openai_schema()`.
The LLM's response includes structured `tool_calls` that DeepTutor parses
and executes.

### The Round Trip

```text
1. Send messages + tool schemas to LLM
2. LLM responds with tool_calls (structured)
3. DeepTutor executes the tools
4. Results added as role="tool" messages
5. Send updated messages back to LLM
6. LLM reads results and generates final answer
```

---

## 11. Context Window Management

The context window is like the model's "working memory":

```text
┌─────────────────── Context Window (128K tokens) ──────────────────────┐
│                                                                        │
│ [System prompt: 500 tokens]                                           │
│ [RAG context: 2000 tokens]                                            │
│ [Conversation history: varies]                                        │
│ [User's current message: varies]                                      │
│ [Space for model's response: max_tokens]                              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

When the conversation gets too long, older messages must be trimmed:

```text
Turn 1: [kept]
Turn 2: [kept]
Turn 3: [trimmed — too old]
Turn 4: [trimmed — too old]
Turn 5: [kept]
Turn 6: [kept — current]
```

**In DeepTutor**: `LoopHost.guard_context_window()` trims messages to stay
within limits.

---

## 12. How DeepTutor Uses LLMs

### The Complete Call Flow

```text
1. User types a message in the web UI
2. WebSocket delivers it to the server
3. ChatOrchestrator routes to a capability
4. Capability builds the messages array:
   - System prompt (instructions + RAG context + memory)
   - Conversation history (previous turns)
   - User message
   - Tool schemas (if agentic)
5. Messages sent to LLM provider (OpenAI/Anthropic/local)
6. LLM generates response (streamed token by token)
7. DeepTutor processes the response:
   - If TOOL label → execute tools, loop back to step 5
   - If THINK label → save reasoning, loop back to step 5
   - If FINISH label → stream answer to user
8. StreamBus delivers events to the web UI
```

### Configuration in DeepTutor

```python
@dataclass
class LLMConfig:
    model: str             # "gpt-4o", "gemma-3-4b", etc.
    api_key: str           # Authentication
    base_url: str          # "https://api.openai.com/v1" or local
    binding: str           # "openai" | "anthropic" | "gemini"
    temperature: float     # 0.7 default
    max_tokens: int        # 4096 default
    context_window: int    # Model's total capacity
    max_concurrency: int   # Parallel requests limit
    requests_per_minute: int  # Rate limit
```

### Provider Architecture

```text
LLMConfig → BaseLLMProvider (abstract)
                 ↓
    ┌────────────┼──────────────┐
    ↓            ↓              ↓
OpenAIProvider  AnthropicProvider  (others)
    ↓            ↓              ↓
httpx/openai   anthropic SDK   provider SDK
    ↓            ↓              ↓
Cloud API      Cloud API       Cloud API
```

Each provider implements:

- `complete(prompt, **kwargs) → TutorResponse`
- `stream(prompt, **kwargs) → AsyncGenerator[TutorStreamChunk]`

---

## 13. Important Limitations to Understand

### LLMs Don't "Know" Things

They predict statistically likely text. They don't have a database of facts.
This is why they hallucinate — the most likely next word isn't always the
*correct* next word.

### LLMs Don't "Think"

Despite labels like `THINK`, the model isn't actually reasoning in the way
humans do. It's doing very sophisticated pattern matching. Chain-of-thought
prompting works because writing out reasoning steps constrains the output
space toward correct answers.

### LLMs Can't Learn in Real-Time

Each API call is stateless. The model doesn't remember previous conversations
unless you include them in the messages array. DeepTutor's conversation history
management gives the *illusion* of memory.

### LLMs Are Probabilistic

Same input + temperature > 0 → different output each time. This is why
DeepTutor's deep_solve runs code execution to verify math — the LLM might
generate different (possibly wrong) steps each time.

---

## 14. Key Takeaways

1. **LLMs predict the next token** — that's the fundamental operation
2. **Temperature controls randomness** — 0 = deterministic, 1+ = creative
3. **Context window = working memory** — limited, must be managed
4. **Tokens ≈ word pieces** — they determine cost, speed, and limits
5. **Messages format structures the conversation** — system/user/assistant/tool
6. **Streaming sends tokens as generated** — makes UI feel responsive
7. **Tool calling is structured** — LLMs output JSON, not free-form "CALC()"
8. **Local models are smaller** — faster/free but less capable
9. **LLMs are stateless** — no memory between calls without explicit history
10. **DeepTutor's label protocol** — structures LLM output for the agentic loop

---

## Further Reading

| Topic | File |
| ------- | ------ |
| All terms defined | [GLOSSARY.md](GLOSSARY.md) |
| How the agentic loop works | [AGENTIC_AI_EXPLAINED.md](AGENTIC_AI_EXPLAINED.md) |
| How RAG gives LLMs document access | [RAG_EXPLAINED.md](RAG_EXPLAINED.md) |
| Full system architecture | [VISUAL_ARCHITECTURE.md](VISUAL_ARCHITECTURE.md) |
| DeepTutor providers in detail | [../coder/AI_MODEL_SELECTION_GUIDE.md](../coder/AI_MODEL_SELECTION_GUIDE.md) |
