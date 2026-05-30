# Chapter 5: Implementation — Part 3: AI Study Coach (FastAPI)

## 5.18 Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | FastAPI | 0.100+ |
| Runtime | Python | 3.12+ |
| ASGI Server | Uvicorn | — |
| LLM Client | httpx (async) | — |
| Embeddings | nomic-embed-text-v1.5 via LM Studio | — |
| Vector DB Client | Supabase Python SDK | — |
| PDF Extraction | PyMuPDF (fitz) | 1.24+ |
| Configuration | pydantic-settings | — |
| Scheduling | APScheduler | — |
| Database | SQLite + aiosqlite | — |

## 5.19 Project Structure

```
ai-study-coach/server/
├── __init__.py
├── main.py                    # FastAPI app creation, startup/shutdown
├── config.py                  # Settings (pydantic-settings, .env loading)
├── router.py                  # Tier/mode routing logic
├── agent/
│   ├── coach.py               # Agent orchestration (deprecated, kept for compat)
│   ├── prompts.py             # System prompts for different modes
│   ├── tool_executor.py       # Tool execution with timeout
│   └── tools.py               # Tool definitions (OpenAI format)
├── capabilities/
│   ├── base.py                # Base capability interface
│   ├── chat.py                # SimpleChatCapability
│   ├── agentic.py             # AgenticCapability (full tool loop)
│   ├── lite_orchestrator.py   # LiteOrchestrator (intent → workflow)
│   ├── quiz.py                # Quiz generation capability
│   └── solve.py               # Step-by-step solver
├── llm/
│   ├── base.py                # Abstract LLM interface + types
│   ├── lm_studio.py           # LM Studio provider (local)
│   └── deepseek.py            # DeepSeek provider (cloud)
├── tools/
│   ├── __init__.py            # BaseTool abstract class
│   ├── registry.py            # ToolRegistry + factory functions
│   ├── quiz_history.py        # QuizHistoryTool implementation
│   ├── recommend.py           # RecommendTool implementation
│   ├── reason.py              # ReasonTool (chain-of-thought)
│   ├── web_search.py          # WebSearchTool (DuckDuckGo)
│   └── rag.py                 # RAGTool (Supabase pgvector search)
├── learning/
│   ├── __init__.py
│   ├── progress.py            # ProgressTracker + metrics computation
│   └── spaced_repetition.py   # SM-2 algorithm implementation
├── models/
│   └── schemas.py             # Pydantic models for API contracts
├── routes/
│   ├── ingest.py              # Document ingestion endpoint
│   ├── generate.py            # Question generation endpoints
│   └── webhook.py             # Quiz completion webhook
├── services/
│   ├── embedding.py           # Embedding generation via LM Studio
│   ├── supabase_client.py     # Supabase connection + operations
│   └── quiz_api.py            # Spring Boot API client
├── scheduler/
│   └── tasks.py               # Periodic tasks (review check, snapshots)
├── ws/
│   ├── __init__.py            # WebSocket protocol message builders
│   └── handler.py             # WebSocket connection handler
└── quiz_client/
    └── client.py              # QuizAPIClient for Spring Boot calls
```

## 5.20 Configuration Management

All settings are centralized in `config.py` using pydantic-settings with environment prefix `COACH_`:

```python
class Settings(BaseSettings):
    # LM Studio (Lite tier)
    lm_studio_url: str = "http://127.0.0.1:1234"
    lm_studio_model: str = ""  # Auto-detect first chat model
    embedding_model: str = "text-embedding-nomic-embed-text-v1.5"

    # External LLM (Full tier)
    external_llm_provider: str = "deepseek"
    external_llm_api_key: str = ""
    external_llm_model: str = ""  # e.g. "deepseek-v4-flash"
    llm_timeout_seconds: float = 300.0

    # Supabase (RAG)
    supabase_url: str = ""
    supabase_key: str = ""

    # Security
    api_key: str = ""  # X-API-Key for protected endpoints

    # Spaced Repetition
    sr_default_easiness: float = 2.5
    sr_min_easiness: float = 1.3

    model_config = {"env_file": ".env", "env_prefix": "COACH_"}
```

Environment variables override defaults: `COACH_EXTERNAL_LLM_API_KEY=sk-...`

## 5.21 LLM Provider Abstraction

### 5.21.1 Base Interface

```python
class LLMService(ABC):
    @abstractmethod
    async def complete(
        self, messages: list[Message], tools: list[ToolDefinition] | None = None
    ) -> AsyncGenerator[StreamChunk, None]:
        """Stream completion chunks from the LLM."""
        ...
```

Both providers implement this interface, producing the same `StreamChunk` types:
- `ChunkType.CONTENT`: Text token.
- `ChunkType.TOOL_CALL`: Function call request.
- `ChunkType.DONE`: Stream complete.

### 5.21.2 LM Studio Provider

Uses the OpenAI-compatible API at `http://127.0.0.1:1234/v1`:

```python
class LMStudioProvider(LLMService):
    async def complete(self, messages, tools=None):
        payload = {
            "model": self.model,
            "messages": [m.to_dict() for m in messages],
            "stream": True,
            "temperature": 0.7,
        }
        # Note: tools passed only if model supports function calling
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", f"{self.base_url}/chat/completions", 
                                     json=payload) as response:
                async for line in response.aiter_lines():
                    # Parse SSE format, yield StreamChunk
                    ...
```

### 5.21.3 DeepSeek Provider

Uses DeepSeek's API (OpenAI-compatible format) with full function-calling support:

```python
class DeepSeekProvider(LLMService):
    BASE_URL = "https://api.deepseek.com/v1"
    
    async def complete(self, messages, tools=None):
        payload = {
            "model": self.model,  # "deepseek-v4-flash"
            "messages": [m.to_dict() for m in messages],
            "tools": tools,  # Full function-calling support
            "stream": True,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}
        # Stream and parse identical to LM Studio
```

## 5.22 Document Ingestion Pipeline

The ingestion route (`routes/ingest.py`) implements the full RAG indexing pipeline:

### 5.22.1 Text Extraction

```python
def _extract_text(file_bytes: bytes, filename: str) -> str:
    if filename.lower().endswith('.pdf'):
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text
    else:
        return file_bytes.decode('utf-8', errors='replace')
```

PyMuPDF (`fitz`) extracts text from PDF pages without requiring external binaries.

### 5.22.2 Content Validation

```python
def _is_meaningful_text(text: str) -> bool:
    """Reject image-only PDFs and garbage content."""
    if len(text.strip()) < 50:
        return False
    printable_ratio = sum(1 for c in text if c.isprintable() or c.isspace()) / len(text)
    return printable_ratio > 0.7
```

This guards against:
- Image-only PDFs that produce no text.
- Corrupted files producing mostly control characters.
- Near-empty documents.

### 5.22.3 Chunking Strategy

```python
CHUNK_SIZE = 2000   # ~500 tokens in characters
CHUNK_OVERLAP = 200 # ~50 tokens overlap

def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks with smart boundary detection."""
    if len(text) <= CHUNK_SIZE:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        
        # Try to break at paragraph boundary
        if end < len(text):
            para_break = text.rfind("\n\n", start, end)
            if para_break > start + CHUNK_SIZE // 2:
                end = para_break + 2
            else:
                # Try sentence boundary
                sent_break = text.rfind(". ", start, end)
                if sent_break > start + CHUNK_SIZE // 2:
                    end = sent_break + 2
                else:
                    # Try word boundary
                    word_break = text.rfind(" ", start, end)
                    if word_break > start + CHUNK_SIZE // 2:
                        end = word_break + 1

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - CHUNK_OVERLAP if end < len(text) else end
    return chunks
```

The chunking prioritizes natural text boundaries (paragraphs > sentences > words) to avoid splitting mid-thought. The 200-character overlap ensures context continuity across chunk boundaries.

### 5.22.4 Embedding and Storage

```python
async def embed_and_store(chunks: list[str], kb_id: str) -> str:
    document_id = str(uuid4())
    
    for i, chunk in enumerate(chunks):
        # Generate embedding via LM Studio
        embedding = await embedding_service.embed(chunk)
        
        # Store in Supabase
        await supabase.table("documents").insert({
            "content": chunk,
            "embedding": embedding,
            "kb_id": kb_id,
            "metadata": {"document_id": document_id, "chunk_index": i}
        }).execute()
    
    return document_id
```

## 5.23 WebSocket Handler

The WebSocket handler manages the full lifecycle of a chat session:

```python
@app.websocket("/ws/coach")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session = None
    cancelled = False

    try:
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "session_start":
                tier = Tier(data.get("tier", "lite"))
                mode = Mode(data.get("mode", "chat"))
                user_id = data.get("user_id", "")
                kb_id = data.get("kb_id", "")
                
                capability = resolve_capability(tier, mode, user_id, kb_id)
                session = {"capability": capability, "messages": []}
                
                tools = capability.tool_names() if hasattr(capability, 'tool_names') else []
                await websocket.send_json(session_ack(session_id, tier, mode, tools))
            
            elif data["type"] == "user_message":
                cancelled = False
                session["messages"].append(Message(role=Role.USER, content=data["content"]))
                
                async def on_event(event):
                    await websocket.send_json(event)
                
                await capability.run(session["messages"], on_event, lambda: cancelled)
                await websocket.send_json({"type": "done"})
            
            elif data["type"] == "stop":
                cancelled = True
    
    except WebSocketDisconnect:
        pass
```

## 5.24 Spaced Repetition Service

The SM-2 implementation in `learning/spaced_repetition.py`:

```python
class SpacedRepetitionScheduler:
    def _score_to_quality(self, score: float) -> int:
        """Map quiz accuracy (0.0-1.0) to SM-2 quality (0-5)."""
        if score >= 0.9: return 5
        if score >= 0.8: return 4
        if score >= 0.6: return 3
        if score >= 0.4: return 2
        if score >= 0.2: return 1
        return 0

    def compute_next_review(self, category, score, current_item=None):
        quality = self._score_to_quality(score)
        
        if quality >= 3:  # Pass
            reps = current_item.repetitions + 1
            if reps == 1:
                interval = 1.0  # 1 day
            elif reps == 2:
                interval = 3.0  # 3 days
            else:
                interval = current_item.interval_days * current_item.easiness
            
            easiness = current_item.easiness + (
                0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
            )
            easiness = max(1.3, easiness)
        else:  # Fail
            reps = 0
            interval = 0.5  # 12 hours
            easiness = current_item.easiness  # Unchanged on failure
        
        return ReviewItem(
            category=category,
            next_review=datetime.now() + timedelta(days=interval),
            interval_days=interval,
            easiness=easiness,
            repetitions=reps,
            last_score=score,
        )
```

Notably, the implementation diverges from canonical SM-2 in two ways:
1. The second interval is 3 days (not 6 as in original SM-2), providing more aggressive early review.
2. On failure, the interval is 12 hours (not 1 day), allowing same-day re-review.

## 5.25 Scheduler

APScheduler runs periodic background tasks:

```python
scheduler = AsyncIOScheduler()

# Check for due reviews every hour
scheduler.add_job(check_due_reviews, 'interval', hours=settings.review_check_interval_hours)

# Daily progress snapshot at 2 AM
scheduler.add_job(compute_daily_snapshot, 'cron', hour=settings.progress_snapshot_hour)
```

The `check_due_reviews` task:
1. Queries all review schedules from Spring Boot API.
2. Filters for `next_review ≤ now`.
3. Creates notification via Spring Boot notification endpoint.

## 5.26 Tool Implementations

### 5.26.1 QuizHistoryTool

Fetches user's quiz history from Spring Boot and computes analytics:

```python
class QuizHistoryTool(BaseTool):
    name = "quiz_history"
    
    async def execute(self, arguments: dict) -> str:
        user_id = arguments.get("user_id") or self.user_id
        history = await quiz_api.get_user_history(user_id)
        
        # Compute summary statistics
        summary = {
            "total_quizzes": len(history),
            "categories": category_breakdown(history),
            "recent_scores": [h.score for h in history[-5:]],
            "weakest": find_weakest(history),
        }
        return json.dumps(summary)
```

### 5.26.2 RAGTool

Performs semantic search against user's uploaded documents:

```python
class RAGTool(BaseTool):
    name = "rag_search"
    
    async def execute(self, arguments: dict) -> str:
        query = arguments["query"]
        top_k = arguments.get("top_k", 5)
        
        # Generate query embedding
        query_embedding = await embedding_service.embed(query)
        
        # Search Supabase via RPC
        results = await supabase.rpc("match_documents", {
            "query_embedding": query_embedding,
            "match_count": top_k,
            "filter_kb_id": self.kb_id,
        }).execute()
        
        # Format results for LLM context
        context = "\n\n".join([
            f"[Source {i+1}] {r['content']}" 
            for i, r in enumerate(results.data)
        ])
        return context
```

### 5.26.3 WebSearchTool

Uses DuckDuckGo for web search (avoiding API key requirements):

```python
class WebSearchTool(BaseTool):
    name = "web_search"
    
    async def execute(self, arguments: dict) -> str:
        query = arguments.get("query", "")
        
        from ddgs import DDGS
        ddgs = DDGS()
        results = list(ddgs.text(query, max_results=5))
        
        if not results:
            return f"No results found for: '{query}'"
        
        formatted = []
        for i, r in enumerate(results, 1):
            title = r.get("title", "No title")
            body = r.get("body", "").strip()
            href = r.get("href", "")
            formatted.append(f"{i}. **{title}**\n   {body}\n   Source: {href}")
        
        return f"Search results for '{query}':\n\n" + "\n\n".join(formatted)
```

DuckDuckGo was chosen over Google Custom Search API to avoid API key costs and rate limit concerns during development.

## 5.27 API Security

### 5.27.1 API Key Middleware

Protected endpoints require `X-API-Key` header:

```python
async def verify_api_key(request: Request):
    if not settings.api_key:
        return  # No key configured = development mode
    
    provided = request.headers.get("X-API-Key", "")
    if not hmac.compare_digest(provided, settings.api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
```

### 5.27.2 CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # ["http://localhost:3000", "http://localhost:8080"]
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 5.28 Running the Service

```bash
cd ai-study-coach
pip install -r requirements.txt
uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
```

The `--reload` flag enables hot-reloading during development. Environment variables are loaded from `.env` via pydantic-settings.
