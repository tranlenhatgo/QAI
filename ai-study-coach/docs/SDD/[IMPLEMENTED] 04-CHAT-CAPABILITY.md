# 04 — Chat Capability

## Purpose

Implement the simplest capability: direct LLM conversation with no tools. Used in both tiers (Lite + Full) when mode is "chat". Single LLM call, stream response tokens to client.

---

## Interface Contract

```python
class SimpleChatCapability:
    """
    Direct chat: user message → LLM → streamed response.
    No tools, no agentic loop, no multi-step reasoning.
    """

    async def run(
        self,
        messages: list[Message],
        on_event: Callable[[dict], Awaitable[None]],
        cancelled: Callable[[], bool],
    ) -> None:
        """
        Args:
            messages: Full conversation history (system + user + assistant turns)
            on_event: Callback to emit events to the WebSocket client
            cancelled: Lambda that returns True if user sent "stop"
        
        Emits (via on_event):
            - stage("responding", "start")
            - content(token) × N
            - stage("responding", "end")
        """
```

---

## Data Shapes

No new data shapes needed — reuses `Message`, `StreamChunk` from [02-LLM-SERVICE](./02-LLM-SERVICE.md).

---

## Behavior Specification

```python
# server/capabilities/chat.py

class SimpleChatCapability:
    def __init__(self, provider: LLMService, config: AppConfig):
        self.llm = provider
        self.system_prompt = self._build_system_prompt()
    
    def tool_names(self) -> list[str]:
        return []  # No tools in chat mode
    
    async def run(self, messages, on_event, cancelled):
        # Step 1: Prepend system prompt if not already present
        full_messages = self._ensure_system_prompt(messages)
        
        # Step 2: Emit stage start
        await on_event({"type": "stage", "stage": "responding", "status": "start"})
        
        # Step 3: Stream LLM response
        assistant_content = ""
        async for chunk in self.llm.complete(full_messages, tools=None):
            if cancelled():
                break
            
            if chunk.type == ChunkType.CONTENT:
                assistant_content += chunk.content
                await on_event({"type": "content", "content": chunk.content})
        
        # Step 4: Emit stage end
        await on_event({"type": "stage", "stage": "responding", "status": "end"})
        
        # Step 5: Add assistant message to history (for multi-turn)
        messages.append(Message(role=Role.ASSISTANT, content=assistant_content))
    
    def _build_system_prompt(self) -> str:
        return """You are an AI Study Coach. Your role is to help students learn effectively.

Guidelines:
- Explain concepts clearly and concisely
- Use examples to illustrate points
- If the student seems confused, try a different explanation approach
- Encourage active learning (ask "does this make sense?" or "can you try explaining it back?")
- Be supportive but honest about mistakes
- Keep responses focused and not overly long"""

    def _ensure_system_prompt(self, messages: list[Message]) -> list[Message]:
        if not messages or messages[0].role != Role.SYSTEM:
            return [Message(role=Role.SYSTEM, content=self.system_prompt)] + messages
        return messages
```

---

## System Prompt Variants

### Default (General Study Coach)

```text
You are an AI Study Coach. Help students learn effectively.
- Explain clearly, use examples
- Encourage active recall
- Keep responses focused
```

### With Knowledge Base Context (when kb_id is set, Full mode)

```text
You are an AI Study Coach with access to the student's study materials.

CONTEXT FROM STUDY MATERIALS:
{rag_context}

Guidelines:
- Reference the study materials when relevant
- If the answer is in the materials, cite it
- If not in the materials, say so and provide general knowledge
```

Note: In Chat mode with RAG context, the RAG retrieval happens **server-side** before calling the LLM (not via tool call). This is the "server-injected RAG" pattern that works even with local models.

### Server-Side RAG Injection (Chat Mode + KB)

```python
async def run(self, messages, on_event, cancelled):
    full_messages = self._ensure_system_prompt(messages)
    
    # If KB is configured, inject RAG context into system prompt
    if self.kb_id:
        user_query = messages[-1].content
        rag_context = await self.rag_service.search(user_query, self.kb_id)
        full_messages[0] = Message(
            role=Role.SYSTEM,
            content=self._build_system_prompt_with_context(rag_context),
        )
    
    # ... rest of streaming logic same as above
```

---

## Conversation History Management

```python
# Keep last N messages to stay within context window
MAX_HISTORY_MESSAGES = 20  # ~10 turns (user + assistant)

def _trim_history(self, messages: list[Message]) -> list[Message]:
    """Keep system prompt + last N messages."""
    if len(messages) <= MAX_HISTORY_MESSAGES + 1:  # +1 for system
        return messages
    
    system = messages[0] if messages[0].role == Role.SYSTEM else None
    recent = messages[-MAX_HISTORY_MESSAGES:]
    
    if system:
        return [system] + recent
    return recent
```

---

## Acceptance Criteria

- [ ] `SimpleChatCapability.run()` streams LLM response tokens via `on_event`
- [ ] System prompt is prepended to every request
- [ ] Works with LM Studio provider (Lite mode)
- [ ] Works with DeepSeek provider (Full mode)
- [ ] `cancelled()` check stops streaming within 1 chunk
- [ ] Multi-turn: assistant responses are appended to history
- [ ] History is trimmed to `MAX_HISTORY_MESSAGES` to prevent context overflow
- [ ] Empty user message → still produces a response (LLM handles it)
- [ ] Server-side RAG injection works when `kb_id` is set
- [ ] Stage events ("responding" start/end) are emitted correctly
- [ ] No tool definitions are sent to the LLM

---

## Dependencies

- `server/llm/base.py` — LLMService, Message, StreamChunk
- `server/services/supabase_client.py` — RAG search (optional, for KB-enabled chat)

---

## DeepTutor Reference

| This Module | DeepTutor Equivalent | What Changed |
| ------------- | --------------------- | -------------- |
| `SimpleChatCapability` | `deeptutor/capabilities/chat/capability.py` | No agentic loop, no tools, single LLM call |
| System prompt | `deeptutor/capabilities/chat/prompts/` | One static prompt instead of dynamic assembly |
| History trimming | `deeptutor/core/context.py` message windowing | Same concept, simpler implementation |
| Server-side RAG | DeepTutor's `pre_retrieve` in deep_solve | Applied to chat for local model compatibility |
