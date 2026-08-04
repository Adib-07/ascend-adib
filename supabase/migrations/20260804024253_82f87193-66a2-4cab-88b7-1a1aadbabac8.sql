ALTER TABLE public.outreach ADD COLUMN IF NOT EXISTS expected_value numeric DEFAULT 0;
ALTER TABLE public.outreach ADD COLUMN IF NOT EXISTS niche text;
ALTER TABLE public.outreach ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.outreach ADD COLUMN IF NOT EXISTS message_type text;
ALTER TABLE public.outreach ADD COLUMN IF NOT EXISTS outcome text;

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS starter_price numeric DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS standard_price numeric DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS premium_price numeric DEFAULT 0;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS niche text;

CREATE UNIQUE INDEX IF NOT EXISTS goals_user_northstar_unique
  ON public.goals(user_id, scope)
  WHERE scope = 'north_star';