ALTER TABLE public.routine_generation_jobs ADD COLUMN IF NOT EXISTS solver_input jsonb;
ALTER TABLE public.routine_generation_jobs ADD COLUMN IF NOT EXISTS solver_metrics jsonb;
ALTER TABLE public.routine_drafts ADD COLUMN IF NOT EXISTS total_penalty numeric NOT NULL DEFAULT 0;
ALTER TABLE public.routine_drafts ADD COLUMN IF NOT EXISTS penalty_components jsonb NOT NULL DEFAULT '{}'::jsonb;
