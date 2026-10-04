-- ============================================================================
-- ASCEND — DOCUMENT VECTOR SEARCH RPC (additive, reversible)
-- Function for hybrid vector similarity search on document_chunks.
-- ============================================================================

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count int default 10,
  filter_user_id uuid default null,
  filter_document_ids uuid[] default null
)
returns table (
  id uuid,
  document_id uuid,
  user_id uuid,
  chunk_index int,
  page_number int,
  heading text,
  content_text text,
  token_count int,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    dc.id,
    dc.document_id,
    dc.user_id,
    dc.chunk_index,
    dc.page_number,
    dc.heading,
    dc.content_text,
    dc.token_count,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where (filter_user_id is null or dc.user_id = filter_user_id)
    and (filter_document_ids is null or dc.document_id = any(filter_document_ids))
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop function if exists public.match_document_chunks(vector, int, uuid, uuid[]);