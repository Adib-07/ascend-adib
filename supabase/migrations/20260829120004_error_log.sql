-- ============================================================================
-- ASCEND — ERROR LOG (additive, reversible)
-- Tracks recurring mistakes with classification for targeted revision.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- error_log: Classified mistakes with frequency tracking
-- ---------------------------------------------------------------------------
create table public.error_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  error_type text not null,               -- 'syntax'|'logic'|'concept'|'edge_case'|'complexity'|'memory'|'debugging'|'interpretation'|'pattern'
  concept text not null,                  -- e.g., 'Pointer arithmetic', 'Two pointers pattern'
  context text,                           -- 'dsa_problem'|'programming_exercise'|'exam_practice'
  context_id uuid,                        -- References dsa_attempts.id or programming_exercises.id
  
  description text not null,
  student_code_snippet text,              -- The problematic code
  correct_approach text,                  -- What should have been done
  
  frequency int not null default 1,
  first_occurred timestamptz not null default now(),
  last_occurred timestamptz not null default now(),
  resolved boolean default false,
  resolved_at timestamptz,
  
  created_at timestamptz not null default now()
);

comment on table public.error_log is
  'Tracks recurring mistakes by type and concept. Frequency triggers revision scheduling.';

grant select, insert, update, delete on public.error_log to authenticated;
grant all on public.error_log to service_role;

alter table public.error_log enable row level security;

create policy "own error_log"
  on public.error_log
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_error_log_user_type on public.error_log (user_id, error_type);
create index if not exists idx_error_log_user_concept on public.error_log (user_id, concept);
create index if not exists idx_error_log_user_frequency on public.error_log (user_id, frequency desc);

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop policy if exists "own error_log" on public.error_log;
-- drop index if exists idx_error_log_user_frequency;
-- drop index if exists idx_error_log_user_concept;
-- drop index if exists idx_error_log_user_type;
-- drop table if exists public.error_log;
-- ============================================================================