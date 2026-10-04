-- ============================================================================
-- ASCEND — USER DOCUMENTS & CHUNKS (additive, reversible)
-- Private document storage with RLS and chunking for retrieval.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- user_documents  (metadata for user-uploaded documents; content in Storage)
-- Path convention in bucket: <user_id>/<uuid>/<filename>
-- ---------------------------------------------------------------------------
create table public.user_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  filename      text not null,
  storage_path  text not null,
  mime_type     text,
  size_bytes    bigint,
  document_type text not null default 'other',
  subject       text,
  page_count    int,
  status        text not null default 'pending',
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

grant select, insert, update, delete on public.user_documents to authenticated;
grant all on public.user_documents to service_role;

alter table public.user_documents enable row level security;

create policy "own user_documents"
  on public.user_documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger t_user_documents_upd
  before update on public.user_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- document_chunks  (parsed text chunks of a user document; no embeddings)
-- ---------------------------------------------------------------------------
create table public.document_chunks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  document_id   uuid not null references public.user_documents on delete cascade,
  chunk_index   int not null,
  page_number   int,
  heading       text,
  content_text  text not null,
  token_count   int,
  created_at    timestamptz not null default now()
);

grant select, insert, update, delete on public.document_chunks to authenticated;
grant all on public.document_chunks to service_role;

alter table public.document_chunks enable row level security;

create policy "own document_chunks"
  on public.document_chunks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: private 'documents' bucket + owner-only object policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 52428800, null)
on conflict (id) do nothing;

create policy "documents insert own"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents select own"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents update own"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents delete own"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_user_documents_user_id     on public.user_documents (user_id);
create index if not exists idx_user_documents_user_status on public.user_documents (user_id, status);

create index if not exists idx_document_chunks_document_id on public.document_chunks (document_id);
create index if not exists idx_document_chunks_user_id     on public.document_chunks (user_id);

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop policy if exists "documents delete own"  on storage.objects;
-- drop policy if exists "documents update own"  on storage.objects;
-- drop policy if exists "documents select own"  on storage.objects;
-- drop policy if exists "documents insert own"  on storage.objects;
-- delete from storage.buckets where id = 'documents';
--
-- drop index if exists idx_document_chunks_user_id;
-- drop index if exists idx_document_chunks_document_id;
-- drop index if exists idx_user_documents_user_status;
-- drop index if exists idx_user_documents_user_id;
--
-- drop table if exists public.document_chunks;
-- drop table if exists public.user_documents;