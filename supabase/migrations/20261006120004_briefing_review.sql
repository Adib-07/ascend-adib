-- ============================================================================
-- ASCEND — DAILY BRIEFING & WEEKLY REVIEW (additive, reversible)
-- Materialized views and helper functions for briefing/review generation.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- daily_briefing: Materialized daily briefing data (refreshed daily or on-demand)
-- ---------------------------------------------------------------------------
create table public.daily_briefing (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  briefing_date       date not null,
  overdue_tasks       jsonb not null default '[]'::jsonb,
  today_tasks         jsonb not null default '[]'::jsonb,
  today_events        jsonb not null default '[]'::jsonb,
  today_habits        jsonb not null default '[]'::jsonb,
  upcoming_deadlines  jsonb not null default '[]'::jsonb,
  active_projects     jsonb not null default '[]'::jsonb,
  daily_intention     text,
  priority_summary    text,
  generated_at        timestamptz not null default now(),
  unique (user_id, briefing_date)
);

comment on table public.daily_briefing is 'Pre-computed daily briefing data for quick retrieval';

grant select, insert, update, delete on public.daily_briefing to authenticated;
grant all on public.daily_briefing to service_role;

alter table public.daily_briefing enable row level security;

create policy "own daily_briefing"
  on public.daily_briefing
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_daily_briefing_user_date on public.daily_briefing (user_id, briefing_date desc);

-- ---------------------------------------------------------------------------
-- weekly_review: Materialized weekly review data
-- ---------------------------------------------------------------------------
create table public.weekly_review (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  week_start          date not null,
  week_end            date not null,
  completed_tasks     jsonb not null default '[]'::jsonb,
  incomplete_tasks    jsonb not null default '[]'::jsonb,
  habit_completion    jsonb not null default '[]'::jsonb,
  streak_changes      jsonb not null default '[]'::jsonb,
  project_progress    jsonb not null default '[]'::jsonb,
  goal_progress       jsonb not null default '[]'::jsonb,
  important_notes     jsonb not null default '[]'::jsonb,
  upcoming_deadlines  jsonb not null default '[]'::jsonb,
  summary_text        text,
  generated_at        timestamptz not null default now(),
  unique (user_id, week_start)
);

comment on table public.weekly_review is 'Pre-computed weekly review data';

grant select, insert, update, delete on public.weekly_review to authenticated;
grant all on public.weekly_review to service_role;

alter table public.weekly_review enable row level security;

create policy "own weekly_review"
  on public.weekly_review
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_weekly_review_user_week on public.weekly_review (user_id, week_start desc);

-- ---------------------------------------------------------------------------
-- Helper function: generate daily briefing (server-side)
-- ---------------------------------------------------------------------------
create or replace function public.generate_daily_briefing(p_user_id uuid, p_date date)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_briefing jsonb;
  v_overdue jsonb;
  v_today jsonb;
  v_events jsonb;
  v_habits jsonb;
  v_deadlines jsonb;
  v_projects jsonb;
  v_intention text;
begin
  -- Overdue tasks
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_overdue
  from (
    select id, title, priority, due_date, type
    from public.tasks
    where user_id = p_user_id
      and done = false
      and due_date < p_date
    order by priority desc, due_date
    limit 10
  ) t;

  -- Today's tasks
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_today
  from (
    select id, title, priority, due_date, due_time, type, mit_slot
    from public.tasks
    where user_id = p_user_id
      and done = false
      and due_date = p_date
    order by priority desc, due_time
    limit 15
  ) t;

  -- Today's events
  select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) into v_events
  from (
    select id, title, start_at, end_at, all_day, location
    from public.events
    where user_id = p_user_id
      and start_at >= p_date
      and start_at < p_date + interval '1 day'
    order by start_at
    limit 10
  ) e;

  -- Today's habits (those due today based on frequency)
  select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) into v_habits
  from (
    select id, name, streak, target, frequency, unit
    from public.habits
    where user_id = p_user_id
      and (
        frequency = 'daily'
        or (frequency = 'weekly' and (p_date - created_at::date) % 7 = 0)
      )
    order by streak desc
    limit 10
  ) h;

  -- Upcoming deadlines (next 7 days)
  select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) into v_deadlines
  from (
    select 'task' as type, id, title as name, due_date as deadline, priority
    from public.tasks
    where user_id = p_user_id
      and done = false
      and due_date >= p_date
      and due_date <= p_date + interval '7 days'
    union all
    select 'goal' as type, id, text as name, deadline, 'medium' as priority
    from public.goals
    where user_id = p_user_id
      and done = false
      and deadline >= p_date
      and deadline <= p_date + interval '7 days'
    union all
    select 'project' as type, id, name, deadline, 'medium' as priority
    from public.work_projects
    where user_id = p_user_id
      and status not in ('Done','Completed')
      and deadline >= p_date
      and deadline <= p_date + interval '7 days'
    union all
    select 'academic_project' as type, id, name, deadline, 'medium' as priority
    from public.academic_projects
    where user_id = p_user_id
      and status not in ('Done','Completed')
      and deadline >= p_date
      and deadline <= p_date + interval '7 days'
    order by deadline
    limit 10
  ) d;

  -- Active projects
  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_projects
  from (
    select 'work' as kind, id, name, status, progress, deadline
    from public.work_projects
    where user_id = p_user_id
      and status not in ('Done','Completed')
    union all
    select 'academic' as kind, id, name, status, progress, deadline
    from public.academic_projects
    where user_id = p_user_id
      and status not in ('Done','Completed')
    order by deadline
    limit 8
  ) p;

  -- Daily intention
  select intention into v_intention
  from public.daily_intentions
  where user_id = p_user_id
    and day = p_date;

  -- Build briefing
  v_briefing := jsonb_build_object(
    'date', p_date,
    'overdue_tasks', v_overdue,
    'today_tasks', v_today,
    'today_events', v_events,
    'today_habits', v_habits,
    'upcoming_deadlines', v_deadlines,
    'active_projects', v_projects,
    'daily_intention', v_intention
  );

  -- Upsert into daily_briefing
  insert into public.daily_briefing (user_id, briefing_date, overdue_tasks, today_tasks, today_events, today_habits, upcoming_deadlines, active_projects, daily_intention, generated_at)
  values (p_user_id, p_date, v_overdue, v_today, v_events, v_habits, v_deadlines, v_projects, v_intention, now())
  on conflict (user_id, briefing_date) do update set
    overdue_tasks = excluded.overdue_tasks,
    today_tasks = excluded.today_tasks,
    today_events = excluded.today_events,
    today_habits = excluded.today_habits,
    upcoming_deadlines = excluded.upcoming_deadlines,
    active_projects = excluded.active_projects,
    daily_intention = excluded.daily_intention,
    generated_at = now();

  return v_briefing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper function: generate weekly review
-- ---------------------------------------------------------------------------
create or replace function public.generate_weekly_review(p_user_id uuid, p_week_start date)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_review jsonb;
  v_week_end date := p_week_start + interval '6 days';
  v_completed jsonb;
  v_incomplete jsonb;
  v_habits jsonb;
  v_streaks jsonb;
  v_projects jsonb;
  v_goals jsonb;
  v_notes jsonb;
  v_deadlines jsonb;
begin
  -- Completed tasks this week
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_completed
  from (
    select id, title, completed_at, priority
    from public.tasks
    where user_id = p_user_id
      and done = true
      and completed_at >= p_week_start
      and completed_at <= p_week_start + interval '6 days'
    order by completed_at desc
  ) t;

  -- Incomplete tasks with deadline this week
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_incomplete
  from (
    select id, title, due_date, priority
    from public.tasks
    where user_id = p_user_id
      and done = false
      and due_date >= p_week_start
      and due_date <= p_week_start + interval '6 days'
    order by due_date
  ) t;

  -- Habit completion this week
  select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) into v_habits
  from (
    select h.id, h.name, count(hl.id) as completions, h.target
    from public.habits h
    left join public.habit_logs hl
      on hl.habit_id = h.id
      and hl.day >= p_week_start
      and hl.day <= p_week_start + interval '6 days'
      and hl.done = true
    where h.user_id = p_user_id
    group by h.id, h.name, h.target
    having count(hl.id) > 0
    order by completions desc
  ) h;

  -- Streak changes
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v_streaks
  from (
    select id, name, streak
    from public.habits
    where user_id = p_user_id
      and streak > 0
    order by streak desc
    limit 5
  ) s;

  -- Project progress
  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_projects
  from (
    select 'work' as kind, id, name, progress, status
    from public.work_projects
    where user_id = p_user_id
      and status not in ('Done','Completed')
    union all
    select 'academic' as kind, id, name, progress, status
    from public.academic_projects
    where user_id = p_user_id
      and status not in ('Done','Completed')
  ) p;

  -- Goal progress
  select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) into v_goals
  from (
    select id, text, scope, done, deadline
    from public.goals
    where user_id = p_user_id
    order by done asc, deadline
  ) g;

  -- Important notes this week
  select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) into v_notes
  from (
    select id, title, content, created_at
    from public.notes
    where user_id = p_user_id
      and created_at >= p_week_start
      and created_at <= p_week_start + interval '6 days'
    order by created_at desc
    limit 5
  ) n;

  -- Upcoming deadlines (next 2 weeks)
  select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) into v_deadlines
  from (
    select 'task' as type, id, title as name, due_date as deadline
    from public.tasks
    where user_id = p_user_id
      and done = false
      and due_date > p_week_start + interval '6 days'
      and due_date <= p_week_start + interval '20 days'
    union all
    select 'goal', id, text, deadline from public.goals where user_id = p_user_id and done = false and deadline > p_week_start + interval '6 days' and deadline <= p_week_start + interval '20 days'
    union all
    select 'project', id, name, deadline from public.work_projects where user_id = p_user_id and status not in ('Done','Completed') and deadline > p_week_start + interval '6 days' and deadline <= p_week_start + interval '20 days'
    union all
    select 'academic_project', id, name, deadline from public.academic_projects where user_id = p_user_id and status not in ('Done','Completed') and deadline > p_week_start + interval '6 days' and deadline <= p_week_start + interval '20 days'
    order by deadline
    limit 10
  ) d;

  v_review := jsonb_build_object(
    'week_start', p_week_start,
    'week_end', p_week_start + interval '6 days',
    'completed_tasks', v_completed,
    'incomplete_tasks', v_incomplete,
    'habit_completion', v_habits,
    'streak_changes', v_streaks,
    'project_progress', v_projects,
    'goal_progress', v_goals,
    'important_notes', v_notes,
    'upcoming_deadlines', v_deadlines
  );

  insert into public.weekly_review (user_id, week_start, week_end, completed_tasks, incomplete_tasks, habit_completion, streak_changes, project_progress, goal_progress, important_notes, upcoming_deadlines, generated_at)
  values (p_user_id, p_week_start, p_week_start + interval '6 days', v_completed, v_incomplete, v_habits, v_streaks, v_projects, v_goals, v_notes, v_deadlines, now())
  on conflict (user_id, week_start) do update set
    week_end = excluded.week_end,
    completed_tasks = excluded.completed_tasks,
    incomplete_tasks = excluded.incomplete_tasks,
    habit_completion = excluded.habit_completion,
    streak_changes = excluded.streak_changes,
    project_progress = excluded.project_progress,
    goal_progress = excluded.goal_progress,
    important_notes = excluded.important_notes,
    upcoming_deadlines = excluded.upcoming_deadlines,
    generated_at = now();

  return v_review;
end;
$$;

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop function if exists public.generate_weekly_review(uuid, date);
-- drop function if exists public.generate_daily_briefing(uuid, date);
-- drop index if exists idx_weekly_review_user_week;
-- drop index if exists idx_daily_briefing_user_date;
-- drop policy if exists "own weekly_review" on public.weekly_review;
-- drop table if exists public.weekly_review;
-- drop policy if exists "own daily_briefing" on public.daily_briefing;
-- drop table if exists public.daily_briefing;