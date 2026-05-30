"""Document ingestion endpoint — indexes uploaded files into Supabase pgvector for RAG."""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from server.config import settings
from server.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Ingest"])

# Storage limit per user (bytes)
MAX_STORAGE_PER_USER = 50 * 1024 * 1024  # 50MB

# Chunk config
CHUNK_SIZE = 2000  # ~500 tokens in characters
CHUNK_OVERLAP = 200  # ~50 tokens overlap


def _extract_text(content_bytes: bytes, filename: str) -> str:
    """Extract text content from uploaded file."""
    lower = filename.lower()

    if lower.endswith((".txt", ".md")):
        text = content_bytes.decode("utf-8", errors="replace")
    elif lower.endswith(".pdf"):
        try:
            import fitz  # PyMuPDF

            doc = fitz.open(stream=content_bytes, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)
            doc.close()
        except ImportError:
            logger.warning("PyMuPDF not installed — treating PDF as raw text")
            text = content_bytes.decode("utf-8", errors="replace")
    else:
        text = content_bytes.decode("utf-8", errors="replace")

    # Sanitize: remove null bytes that PostgreSQL rejects
    text = text.replace("\x00", "")
    return text


def _is_meaningful_text(text: str) -> bool:
    """Check if extracted text contains meaningful readable content."""
    stripped = text.strip()
    if len(stripped) < 50:
        return False
    # Count printable characters (letters, digits, spaces, punctuation)
    printable_count = sum(1 for c in stripped if c.isprintable() or c in "\n\r\t")
    ratio = printable_count / len(stripped) if stripped else 0
    # If less than 70% printable, it's likely garbage/image-only PDF
    return ratio > 0.7


def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks of ~500 tokens."""
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

        # Advance with overlap
        start = end - CHUNK_OVERLAP if end < len(text) else end

    return chunks


@router.post("/ingest")
async def ingest_document(
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    """Index an uploaded document into Supabase pgvector for RAG search.

    Full tier only. Extracts text, chunks it, generates embeddings, stores in Supabase.
    """
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id is required")

    user_id = user_id.strip()

    if not file.filename:
        raise HTTPException(status_code=400, detail="File is required")

    # Check Supabase is configured
    client = get_supabase_client()
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="RAG storage not configured (Supabase URL/key missing)",
        )

    # Read file
    content_bytes = await file.read()
    file_size = len(content_bytes)

    # Check storage limit
    try:
        existing_docs = await _get_user_documents(client, user_id)
        total_size = sum(d.get("file_size", 0) for d in existing_docs)
        if total_size + file_size > MAX_STORAGE_PER_USER:
            raise HTTPException(
                status_code=413,
                detail=f"Storage limit reached ({MAX_STORAGE_PER_USER // (1024*1024)}MB). Delete old documents to free space.",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Could not check storage usage: {e}")

    # Check for duplicate
    duplicate = None
    try:
        existing_docs = await _get_user_documents(client, user_id)
        for doc in existing_docs:
            if doc.get("filename") == file.filename:
                duplicate = doc
                break
    except Exception:
        pass

    # Extract text
    text_content = _extract_text(content_bytes, file.filename)
    if not text_content.strip():
        raise HTTPException(
            status_code=400,
            detail="File is empty or could not be read. Only text-based PDFs are supported (no scanned/image PDFs).",
        )
    if not _is_meaningful_text(text_content):
        raise HTTPException(
            status_code=400,
            detail="This PDF appears to contain images rather than selectable text. Please use a text-based PDF (exported from Word, Google Docs, etc.) instead of a printed/scanned document.",
        )

    # Chunk
    chunks = _chunk_text(text_content)
    if not chunks:
        raise HTTPException(status_code=400, detail="No content to index after chunking")

    logger.info(
        f"Ingesting '{file.filename}' for user {user_id}: "
        f"{len(text_content)} chars → {len(chunks)} chunks"
    )

    # Generate embeddings and store
    document_id = str(uuid.uuid4())[:8]
    indexed_count = 0
    now = datetime.now(timezone.utc).isoformat()

    for i, chunk in enumerate(chunks):
        try:
            await client.store_document(
                kb_id=user_id,
                content=chunk,
                metadata={
                    "filename": file.filename,
                    "document_id": document_id,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "file_size": file_size,
                    "uploaded_at": now,
                },
            )
            indexed_count += 1
        except Exception as e:
            logger.error(f"Failed to store chunk {i} of '{file.filename}': {e}")

    if indexed_count == 0:
        raise HTTPException(
            status_code=502,
            detail="Failed to index document. Embedding service (LM Studio) may be unavailable.",
        )

    logger.info(
        f"Indexed '{file.filename}': {indexed_count}/{len(chunks)} chunks stored"
    )

    return {
        "document_id": document_id,
        "filename": file.filename,
        "chunks_indexed": indexed_count,
        "total_chunks": len(chunks),
        "status": "indexed" if indexed_count == len(chunks) else "partial",
        "duplicate_replaced": duplicate is not None,
    }


@router.get("/ingest/{user_id}")
async def list_user_documents(user_id: str):
    """List all documents indexed for a user."""
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id is required")

    client = get_supabase_client()
    if client is None:
        return {"documents": [], "total_size": 0}

    try:
        docs = await _get_user_documents(client, user_id.strip())
        total_size = sum(d.get("file_size", 0) for d in docs)
        return {
            "documents": docs,
            "total_size": total_size,
            "limit": MAX_STORAGE_PER_USER,
        }
    except Exception as e:
        logger.error(f"Failed to list documents for {user_id}: {e}")
        return {"documents": [], "total_size": 0, "limit": MAX_STORAGE_PER_USER}


@router.delete("/ingest/{user_id}/{document_id}")
async def delete_document(user_id: str, document_id: str):
    """Delete all chunks for a specific document."""
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id is required")

    client = get_supabase_client()
    if client is None:
        raise HTTPException(status_code=503, detail="RAG storage not configured")

    try:
        supabase = await client._get_client()
        # Delete all chunks matching this document_id for this user
        result = (
            supabase.table("documents")
            .delete()
            .eq("kb_id", user_id.strip())
            .filter("metadata->>document_id", "eq", document_id)
            .execute()
        )
        deleted = len(result.data) if result.data else 0
        logger.info(f"Deleted {deleted} chunks for document {document_id} (user: {user_id})")
        return {"deleted_chunks": deleted, "status": "success"}
    except Exception as e:
        logger.error(f"Failed to delete document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete: {str(e)}")


async def _get_user_documents(client, user_id: str) -> list[dict]:
    """Get unique documents for a user by querying Supabase metadata."""
    try:
        supabase = await client._get_client()
        result = (
            supabase.table("documents")
            .select("metadata")
            .eq("kb_id", user_id)
            .execute()
        )

        if not result.data:
            return []

        # Group by document_id to get unique documents
        docs_map = {}
        for row in result.data:
            meta = row.get("metadata", {})
            doc_id = meta.get("document_id", "")
            if doc_id and doc_id not in docs_map:
                docs_map[doc_id] = {
                    "document_id": doc_id,
                    "filename": meta.get("filename", "unknown"),
                    "total_chunks": meta.get("total_chunks", 0),
                    "file_size": meta.get("file_size", 0),
                    "uploaded_at": meta.get("uploaded_at", ""),
                }

        return list(docs_map.values())
    except Exception as e:
        logger.error(f"Failed to query user documents: {e}")
        return []
