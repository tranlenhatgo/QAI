# 06 — Tools Registry

## Purpose

Define the tool protocol (interface every tool implements), the registry that holds and discovers tools, and the concrete tool definitions for the AI Study Coach.

---

## Interface Contract

```python
class BaseTool(ABC):
    """Every tool implements this interface."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Unique tool identifier (used in function calling)."""
        ...
    
    @property
    @abstractmethod
    def description(self) -> str:
        """What this tool does (shown to the LLM)."""
        ...
    
    @abstractmethod
    def parameters_schema(self) -> dict:
        """JSON Schema for the tool's input parameters."""
        ...
    
    @abstractmethod
    async def execute(self, arguments: dict) -> str:
        """
        Execute the tool with given arguments.
        Returns: string result (fed back to LLM as tool response).
        """
        ...
    
    def definition(self) -> ToolDefinition:
        """Convert to the format passed to LLM."""
        return ToolDefinition(
            name=self.name,
            description=self.description,
            parameters=self.parameters_schema(),
        )
```

---

## Tool Registry

```python
# ai_coach/tools/registry.py

class ToolRegistry:
    """Holds all available tools. Provides lookup by name."""
    
    def __init__(self):
        self._tools: dict[str, BaseTool] = {}
    
    def register(self, tool: BaseTool) -> None:
        self._tools[tool.name] = tool
    
    def get(self, name: str) -> BaseTool | None:
        return self._tools.get(name)
    
    def all_tools(self) -> list[BaseTool]:
        return list(self._tools.values())
    
    def all_definitions(self) -> list[ToolDefinition]:
        return [t.definition() for t in self._tools.values()]
    
    def names(self) -> list[str]:
        return list(self._tools.keys())


def create_full_registry(config: AppConfig) -> ToolRegistry:
    """Create registry with all tools for Full Agentic mode."""
    registry = ToolRegistry()
    
    registry.register(RAGTool(config.rag))
    registry.register(ReasonTool(config.llm))
    registry.register(QuizHistoryTool(config.java_backend))
    registry.register(RecommendTool(config.java_backend))
    registry.register(WebSearchTool())
    
    return registry
```

---

## Tool Definitions

### 1. RAG Tool

```python
# ai_coach/tools/rag.py
# Full spec in 07-RAG-TOOL.md

class RAGTool(BaseTool):
    name = "rag"
    description = "Search the student's study materials (knowledge base) for relevant information. Use when the student asks about their uploaded documents, textbook content, or course materials."
    
    def parameters_schema(self):
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to find relevant study material"
                }
            },
            "required": ["query"]
        }
    
    async def execute(self, arguments: dict) -> str:
        query = arguments["query"]
        # → Supabase pgvector similarity search
        # Returns: formatted text snippets from matched documents
```

### 2. Reason Tool

```python
# ai_coach/tools/reason.py

class ReasonTool(BaseTool):
    name = "reason"
    description = "Think deeply about a complex problem. Use for multi-step math, logic puzzles, or when you need careful step-by-step analysis before answering."
    
    def parameters_schema(self):
        return {
            "type": "object",
            "properties": {
                "problem": {
                    "type": "string",
                    "description": "The problem or question to reason about carefully"
                },
                "context": {
                    "type": "string",
                    "description": "Additional context or constraints (optional)"
                }
            },
            "required": ["problem"]
        }
    
    async def execute(self, arguments: dict) -> str:
        problem = arguments["problem"]
        context = arguments.get("context", "")
        
        # Make a separate LLM call with a "deep thinking" system prompt
        thinking_prompt = f"""Think step by step about this problem. Show your reasoning clearly.

Problem: {problem}
{"Context: " + context if context else ""}

Provide a detailed, logical analysis."""
        
        # Use the same LLM but with different system prompt
        result = await self.llm.complete_sync(
            messages=[
                Message(role=Role.SYSTEM, content="You are a careful logical thinker. Solve problems step by step."),
                Message(role=Role.USER, content=thinking_prompt),
            ],
            tools=None,  # No tools in reasoning call
        )
        return result.content
```

### 3. Quiz History Tool

```python
# ai_coach/tools/quiz_history.py

class QuizHistoryTool(BaseTool):
    name = "quiz_history"
    description = "Get the student's past quiz results and performance data. Use when analyzing strengths/weaknesses or tracking progress over time."
    
    def parameters_schema(self):
        return {
            "type": "object",
            "properties": {
                "user_id": {
                    "type": "string",
                    "description": "The student's user ID"
                },
                "subject": {
                    "type": "string",
                    "description": "Filter by subject/topic (optional)"
                },
                "limit": {
                    "type": "integer",
                    "description": "Number of recent results to fetch (default: 10)"
                }
            },
            "required": ["user_id"]
        }
    
    async def execute(self, arguments: dict) -> str:
        user_id = arguments["user_id"]
        subject = arguments.get("subject")
        limit = arguments.get("limit", 10)
        
        # Call Java Backend REST API
        params = {"userId": user_id, "limit": limit}
        if subject:
            params["subject"] = subject
        
        response = await self.java_client.get("/api/quiz-history", params=params)
        
        # Format for LLM consumption
        results = response.json()
        formatted = self._format_quiz_results(results)
        return formatted
    
    def _format_quiz_results(self, results: list[dict]) -> str:
        """Format quiz history for LLM to analyze."""
        if not results:
            return "No quiz history found for this student."
        
        lines = [f"Quiz History ({len(results)} recent results):"]
        for r in results:
            lines.append(
                f"- {r['quiz_title']} ({r['subject']}): "
                f"Score {r['score']}/{r['total']} ({r['percentage']}%) "
                f"on {r['completed_at']}"
            )
            if r.get("weak_topics"):
                lines.append(f"  Weak areas: {', '.join(r['weak_topics'])}")
        
        return "\n".join(lines)
```

### 4. Recommend Tool

```python
# ai_coach/tools/recommend.py

class RecommendTool(BaseTool):
    name = "recommend"
    description = "Get personalized quiz/study recommendations for the student based on their performance and available quizzes. Use when the student asks 'what should I study next?' or 'which quiz should I take?'"
    
    def parameters_schema(self):
        return {
            "type": "object",
            "properties": {
                "user_id": {
                    "type": "string",
                    "description": "The student's user ID"
                },
                "goal": {
                    "type": "string",
                    "description": "What the student wants to achieve (e.g., 'improve math', 'prepare for exam')"
                }
            },
            "required": ["user_id"]
        }
    
    async def execute(self, arguments: dict) -> str:
        user_id = arguments["user_id"]
        goal = arguments.get("goal", "general improvement")
        
        # Call Java Backend recommendation endpoint
        response = await self.java_client.get(
            "/api/recommendations",
            params={"userId": user_id, "goal": goal}
        )
        
        recommendations = response.json()
        return self._format_recommendations(recommendations)
    
    def _format_recommendations(self, recs: list[dict]) -> str:
        if not recs:
            return "No recommendations available. The student may need to take more quizzes first."
        
        lines = ["Recommended next steps:"]
        for i, r in enumerate(recs, 1):
            lines.append(
                f"{i}. {r['type'].title()}: {r['title']}\n"
                f"   Reason: {r['reason']}\n"
                f"   Difficulty: {r['difficulty']}/5"
            )
        return "\n".join(lines)
```

### 5. Web Search Tool

```python
# ai_coach/tools/web_search.py

class WebSearchTool(BaseTool):
    name = "web_search"
    description = "Search the web for current information. Use when the student's question requires up-to-date facts, current events, or information not in their study materials."
    
    def parameters_schema(self):
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query"
                }
            },
            "required": ["query"]
        }
    
    async def execute(self, arguments: dict) -> str:
        query = arguments["query"]
        
        # Option A: Google Custom Search API (free tier: 100 queries/day)
        # Option B: SerpAPI
        # Option C: DuckDuckGo (no API key needed)
        
        results = await self._search(query)
        return self._format_results(results)
    
    async def _search(self, query: str) -> list[dict]:
        """Execute web search. Implementation depends on chosen provider."""
        # DuckDuckGo example (no API key):
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
        return results
    
    def _format_results(self, results: list[dict]) -> str:
        if not results:
            return "No web results found."
        
        lines = ["Web search results:"]
        for i, r in enumerate(results, 1):
            lines.append(f"{i}. {r['title']}\n   {r['body'][:200]}\n   Source: {r['href']}")
        return "\n".join(lines)
```

---

## Tool Argument Augmentation

Some tools need `user_id` but the LLM shouldn't have to guess it. The orchestrator injects session context:

```python
# In AgenticCapability._execute_tool():

async def _execute_tool(self, tool_call: ToolCall, on_event, session: Session) -> str:
    arguments = tool_call.arguments.copy()
    
    # Auto-inject user_id for tools that need it
    if tool_call.name in ("quiz_history", "recommend") and "user_id" not in arguments:
        arguments["user_id"] = session.user_id
    
    # Auto-inject kb_id for RAG tool
    if tool_call.name == "rag" and session.kb_id:
        arguments["kb_id"] = session.kb_id
    
    return await self.tools[tool_call.name].execute(arguments)
```

---

## Acceptance Criteria

- [ ] `BaseTool` interface is implemented by all 5 tools
- [ ] `ToolRegistry` registers, discovers, and provides definitions
- [ ] Each tool's `parameters_schema()` returns valid JSON Schema
- [ ] Each tool's `execute()` returns a string result
- [ ] `RAGTool` queries Supabase and returns formatted snippets
- [ ] `ReasonTool` makes a separate LLM call and returns reasoning
- [ ] `QuizHistoryTool` calls Java BE and formats results
- [ ] `RecommendTool` calls Java BE and formats recommendations
- [ ] `WebSearchTool` searches web and returns formatted results
- [ ] Tool argument augmentation injects `user_id` and `kb_id`
- [ ] Tool timeout is respected (30s default)
- [ ] Tool execution errors don't crash the agentic loop

---

## Dependencies

```text
httpx>=0.25.0              # For Java BE calls
duckduckgo-search>=6.0.0   # For web search (no API key)
# supabase-py — see 07-RAG-TOOL.md
# google-generativeai — see 02-LLM-SERVICE.md
```

---

## DeepTutor Reference

| This Module | DeepTutor Equivalent | What Changed |
| ------------- | --------------------- | -------------- |
| `BaseTool` | `deeptutor/core/tool_protocol.py` | Same interface, fewer methods |
| `ToolRegistry` | `deeptutor/runtime/registry/tool_registry.py` | No auto-discovery, manual registration |
| `RAGTool` | `deeptutor/tools/builtin/rag.py` | Supabase instead of ChromaDB/custom |
| `ReasonTool` | `deeptutor/tools/builtin/reason.py` | Same concept (dedicated thinking call) |
| `WebSearchTool` | `deeptutor/tools/builtin/web_search.py` | DuckDuckGo instead of SerpAPI/Tavily |
| `QuizHistoryTool` | N/A (new) | Custom tool calling Java BE |
| `RecommendTool` | N/A (new) | Custom tool calling Java BE |
| Argument augmentation | `deeptutor/core/agentic/tool_dispatcher.py` server-side arg injection | Same pattern |
