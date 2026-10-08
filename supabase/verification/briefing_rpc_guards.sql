-- Read-only verification for the briefing/review RPC guards.
--
-- This is NOT a migration and lives outside supabase/migrations on purpose. It
-- creates no object and mutates no data -- run it with the Supabase Dashboard
-- SQL Editor (or any read-only session) after the briefing/review migrations
-- have actually been deployed, and expect:
--
--   daily_body_has_uid_check  = true
--   weekly_body_has_uid_check = true
--   public_can_execute        = false
--   anon_can_execute          = false
--   authenticated_can_execute = true
--   service_role_can_execute  = true
--   search_path_pinned        = true
--
-- The guard itself now lives in the creating migration
-- (20261006120004_briefing_review.sql) rather than in a follow-up patch, so
-- this script only observes the end state.

select
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'generate_daily_briefing'
      and p.prosrc ilike '%auth.uid()%'
  ) as daily_body_has_uid_check,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'generate_weekly_review'
      and p.prosrc ilike '%auth.uid()%'
  ) as weekly_body_has_uid_check,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('generate_daily_briefing', 'generate_weekly_review')
      and has_function_privilege('public', p.oid, 'execute')
  ) as public_can_execute,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('generate_daily_briefing', 'generate_weekly_review')
      and has_function_privilege('anon', p.oid, 'execute')
  ) as anon_can_execute,
  bool_and(has_function_privilege('authenticated', p.oid, 'execute')) as authenticated_can_execute,
  bool_and(has_function_privilege('service_role', p.oid, 'execute')) as service_role_can_execute,
  bool_and(coalesce(p.proconfig @> array['search_path=public'], false)) as search_path_pinned
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('generate_daily_briefing', 'generate_weekly_review')
  and pg_get_function_identity_arguments(p.oid) = 'uuid, date';