-- ============================================================================
-- ASCEND — LEARNING RESOURCES (additive, reversible)
-- Global curated resources (primary + backup per subject). Read-only for users.
-- Pattern matches educational_resources / external_datasets.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- learning_resources: Global curated resources
-- ---------------------------------------------------------------------------
create table public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  language text not null,                 -- 'C'|'Python'|'C++'|'DSA'|'HTML'|'CSS'|'General'
  topic text,                             -- Specific topic this resource covers
  resource_type text not null,            -- 'primary'|'backup'|'practice'|'reference'|'visualizer'
  title text not null,
  url text not null,
  description text,
  format text,                            -- 'interactive'|'video'|'text'|'exercises'|'documentation'|'structured'|'visualizer'
  difficulty text,                        -- 'Beginner'|'Intermediate'|'Advanced'
  estimated_hours numeric,
  is_official boolean default false,      -- Official docs (Python.org, cppreference.com)
  is_free boolean default true,
  recommended_order int,                  -- Sequence within a topic
  created_at timestamptz not null default now()
);

comment on table public.learning_resources is
  'Global curated learning resources. 1 primary + 1 backup per subject. Read-only for authenticated users.';

grant select on public.learning_resources to authenticated;
grant all on public.learning_resources to service_role;

alter table public.learning_resources enable row level security;

create policy "learning_resources read"
  on public.learning_resources
  for select to authenticated
  using (true);

create policy "learning_resources no public write"
  on public.learning_resources
  for all to authenticated
  using (false)
  with check (false);

create index if not exists idx_learning_resources_language on public.learning_resources (language);
create index if not exists idx_learning_resources_language_topic on public.learning_resources (language, topic);

-- ---------------------------------------------------------------------------
-- Seed Data: Primary + Backup per subject (Priority 1: C, Python; Priority 2: C++, DSA; Priority 3: HTML, CSS)
-- ---------------------------------------------------------------------------
insert into public.learning_resources
  (language, topic, resource_type, title, url, description, format, difficulty, is_official, is_free, recommended_order)
values
  -- C (Priority 1)
  ('C', 'Fundamentals', 'primary', 'Exercism C Track', 'https://exercism.org/tracks/c',
   'Interactive C exercises with mentored feedback. Covers variables, loops, functions, pointers, memory.',
   'interactive', 'Beginner', false, true, 1),
  ('C', 'Fundamentals', 'backup', 'The C Programming Language (K&R)', 'https://www.amazon.com/C-Programming-Language-2nd/dp/0131103628',
   'Classic authoritative reference. Dense but complete. Use for deep understanding.',
   'text', 'Beginner', false, false, 2),
  ('C', 'Pointers & Memory', 'primary', 'Exercism C Track - Pointers', 'https://exercism.org/tracks/c/exercises',
   'Focused pointer exercises: dereferencing, pointer arithmetic, dynamic allocation.',
   'interactive', 'Intermediate', false, true, 1),
  ('C', 'Pointers & Memory', 'backup', 'C Pointers Explained (Beej)', 'https://beej.us/guide/bgc/',
   'Friendly guide to pointers, memory layout, malloc/free, common pitfalls.',
   'text', 'Intermediate', false, true, 2),

  -- Python (Priority 1)
  ('Python', 'Fundamentals', 'primary', 'Exercism Python Track', 'https://exercism.org/tracks/python',
   'Interactive Python exercises with mentored feedback. Covers syntax, data structures, OOP, file I/O.',
   'interactive', 'Beginner', false, true, 1),
  ('Python', 'Fundamentals', 'backup', 'Python Official Tutorial', 'https://docs.python.org/3/tutorial/',
   'Official tutorial from Python Software Foundation. Authoritative and up-to-date.',
   'documentation', 'Beginner', true, true, 2),
  ('Python', 'OOP', 'primary', 'Exercism Python Track - OOP', 'https://exercism.org/tracks/python/exercises',
   'Classes, inheritance, polymorphism, dunder methods, dataclasses.',
   'interactive', 'Intermediate', false, true, 1),
  ('Python', 'OOP', 'backup', 'Real Python OOP Tutorial', 'https://realpython.com/python3-object-oriented-programming/',
   'Practical OOP with examples. Good for understanding why OOP patterns exist.',
   'text', 'Intermediate', false, true, 2),

  -- C++ (Priority 2)
  ('C++', 'Fundamentals', 'primary', 'Exercism C++ Track', 'https://exercism.org/tracks/cpp',
   'Interactive C++ exercises. Covers basics, references, OOP, STL containers.',
   'interactive', 'Beginner', false, true, 1),
  ('C++', 'Fundamentals', 'backup', 'cppreference.com', 'https://en.cppreference.com/',
   'Authoritative C++ reference. Standard library, language features, compiler support.',
   'reference', 'Beginner', true, true, 2),
  ('C++', 'STL', 'primary', 'Exercism C++ Track - STL', 'https://exercism.org/tracks/cpp/exercises',
   'vector, string, map, unordered_map, set, stack, queue, algorithms.',
   'interactive', 'Intermediate', false, true, 1),
  ('C++', 'STL', 'backup', 'C++ STL Tutorial (GeeksforGeeks)', 'https://www.geeksforgeeks.org/the-c-standard-template-library-stl/',
   'Comprehensive STL guide with examples for each container.',
   'text', 'Intermediate', false, true, 2),

  -- DSA (Priority 2)
  ('DSA', 'Roadmap', 'primary', 'Striver A2Z DSA Sheet', 'https://takeuforward.org/strivers-a2z-dsa-course/',
   'Structured progression: Arrays → Strings → Searching → Sorting → Two Pointers → Sliding Window → Hashing → Recursion → Backtracking → Linked Lists → Stacks → Queues → Trees → Graphs → DP.',
   'structured', 'Beginner', false, true, 1),
  ('DSA', 'Roadmap', 'backup', 'NeetCode 150', 'https://neetcode.io/roadmap',
   '150 curated problems by pattern. Video explanations. Good for interview prep.',
   'structured', 'Beginner', false, true, 2),
  ('DSA', 'Visualization', 'visualizer', 'W3Schools DSA Visualizer', 'https://www.w3schools.com/dsa/',
   'Interactive visualizations for sorting, searching, trees, graphs. Helps build intuition.',
   'visualizer', 'Beginner', false, true, 3),

  -- HTML (Priority 4)
  ('HTML', 'Fundamentals', 'primary', 'W3Docs HTML Exercises', 'https://www.w3docs.com/learn-html/html-exercises.html',
   'Hands-on HTML exercises. Semantic HTML, forms, tables, links, images, accessibility.',
   'exercises', 'Beginner', false, true, 1),
  ('HTML', 'Fundamentals', 'backup', 'MDN HTML Reference', 'https://developer.mozilla.org/en-US/docs/Web/HTML',
   'Authoritative HTML reference. Elements, attributes, global attributes, examples.',
   'reference', 'Beginner', true, true, 2),

  -- CSS (Priority 4)
  ('CSS', 'Fundamentals', 'primary', 'W3Docs CSS Exercises', 'https://www.w3docs.com/learn-css/css-exercises.html',
   'Hands-on CSS exercises. Selectors, box model, flexbox, grid, responsive design.',
   'exercises', 'Beginner', false, true, 1),
  ('CSS', 'Fundamentals', 'backup', 'MDN CSS Reference', 'https://developer.mozilla.org/en-US/docs/Web/CSS',
   'Authoritative CSS reference. Properties, selectors, layout modules, examples.',
   'reference', 'Beginner', true, true, 2);

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- drop policy if exists "learning_resources no public write" on public.learning_resources;
-- drop policy if exists "learning_resources read" on public.learning_resources;
-- drop index if exists idx_learning_resources_language_topic;
-- drop index if exists idx_learning_resources_language;
-- delete from public.learning_resources;
-- drop table if exists public.learning_resources;
-- ============================================================================