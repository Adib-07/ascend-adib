-- ============================================================================
-- ASCEND — GROUNDED EDUCATION ENGINE V1 (additive, reversible)
-- Adds TWO global, curated, read-only reference tables used by the grounded
-- AI Tutor. These are NOT user-scoped (no user_id): they are curated by Ascend
-- and shared by every user. Normal authenticated users may SELECT only.
-- Inserts/updates/deletes are restricted to service_role (seed/migration).
-- No embeddings, no pgvector, no Kaggle API, no dataset downloads.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- educational_resources  (curated trusted educational sources)
-- ---------------------------------------------------------------------------
create table public.educational_resources (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  source           text not null,
  url              text not null,
  license          text not null,
  description      text,
  subject_domain   text not null,
  difficulty       text not null default 'beginner',
  learning_purpose text,
  provenance       text,
  created_at       timestamptz not null default now()
);

comment on table public.educational_resources is
  'Curated, trusted educational sources (OCW, docs, OER). Global + read-only to users.';

grant select on public.educational_resources to authenticated;
grant all on public.educational_resources to service_role;

alter table public.educational_resources enable row level security;

create policy "educational_resources read"
  on public.educational_resources
  for select to authenticated
  using (true);

create policy "educational_resources no public write"
  on public.educational_resources
  for all to authenticated
  using (false)
  with check (false);

create index if not exists idx_educational_resources_domain
  on public.educational_resources (subject_domain);

-- ---------------------------------------------------------------------------
-- external_datasets  (Kaggle / practical-project metadata ONLY — not content)
-- ---------------------------------------------------------------------------
create table public.external_datasets (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  source           text not null,
  url              text not null,
  license          text not null,
  description      text,
  subject_domain   text not null,
  difficulty       text not null default 'beginner',
  learning_purpose text,
  provenance       text,
  kaggle_slug      text,
  created_at       timestamptz not null default now()
);

comment on table public.external_datasets is
  'Metadata for practical/project datasets (Kaggle etc.). Content is NEVER ingested. Global + read-only to users.';

grant select on public.external_datasets to authenticated;
grant all on public.external_datasets to service_role;

alter table public.external_datasets enable row level security;

create policy "external_datasets read"
  on public.external_datasets
  for select to authenticated
  using (true);

create policy "external_datasets no public write"
  on public.external_datasets
  for all to authenticated
  using (false)
  with check (false);

create index if not exists idx_external_datasets_domain
  on public.external_datasets (subject_domain);
