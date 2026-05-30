# 07 — RAG Tool (Supabase pgvector)

## Purpose

Implement Retrieval-Augmented Generation using Supabase's pgvector extension. Embeds user queries, searches the vector store for relevant document chunks, and returns formatted context to the LLM.

**Status: ✅ Implemented** — Full pipeline: upload → extract → chunk → embed → store → search. Integrated in agentic loop as `search_study_materials` tool.

---

## Implementation Summary

### Files Created/Modified

| File | Role |
|------|------|
| `server/routes/ingest.py` | POST/GET/DELETE endpoints for document ingestion |
| `server/agent/tools.py` | `search_study_materials` tool definition |
| `server/agent/tool_executor.py` | `_search_study_materials()` executor |
| `server/services/supabase_client.py` | `store_document()` + `search_documents()` |
| `server/services/embeddings.py` | `get_embedding()` via LM Studio |
| `server/tools/registry.py` | RAG tool in full registry (kb_id = user_id) |
| `frontend/src/pages/api/coach/ingest.js` | BFF proxy for upload |
| `frontend/src/pages/api/coach/documents/[userId].js` | BFF proxy for listing |
| `frontend/src/pages/api/coach/documents/[userId]/[documentId].js` | BFF proxy for deletion |
| `frontend/src/store/useCoach.js` | Calls ingest after upload (Full tier) |
| `frontend/src/components/Coach/StudyMaterials.jsx` | RAG status badges |

### Ingestion Flow

```text
User uploads file (Materials tab, Full tier)
  → POST /ingest (multipart: file + user_id)
  → _extract_text() (PyMuPDF for PDF, utf-8 for txt/md)
  → Sanitize: strip null bytes (\x00) that PostgreSQL rejects
  → _is_meaningful_text() check (>70% printable chars, >50 chars)
     → If fails: HTTP 400 "This PDF appears to contain images rather than selectable text"
  → _chunk_text() (2000 chars, 200 overlap, paragraph→sentence→word boundary)
  → LM Studio embedding (nomic-embed-text-v1.5, 768 dims)
  → Supabase documents table (kb_id = user_id, metadata: filename, chunk_index)
  → Returns document_id + chunk count
```

### Document Metadata Persistence

```text
Document metadata is stored in Firestore (not localStorage):
  Collection: users/{uid}/documents/{docId}
  Fields: name, status, ragStatus, ragError, ragDocumentId, uploadedAt, questions[], ragChunks
  
  Loaded via loadUserDocuments() on auth (in _app.js onIdTokenChanged)
  Saved via saveDocumentToFirestore() at each status change
  Deleted via deleteDocumentFromFirestore() + AI coach DELETE /ingest/{uid}/{docId}
```

### Search Flow (Agentic Chat)

```text
User asks question → LLM decides to call search_study_materials tool
  → tool_executor._search_study_materials(query, user_id)
  → supabase_client.search_documents(user_id, query, top_k=5)
  → embed query → match_documents RPC → cosine similarity
  → formatted results returned to LLM (with filename + relevance score)
  → LLM answers grounded in student's uploaded materials
```

## Interface Contract

```python
class RAGTool(BaseTool):
    name = "rag"
    
    async def execute(self, arguments: dict) -> str:
        """
        Args (from LLM function call):
            query: str — the search query
            kb_id: str — knowledge base ID (auto-injected by orchestrator)
        
        Returns:
            Formatted text with relevant document chunks and source references.
            Empty message if no relevant results found.
        """
```

---

## Data Shapes

### Supabase Table Schema

```sql
-- Run this in Supabase SQL Editor

-- Enable pgvector extension
create extension if not exists vector;

-- Documents table (metadata)
create table documents (
    id uuid primary key default gen_random_uuid(),
    kb_id text not null,           -- Knowledge base identifier
    filename text not null,
    file_type text,                -- 'pdf', 'txt', 'md'
    uploaded_at timestamp default now(),
    chunk_count integer default 0
);

-- Document chunks table (with embeddings)
create table document_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid references documents(id) on delete cascade,
    kb_id text not null,           -- Denormalized for fast filtering
    chunk_index integer not null,  -- Order within document
    content text not null,         -- The actual text chunk
    embedding vector(384),         -- 384-dim for all-MiniLM-L6-v2
                                   -- or vector(768) for text-embedding-004
    metadata jsonb default '{}'::jsonb,  -- page_number, section_title, etc.
    created_at timestamp default now()
);

-- Index for fast similarity search
create index on document_chunks 
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

-- Index for filtering by kb_id
create index on document_chunks (kb_id);

-- Similarity search function
create or replace function match_documents(
    query_embedding vector(384),
    match_kb_id text,
    match_threshold float default 0.7,
    match_count int default 5
)
returns table (
    id uuid,
    content text,
    metadata jsonb,
    similarity float
)
language sql stable
as $$
    select
        document_chunks.id,
        document_chunks.content,
        document_chunks.metadata,
        1 - (document_chunks.embedding <=> query_embedding) as similarity
    from document_chunks
    where document_chunks.kb_id = match_kb_id
        and 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
    order by document_chunks.embedding <=> query_embedding
    limit match_count;
$$;
```

### Python Data Models

```python
@dataclass
class ChunkResult:
    """A single retrieved document chunk."""
    id: str
    content: str
    similarity: float
    metadata: dict  # page_number, section_title, filename, etc.

@dataclass
class RAGResult:
    """Complete RAG retrieval result."""
    chunks: list[ChunkResult]
    query: str
    kb_id: str
```

---

## Behavior Specification

### RAG Tool Implementation

```python
# server/tools/rag.py

from server.services.supabase_client import SupabaseClient
from server.services.embeddings import EmbeddingService

class RAGTool(BaseTool):
    name = "rag"
    description = "Search the student's study materials for relevant information."
    
    def __init__(self, config: RAGConfig):
        self.supabase = SupabaseClient(config)
        self.embedder = EmbeddingService(config.embedding_model)
        self.similarity_threshold = config.similarity_threshold
        self.max_results = config.max_results
    
    def parameters_schema(self):
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query to find relevant study material"
                }
            },
            "required": ["query"]
        }
    
    async def execute(self, arguments: dict) -> str:
        query = arguments["query"]
        kb_id = arguments.get("kb_id", "default")
        
        # Step 1: Embed the query
        query_embedding = await self.embedder.embed(query)
        
        # Step 2: Search Supabase
        results = await self.supabase.rpc(
            "match_documents",
            {
                "query_embedding": query_embedding,
                "match_kb_id": kb_id,
                "match_threshold": self.similarity_threshold,
                "match_count": self.max_results,
            }
        )
        
        # Step 3: Format results for LLM
        if not results:
            return f"No relevant information found in study materials for: '{query}'"
        
        return self._format_results(results, query)
    
    def _format_results(self, results: list[dict], query: str) -> str:
        """Format retrieved chunks for LLM consumption."""
        lines = [f"Found {len(results)} relevant passages for '{query}':\n"]
        
        for i, r in enumerate(results, 1):
            metadata = r.get("metadata", {})
            source = metadata.get("filename", "Unknown")
            page = metadata.get("page_number", "")
            section = metadata.get("section_title", "")
            
            header = f"[{i}] Source: {source}"
            if page:
                header += f", Page {page}"
            if section:
                header += f", Section: {section}"
            
            lines.append(header)
            lines.append(r["content"])
            lines.append(f"(Relevance: {r['similarity']:.0%})\n")
        
        return "\n".join(lines)
```

### Embedding Service

```python
# server/services/embeddings.py

class EmbeddingService:
    """Generate embeddings for text."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model = None
    
    async def embed(self, text: str) -> list[float]:
        """Embed a single text string."""
        if self.model_name == "text-embedding-004":
            return await self._embed_google(text)
        else:
            return await self._embed_local(text)
    
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts (for document ingestion)."""
        if self.model_name == "text-embedding-004":
            return await self._embed_google_batch(texts)
        else:
            return await self._embed_local_batch(texts)
    
    async def _embed_local(self, text: str) -> list[float]:
        """Local embedding using sentence-transformers."""
        from sentence_transformers import SentenceTransformer
        if self._model is None:
            self._model = SentenceTransformer(self.model_name)
        embedding = self._model.encode(text)
        return embedding.tolist()
    
    async def _embed_google(self, text: str) -> list[float]:
        """Google embedding API."""
        import google.generativeai as genai
        result = await genai.embed_content_async(
            model="models/text-embedding-004",
            content=text,
        )
        return result["embedding"]
```

### Supabase Client

```python
# server/services/supabase_client.py

import httpx

class SupabaseClient:
    """Async Supabase client for vector operations."""
    
    def __init__(self, config: RAGConfig):
        self.url = config.supabase_url
        self.key = config.supabase_key
        self.client = httpx.AsyncClient(
            base_url=f"{self.url}/rest/v1",
            headers={
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
            },
        )
    
    async def rpc(self, function_name: str, params: dict) -> list[dict]:
        """Call a Supabase RPC function (e.g., match_documents)."""
        response = await self.client.post(
            f"/rpc/{function_name}",
            json=params,
        )
        response.raise_for_status()
        return response.json()
    
    async def insert_chunks(self, chunks: list[dict]) -> None:
        """Insert document chunks with embeddings."""
        response = await self.client.post(
            "/document_chunks",
            json=chunks,
        )
        response.raise_for_status()
```

---

## Document Ingestion Pipeline

```python
# server/services/ingestion.py
# (Called when student uploads a document — separate from the real-time AI loop)

class DocumentIngester:
    """Process uploaded documents into chunks and embeddings."""
    
    def __init__(self, supabase: SupabaseClient, embedder: EmbeddingService):
        self.supabase = supabase
        self.embedder = embedder
    
    async def ingest(self, file_path: str, kb_id: str, filename: str) -> int:
        """
        Ingest a document:
        1. Parse document (PDF/TXT)
        2. Split into chunks
        3. Embed each chunk
        4. Store in Supabase
        
        Returns: number of chunks created
        """
        # Step 1: Parse
        text = await self._parse_document(file_path)
        
        # Step 2: Chunk
        chunks = self._split_into_chunks(text, chunk_size=500, overlap=50)
        
        # Step 3: Embed
        embeddings = await self.embedder.embed_batch([c["content"] for c in chunks])
        
        # Step 4: Store
        records = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            records.append({
                "kb_id": kb_id,
                "chunk_index": i,
                "content": chunk["content"],
                "embedding": embedding,
                "metadata": chunk.get("metadata", {}),
            })
        
        await self.supabase.insert_chunks(records)
        return len(records)
    
    def _split_into_chunks(self, text: str, chunk_size: int = 500, overlap: int = 50) -> list[dict]:
        """Split text into overlapping chunks."""
        chunks = []
        words = text.split()
        
        i = 0
        chunk_idx = 0
        while i < len(words):
            chunk_words = words[i:i + chunk_size]
            chunk_text = " ".join(chunk_words)
            chunks.append({
                "content": chunk_text,
                "metadata": {"chunk_index": chunk_idx},
            })
            i += chunk_size - overlap
            chunk_idx += 1
        
        return chunks
    
    async def _parse_document(self, file_path: str) -> str:
        """Extract text from document."""
        if file_path.endswith(".pdf"):
            return await self._parse_pdf(file_path)
        elif file_path.endswith((".txt", ".md")):
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        else:
            raise ValueError(f"Unsupported file type: {file_path}")
    
    async def _parse_pdf(self, file_path: str) -> str:
        """Extract text from PDF."""
        import pymupdf  # PyMuPDF
        doc = pymupdf.open(file_path)
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return "\n".join(text_parts)
```

---

## Acceptance Criteria

- [x] `RAGTool.execute()` embeds query and searches Supabase
- [x] Returns formatted results with source attribution (filename)
- [x] Returns "no results" message when no relevant content found
- [x] Embeddings generated via LM Studio (nomic-embed-text-v1.5, 768 dims)
- [x] `SupabaseClient.rpc()` correctly calls `match_documents` function
- [x] Document ingestion: PDF/TXT/MD → chunks → embeddings → stored in Supabase
- [x] Chunk overlap (200 chars) prevents context loss at boundaries
- [x] Max 5 results returned (configurable via top_k)
- [x] Handles empty knowledge base gracefully
- [x] Handles Supabase connection errors gracefully
- [x] Storage limit: 50MB per user with validation
- [x] Duplicate detection by filename
- [x] Document listing and deletion endpoints
- [x] `search_study_materials` tool in agentic loop (tool_executor + tools.py)
- [x] Frontend RAG status badges (indexed / failed)
- [x] BFF proxy routes (ingest, list, delete)

---

## Dependencies

```text
supabase>=2.16.0             # Supabase Python client
httpx>=0.28.1                # HTTP client (already in requirements)
pymupdf>=1.24.0              # PDF parsing (optional — graceful fallback)
```

Embedding model: `text-embedding-nomic-embed-text-v1.5` via LM Studio (768 dimensions).

---

## DeepTutor Reference

| This Module | DeepTutor Equivalent | What Changed |
| ------------- | --------------------- | -------------- |
| `RAGTool` | `deeptutor/tools/builtin/rag.py` | Supabase instead of custom vector store |
| Embedding service | `deeptutor/knowledge/embedding/` | Same concept, fewer providers |
| Document ingestion | `deeptutor/knowledge/ingestion/` | Simplified pipeline (no MinerU, no multi-format) |
| Chunking | `deeptutor/knowledge/chunking/` | Basic word-based instead of semantic chunking |
| Vector search | `deeptutor/knowledge/retrieval/` | Supabase RPC instead of custom retriever |
