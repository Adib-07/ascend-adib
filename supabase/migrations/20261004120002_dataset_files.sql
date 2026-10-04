-- ============================================================================
-- ASCEND — DATASET FILES (additive, reversible)
-- Stores actual downloaded dataset content for user-scoped or global datasets.
-- Separate from external_datasets metadata catalog.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- dataset_files: Actual dataset content storage
-- ---------------------------------------------------------------------------
create table public.dataset_files (
  id               uuid primary key default gen_random_uuid(),
  external_dataset_id uuid references public.external_datasets(id) on delete set null,
  user_id          uuid references auth.users on delete cascade,  -- null = global
  filename         text not null,
  storage_path     text not null,
  mime_type        text,
  size_bytes       bigint,
  file_format      text,              -- 'csv', 'json', 'parquet', 'npz', 'zip', etc.
  row_count        int,
  column_count     int,
  columns_json     jsonb,             -- [{name, type, sample_values, missing_count}]
  profile_json     jsonb,             -- {stats, missing_values, target_column_suggestions}
  ingestion_status text not null default 'pending',  -- pending|downloading|validating|extracting|processing|ready|failed
  error_message    text,
  checksum         text,              -- SHA256 of file content
  ingested_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.dataset_files is
  'Actual dataset file content. user_id=null means global curated dataset; user_id set means user-uploaded. RLS enforces ownership.';

grant select, insert, update, delete on public.dataset_files to authenticated;
grant all on public.dataset_files to service_role;

alter table public.dataset_files enable row level security;

-- Global datasets (user_id is null) readable by all authenticated users
create policy "dataset_files global read"
  on public.dataset_files
  for select to authenticated
  using (user_id is null);

-- User-owned datasets
create policy "dataset_files own"
  on public.dataset_files
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger t_dataset_files_upd
  before update on public.dataset_files
  for each row execute function public.set_updated_at();

create index if not exists idx_dataset_files_external_id on public.dataset_files (external_dataset_id);
create index if not exists idx_dataset_files_user_id on public.dataset_files (user_id);
create index if not exists idx_dataset_files_status on public.dataset_files (ingestion_status);

-- ---------------------------------------------------------------------------
-- Storage: private 'dataset-files' bucket + policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dataset-files', 'dataset-files', false, 524288000, null)  -- 500MB limit
on conflict (id) do nothing;

-- Global files (path: global/<dataset_id>/<filename>)
create policy "dataset_files global read storage"
  on storage.objects
  for select to authenticated
  using (bucket_id = 'dataset-files' and (storage.foldername(name))[1] = 'global');

-- User files (path: <user_id>/<dataset_id>/<filename>)
create policy "dataset_files user read storage"
  on storage.objects
  for select to authenticated
  using (bucket_id = 'dataset-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "dataset_files user write storage"
  on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dataset-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "dataset_files user delete storage"
  on storage.objects
  for delete to authenticated
  using (bucket_id = 'dataset-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop policy if exists "dataset_files user delete storage" on storage.objects;
-- drop policy if exists "dataset_files user write storage" on storage.objects;
-- drop policy if exists "dataset_files user read storage" on storage.objects;
-- drop policy if exists "dataset_files global read storage" on storage.objects;
-- drop policy if exists "dataset_files own" on public.dataset_files;
-- drop policy if exists "dataset_files global read" on public.dataset_files;
-- drop index if exists idx_dataset_files_status;
-- drop index if exists idx_dataset_files_user_id;
-- drop index if exists idx_dataset_files_external_id;
-- delete from storage.buckets where id = 'dataset-files';
-- drop table if exists public.dataset_files;