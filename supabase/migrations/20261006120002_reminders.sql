-- ============================================================================
-- ASCEND — REMINDERS (additive, reversible)
-- Time-based notifications linked to tasks, events, habits, or custom.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- reminders: User notifications scheduled for a specific time
-- ---------------------------------------------------------------------------
create table public.reminders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  title               text not null,
  message             text,
  trigger_at          timestamptz not null,
  timezone            text not null default 'UTC',      -- IANA timezone for user-local trigger
  status              text not null default 'pending',  -- pending|sent|dismissed|failed
  related_type        text,                             -- task|event|habit|custom
  related_id          uuid,                             -- reference to related entity
  delivery_channel    text not null default 'in_app',   -- in_app|push|email
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.reminders is 'Scheduled reminders for tasks, events, habits, or custom user requests';
comment on column public.reminders.related_type is 'Type of related entity: task, event, habit, custom';
comment on column public.reminders.delivery_channel is 'How to deliver: in_app, push, email';

grant select, insert, update, delete on public.reminders to authenticated;
grant all on public.reminders to service_role;

alter table public.reminders enable row level security;

create policy "own reminders"
  on public.reminders
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger t_reminders_upd
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_reminders_user_trigger on public.reminders (user_id, trigger_at);
create index if not exists idx_reminders_status on public.reminders (user_id, status) where status in ('pending','failed');
create index if not exists idx_reminders_related on public.reminders (related_type, related_id);

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop index if exists idx_reminders_related;
-- drop index if exists idx_reminders_status;
-- drop index if exists idx_reminders_user_trigger;
-- drop trigger if exists t_reminders_upd on public.reminders;
-- drop policy if exists "own reminders" on public.reminders;
-- drop table if exists public.reminders;