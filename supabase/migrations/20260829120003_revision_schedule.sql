-- ============================================================================
-- ASCEND — REVISION SCHEDULE (additive, reversible)
-- SM-2 spaced repetition for topics, patterns, concepts, and errors.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- revision_schedule: Spaced repetition items
-- ---------------------------------------------------------------------------
create table public.revision_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  source_type text not null,              -- 'learn_topic'|'dsa_pattern'|'programming_concept'|'exam_material'|'error_pattern'
  source_id uuid not null,                -- References learn_topics.id, dsa_attempts.id, etc.
  source_title text not null,             -- Human-readable title
  
  -- SM-2 algorithm fields
  next_review_date date not null,
  interval_days int not null default 1,
  ease_factor numeric not null default 2.5,
  repetitions int not null default 0,
  
  -- Priority boosting
  priority_boost int default 0,           -- +1 for exam topics, +1 for weak areas, +1 for repeated errors
  
  last_reviewed timestamptz,
  last_grade int,                         -- 0-5 (SM-2 grade)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.revision_schedule is
  'Spaced repetition schedule using SM-2 algorithm. Priority boost for exams, weak areas, recurring errors.';

grant select, insert, update, delete on public.revision_schedule to authenticated;
grant all on public.revision_schedule to service_role;

alter table public.revision_schedule enable row level security;

create policy "own revision_schedule"
  on public.revision_schedule
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_revision_schedule_user_next on public.revision_schedule (user_id, next_review_date);
create index if not exists idx_revision_schedule_user_source on public.revision_schedule (user_id, source_type, source_id);

create trigger t_revision_schedule_upd
  before update on public.revision_schedule
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop trigger if exists t_revision_schedule_upd on public.revision_schedule;
-- drop policy if exists "own revision_schedule" on public.revision_schedule;
-- drop index if exists idx_revision_schedule_user_source;
-- drop index if exists idx_revision_schedule_user_next;
-- drop table if exists public.revision_schedule;
-- ============================================================================