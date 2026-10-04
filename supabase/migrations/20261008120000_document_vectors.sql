-- ============================================================================
-- ASCEND — DOCUMENT VECTOR SEARCH (additive, reversible)
-- Enable pgvector and add embedding column to document_chunks.
-- ============================================================================

-- Enable pgvector extension
create extension if not exists vector;

-- Add embedding column to document_chunks
-- Using 1536 dimensions for text-embedding-3-small
alter table public.document_chunks
  add column if not exists embedding vector(1536);

-- Create index for vector similarity search (IVFFLAT for approximate nearest neighbor)
create index if not exists idx_document_chunks_embedding
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop index if exists idx_document_chunks_embedding;
-- alter table public.document_chunks drop column if exists embedding;
-- drop extension if exists vector;