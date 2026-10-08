-- ============================================================================
-- ASCEND — PRODUCTION SCHEMA RECONCILIATION
-- ============================================================================
-- Purpose: bring production (akoskmxdfjuroeeniyjy) up to the schema the
-- CURRENT live application actually requires, as a single forward migration.
--
-- This file deliberately does NOT replay the historical chain. Production has
-- only ever recorded three migrations (20260630123604, 20260702111509,
-- 20260804024253); everything after that is unapplied locally and contains
-- objects that are dead, duplicated, or awaiting a security decision. Replaying
-- it would (a) die on a self-contradicting statement in 20260821123000 and
-- (b) create `user_documents`/`document_chunks`/`external_datasets` twice,
-- since two historical migrations each create them without IF NOT EXISTS.
--
-- So: one new file, additive only, written against the production baseline that
-- actually exists (18 tables, all RLS-enabled with auth.uid() ownership, one
-- function set_updated_at(), zero storage buckets, no pgvector).
--
-- INCLUDED, because routed live code reads or writes it:
--   columns   outreach.lead_id / ai_drafted / approved
--   columns   tasks.due_time / recurrence / completed_at
--   columns   habits.metric_type / target / frequency ; habit_logs.value
--   tables    leads, lead_research, proposals
--   tables    events, reminders
--   tables    automation_rules, automation_logs
--   tables    user_documents, document_chunks
--   tables    revision_schedule, error_log, dsa_attempts
--   storage   private 'documents' bucket + owner-only object policies
--
-- EXCLUDED on purpose:
--   vector extension, document_chunks.embedding, match_document_chunks
--     -- semantic search is deferred; the historical RPC accepts a caller-
--        supplied filter_user_id with a null default and no auth.uid() check,
--        so it can return another user's chunks. Needs its own guarded
--        migration once that is fixed.
--   daily_briefing, weekly_review, generate_daily_briefing, generate_weekly_review
--     -- only reachable from TodayView.tsx, which has zero references and is
--        tree-shaken out of the bundle.
--   tutor_sessions, tutor_messages  -- unified-tutor.server.ts is gated behind
--        ENABLE_UNIFIED_TUTOR and session-persistence.ts has no importers.
--   daily_missions, programming_exercises, dataset_files, learning_resources,
--   educational_resources, external_datasets, event_emission_logs,
--   event_processing_logs -- no live references.
--
-- All object names below are IF NOT EXISTS / OR REPLACE guarded, so this file
-- is safe to re-run and safe to apply on top of any of the excluded ones later.
--
-- Ownership model is unchanged: every table carries user_id referencing
-- auth.users, RLS is enabled, and the policy is the same
--   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
-- already present on all 18 production tables. No policy is weakened, no
-- EXECUTE is granted to anon, and service_role keeps server-only access.
--
-- ROLLBACK is documented at the end, in reverse dependency order.
-- ============================================================================


-- ============================================================================
-- 1. CRM — leads, then lead_research, then proposals
--
-- ORDERING IS LOAD-BEARING. `leads` is created FIRST because section 3 adds
-- outreach.lead_id as a foreign key onto it. The historical migration
-- 20260821123000 does the opposite: it adds that FK at line 36 and only creates
-- the table at line 47, which is why `supabase db push` aborted with
-- "relation public.leads does not exist". That ordering bug is the root cause of
-- the divergence; it is not reproduced here.
-- ============================================================================
create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  name            text not null,
  source_platform text,
  contact         text,
  niche           text,
  status          text not null default 'New',   -- New|Qualified|Outreach|Won|Lost
  discovered_at   timestamptz default now(),
  raw_notes       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.leads is 'Discovered prospects / lead pipeline (work automation foundation)';
comment on column public.leads.status is 'New | Qualified | Outreach | Won | Lost';

grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;

alter table public.leads enable row level security;

drop policy if exists "own leads" on public.leads;
create policy "own leads"
  on public.leads
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists t_leads_upd on public.leads;
create trigger t_leads_upd
  before update on public.leads
  for each row execute function public.set_updated_at();

create index if not exists idx_leads_user_id      on public.leads (user_id);
create index if not exists idx_leads_user_status on public.leads (user_id, status);

-- ---------------------------------------------------------------------------
-- 1b. lead_research — research notes attached to a lead
-- ---------------------------------------------------------------------------
create table if not exists public.lead_research (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users on delete cascade,
  lead_id              uuid not null references public.leads on delete cascade,
  summary              text,
  pain_points          text,
  tech_stack_detected  text,
  social_urls          jsonb not null default '[]'::jsonb,
  research_method      text default 'manual',
  researched_at        timestamptz default now(),
  created_at           timestamptz not null default now()
);

comment on table public.lead_research is 'Research / opportunity notes for a single lead';

grant select, insert, update, delete on public.lead_research to authenticated;
grant all on public.lead_research to service_role;

alter table public.lead_research enable row level security;

drop policy if exists "own lead_research" on public.lead_research;
create policy "own lead_research"
  on public.lead_research
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_lead_research_lead_id on public.lead_research (lead_id);
create index if not exists idx_lead_research_user_id on public.lead_research (user_id);

-- ---------------------------------------------------------------------------
-- 1c. proposals — human-approved proposals, may reference a lead or a client
-- ---------------------------------------------------------------------------
create table if not exists public.proposals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  lead_id       uuid references public.leads on delete set null,
  client_id     uuid references public.clients on delete set null,
  title         text not null,
  body_markdown text,
  status        text not null default 'Draft',  -- Draft|Sent|Accepted|Declined
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.proposals is 'Human-approved proposals; may reference a lead or a client';

grant select, insert, update, delete on public.proposals to authenticated;
grant all on public.proposals to service_role;

alter table public.proposals enable row level security;

drop policy if exists "own proposals" on public.proposals;
create policy "own proposals"
  on public.proposals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists t_proposals_upd on public.proposals;
create trigger t_proposals_upd
  before update on public.proposals
  for each row execute function public.set_updated_at();

create index if not exists idx_proposals_user_id   on public.proposals (user_id);
create index if not exists idx_proposals_lead_id   on public.proposals (lead_id);
create index if not exists idx_proposals_client_id on public.proposals (client_id);


-- ============================================================================
-- 2. Schedule — events, reminders
-- ============================================================================
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  title           text not null,
  description     text,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  timezone        text not null default 'UTC',
  all_day         boolean not null default false,
  location        text,
  task_id         uuid references public.tasks(id) on delete set null,
  project_id      uuid,
  recurrence      text,
  recurrence_days text,
  recurrence_end  timestamptz,
  color           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.events is 'Calendar events with timezone-aware scheduling and optional task linking';
comment on column public.events.timezone is 'IANA timezone identifier for user-local times';

grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;

alter table public.events enable row level security;

drop policy if exists "own events" on public.events;
create policy "own events"
  on public.events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists t_events_upd on public.events;
create trigger t_events_upd
  before update on public.events
  for each row execute function public.set_updated_at();

create index if not exists idx_events_user_time  on public.events (user_id, start_at, end_at);
create index if not exists idx_events_task       on public.events (task_id);
create index if not exists idx_events_recurrence on public.events (user_id, recurrence) where recurrence is not null;

-- ---------------------------------------------------------------------------
-- 2b. reminders
-- ---------------------------------------------------------------------------
create table if not exists public.reminders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  title            text not null,
  message          text,
  trigger_at       timestamptz not null,
  timezone         text not null default 'UTC',
  status           text not null default 'pending',  -- pending|sent|dismissed|failed
  related_type     text,                             -- task|event|habit|custom
  related_id       uuid,
  delivery_channel text not null default 'in_app',
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.reminders is 'Scheduled reminders for tasks, events, habits, or custom user requests';
comment on column public.reminders.delivery_channel is 'How to deliver: in_app, push, email';

grant select, insert, update, delete on public.reminders to authenticated;
grant all on public.reminders to service_role;

alter table public.reminders enable row level security;

drop policy if exists "own reminders" on public.reminders;
create policy "own reminders"
  on public.reminders
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists t_reminders_upd on public.reminders;
create trigger t_reminders_upd
  before update on public.reminders
  for each row execute function public.set_updated_at();

create index if not exists idx_reminders_user_trigger on public.reminders (user_id, trigger_at);
create index if not exists idx_reminders_status      on public.reminders (user_id, status) where status in ('pending','failed');
create index if not exists idx_reminders_related     on public.reminders (related_type, related_id);


-- ============================================================================
-- 3. Automations — automation_rules, then automation_logs (FK onto it)
-- ============================================================================
create table if not exists public.automation_rules (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users on delete cascade,
  name              text not null,
  description       text,
  enabled           boolean not null default true,
  trigger_type      text not null,   -- task_completed|task_overdue|habit_completed|event_upcoming|reminder_due|scheduled_time|document_uploaded|project_completed
  trigger_config    jsonb not null default '{}'::jsonb,
  condition_config  jsonb not null default '[]'::jsonb,
  action_type       text not null,   -- create_reminder|create_task|create_habit_log|update_progress|generate_briefing|generate_review|send_notification
  action_config     jsonb not null default '{}'::jsonb,
  timezone          text not null default 'UTC',
  last_run_at       timestamptz,
  last_triggered_at timestamptz,
  run_count         int not null default 0,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.automation_rules is 'Personal automation rules: trigger -> condition -> action';
comment on column public.automation_rules.condition_config is
  'LIST of conditions, read as ConditionConfig[] by automation.runner.ts. Defaults to an empty array, not an object: automation.functions.ts validates it with z.union([z.array, z.record]).';

grant select, insert, update, delete on public.automation_rules to authenticated;
grant all on public.automation_rules to service_role;

alter table public.automation_rules enable row level security;

drop policy if exists "own automation_rules" on public.automation_rules;
create policy "own automation_rules"
  on public.automation_rules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists t_automation_rules_upd on public.automation_rules;
create trigger t_automation_rules_upd
  before update on public.automation_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3b. automation_logs — execution history, with the idempotency key that
--     automation.runner.ts writes on every execution (rule_id + execution_id).
-- ---------------------------------------------------------------------------
create table if not exists public.automation_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users on delete cascade,
  rule_id           uuid not null references public.automation_rules on delete cascade,
  execution_id      uuid,
  status            text not null,   -- success|failed|skipped
  trigger_data      jsonb,
  condition_result  boolean,
  action_result     jsonb,
  error_message     text,
  executed_at       timestamptz not null default now()
);

comment on table public.automation_logs is 'Execution history for automation rules';
comment on column public.automation_logs.execution_id is 'Idempotency key: unique per rule execution window';

grant select, insert, update, delete on public.automation_logs to authenticated;
grant all on public.automation_logs to service_role;

alter table public.automation_logs enable row level security;

drop policy if exists "own automation_logs" on public.automation_logs;
create policy "own automation_logs"
  on public.automation_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_automation_logs_rule        on public.automation_logs (rule_id);
create index if not exists idx_automation_logs_user_time   on public.automation_logs (user_id, executed_at);

-- Idempotency guard. automation.runner.ts checks this before executing, so a
-- duplicate (rule_id, execution_id) must be rejected at the database too.
create unique index if not exists idx_automation_logs_idempotency
  on public.automation_logs (rule_id, execution_id)
  where execution_id is not null;


-- ============================================================================
-- 4. Documents — user_documents, then document_chunks (FK onto it)
-- ============================================================================
create table if not exists public.user_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  filename      text not null,
  storage_path  text not null,
  mime_type     text,
  size_bytes    bigint,
  document_type text not null default 'other',
  subject       text,
  page_count    int,
  status        text not null default 'pending',  -- pending|processing|ready|failed
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.user_documents is 'Metadata for user-uploaded documents; file content lives in the private documents bucket';

grant select, insert, update, delete on public.user_documents to authenticated;
grant all on public.user_documents to service_role;

alter table public.user_documents enable row level security;

drop policy if exists "own user_documents" on public.user_documents;
create policy "own user_documents"
  on public.user_documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists t_user_documents_upd on public.user_documents;
create trigger t_user_documents_upd
  before update on public.user_documents
  for each row execute function public.set_updated_at();

create index if not exists idx_user_documents_user_id     on public.user_documents (user_id);
create index if not exists idx_user_documents_user_status on public.user_documents (user_id, status);

-- ---------------------------------------------------------------------------
-- 4b. document_chunks — parsed text, NO embedding column.
--     pgvector and match_document_chunks are intentionally omitted; see header.
-- ---------------------------------------------------------------------------
create table if not exists public.document_chunks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  document_id uuid not null references public.user_documents on delete cascade,
  chunk_index int not null,
  page_number int,
  heading     text,
  content_text text not null,
  token_count int,
  created_at  timestamptz not null default now()
);

comment on table public.document_chunks is 'Parsed text chunks of an uploaded document (no embeddings yet)';

grant select, insert, update, delete on public.document_chunks to authenticated;
grant all on public.document_chunks to service_role;

alter table public.document_chunks enable row level security;

drop policy if exists "own document_chunks" on public.document_chunks;
create policy "own document_chunks"
  on public.document_chunks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_document_chunks_document_id on public.document_chunks (document_id);
create index if not exists idx_document_chunks_user_id     on public.document_chunks (user_id);


-- ============================================================================
-- 5. Student intelligence — revision_schedule, error_log, dsa_attempts
--    Read by context-engine.server.ts (getDueRevisions / getWeakAreas), which
--    personal-assistant.server.ts calls on every assistant turn.
-- ============================================================================
create table if not exists public.revision_schedule (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  source_type      text not null,   -- learn_topic|dsa_pattern|programming_concept|exam_material|error_pattern
  source_id        uuid not null,
  source_title     text not null,
  next_review_date date not null,
  interval_days    int not null default 1,
  ease_factor      numeric not null default 2.5,
  repetitions      int not null default 0,
  priority_boost   int default 0,
  last_reviewed    timestamptz,
  last_grade       int,             -- 0-5 (SM-2 grade)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.revision_schedule is 'Spaced repetition schedule using SM-2';

grant select, insert, update, delete on public.revision_schedule to authenticated;
grant all on public.revision_schedule to service_role;

alter table public.revision_schedule enable row level security;

drop policy if exists "own revision_schedule" on public.revision_schedule;
create policy "own revision_schedule"
  on public.revision_schedule
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists t_revision_schedule_upd on public.revision_schedule;
create trigger t_revision_schedule_upd
  before update on public.revision_schedule
  for each row execute function public.set_updated_at();

create index if not exists idx_revision_schedule_user_next   on public.revision_schedule (user_id, next_review_date);
create index if not exists idx_revision_schedule_user_source on public.revision_schedule (user_id, source_type, source_id);

-- ---------------------------------------------------------------------------
-- 5b. error_log — classified recurring mistakes
-- ---------------------------------------------------------------------------
create table if not exists public.error_log (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users on delete cascade,
  error_type            text not null,
  concept               text not null,
  context               text,   -- dsa_problem|programming_exercise|exam_practice
  context_id            uuid,
  description           text not null,
  student_code_snippet  text,
  correct_approach      text,
  frequency             int not null default 1,
  first_occurred        timestamptz not null default now(),
  last_occurred         timestamptz not null default now(),
  resolved              boolean default false,
  resolved_at           timestamptz,
  created_at            timestamptz not null default now()
);

comment on table public.error_log is 'Tracks recurring mistakes by type and concept';

grant select, insert, update, delete on public.error_log to authenticated;
grant all on public.error_log to service_role;

alter table public.error_log enable row level security;

drop policy if exists "own error_log" on public.error_log;
create policy "own error_log"
  on public.error_log
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_error_log_user_type     on public.error_log (user_id, error_type);
create index if not exists idx_error_log_user_concept  on public.error_log (user_id, concept);
create index if not exists idx_error_log_user_frequency on public.error_log (user_id, frequency desc);

-- ---------------------------------------------------------------------------
-- 5c. dsa_attempts — one row per DSA problem attempt
-- ---------------------------------------------------------------------------
create table if not exists public.dsa_attempts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users on delete cascade,
  problem_title         text not null,
  problem_source        text,
  problem_url           text,
  difficulty            text not null,  -- Easy|Medium|Hard
  pattern               text,
  tags                  text[],
  status                text not null default 'attempted',
  hints_used            int default 0,
  solution_viewed       boolean default false,
  approach_viewed       boolean default false,
  time_spent_minutes    int,
  student_code          text,
  language              text,
  passed_tests          boolean,
  mastery_level         int default 0,  -- 0-5
  last_reviewed         timestamptz,
  next_review_date      date,
  review_interval_days  int default 1,
  ease_factor           numeric default 2.5,
  attempted_at          timestamptz not null default now(),
  mastered_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.dsa_attempts is 'DSA problem attempts with mastery and spaced repetition';

grant select, insert, update, delete on public.dsa_attempts to authenticated;
grant all on public.dsa_attempts to service_role;

alter table public.dsa_attempts enable row level security;

drop policy if exists "own dsa_attempts" on public.dsa_attempts;
create policy "own dsa_attempts"
  on public.dsa_attempts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists t_dsa_attempts_upd on public.dsa_attempts;
create trigger t_dsa_attempts_upd
  before update on public.dsa_attempts
  for each row execute function public.set_updated_at();

create index if not exists idx_dsa_attempts_user_id     on public.dsa_attempts (user_id);
create index if not exists idx_dsa_attempts_user_status on public.dsa_attempts (user_id, status);
create index if not exists idx_dsa_attempts_user_pattern on public.dsa_attempts (user_id, pattern);
create index if not exists idx_dsa_attempts_next_review on public.dsa_attempts (user_id, next_review_date);


-- ============================================================================
-- 6. Column additions to EXISTING tables
--
-- All additive, all IF NOT EXISTS, no existing column is dropped or retyped and
-- no existing policy is touched. Existing rows keep their data; new columns
-- take their default.
-- ============================================================================

-- 6a. outreach — PipelineView.tsx reads outreach.ai_drafted / outreach.approved
--      and writes { id, approved: true } on the approve button, so these three
--      columns are currently missing in production and the approve button is
--      broken right now. lead_id is added HERE, after section 1 created leads.
alter table public.outreach
  add column if not exists lead_id      uuid references public.leads on delete set null,
  add column if not exists ai_drafted   boolean not null default false,
  add column if not exists approved     boolean not null default false;

comment on column public.outreach.ai_drafted is 'True when the draft was generated by AI; requires human approval before send';
comment on column public.outreach.approved is 'Human approval flag. An approved draft is never auto-sent.';

create index if not exists idx_outreach_lead_id on public.outreach (lead_id);

-- 6b. tasks — used by DailyTasks.tsx and automation.runner.ts for time-of-day
--      scheduling and completion bookkeeping.
alter table public.tasks
  add column if not exists due_time     timestamptz,   -- time of day for due_date
  add column if not exists recurrence   text,          -- daily|weekly|monthly|custom
  add column if not exists completed_at timestamptz;   -- when the task was marked done

comment on column public.tasks.due_time is 'Time of day for due_date (timestamptz preserves user timezone)';
comment on column public.tasks.recurrence is 'Recurrence rule: daily, weekly, monthly, custom';
comment on column public.tasks.completed_at is 'Timestamp when task was completed';

create index if not exists idx_tasks_user_due_datetime on public.tasks (user_id, due_date, due_time);

-- 6c. habits — exact types/defaults from 20261003120000_habit_metric_types.sql.
--      habits.metric_type feeds useLogHabit(), which writes
--      done = metricType === 'boolean' ? logValue > 0 : logValue >= target.
alter table public.habits
  add column if not exists metric_type text   not null default 'boolean',
  add column if not exists target      numeric not null default 1,
  add column if not exists frequency   text   not null default 'daily';

comment on column public.habits.metric_type is 'Type of metric: boolean, count, duration, numeric';
comment on column public.habits.target is 'Target value per period (e.g. 50 pushups, 60 minutes)';
comment on column public.habits.frequency is 'Frequency: daily, weekly, custom';

-- 6d. habit_logs — `value` is required by the boolean-habit fix in ascend-hooks.ts:
--      without it the uncheck path cannot compute `done`.
alter table public.habit_logs
  add column if not exists value numeric not null default 1;

comment on column public.habit_logs.value is 'Logged value (1 for boolean, actual count/duration for others)';


-- ============================================================================
-- 7. Storage — private 'documents' bucket + owner-only object policies
--
-- Path convention: <user_id>/<uuid>/<filename>. Every policy pins the first
-- folder segment to auth.uid()::text, so one owner cannot read another's files
-- even though the bucket is shared.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 52428800, null)
on conflict (id) do nothing;

drop policy if exists "documents insert own" on storage.objects;
create policy "documents insert own"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents select own" on storage.objects;
create policy "documents select own"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents update own" on storage.objects;
create policy "documents update own"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents delete own" on storage.objects;
create policy "documents delete own"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================================
-- ROLLBACK (reverse dependency order; run manually, not part of this migration)
-- ----------------------------------------------------------------------------
-- drop policy if exists "documents delete own"  on storage.objects;
-- drop policy if exists "documents update own"  on storage.objects;
-- drop policy if exists "documents select own"  on storage.objects;
-- drop policy if exists "documents insert own"  on storage.objects;
-- delete from storage.buckets where id = 'documents';
--
-- drop table if exists public.document_chunks;
-- drop table if exists public.user_documents;
-- drop table if exists public.automation_logs;
-- drop table if exists public.automation_rules;
-- drop table if exists public.dsa_attempts;
-- drop table if exists public.error_log;
-- drop table if exists public.revision_schedule;
-- drop table if exists public.reminders;
-- drop table if exists public.events;
-- drop table if exists public.proposals;
-- drop table if exists public.lead_research;
--
-- alter table public.outreach drop column if exists lead_id;    -- last: FK to leads
-- drop table if exists public.leads;
--
-- alter table public.habit_logs drop column if exists value;
-- alter table public.habits drop column if exists frequency;
-- alter table public.habits drop column if exists target;
-- alter table public.habits drop column if exists metric_type;
-- alter table public.tasks drop column if exists completed_at;
-- alter table public.tasks drop column if exists recurrence;
-- alter table public.tasks drop column if exists due_time;
-- alter table public.outreach drop column if exists approved;
-- alter table public.outreach drop column if exists ai_drafted;
-- ============================================================================