# Appendix C: Database Schema

## C.1 Firestore Collections (Spring Boot Domain)

### C.1.1 Collection: `quiz`

```
quiz/
└── {quiz_id}/
    ├── id: string (auto-generated)
    ├── host_id: string (user UID who created the quiz)
    ├── title: string
    ├── description: string
    ├── status: string ("ACTIVE" | "INACTIVE")
    ├── categories: array<string> (e.g., ["science"])
    ├── start_time: timestamp | null
    ├── end_time: timestamp | null
    └── availability: string | null
```

### C.1.2 Collection: `question`

```
question/
└── {question_id}/
    ├── id: string (auto-generated)
    ├── quiz_id: string (reference to parent quiz)
    ├── content: string (question text)
    ├── answers: array<string> (exactly 4 options)
    └── correct_answer: string (plaintext, one of the answers)
```

### C.1.3 Collection: `take_quiz`

```
take_quiz/
└── {take_quiz_id}/
    ├── id: string (auto-generated)
    ├── quiz_id: string (reference to quiz taken)
    ├── player_id: string (user UID who took the quiz)
    ├── player_name: string (display name)
    ├── score: string (format: "correct/total", e.g., "4/5")
    ├── start_time: timestamp
    └── end_time: timestamp
```

### C.1.4 Collection: `take_question`

```
take_question/
└── {take_question_id}/
    ├── id: string (auto-generated)
    ├── take_id: string (reference to parent attempt)
    ├── question_id: string (reference to original question)
    ├── answer: string (user's chosen answer)
    └── check_answer: string ("1"|"2" for correct, "-1" for incorrect)
```

### C.1.5 Collection: `review_schedule`

```
review_schedule/
└── {schedule_id}/
    ├── id: string (auto-generated)
    ├── user_id: string (user UID)
    ├── category: string (e.g., "SCIENCE")
    ├── easiness: number (SM-2 easiness factor, ≥1.3)
    ├── interval_days: number (days until next review)
    ├── repetitions: number (consecutive successful reviews)
    ├── next_review: timestamp (when review is due)
    ├── last_reviewed: timestamp (last review date)
    ├── last_score: string (score from last review, e.g., "4/5")
    └── updated_at: timestamp
```

**Composite Key**: (user_id, category) — enforced by upsert logic in service layer.

### C.1.6 Collection: `notifications`

```
notifications/
└── {notification_id}/
    ├── id: string (auto-generated)
    ├── user_id: string (recipient user UID)
    ├── type: string ("REVIEW_DUE" | "MILESTONE" | "WELCOME")
    ├── title: string
    ├── message: string
    ├── read: boolean (default: false)
    ├── metadata: map (additional context)
    │   ├── category: string (for REVIEW_DUE)
    │   ├── quiz_id: string (for quiz-related)
    │   └── achievement: string (for MILESTONE)
    └── created_at: timestamp
```

### C.1.7 Collection: `users`

```
users/
└── {user_id}/
    ├── id: string (Firebase Auth UID)
    ├── name: string
    ├── email: string
    ├── password: string (hashed, for email/password auth)
    ├── bio: string
    ├── role: string ("USER" | "ADMIN")
    ├── createdAt: timestamp
    └── updatedAt: timestamp
```

### C.1.8 Subcollection: `users/{uid}/documents` (Frontend-managed)

```
users/
└── {user_id}/
    └── documents/
        └── {document_id}/
            ├── id: string (crypto.randomUUID())
            ├── name: string (original filename)
            ├── status: string ("processing" | "indexed" | "failed")
            ├── ragStatus: string ("pending" | "indexed" | "failed")
            ├── ragError: string (error message if RAG failed)
            ├── ragDocumentId: string (UUID in Supabase for deletion)
            ├── uploadedAt: timestamp (Firestore server timestamp)
            ├── questions: array (optional, generated questions)
            └── ragChunks: number (count of stored embeddings)
```

---

## C.2 Supabase Tables (RAG Vector Storage)

### C.2.1 Table: `documents`

```sql
CREATE TABLE documents (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content     TEXT NOT NULL,
    metadata    JSONB DEFAULT '{}'::jsonb,
    embedding   VECTOR(768) NOT NULL,
    kb_id       TEXT NOT NULL
);

-- Index for approximate nearest-neighbor search
CREATE INDEX ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for kb_id filtering
CREATE INDEX idx_documents_kb_id ON documents(kb_id);
```

**Column Details**:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Auto-generated primary key |
| content | TEXT | Chunk text (≤500 characters) |
| metadata | JSONB | `{"document_id": "...", "chunk_index": 0, "filename": "..."}` |
| embedding | VECTOR(768) | nomic-embed-text-v1.5 embedding |
| kb_id | TEXT | Knowledge base ID (= user UID for isolation) |

### C.2.2 RPC Function: `match_documents`

```sql
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(768),
    match_count INT DEFAULT 5,
    filter_kb_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.content,
        d.metadata,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM documents d
    WHERE (filter_kb_id IS NULL OR d.kb_id = filter_kb_id)
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

The function uses cosine distance (`<=>` operator) for similarity ranking and supports optional kb_id filtering for user-scoped searches.

---

## C.3 Entity Relationship Summary

```text
┌──────────┐          ┌───────────────┐
│  users   │──1:N────►│     quiz      │  (host_id → users.id)
└──────────┘          └───────┬───────┘
     │                        │
     │                        │ 1:N
     │                        ▼
     │                ┌───────────────┐
     │                │   question    │  (quiz_id → quiz.id)
     │                └───────────────┘
     │
     │ 1:N            ┌───────────────┐
     ├───────────────►│   take_quiz   │  (player_id → users.id)
     │                └───────┬───────┘
     │                        │
     │                        │ 1:N
     │                        ▼
     │                ┌───────────────┐
     │                │ take_question │  (take_id → take_quiz.id)
     │                └───────────────┘
     │
     │ 1:N            ┌───────────────┐
     ├───────────────►│review_schedule│  (user_id → users.id)
     │                └───────────────┘
     │
     │ 1:N            ┌───────────────┐
     ├───────────────►│ notification  │  (user_id → users.id)
     │                └───────────────┘
     │
     │ subcollection  ┌───────────────┐         ┌──────────────┐
     └───────────────►│  documents    │────────►│  Supabase    │
                      │  (metadata)   │ ragDocId │  documents   │
                      └───────────────┘         │  (vectors)   │
                                                └──────────────┘
```

Note: Firestore is NoSQL and does not enforce foreign keys. Referential integrity is maintained by application logic.

---

## C.4 Data Volume Estimates

| Collection | Documents per User | Document Size | Growth Rate |
|------------|-------------------|---------------|-------------|
| quiz | 10–50 | ~500 bytes | 2–5/week |
| question | 50–250 | ~300 bytes | 10–25/week |
| take_quiz | 50–500 | ~200 bytes | 5–20/week |
| take_question | 250–2500 | ~150 bytes | 25–100/week |
| review_schedule | 5–15 | ~200 bytes | Stable (one per category) |
| notification | 20–100 | ~300 bytes | 3–10/week |
| documents (Firestore) | 5–20 | ~400 bytes | 1–3/week |
| documents (Supabase) | 100–2000 chunks | ~4KB (content + 768×4 embedding) | Per upload |
