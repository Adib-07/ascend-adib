-- ============================================================================
-- ASCEND — PROGRAMMING EXERCISE TRACKING (additive, reversible)
-- Tracks coding exercises per language/concept with error classification.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- programming_exercises: One row per coding exercise
-- ---------------------------------------------------------------------------
create table public.programming_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  language text not null,                 -- 'C'|'Python'|'C++'
  concept text not null,                  -- 'Pointers', 'Loops', 'Functions', 'OOP', etc.
  topic text,                             -- e.g., 'Dynamic Memory Allocation'
  difficulty text,                        -- 'Beginner'|'Intermediate'|'Advanced'
  
  exercise_description text not null,
  student_code text,
  reference_solution text,                -- Optional: tutor's solution for comparison
  
  -- Verification
  verified boolean default false,
  passed_tests boolean,
  test_results jsonb,                     -- {input: "...", expected: "...", actual: "...", passed: true}
  
  -- Error classification (PART 15)
  errors jsonb default '[]'::jsonb,       -- [{"type": "syntax|logic|concept|edge_case|complexity|memory|debugging|interpretation|pattern", "description": "...", "line": 10}]
  
  -- Mastery
  mastery_level int default 0,            -- 0-5 scale
  time_spent_minutes int,
  
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.programming_exercises is
  'Tracks programming exercises with verification, error classification, and mastery progression.';

grant select, insert, update, delete on public.programming_exercises to authenticated;
grant all on public.programming_exercises to service_role;

alter table public.programming_exercises enable row level security;

create policy "own programming_exercises"
  on public.programming_exercises
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_programming_exercises_user_lang on public.programming_exercises (user_id, language);
create index if not exists idx_programming_exercises_user_concept on public.programming_exercises (user_id, concept);
create index if not exists idx_programming_exercises_user_mastery on public.programming_exercises (user_id, mastery_level);

create trigger t_programming_exercises_upd
  before update on public.programming_exercises
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop trigger if exists t_programming_exercises_upd on public.programming_exercises;
-- drop policy if exists "own programming_exercises" on public.programming_exercises;
-- drop index if exists idx_programming_exercises_user_mastery;
-- drop index if exists idx_programming_exercises_user_concept;
-- drop index if exists idx_programming_exercises_user_lang;
-- drop table if exists public.programming_exercises;
-- ============================================================================