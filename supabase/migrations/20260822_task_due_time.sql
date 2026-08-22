-- Add an optional timezone-safe due time to tasks so users can schedule a
-- specific time of day (not just a calendar date) for a task.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_time timestamptz;
