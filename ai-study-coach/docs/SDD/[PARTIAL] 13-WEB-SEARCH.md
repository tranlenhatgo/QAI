# 13 — Web Search Tool

## Purpose

Implement a production-ready web search tool that the AI Coach can invoke during agentic conversations to find current information, explanations, and educational resources.

**Status: ⚠️ Partial** — Stub exists in `server/tools/web_search.py` but returns placeholder text. Needs real search provider integration.

**Reference**: DeepTutor's `deeptutor/services/search/` implements 6 pluggable SERP providers with template-based consolidation.

---

## Interface Contract

```python
# server/tools/web_search.py

class WebSearchTool:
    """Web search with educational context and citation formatting."""
    
    name = "web_search"
    description = "Search the web for current information, explanations, or educational resources relevant to the student's question."
    
    async def execute(self, query: str, num_results: int = 5) -> str:
        """
        Execute web search and return formatted results.
        
        Args:
            query: Search query string
            num_results: Maximum results to return (default 5)
            
        Returns:
            Formatted string with search results + citations for LLM context
        """
```

**Tool Definition (OpenAI function-calling format):**
```python
{
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the web for current information, explanations, or educational resources. Use when the student asks about current events, needs external references, or when your knowledge might be outdated.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query. Be specific and include relevant context."
                },
                "num_results": {
                    "type": "integer",
                    "description": "Number of results to retrieve (1-10, default 5)"
                }
            },
            "required": ["query"]
        }
    }
}
```

---

## Data Shapes

```python
from pydantic import BaseModel

class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str
    position: int

class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    provider: str           # "brave", "serper", "duckduckgo"
    total_results: int
```

---

## Behavior Specification

### Provider Architecture (inspired by DeepTutor)

```python
# server/services/search_provider.py

from abc import ABC, abstractmethod

class SearchProvider(ABC):
    """Base class for pluggable search providers."""
    
    @abstractmethod
    async def search(self, query: str, num_results: int) -> list[SearchResult]:
        """Execute search and return structured results."""

class BraveSearchProvider(SearchProvider):
    """Brave Search API — requires COACH_BRAVE_API_KEY."""
    
    BASE_URL = "https://api.search.brave.com/res/v1/web/search"
    
    async def search(self, query: str, num_results: int = 5) -> list[SearchResult]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.BASE_URL,
                params={"q": query, "count": num_results},
                headers={"X-Subscription-Token": self.api_key}
            )
            response.raise_for_status()
            data = response.json()
            return [
                SearchResult(
                    title=r["title"],
                    url=r["url"],
                    snippet=r.get("description", ""),
                    position=i + 1,
                )
                for i, r in enumerate(data.get("web", {}).get("results", []))
            ]

class SerperSearchProvider(SearchProvider):
    """Serper.dev API — requires COACH_SERPER_API_KEY."""
    
    BASE_URL = "https://google.serper.dev/search"
    
    async def search(self, query: str, num_results: int = 5) -> list[SearchResult]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.BASE_URL,
                json={"q": query, "num": num_results},
                headers={"X-API-KEY": self.api_key}
            )
            response.raise_for_status()
            data = response.json()
            return [
                SearchResult(
                    title=r["title"],
                    url=r["link"],
                    snippet=r.get("snippet", ""),
                    position=i + 1,
                )
                for i, r in enumerate(data.get("organic", []))
            ]

class DuckDuckGoProvider(SearchProvider):
    """DuckDuckGo Instant Answers — no API key required (fallback)."""
    
    async def search(self, query: str, num_results: int = 5) -> list[SearchResult]:
        # Uses duckduckgo-search library (pip install duckduckgo-search)
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=num_results))
        return [
            SearchResult(title=r["title"], url=r["href"], snippet=r["body"], position=i+1)
            for i, r in enumerate(results)
        ]
```

### Provider Selection Logic

```python
def get_search_provider(settings: Settings) -> SearchProvider:
    """Select best available provider based on configured API keys."""
    if settings.brave_api_key:
        return BraveSearchProvider(settings.brave_api_key)
    elif settings.serper_api_key:
        return SerperSearchProvider(settings.serper_api_key)
    else:
        return DuckDuckGoProvider()  # Free fallback, no key needed
```

### Result Formatting for LLM Context

```python
def format_search_results(results: list[SearchResult]) -> str:
    """Format results as markdown for LLM consumption."""
    if not results:
        return "No search results found."
    
    lines = ["## Search Results\n"]
    for r in results:
        lines.append(f"**[{r.position}] {r.title}**")
        lines.append(f"   URL: {r.url}")
        lines.append(f"   {r.snippet}\n")
    
    return "\n".join(lines)
```

---

## Configuration

Add to `server/config.py`:

```python
class Settings(BaseSettings):
    # ... existing settings ...
    
    # Web Search (pick one provider)
    brave_api_key: str = ""        # Brave Search API key
    serper_api_key: str = ""       # Serper.dev API key
    # DuckDuckGo needs no key (free fallback)
```

Environment variables:
```bash
COACH_BRAVE_API_KEY=BSA...        # Option A: Brave Search
COACH_SERPER_API_KEY=abc123...    # Option B: Serper.dev
# No key needed for DuckDuckGo fallback
```

---

## Dependencies

Add to `requirements.txt`:
```
duckduckgo-search>=7.0.0    # Free fallback provider
```

---

## Acceptance Criteria

- [ ] `web_search` tool returns real search results (not placeholder)
- [ ] At least one provider works with API key configured
- [ ] DuckDuckGo fallback works without any API key
- [ ] Results formatted as readable markdown for LLM context
- [ ] Error handling: graceful fallback if provider fails
- [ ] Respects `num_results` parameter (capped at 10)
- [ ] Results include title, URL, and snippet
- [ ] Tool registered in Full tier tool registry
