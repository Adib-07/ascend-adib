-- ============================================================================
-- ASCEND — EXTERNAL DATASETS CATALOG (additive, reversible)
-- Global curated dataset metadata for educational purposes.
-- Content is NOT ingested in this migration; only metadata for recommendations.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- external_datasets  (Kaggle / practical-project metadata)
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
  'Metadata for practical/project datasets (Kaggle etc.). Content is NOT ingested in this migration. Global + read-only to users.';

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