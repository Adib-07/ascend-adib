-- ============================================================================
-- ASCEND — AUTOMATION IDEMPOTENCY (additive, reversible)
-- Add execution_id for idempotency and loop protection.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Add execution_id to automation_logs for idempotency
-- ---------------------------------------------------------------------------
alter table public.automation_logs
  add column if not exists execution_id uuid;

-- Create unique index for idempotency (rule_id + execution_id)
create unique index if not exists idx_automation_logs_idempotency
  on public.automation_logs (rule_id, execution_id)
  where execution_id is not null;

-- ---------------------------------------------------------------------------
-- Add last_triggered_at to automation_rules for rate limiting
-- ---------------------------------------------------------------------------
alter table public.automation_rules
  add column if not exists last_triggered_at timestamptz;

-- ---------------------------------------------------------------------------
-- Add timezone to automation_rules for scheduled triggers
-- ---------------------------------------------------------------------------
alter table public.automation_rules
  add column if not exists timezone text not null default 'UTC';

comment on column public.automation_logs.execution_id is 'Idempotency key: unique per rule execution window';
comment on column public.automation_rules.last_triggered_at is 'Last time this rule was triggered (for rate limiting)';
comment on column public.automation_rules.timezone is 'Timezone for scheduled triggers (IANA format)';

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop index if exists idx_automation_logs_idempotency;
-- alter table public.automation_logs drop column if exists execution_id;
-- alter table public.automation_rules drop column if exists last_triggered_at;
-- alter table public.automation_rules drop column if exists timezone;