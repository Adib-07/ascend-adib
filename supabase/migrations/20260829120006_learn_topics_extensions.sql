-- ============================================================================
-- ASCEND — LEARN TOPICS EXTENSIONS (additive, reversible)
-- Extends existing learn_topics with language, category, mastery, and prerequisite tracking.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Add columns to existing learn_topics (all additive, with defaults)
-- ---------------------------------------------------------------------------
alter table public.learn_topics
  add column if not exists language text;           -- 'C'|'Python'|'C++'|'HTML'|'CSS'
add column if not exists category text;           -- 'programming'|'dsa'|'project'|'exam'|'cs_fundamentals'
add column if not exists mastery_level int default 0;  -- 0-5 (MASTERY_SCALE)
add column if not exists last_practiced timestamptz;
add column if not exists exam_priority boolean default false;
add column if not exists depends_on uuid references public.learn_topics(id);

comment on column public.learn_topics.language is 'Primary language for this topic: C, Python, C++, HTML, CSS';
comment on column public.learn_topics.category is 'Topic category: programming, dsa, project, exam, cs_fundamentals';
comment on column public.learn_topics.mastery_level is 'Mastery level 0-5 per MASTERY_SCALE';
comment on column public.learn_topics.last_practiced is 'Timestamp of last practice session';
comment on column public.learn_topics.exam_priority is 'Flag for exam-focused topics';
comment on column public.learn_topics.depends_on is 'Prerequisite topic (self-referential FK)';

create index if not exists idx_learn_topics_user_language on public.learn_topics (user_id, language);
create index if not exists idx_learn_topics_user_category on public.learn_topics (user_id, category);
create index if not exists idx_learn_topics_user_mastery on public.learn_topics (user_id, mastery_level);

-- ---------------------------------------------------------------------------
-- Backfill existing rows (run after migration applies)
-- ---------------------------------------------------------------------------
-- Infer language from skill
update public.learn_topics
set language = 'C'
where language is null and skill ILIKE '%c%' and skill NOT ILIKE '%c++%' and skill NOT ILIKE '%cpp%';

update public.learn_topics
set language = 'Python'
where language is null and skill ILIKE '%python%';

update public.learn_topics
set language = 'C++'
where language is null and (skill ILIKE '%c++%' or skill ILIKE '%cpp%' or skill ILIKE '%dsa%');

update public.learn_topics
set language = 'HTML'
where language is null and skill ILIKE '%html%';

update public.learn_topics
set language = 'CSS'
where language is null and skill ILIKE '%css%';

-- Infer category from skill
update public.learn_topics
set category = 'programming'
where category is null and skill IN ('C', 'Python', 'C++');

update public.learn_topics
set category = 'dsa'
where category is null and skill = 'DSA';

update public.learn_topics
set category = 'exam'
where category is null and exam_priority = true;

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- alter table public.learn_topics drop column if exists depends_on;
-- alter table public.learn_topics drop column if exists exam_priority;
-- alter table public.learn_topics drop column if exists last_practiced;
-- alter table public.learn_topics drop column if exists mastery_level;
-- alter table public.learn_topics drop column if exists category;
-- alter table public.learn_topics drop column if exists language;
-- drop index if exists idx_learn_topics_user_mastery;
-- drop index if exists idx_learn_topics_user_category;
-- drop index if exists idx_learn_topics_user_language;
-- ============================================================================