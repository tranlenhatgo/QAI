# Plan: RAG Document Ingestion Pipeline

**Status: ✅ IMPLEMENTED** — All items below have been completed and tested end-to-end.

## Goal

When a user uploads a file in the Materials tab, also index it in Supabase pgvector so the AI can reference their study materials during chat (via the existing RAG tool).

## Current State

- **Materials tab** (`StudyMaterials.jsx`): Uploads file → `POST /generate/from-file` → LLM generates quiz questions. Nothing stored in Supabase.
- **RAG tool** (`server/tools/rag.py`): Searches Supabase `documents` table via pgvector similarity. Already functional — but the table is empty because no ingestion pipeline exists.
- **Supabase client** (`server/services/supabase_client.py`): Has `store_document()` method ready. Never called by any endpoint.
- **Embeddings** (`server/services/embeddings.py`): Generates embeddings via LM Studio `text-embedding-nomic-embed-text-v1.5`. Already functional.

## Architecture

```text
User uploads file (Materials tab)
  ├─→ /generate/from-file → LLM generates questions (existing flow, unchanged)
  └─→ /ingest → extract text → chunk → embed → store in Supabase (NEW)
         │
         ├─ Text extraction (reuse _extract_text from generate.py)
         ├─ Chunking (split into ~500-token segments with 50-token overlap)
         ├─ Embedding (LM Studio nomic-embed-text-v1.5, 768 dimensions)
         └─ Storage (Supabase documents table, kb_id = user_id)

Later in chat (agentic mode):
  User asks question → LLM calls RAG tool → embed query → pgvector similarity search
                                           → top-5 relevant chunks returned to LLM
                                           → LLM answers grounded in student's materials
```

## Changes Required

### 1. New endpoint: `POST /ingest` (ai-study-coach)

**File:** `server/routes/ingest.py` (new)

- Accepts: multipart file upload + `user_id` form field
- Extracts text content from PDF/TXT/MD (reuse `_extract_text()` logic from `generate.py`)
- Splits text into chunks (~500 tokens, 50-token overlap)
- For each chunk: generates embedding via LM Studio embedding model
- Stores in Supabase `documents` table via `SupabaseClient.store_document()`
- `kb_id` = `user_id` (each user has their own knowledge base)
- Returns: `{"document_id": "...", "chunks_indexed": N, "status": "success"}`
- Metadata per chunk: `{"filename": "...", "chunk_index": N, "uploaded_at": "..."}`

### 2. Register route in main.py

**File:** `server/main.py`

- Add `from server.routes import ingest`
- Add `app.include_router(ingest.router, tags=["Ingest"])`

### 3. Frontend: ingest call with status feedback

**File:** `frontend/src/store/useCoach.js` → `uploadStudyMaterial()`

- After the existing `/api/quiz/upload` succeeds, also call `POST /api/coach/ingest`
- Send the same file + `user_id`
- On success: update document card status to include "indexed for search" ✅
- On failure: show "⚠️ Not indexed for search" warning on the document card + offer a "Retry" button
- Do NOT block the main upload flow — run in parallel but track result

### 4. BFF proxy route

**File:** `frontend/src/pages/api/coach/ingest.js` (new)

- Forward multipart upload to AI Coach `POST /ingest`
- Include `X-API-Key` header
- Return result

### 5. RAG tool wiring (minimal change)

**File:** `server/tools/registry.py` or WebSocket session handler

- Ensure `kb_id` is set to `user_id` when creating the RAG tool instance for agentic sessions
- Verify this is already done (likely is based on existing code)

## Supabase Schema (already exists)

```sql
-- Already created per SUPABASE_SETUP.md
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- pgvector similarity search function (already exists)
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 5,
  filter_kb_id TEXT DEFAULT ''
) RETURNS TABLE (id UUID, content TEXT, metadata JSONB, similarity FLOAT)
AS $$
  SELECT id, content, metadata, 1 - (embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE (filter_kb_id = '' OR kb_id = filter_kb_id)
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE SQL;
```

## Duplicate Handling

- On upload, check if a document with the same filename + user_id already exists in Supabase
- If duplicate detected: show a confirmation dialog asking "This file was already indexed. Replace the old version?"
  - **Yes:** Delete old chunks (by kb_id + metadata.filename), then re-index
  - **No:** Allow duplicate — insert new chunks alongside old ones
- The Materials tab already shows a document list with status — this list will also show Supabase-indexed documents

## Document List in Materials Tab

- Add a section showing all documents indexed in Supabase for this user
- Fetched via a new `GET /ingest/{user_id}` endpoint (returns filename, chunk_count, indexed_at)
- Each document card shows: filename, date indexed, chunk count, delete button
- Delete button calls `DELETE /ingest/{user_id}/{document_id}` → removes all chunks for that file

- **Chunk size:** ~500 tokens (~2000 characters)
- **Overlap:** 50 tokens (~200 characters) between adjacent chunks
- **Separator priority:** paragraph breaks (`\n\n`) > sentence boundaries (`. `) > word boundaries (` `)
- **Metadata:** Each chunk stores filename, chunk_index, total_chunks

## Scope

- **New files:** 2 (ingest route, BFF proxy)
- **Modified files:** 2 (main.py, useCoach.js)
- **New code:** ~150 lines
- **Dependencies:** None new (supabase, httpx already installed)

## Tier Restriction

- **RAG + Ingest = Full tier only**
- Materials tab: disable upload when `coachTier === 'lite'` — show a message like "Switch to Full mode to upload study materials for AI search"
- RAG tool: only registered in `create_full_registry()` (already the case)
- Ingest endpoint: validate tier or just rely on the frontend gating

## Security

- **Server-side validation:** RAG tool and ingest endpoints MUST reject requests where `user_id` is empty/null
- This prevents the `match_documents` SQL function from returning all users' documents (its WHERE clause falls through when `filter_kb_id = ''`)
- Validation point: in `RAGTool.execute()` and `POST /ingest` handler, check `user_id` before proceeding

## Storage Limits

- **50MB total per user** — tracked by summing file sizes from metadata
- On upload, check current usage via `GET /ingest/{user_id}` response (includes total size)
- If over limit: reject with "Storage limit reached (50MB). Delete old documents to free space."
- Display remaining storage in the Materials tab document list header

## Limitations

- **Scanned/image PDFs not supported** — only text-based PDFs can be indexed. Scanned documents will produce empty or minimal content. Document this in the UI tooltip.
- No OCR planned for v1.

## Prerequisites

- Supabase `documents` table + `match_documents` RPC function must exist (per SUPABASE_SETUP.md)
- LM Studio must have `text-embedding-nomic-embed-text-v1.5` loaded for embeddings
- `COACH_SUPABASE_URL` and `COACH_SUPABASE_KEY` must be set in `.env` (already configured)
