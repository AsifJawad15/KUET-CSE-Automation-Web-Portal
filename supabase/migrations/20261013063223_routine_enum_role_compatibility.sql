-- Existing deployments use user_role enums; reconstructed installs use text.
-- Replace the function without changing either deployment's account column type.
GRANT USAGE ON SCHEMA deptflow_private TO service_role;
DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.commit_routine_draft(text,uuid,integer,uuid,jsonb,jsonb,boolean,boolean)'::regprocedure)
    INTO definition;
  EXECUTE replace(definition, 'upper(actor.role)', 'upper(actor.role::text)');
END
$migration$;
