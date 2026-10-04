-- ============================================================================
-- ASCEND — HABIT METRIC TYPES (additive, reversible)
-- Extends habits with metric_type, target, frequency, schedule for advanced tracking.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Add columns to existing habits (all additive, with defaults)
-- ---------------------------------------------------------------------------
alter table public.habits
  add column if not exists metric_type text not null default 'boolean';  -- 'boolean'|'count'|'duration'|'numeric'
add column if not exists target numeric not null default 1;
add column if not exists frequency text not null default 'daily';       -- 'daily'|'weekly'|'custom'
add column if not exists schedule_days text;                            -- comma-separated weekdays (0-6, Mon=0) for custom
add column if not exists unit text;                                     -- 'reps', 'minutes', 'hours', 'pages', etc.
add column if not exists total_completions int not null default 0;
add column if not exists longest_streak int not null default 0;

comment on column public.habits.metric_type is 'Type of metric: boolean, count, duration, numeric';
comment on column public.habits.target is 'Target value per period (e.g., 50 pushups, 60 minutes)';
comment on column public.habits.frequency is 'Frequency: daily, weekly, custom';
comment on column public.habits.schedule_days is 'Comma-separated weekdays for custom frequency (0=Mon..6=Sun)';
comment on column public.habits.unit is 'Display unit for count/duration/numeric metrics';
comment on column public.habits.total_completions is 'Lifetime completions count';
comment on column public.habits.longest_streak is 'Longest streak achieved';

-- ---------------------------------------------------------------------------
-- Add columns to habit_logs for metric values
-- ---------------------------------------------------------------------------
alter table public.habit_logs
  add column if not exists value numeric not null default 1;  -- actual value logged (1 for boolean, count for others)
add column if not exists duration_seconds int;               -- for duration metrics
add column if not exists notes text;                          -- optional notes per log

comment on column public.habit_logs.value is 'Logged value (1 for boolean, actual count/duration for others)';
comment on column public.habit_logs.duration_seconds is 'Duration in seconds for duration metrics';
comment on column public.habit_logs.notes is 'Optional notes for this log entry';

-- ---------------------------------------------------------------------------
-- Backfill existing rows
-- ---------------------------------------------------------------------------
update public.habits
set metric_type = 'boolean',
    target = 1,
    frequency = 'daily',
    unit = null
where metric_type is null;

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- alter table public.habits drop column if exists longest_streak;
-- alter table public.habits drop column if exists total_completions;
-- alter table public.habits drop column if exists unit;
-- alter table public.habits drop column if exists schedule_days;
-- alter table public.habits drop column if exists frequency;
-- alter table public.habits drop column if exists target;
-- alter table public.habits drop column if exists metric_type;
-- alter table public.habit_logs drop column if exists notes;
-- alter table public.habit_logs drop column if exists duration_seconds;
-- alter table public.habit_logs drop column if exists value;