-- ============================================================================
-- ASCEND — STAGE 5B: CORE DATABASE (additive, reversible)
-- Branch: ascend-data-integration
-- Upstream Stage 4: docs/architecture/ASCEND_STAGE_4_DATA_ARCHITECTURE.md
--
-- Scope (CORE only — dataset ingestion explicitly EXCLUDED):
--   NEW (user-scoped):  leads, lead_research, proposals,
--                       user_documents, document_chunks
--   EXTEND EXISTING:    learn_topics (+source_url, +estimated_hours)
--                       outreach    (+lead_id, +ai_drafted, +approved)
--   Storage:            private 'documents' bucket + owner-only policies
--
-- NOT implemented (per safety gate):
--   website_audits (UNVERIFIED), work_projects.lead_id (UNVERIFIED),
--   document_embeddings (pgvector UNVERIFIED), knowledge_items /
--   corpus_embeddings (dataset ingestion BLOCKED).
--
-- All changes are additive. No existing table/column dropped or altered
-- destructively. Every user-owned table replicates the existing per-user
-- RLS pattern: FOR ALL USING (auth.uid()=user_id) WITH CHECK (...).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- EXTEND EXISTING: learn_topics
-- ---------------------------------------------------------------------------
alter table public.learn_topics
  add column if not exists source_url text;

alter table public.learn_topics
  add column if not exists estimated_hours numeric;

-- ---------------------------------------------------------------------------
-- EXTEND EXISTING: outreach  (link to leads + human-approval flags)
-- ---------------------------------------------------------------------------
alter table public.outreach
  add column if not exists lead_id uuid references public.leads on delete set null;

alter table public.outreach
  add column if not exists ai_drafted boolean not null default false;

alter table public.outreach
  add column if not exists approved boolean not null default false;

-- ---------------------------------------------------------------------------
-- NEW: leads  (Work automation foundation — discovered prospects)
-- ---------------------------------------------------------------------------
create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  name          text not null,
  source_platform text,
  contact       text,
  niche         text,
  status        text not null default 'New',
  discovered_at timestamptz default now(),
  raw_notes     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;

alter table public.leads enable row level security;

create policy "own leads"
  on public.leads
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger t_leads_upd
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- NEW: lead_research  (research/opportunity notes for a lead)
-- ---------------------------------------------------------------------------
create table public.lead_research (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  lead_id             uuid not null references public.leads on delete cascade,
  summary             text,
  pain_points         text,
  tech_stack_detected text,
  social_urls         jsonb not null default '[]'::jsonb,
  research_method     text default 'manual',
  researched_at       timestamptz default now(),
  created_at          timestamptz not null default now()
);

grant select, insert, update, delete on public.lead_research to authenticated;
grant all on public.lead_research to service_role;

alter table public.lead_research enable row level security;

create policy "own lead_research"
  on public.lead_research
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- NEW: proposals  (human-approved proposals; may reference lead or client)
-- ---------------------------------------------------------------------------
create table public.proposals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  lead_id     uuid references public.leads on delete set null,
  client_id   uuid references public.clients on delete set null,
  title       text not null,
  body_markdown text,
  status      text not null default 'Draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

grant select, insert, update, delete on public.proposals to authenticated;
grant all on public.proposals to service_role;

alter table public.proposals enable row level security;

create policy "own proposals"
  on public.proposals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger t_proposals_upd
  before update on public.proposals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- NEW: user_documents  (metadata for user-uploaded documents; content in Storage)
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
-- NEW: document_chunks  (parsed text chunks of a user document; no embeddings)
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
-- Indexes (additive; justified by user_id filter, FK joins, status filtering)
-- ---------------------------------------------------------------------------
create index if not exists idx_leads_user_id            on public.leads (user_id);
create index if not exists idx_leads_user_status       on public.leads (user_id, status);

create index if not exists idx_lead_research_lead_id   on public.lead_research (lead_id);
create index if not exists idx_lead_research_user_id   on public.lead_research (user_id);

create index if not exists idx_proposals_user_id       on public.proposals (user_id);
create index if not exists idx_proposals_lead_id       on public.proposals (lead_id);
create index if not exists idx_proposals_client_id     on public.proposals (client_id);

create index if not exists idx_user_documents_user_id     on public.user_documents (user_id);
create index if not exists idx_user_documents_user_status on public.user_documents (user_id, status);

create index if not exists idx_document_chunks_document_id on public.document_chunks (document_id);
create index if not exists idx_document_chunks_user_id     on public.document_chunks (user_id);

create index if not exists idx_outreach_lead_id        on public.outreach (lead_id);

-- ============================================================================
-- ROLLBACK (reverse of the above; run only to undo this migration)
-- ----------------------------------------------------------------------------
-- drop policy if exists "documents delete own"  on storage.objects;
-- drop policy if exists "documents update own"  on storage.objects;
-- drop policy if exists "documents select own"  on storage.objects;
-- drop policy if exists "documents insert own"  on storage.objects;
-- delete from storage.buckets where id = 'documents';
--
-- drop index if exists idx_outreach_lead_id;
-- drop index if exists idx_document_chunks_user_id;
-- drop index if exists idx_document_chunks_document_id;
-- drop index if exists idx_user_documents_user_status;
-- drop index if exists idx_user_documents_user_id;
-- drop index if exists idx_proposals_client_id;
-- drop index if exists idx_proposals_lead_id;
-- drop index if exists idx_proposals_user_id;
-- drop index if exists idx_lead_research_user_id;
-- drop index if exists idx_lead_research_lead_id;
-- drop index if exists idx_leads_user_status;
-- drop index if exists idx_leads_user_id;
--
-- drop table if exists public.document_chunks;
-- drop table if exists public.user_documents;
-- drop table if exists public.proposals;
-- drop table if exists public.lead_research;
-- drop table if exists public.leads;
--
-- alter table public.outreach drop column if exists approved;
-- alter table public.outreach drop column if exists ai_drafted;
-- alter table public.outreach drop column if exists lead_id;
-- alter table public.learn_topics drop column if exists estimated_hours;
-- alter table public.learn_topics drop column if exists source_url;
-- ============================================================================
