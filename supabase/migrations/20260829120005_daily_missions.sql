-- ============================================================================
-- ASCEND — DAILY MISSIONS (additive, reversible)
-- Structured daily study plans persisted per user per day.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- daily_missions: One row per user per day
-- ---------------------------------------------------------------------------
create table public.daily_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  available_minutes int not null default 90,
  
  -- Structured mission plan
  mission_json jsonb not null,            -- {blocks: [{type: 'revision'|'concept'|'coding'|'dsa'|'project'|'review', duration_min: 25, topic: '...', details: '...', priority: 1, resources: [...]}]}
  
  -- Status
  status text not null default 'pending', -- 'pending'|'in_progress'|'completed'|'skipped'
  started_at timestamptz,
  completed_at timestamptz,
  actual_minutes int,
  
  -- Feedback
  completion_notes text,
  adjustments_made text,                  -- What was changed during the session
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  unique(user_id, date)
);

comment on table public.daily_missions is
  'Daily structured study missions. One per user per day. mission_json contains prioritized time blocks.';

grant select, insert, update, delete on public.daily_missions to authenticated;
grant all on public.daily_missions to service_role;

alter table public.daily_missions enable row level security;

create policy "own daily_missions"
  on public.daily_missions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_daily_missions_user_date on public.daily_missions (user_id, date desc);

create trigger t_daily_missions_upd
  before update on public.daily_missions
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop trigger if exists t_daily_missions_upd on public.daily_missions;
-- drop policy if exists "own daily_missions" on public.daily_missions;
-- drop index if exists idx_daily_missions_user_date;
-- drop table if exists public.daily_missions;
-- ============================================================================