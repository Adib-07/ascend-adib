
-- Updated-at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- DAILY INTENTIONS (one per day per user)
CREATE TABLE public.daily_intentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  day DATE NOT NULL,
  intention TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, day)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.daily_intentions TO authenticated;
GRANT ALL ON public.daily_intentions TO service_role;
ALTER TABLE public.daily_intentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own intentions" ON public.daily_intentions FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER t_di_upd BEFORE UPDATE ON public.daily_intentions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium',
  due_date DATE,
  type TEXT NOT NULL DEFAULT 'Study',
  done BOOLEAN NOT NULL DEFAULT false,
  mit_slot INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks" ON public.tasks FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER t_tasks_upd BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- LEARN TOPICS
CREATE TABLE public.learn_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  topic TEXT NOT NULL,
  skill TEXT NOT NULL DEFAULT 'Python',
  status TEXT NOT NULL DEFAULT 'Not Started',
  progress INT NOT NULL DEFAULT 0,
  difficulty TEXT DEFAULT 'Medium',
  source TEXT,
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.learn_topics TO authenticated;
GRANT ALL ON public.learn_topics TO service_role;
ALTER TABLE public.learn_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own learn" ON public.learn_topics FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER t_lt_upd BEFORE UPDATE ON public.learn_topics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NOTES
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON public.notes FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER t_notes_upd BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CODING PROBLEMS
CREATE TABLE public.coding_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  platform TEXT DEFAULT 'LeetCode',
  difficulty TEXT DEFAULT 'Medium',
  solved BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.coding_problems TO authenticated;
GRANT ALL ON public.coding_problems TO service_role;
ALTER TABLE public.coding_problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coding" ON public.coding_problems FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER t_cp_upd BEFORE UPDATE ON public.coding_problems FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- QUIZ
CREATE TABLE public.quiz_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  topic TEXT DEFAULT 'General',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.quiz_items TO authenticated;
GRANT ALL ON public.quiz_items TO service_role;
ALTER TABLE public.quiz_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quiz" ON public.quiz_items FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- FLASHCARD DECKS
CREATE TABLE public.flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.flashcard_decks TO authenticated;
GRANT ALL ON public.flashcard_decks TO service_role;
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own decks" ON public.flashcard_decks FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- FLASHCARDS
CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES public.flashcard_decks ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  known BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.flashcards TO authenticated;
GRANT ALL ON public.flashcards TO service_role;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cards" ON public.flashcards FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- EXAMS
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  exam_date DATE,
  syllabus JSONB NOT NULL DEFAULT '[]'::jsonb,
  prep_status TEXT DEFAULT 'Not Started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own exams" ON public.exams FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER t_exams_upd BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ACADEMIC PROJECTS
CREATE TABLE public.academic_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'Planning',
  deadline DATE,
  tech_stack TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.academic_projects TO authenticated;
GRANT ALL ON public.academic_projects TO service_role;
ALTER TABLE public.academic_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ap" ON public.academic_projects FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER t_ap_upd BEFORE UPDATE ON public.academic_projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- HABITS
CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  streak INT NOT NULL DEFAULT 0,
  last_done DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own habits" ON public.habits FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- HABIT LOGS
CREATE TABLE public.habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES public.habits ON DELETE CASCADE,
  day DATE NOT NULL,
  done BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(habit_id, day)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.habit_logs TO authenticated;
GRANT ALL ON public.habit_logs TO service_role;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own hl" ON public.habit_logs FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- GOALS
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  scope TEXT NOT NULL,
  text TEXT NOT NULL,
  deadline DATE,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.goals FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT DEFAULT 'Direct',
  status TEXT DEFAULT 'Lead',
  revenue NUMERIC NOT NULL DEFAULT 0,
  contact TEXT,
  rating INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own clients" ON public.clients FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER t_clients_upd BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WORK PROJECTS
CREATE TABLE public.work_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Freelance',
  status TEXT DEFAULT 'Planning',
  client_id UUID REFERENCES public.clients ON DELETE SET NULL,
  deadline DATE,
  revenue NUMERIC NOT NULL DEFAULT 0,
  progress INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.work_projects TO authenticated;
GRANT ALL ON public.work_projects TO service_role;
ALTER TABLE public.work_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wp" ON public.work_projects FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER t_wp_upd BEFORE UPDATE ON public.work_projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FINANCE
CREATE TABLE public.finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'Income',
  category TEXT,
  account TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fin" ON public.finance_entries FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- SERVICES
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_range TEXT,
  delivery_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own services" ON public.services FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- OUTREACH
CREATE TABLE public.outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  outreach_date DATE NOT NULL DEFAULT CURRENT_DATE,
  platform TEXT,
  lead_name TEXT NOT NULL,
  status TEXT DEFAULT 'Lead',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.outreach TO authenticated;
GRANT ALL ON public.outreach TO service_role;
ALTER TABLE public.outreach ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own out" ON public.outreach FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
