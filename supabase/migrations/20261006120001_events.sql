-- ============================================================================
-- ASCEND — CALENDAR EVENTS (additive, reversible)
-- Time-bounded events with recurrence and task linking.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- events: Time-bounded calendar entries
-- ---------------------------------------------------------------------------
create table public.events (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  title               text not null,
  description         text,
  start_at            timestamptz not null,
  end_at              timestamptz not null,
  timezone            text not null default 'UTC',      -- IANA timezone, e.g. 'Asia/Kolkata'
  all_day             boolean not null default false,
  location            text,
  task_id             uuid references public.tasks(id) on delete set null,
  project_id          uuid,                             -- generic reference (academic/work)
  recurrence          text,                             -- 'daily'|'weekly'|'monthly'|'custom'
  recurrence_days     text,                             -- comma-separated weekdays (0=Mon..6=Sun)
  recurrence_end      timestamptz,
  color               text,                             -- hex color for UI
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.events is 'Calendar events with timezone-aware scheduling and optional task/project linking';
comment on column public.events.timezone is 'IANA timezone identifier for user-local times';
comment on column public.events.recurrence is 'Recurrence rule: daily, weekly, monthly, custom';
comment on column public.events.recurrence_days is 'Comma-separated weekdays for custom recurrence (0=Mon..6=Sun)';

grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;

alter table public.events enable row level security;

create policy "own events"
  on public.events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger t_events_upd
  before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_events_user_time on public.events (user_id, start_at, end_at);
create index if not exists idx_events_task on public.events (task_id);
create index if not exists idx_events_recurrence on public.events (user_id, recurrence) where recurrence is not null;

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop index if exists idx_events_recurrence;
-- drop index if exists idx_events_task;
-- drop index if exists idx_events_user_time;
-- drop trigger if exists t_events_upd on public.events;
-- drop policy if exists "own events" on public.events;
-- drop table if exists public.events;