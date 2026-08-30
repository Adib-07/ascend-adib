-- ============================================================================
-- ASCEND — TUTOR CONVERSATIONS (additive, reversible)
-- Adds persistent conversation storage for the unified CSE Tutor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- tutor_sessions: Conversation containers with mode/subject context
-- ---------------------------------------------------------------------------
create table public.tutor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  mode text not null,                     -- 'TEACH'|'PRACTICE'|'EVALUATE'|'EXAM'|'CODING'|'DEBUG'|'PROJECT'|'CHAT'|'DAILY_PLAN'
  subject text,                           -- e.g., 'C Pointers', 'Binary Trees'
  language text,                          -- 'C'|'Python'|'C++'|'HTML'|'CSS'|null
  context_snapshot jsonb,                 -- {learn_topics: [...], exams: [...], weak_areas: [...]}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tutor_sessions is
  'Persistent tutor conversation sessions. One per conversation context.';

grant select, insert, update, delete on public.tutor_sessions to authenticated;
grant all on public.tutor_sessions to service_role;

alter table public.tutor_sessions enable row level security;

create policy "own tutor_sessions"
  on public.tutor_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_tutor_sessions_user_id on public.tutor_sessions (user_id);
create index if not exists idx_tutor_sessions_user_updated on public.tutor_sessions (user_id, updated_at desc);

create trigger t_tutor_sessions_upd
  before update on public.tutor_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tutor_messages: Individual turns in a session
-- ---------------------------------------------------------------------------
create table public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tutor_sessions on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null,                     -- 'user'|'assistant'|'system'
  content text not null,
  sources jsonb,                          -- ContextItem[] used for this response
  datasets jsonb,                         -- Dataset recommendations
  grounded boolean,                       -- Was answer grounded?
  syllabus_match boolean,                 -- Matched user's syllabus?
  mode text,                              -- Mode when message was generated
  metadata jsonb,                         -- {hints_given: 2, mastery_assessed: 3, ...}
  created_at timestamptz not null default now()
);

comment on table public.tutor_messages is
  'Individual messages within a tutor session. Includes grounding metadata.';

grant select, insert, update, delete on public.tutor_messages to authenticated;
grant all on public.tutor_messages to service_role;

alter table public.tutor_messages enable row level security;

create policy "own tutor_messages"
  on public.tutor_messages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_tutor_messages_session_id on public.tutor_messages (session_id);
create index if not exists idx_tutor_messages_user_id on public.tutor_messages (user_id);

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop trigger if exists t_tutor_sessions_upd on public.tutor_sessions;
-- drop policy if exists "own tutor_messages" on public.tutor_messages;
-- drop policy if exists "own tutor_sessions" on public.tutor_sessions;
-- drop index if exists idx_tutor_messages_user_id;
-- drop index if exists idx_tutor_messages_session_id;
-- drop index if exists idx_tutor_sessions_user_updated;
-- drop index if exists idx_tutor_sessions_user_id;
-- drop table if exists public.tutor_messages;
-- drop table if exists public.tutor_sessions;
-- ============================================================================