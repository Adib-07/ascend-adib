-- ============================================================================
-- ASCEND — DSA PROBLEM TRACKING (additive, reversible)
-- Tracks every DSA problem attempt with mastery and spaced repetition.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- dsa_attempts: One row per problem attempt
-- ---------------------------------------------------------------------------
create table public.dsa_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  problem_title text not null,
  problem_source text,                    -- 'striver_a2z'|'neetcode'|'leetcode'|'custom'
  problem_url text,
  difficulty text not null,               -- 'Easy'|'Medium'|'Hard'
  pattern text,                           -- 'Two Pointers', 'Sliding Window', 'Binary Tree', etc.
  tags text[],                            -- ['array', 'hash-map', 'prefix-sum']
  
  -- Attempt tracking
  status text not null default 'attempted', -- 'attempted'|'solved_independent'|'solved_with_hint'|'solved_after_approach'|'viewed_solution'|'failed'|'mastered'
  hints_used int default 0,
  solution_viewed boolean default false,
  approach_viewed boolean default false,
  time_spent_minutes int,
  
  -- Code & verification
  student_code text,
  language text,                          -- 'C'|'C++'|'Python'
  passed_tests boolean,
  
  -- Mastery (0-5 scale from MASTERY_SCALE)
  mastery_level int default 0,            -- 0=Not attempted, 1=Needs major help, 2=Developing, 3=Understands, 4=Strong, 5=Exam ready
  last_reviewed timestamptz,
  next_review_date date,
  review_interval_days int default 1,
  ease_factor numeric default 2.5,
  
  -- Metadata
  attempted_at timestamptz not null default now(),
  mastered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.dsa_attempts is
  'Tracks every DSA problem attempt with mastery progression and spaced repetition scheduling.';

grant select, insert, update, delete on public.dsa_attempts to authenticated;
grant all on public.dsa_attempts to service_role;

alter table public.dsa_attempts enable row level security;

create policy "own dsa_attempts"
  on public.dsa_attempts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_dsa_attempts_user_id on public.dsa_attempts (user_id);
create index if not exists idx_dsa_attempts_user_status on public.dsa_attempts (user_id, status);
create index if not exists idx_dsa_attempts_user_pattern on public.dsa_attempts (user_id, pattern);
create index if not exists idx_dsa_attempts_next_review on public.dsa_attempts (user_id, next_review_date);

create trigger t_dsa_attempts_upd
  before update on public.dsa_attempts
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop trigger if exists t_dsa_attempts_upd on public.dsa_attempts;
-- drop policy if exists "own dsa_attempts" on public.dsa_attempts;
-- drop index if exists idx_dsa_attempts_next_review;
-- drop index if exists idx_dsa_attempts_user_pattern;
-- drop index if exists idx_dsa_attempts_user_status;
-- drop index if exists idx_dsa_attempts_user_id;
-- drop table if exists public.dsa_attempts;
-- ============================================================================