# Supabase Setup Guide — AI Study Coach (pgvector RAG)

This guide walks you through setting up Supabase as the vector database for the
AI Study Coach's RAG (Retrieval-Augmented Generation) feature.

---

## Overview

The RAG pipeline works as follows:

```
User question → Embedding (LM Studio) → pgvector similarity search (Supabase)
                                              ↓
                                    Top-K document chunks
                                              ↓
                                    LLM generates grounded answer
```

**Components:**
- `server/services/embeddings.py` — generates vector embeddings via LM Studio
- `server/services/supabase_client.py` — queries Supabase pgvector
- `server/tools/rag.py` — RAGTool used by AgenticCapability

---

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up (free tier available)
2. Click **"New Project"**
3. Choose a name (e.g., `ai-study-coach`)
4. Set a database password (save it somewhere safe)
5. Select a region close to your users
6. Click **"Create new project"** and wait for provisioning (~2 minutes)

---

## Step 2: Enable the pgvector Extension

In the Supabase dashboard:

1. Go to **SQL Editor** (left sidebar)
2. Run this SQL:

```sql
-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Step 3: Create the Documents Table

Run this SQL in the SQL Editor:

```sql
-- Main table for storing document chunks with embeddings
CREATE TABLE documents (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kb_id       TEXT NOT NULL,
    content     TEXT NOT NULL,
    embedding   VECTOR(768),    -- Matches LM Studio embedding dimension
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast vector similarity search
CREATE INDEX documents_embedding_idx
    ON documents
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Index for filtering by knowledge base
CREATE INDEX documents_kb_id_idx ON documents (kb_id);
```

> **Note on embedding dimension:** The default is 768 (standard for many embedding
> models in LM Studio like `nomic-embed-text`). If your embedding model outputs a
> different dimension (e.g., 1536 for OpenAI), change `VECTOR(768)` accordingly.

---

## Step 4: Create the `match_documents` RPC Function

This function is called by `SupabaseClient.search_documents()`:

```sql
-- Similarity search function used by the AI Study Coach
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(768),
    match_count     INT DEFAULT 5,
    filter_kb_id    TEXT DEFAULT NULL
)
RETURNS TABLE (
    id         BIGINT,
    kb_id      TEXT,
    content    TEXT,
    metadata   JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.kb_id,
        d.content,
        d.metadata,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM documents d
    WHERE
        (filter_kb_id IS NULL OR d.kb_id = filter_kb_id)
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

---

## Step 5: (Optional) Row-Level Security

If you want to restrict access per user:

```sql
-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Allow service role (used by backend) full access
CREATE POLICY "Service role full access"
    ON documents
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

> Since the AI Study Coach backend uses the **service role key**, RLS won't block
> it. But it's good practice to enable it for future multi-tenant scenarios.

---

## Step 6: Get Your Credentials

1. In Supabase dashboard, go to **Settings → API**
2. Copy:
   - **Project URL** — e.g. `https://abcdefghij.supabase.co`
   - **Service Role Key** (secret, `service_role`) — starts with `eyJ...`

> ⚠️ Use the **service role key**, NOT the anon key. The service role bypasses RLS
> and is meant for server-side use only.

---

## Step 7: Configure the AI Study Coach

Add to your `.env` file:

```env
# Supabase (pgvector RAG)
COACH_SUPABASE_URL=https://your-project-id.supabase.co
COACH_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-service-role-key
```

These map to `server/config.py`:
```python
supabase_url: str = ""   # ← COACH_SUPABASE_URL
supabase_key: str = ""   # ← COACH_SUPABASE_KEY
```

---

## Step 8: Install the Python Dependency

```bash
cd ai-study-coach
pip install supabase
```

Or it's already in `requirements.txt`:
```
supabase>=2.0.0
```

---

## Step 9: Set Up LM Studio Embeddings

The embedding service uses LM Studio's `/v1/embeddings` endpoint:

1. Open LM Studio
2. Load an embedding model (recommended: `nomic-embed-text` or `bge-small-en`)
3. Start the server (default: `http://127.0.0.1:1234`)

The coach calls:
```
POST http://127.0.0.1:1234/v1/embeddings
{"input": "text to embed", "model": "text-embedding"}
```

---

## Step 10: Verify the Setup

Run this quick test:

```bash
cd ai-study-coach
python -c "
import asyncio
from server.services.supabase_client import get_supabase_client

async def test():
    client = get_supabase_client()
    if client is None:
        print('ERROR: Supabase not configured (check COACH_SUPABASE_URL and COACH_SUPABASE_KEY)')
        return
    # Test connection by searching (will return empty if no docs)
    results = await client.search_documents(kb_id='test', query='hello', top_k=1)
    print(f'OK — Supabase connected. Results: {len(results)}')

asyncio.run(test())
"
```

---

## Uploading Documents

To populate the knowledge base, use `SupabaseClient.store_document()`:

```python
from server.services.supabase_client import get_supabase_client

client = get_supabase_client()
await client.store_document(
    kb_id="student-123-calculus",
    content="The derivative of x^n is nx^(n-1). This is the power rule...",
    metadata={
        "filename": "calculus_textbook.pdf",
        "page_number": 42,
        "section_title": "Power Rule",
    },
)
```

> A document ingestion pipeline (PDF → chunks → embeddings → Supabase) is planned
> but not yet implemented. For now, you can use the method above or insert directly
> via the Supabase dashboard.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `RAG not available: Supabase not configured` | Missing env vars | Set `COACH_SUPABASE_URL` and `COACH_SUPABASE_KEY` in `.env` |
| `supabase package not installed` | Missing dependency | `pip install supabase` |
| `Embedding service unavailable` | LM Studio not running or no embedding model loaded | Start LM Studio with an embedding model |
| `No relevant information found` | Empty knowledge base | Upload documents first (see above) |
| `dimension mismatch` | Embedding model outputs different size | Change `VECTOR(768)` in table to match your model |
| `ivfflat index` slow on first query | Index needs training data | After inserting 1000+ docs, run `REINDEX INDEX documents_embedding_idx;` |

---

## Architecture Reference

```
server/
├── config.py                    # COACH_SUPABASE_URL, COACH_SUPABASE_KEY
├── services/
│   ├── supabase_client.py       # SupabaseClient (search + store)
│   └── embeddings.py            # get_embedding() via LM Studio
└── tools/
    └── rag.py                   # RAGTool (used by AgenticCapability)
```

The RAG tool is automatically added to `AgenticCapability` when `kb_id` is
provided in the session context (set during WebSocket `session_start` message
or via query param on REST endpoints).
