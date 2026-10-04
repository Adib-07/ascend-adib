-- ============================================================================
-- ASCEND — EVENT EMISSION LOGS (additive, reversible)
-- Track event emissions for idempotency and audit trail.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- event_emission_logs: Track all emitted events for idempotency
-- ---------------------------------------------------------------------------
create table public.event_emission_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  event_type    text not null,
  entity_id     uuid not null,
  event_timestamp timestamptz not null,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.event_emission_logs is 'Log of all emitted domain events for idempotency and audit trail';

grant select, insert on public.event_emission_logs to authenticated;
grant all on public.event_emission_logs to service_role;

alter table public.event_emission_logs enable row level security;

create policy "own event_emission_logs"
  on public.event_emission_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_event_emission_logs_user_event_entity
  on public.event_emission_logs (user_id, event_type, entity_id);

create index if not exists idx_event_emission_logs_user_timestamp
  on public.event_emission_logs (user_id, event_timestamp);

-- ---------------------------------------------------------------------------
-- event_processing_logs: Track event processing for automation dispatch
-- ---------------------------------------------------------------------------
create table public.event_processing_logs (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users on delete cascade,
  event_idempotency_key  text not null,
  event_type             text not null,
  entity_id              uuid not null,
  status                 text not null, -- success|failed|skipped
  matched_rules          int not null default 0,
  executed_automations   int not null default 0,
  error_message          text,
  created_at             timestamptz not null default now()
);

comment on table public.event_processing_logs is 'Log of event processing for automation dispatch audit trail';

grant select, insert on public.event_processing_logs to authenticated;
grant all on public.event_processing_logs to service_role;

alter table public.event_processing_logs enable row level security;

create policy "own event_processing_logs"
  on public.event_processing_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index if not exists idx_event_processing_logs_idempotency
  on public.event_processing_logs (user_id, event_idempotency_key);

create index if not exists idx_event_processing_logs_user_created
  on public.event_processing_logs (user_id, created_at desc);

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop index if exists idx_event_processing_logs_user_created;
-- drop index if exists idx_event_processing_logs_idempotency;
-- drop policy if exists "own event_processing_logs" on public.event_processing_logs;
-- drop table if exists public.event_processing_logs;
-- drop index if exists idx_event_emission_logs_user_timestamp;
-- drop index if exists idx_event_emission_logs_user_event_entity;
-- drop policy if exists "own event_emission_logs" on public.event_emission_logs;
-- drop table if exists public.event_emission_logs;