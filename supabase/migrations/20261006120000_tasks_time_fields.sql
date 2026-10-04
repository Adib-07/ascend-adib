-- ============================================================================
-- ASCEND — TASK TIME FIELDS (additive, reversible)
-- Add due_time and recurrence to tasks for scheduling.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Add columns to existing tasks
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists due_time timestamptz;        -- time of day for due_date (with timezone)
add column if not exists recurrence text;               -- 'daily'|'weekly'|'monthly'|'custom'
add column if not exists recurrence_days text;          -- comma-separated weekdays (0=Mon..6=Sun)
add column if not exists recurrence_end timestamptz;    -- when recurrence stops
add column if not exists completed_at timestamptz;      -- when task was marked done

comment on column public.tasks.due_time is 'Time of day for due_date (timestamptz preserves user timezone)';
comment on column public.tasks.recurrence is 'Recurrence rule: daily, weekly, monthly, custom';
comment on column public.tasks.recurrence_days is 'Comma-separated weekdays for custom recurrence (0=Mon..6=Sun)';
comment on column public.tasks.recurrence_end is 'When recurrence stops';
comment on column public.tasks.completed_at is 'Timestamp when task was completed';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_tasks_user_due_datetime on public.tasks (user_id, due_date, due_time);
create index if not exists idx_tasks_recurrence on public.tasks (user_id, recurrence) where recurrence is not null;

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop index if exists idx_tasks_recurrence;
-- drop index if exists idx_tasks_user_due_datetime;
-- alter table public.tasks drop column if exists completed_at;
-- alter table public.tasks drop column if exists recurrence_end;
-- alter table public.tasks drop column if exists recurrence_days;
-- alter table public.tasks drop column if exists recurrence;
-- alter table public.tasks drop column if exists due_time;