-- ============================================================================
-- ASCEND — AUTOMATION ENGINE (additive, reversible)
-- Trigger → Condition → Action rules for personal workflow automation.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- automation_rules: User-defined automation rules
-- ---------------------------------------------------------------------------
create table public.automation_rules (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  name                text not null,
  description         text,
  enabled             boolean not null default true,
  trigger_type        text not null,                      -- task_completed|task_overdue|habit_completed|event_upcoming|reminder_due|scheduled_time|document_uploaded|project_completed
  trigger_config      jsonb not null default '{}'::jsonb,  -- trigger-specific config
  condition_config    jsonb not null default '{}'::jsonb,  -- condition to evaluate (optional)
  action_type         text not null,                      -- create_reminder|create_task|create_habit_log|update_progress|generate_briefing|generate_review|send_notification
  action_config       jsonb not null default '{}'::jsonb,  -- action-specific config
  last_run_at         timestamptz,
  run_count           int not null default 0,
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.automation_rules is 'Personal automation rules: trigger -> condition -> action';
comment on column public.automation_rules.trigger_type is 'Event that fires the rule';
comment on column public.automation_rules.trigger_config is 'Trigger-specific configuration (JSON)';
comment on column public.automation_rules.condition_config is 'Optional condition to evaluate before action (JSON)';
comment on column public.automation_rules.action_type is 'Action to execute when triggered';
comment on column public.automation_rules.action_config is 'Action-specific configuration (JSON)';

grant select, insert, update, delete on public.automation_rules to authenticated;
grant all on public.automation_rules to service_role;

alter table public.automation_rules enable row level security;

create policy "own automation_rules"
  on public.automation_rules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger t_automation_rules_upd
  before update on public.automation_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- automation_logs: Execution history for debugging/auditing
-- ---------------------------------------------------------------------------
create table public.automation_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  rule_id             uuid not null references public.automation_rules(id) on delete cascade,
  status              text not null,                      -- success|failed|skipped
  trigger_data        jsonb,                              -- data that triggered the rule
  condition_result    boolean,
  action_result       jsonb,
  error_message       text,
  executed_at         timestamptz not null default now()
);

comment on table public.automation_logs is 'Execution history for automation rules';

grant select, insert, update, delete on public.automation_logs to authenticated;
grant all on public.automation_logs to service_role;

alter table public.automation_logs enable row level security;

create policy "own automation_logs"
  on public.automation_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_automation_logs_rule on public.automation_logs (rule_id);
create index if not exists idx_automation_logs_user_time on public.automation_logs (user_id, executed_at);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_automation_rules_user_enabled on public.automation_rules (user_id, enabled);
create index if not exists idx_automation_rules_trigger on public.automation_rules (trigger_type);

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop index if exists idx_automation_rules_trigger;
-- drop index if exists idx_automation_rules_user_enabled;
-- drop index if exists idx_automation_logs_user_time;
-- drop index if exists idx_automation_logs_rule;
-- drop trigger if exists t_automation_rules_upd on public.automation_rules;
-- drop policy if exists "own automation_rules" on public.automation_rules;
-- drop table if exists public.automation_rules;
-- drop policy if exists "own automation_logs" on public.automation_logs;
-- drop table if exists public.automation_logs;