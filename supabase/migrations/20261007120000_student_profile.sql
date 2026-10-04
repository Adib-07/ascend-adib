-- ============================================================================
-- ASCEND — STUDENT PROFILE (additive, reversible)
-- Minimal academic profile per user.
-- ============================================================================

create table public.student_profile (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  semester        text,                -- e.g., "Fall 2024"
  academic_goals  text,                -- free-form goals
  study_availability jsonb,           -- e.g., {"mon": 120, "tue": 90, ...} minutes per day
  preferred_session_length int default 45, -- minutes
  exam_alert_days_before int default 7,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id)
);

grant select, insert, update, delete on public.student_profile to authenticated;
grant all on public.student_profile to service_role;

alter table public.student_profile enable row level security;

create policy "own student_profile"
  on public.student_profile
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger t_student_profile_upd
  before update on public.student_profile
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop trigger if exists t_student_profile_upd on public.student_profile;
-- drop policy if exists "own student_profile" on public.student_profile;
-- drop table if exists public.student_profile;