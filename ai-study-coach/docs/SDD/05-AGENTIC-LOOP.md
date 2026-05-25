# 05 — Agentic Loop

## Purpose

Implement the core agentic orchestration engine for Full Agentic mode. The LLM decides which tools to call, the loop executes them, and feeds results back until the LLM produces a final answer.

---

## Interface Contract

```python
class AgenticCapability:
    """
    Full Agentic mode: LLM-driven tool calling loop.
    
    The LLM receives tool definitions, decides what to call,
    the engine executes tools and feeds results back,
    repeating until the LLM emits a final text response.
    """

    async def run(
        self,
        messages: list[Message],
        on_event: Callable[[dict], Awaitable[None]],
        cancelled: Callable[[], bool],
    ) -> None:
        """
        Emits (via on_event):
            - stage("thinking", "start"/"end")
            - tool(name, "calling", arguments)
            - tool(name, "result", result)
            - stage("responding", "start"/"end")
            - content(token) × N
        """
```

---

## Data Shapes

```python
@dataclass
class AgenticConfig:
    """Configuration for the agentic loop."""
    max_iterations: int = 10        # Max tool-call rounds
    max_tool_calls_per_turn: int = 3  # Max parallel tool calls per iteration
    timeout_per_tool: float = 30.0   # Seconds before tool execution times out
```

---

## Behavior Specification

### The Loop

```python
# server/capabilities/agentic.py

class AgenticCapability:
    def __init__(self, provider: LLMService, tools: list[BaseTool], config: AgenticConfig):
        self.llm = provider
        self.tools = {t.name: t for t in tools}
        self.tool_definitions = [t.definition() for t in tools]
        self.config = config
    
    def tool_names(self) -> list[str]:
        return list(self.tools.keys())
    
    async def run(self, messages, on_event, cancelled):
        full_messages = self._ensure_system_prompt(messages)
        iteration = 0
        
        while iteration < self.config.max_iterations:
            if cancelled():
                break
            
            iteration += 1
            
            # Step 1: Call LLM with tools
            await on_event({"type": "stage", "stage": "thinking", "status": "start"})
            
            response_content = ""
            tool_calls = []
            
            async for chunk in self.llm.complete(
                full_messages,
                tools=self.tool_definitions,
            ):
                if cancelled():
                    break
                
                if chunk.type == ChunkType.CONTENT:
                    response_content += chunk.content
                elif chunk.type == ChunkType.TOOL_CALL:
                    tool_calls.extend(chunk.tool_calls)
            
            await on_event({"type": "stage", "stage": "thinking", "status": "end"})
            
            # Step 2: If no tool calls → LLM is done, stream final answer
            if not tool_calls:
                await self._stream_final_answer(response_content, on_event, cancelled)
                full_messages.append(Message(role=Role.ASSISTANT, content=response_content))
                messages.append(Message(role=Role.ASSISTANT, content=response_content))
                return
            
            # Step 3: Execute tool calls
            assistant_msg = Message(
                role=Role.ASSISTANT,
                content=response_content,
                tool_calls=tool_calls,
            )
            full_messages.append(assistant_msg)
            
            for tc in tool_calls[:self.config.max_tool_calls_per_turn]:
                if cancelled():
                    break
                
                result = await self._execute_tool(tc, on_event)
                
                # Add tool result to messages
                full_messages.append(Message(
                    role=Role.TOOL,
                    content=result,
                    tool_call_id=tc.id,
                    name=tc.name,
                ))
            
            # Loop continues — LLM will see tool results and decide next action
        
        # Max iterations reached — force a final response
        await self._force_final_response(full_messages, on_event, cancelled, messages)
    
    async def _execute_tool(self, tool_call: ToolCall, on_event) -> str:
        """Execute a single tool call and emit events."""
        tool_name = tool_call.name
        arguments = tool_call.arguments
        
        # Emit calling event
        await on_event({
            "type": "tool",
            "tool_name": tool_name,
            "status": "calling",
            "arguments": arguments,
        })
        
        # Execute
        tool = self.tools.get(tool_name)
        if not tool:
            error_msg = f"Unknown tool: {tool_name}"
            await on_event({"type": "tool", "tool_name": tool_name, "status": "error", "result": error_msg})
            return error_msg
        
        try:
            result = await asyncio.wait_for(
                tool.execute(arguments),
                timeout=self.config.timeout_per_tool,
            )
            await on_event({
                "type": "tool",
                "tool_name": tool_name,
                "status": "result",
                "result": result[:500],  # Truncate for WS event (full result goes to LLM)
            })
            return result
        except asyncio.TimeoutError:
            error_msg = f"Tool {tool_name} timed out after {self.config.timeout_per_tool}s"
            await on_event({"type": "tool", "tool_name": tool_name, "status": "error", "result": error_msg})
            return error_msg
        except Exception as e:
            error_msg = f"Tool {tool_name} failed: {str(e)}"
            await on_event({"type": "tool", "tool_name": tool_name, "status": "error", "result": error_msg})
            return error_msg
    
    async def _stream_final_answer(self, content: str, on_event, cancelled):
        """Stream the final text answer to the client."""
        await on_event({"type": "stage", "stage": "responding", "status": "start"})
        
        # Stream in small chunks to simulate real-time feel
        # (content was already collected from the streaming LLM call)
        chunk_size = 20  # characters per chunk
        for i in range(0, len(content), chunk_size):
            if cancelled():
                break
            await on_event({"type": "content", "content": content[i:i+chunk_size]})
        
        await on_event({"type": "stage", "stage": "responding", "status": "end"})
    
    async def _force_final_response(self, full_messages, on_event, cancelled, messages):
        """Force a final answer when max iterations reached."""
        # Add instruction to finish
        full_messages.append(Message(
            role=Role.USER,
            content="[SYSTEM: Maximum iterations reached. Please provide your final answer now based on the information gathered so far.]",
        ))
        
        await on_event({"type": "stage", "stage": "responding", "status": "start"})
        
        final_content = ""
        async for chunk in self.llm.complete(full_messages, tools=None):  # No tools = must answer
            if cancelled():
                break
            if chunk.type == ChunkType.CONTENT:
                final_content += chunk.content
                await on_event({"type": "content", "content": chunk.content})
        
        await on_event({"type": "stage", "stage": "responding", "status": "end"})
        messages.append(Message(role=Role.ASSISTANT, content=final_content))
```

---

## Flow Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                    AGENTIC LOOP                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────────┐   │
│  │ Messages  │───→│ LLM Call    │───→│ Parse Response   │   │
│  │ + Tools   │    │ (streaming) │    │                  │   │
│  └──────────┘    └─────────────┘    └────────┬─────────┘   │
│                                              │              │
│                                    ┌─────────┴──────────┐   │
│                                    ↓                    ↓   │
│                            Has tool_calls?         Text only │
│                                    │                    │   │
│                                    ↓                    ↓   │
│                          ┌─────────────────┐   ┌───────────┐│
│                          │ Execute Tools   │   │ Stream    ││
│                          │ (parallel, max 3)│   │ Final Ans ││
│                          └────────┬────────┘   └───────────┘│
│                                   │                    │    │
│                                   ↓                    ↓    │
│                          ┌─────────────────┐       DONE     │
│                          │ Append results  │                │
│                          │ to messages     │                │
│                          └────────┬────────┘                │
│                                   │                         │
│                                   ↓                         │
│                          iteration < max?                    │
│                           yes → LOOP BACK                   │
│                           no  → FORCE ANSWER                │
└─────────────────────────────────────────────────────────────┘
```

---

## System Prompt for Agentic Mode

```python
AGENTIC_SYSTEM_PROMPT = """You are an AI Study Coach with access to tools.

Available tools will be provided as function definitions. Use them when:
- The student asks about their study materials → use `rag` tool
- You need to think deeply about a complex problem → use `reason` tool
- The student asks about their quiz performance → use `quiz_history` tool
- The student wants quiz recommendations → use `recommend` tool
- You need current/external information → use `web_search` tool

Guidelines:
- Call tools when they would genuinely help answer the question
- Don't call tools unnecessarily (e.g., for simple greetings)
- After getting tool results, synthesize them into a helpful response
- Be transparent about what information came from tools vs. your knowledge
- If a tool fails, acknowledge it and try to help with available information

IMPORTANT: When you have enough information to answer, respond directly without calling more tools."""
```

---

## Acceptance Criteria

- [ ] LLM receives tool definitions and can request tool calls
- [ ] Tool calls are executed and results fed back to LLM
- [ ] Loop terminates when LLM responds with text only (no tool calls)
- [ ] Loop terminates at `max_iterations` with forced final answer
- [ ] `cancelled()` stops the loop within current iteration
- [ ] Tool execution timeout (30s) is enforced
- [ ] Unknown tool name → error message returned as tool result
- [ ] Tool execution error → error message returned (not crash)
- [ ] Multiple tool calls in one response are executed sequentially (max 3)
- [ ] Stage events emitted: "thinking" (during LLM call), "responding" (final answer)
- [ ] Tool events emitted: "calling" (with args), "result" (with output), "error"
- [ ] Conversation history is updated with assistant + tool messages
- [ ] System prompt includes guidance on when to use each tool
- [ ] Works with DeepSeek's OpenAI-compatible function calling format

---

## Dependencies

- `server/llm/base.py` — LLMService, Message, StreamChunk, ToolCall
- `server/tools/base.py` — BaseTool
- `server/tools/registry.py` — ToolRegistry

---

## DeepTutor Reference

| This Module | DeepTutor Equivalent | What Changed |
| ------------- | --------------------- | -------------- |
| Agentic loop | `deeptutor/core/agentic/iteration_scheduler.py` | Native function calling instead of label protocol |
| Tool execution | `deeptutor/core/agentic/tool_dispatcher.py` | Same pattern, simplified error handling |
| Force finish | `_force_terminal_label()` in iteration scheduler | Simpler: just remove tools from last call |
| Max iterations | `AgenticRunConfig.max_iterations` | Same concept |
| System prompt | `deeptutor/capabilities/chat/prompts/` | Single static prompt |

### Key Difference from DeepTutor

DeepTutor uses a **label-based text protocol** (LLM emits `FINISH`/`TOOL`/`THINK` as first line of response). This was designed for providers without native function calling.

Your AI Study Coach uses **native function calling (DeepSeek's OpenAI-compatible `tool_calls` response type). This is:

- More reliable (structured output, not text parsing)
- Simpler code (no label parsing, no regex)
- Only works with providers that support it (DeepSeek ?, LM Studio ?)

That's why Lite Agentic uses [10-LITE-ORCHESTRATOR](./10-LITE-ORCHESTRATOR.md) instead — code-driven, no LLM tool calling.
