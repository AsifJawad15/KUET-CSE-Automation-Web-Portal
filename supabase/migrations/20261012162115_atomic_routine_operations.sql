-- All relevant writers acquire one transaction lock and advance a revision.
-- Server validation reads revision BEFORE loading data; commit rejects a changed snapshot.
ALTER TABLE public.routine_draft_slots ADD COLUMN IF NOT EXISTS activity_id text;
ALTER TABLE public.routine_slots ADD COLUMN IF NOT EXISTS activity_id text;
ALTER TABLE public.routine_slots ADD COLUMN IF NOT EXISTS source_draft_id uuid REFERENCES public.routine_drafts(id);
ALTER TABLE public.routine_slots ADD COLUMN IF NOT EXISTS group_name text;
CREATE INDEX draft_activity_identity ON public.routine_draft_slots(draft_id,activity_id);
CREATE TABLE deptflow_private.routine_revision(id integer PRIMARY KEY CHECK(id=1),revision bigint NOT NULL);
INSERT INTO deptflow_private.routine_revision VALUES(1,0);
REVOKE ALL ON deptflow_private.routine_revision FROM PUBLIC,anon,authenticated;
GRANT ALL ON deptflow_private.routine_revision TO service_role;
CREATE FUNCTION deptflow_private.advance_routine_revision() RETURNS trigger LANGUAGE plpgsql
 SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(73012026,1);
 UPDATE deptflow_private.routine_revision SET revision=revision+1 WHERE id=1;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION deptflow_private.advance_routine_revision() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','admins','students','teachers','courses','course_offerings','enrollments','rooms',
 'routine_slots','routine_generation_jobs','routine_drafts','routine_draft_slots','teacher_availability',
 'course_schedule_requirements','routine_constraints','time_periods','routine_versions','room_booking_requests',
 'cr_room_requests','admin_direct_bookings'] LOOP
 EXECUTE format('CREATE TRIGGER a_routine_revision BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I
 FOR EACH STATEMENT EXECUTE FUNCTION deptflow_private.advance_routine_revision()',t);
 END LOOP;
END $$;
CREATE FUNCTION public.get_routine_revision() RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT revision::text FROM deptflow_private.routine_revision WHERE id=1
$$;
REVOKE ALL ON FUNCTION public.get_routine_revision() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_routine_revision() TO service_role;

CREATE FUNCTION deptflow_private.routine_slot_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE session_value text; teacher_value uuid; course_value uuid; term_value text; BEGIN
 IF NEW.start_time>=NEW.end_time THEN RAISE EXCEPTION 'Invalid routine interval' USING ERRCODE='22023'; END IF;
 SELECT session,teacher_user_id,course_id,term INTO session_value,teacher_value,course_value,term_value FROM public.course_offerings WHERE id=NEW.offering_id;
 IF EXISTS(SELECT 1 FROM public.routine_slots s JOIN public.course_offerings o ON o.id=s.offering_id
 WHERE s.id<>NEW.id AND o.session=session_value AND s.day_of_week=NEW.day_of_week
 AND s.start_time<NEW.end_time AND NEW.start_time<s.end_time
 AND coalesce(s.valid_from,'-infinity'::date)<=coalesce(NEW.valid_until,'infinity'::date)
 AND coalesce(NEW.valid_from,'-infinity'::date)<=coalesce(s.valid_until,'infinity'::date)
 AND NOT(NEW.activity_id IS NOT NULL AND s.activity_id IS NOT DISTINCT FROM NEW.activity_id
 AND s.source_draft_id IS NOT DISTINCT FROM NEW.source_draft_id)
 AND NOT coalesce((NEW.activity_id IS NULL AND s.activity_id IS NULL AND o.course_id=course_value AND o.term=term_value
 AND s.room_number=NEW.room_number AND s.start_time=NEW.start_time AND s.end_time=NEW.end_time
 AND (o.teacher_user_id<>teacher_value OR s.section IS DISTINCT FROM NEW.section)),false)
 AND (s.room_number=NEW.room_number OR o.teacher_user_id=teacher_value OR
 (o.term=(SELECT term FROM public.course_offerings WHERE id=NEW.offering_id) AND s.section=NEW.section
 AND (s.group_name IS NULL OR NEW.group_name IS NULL OR s.group_name=NEW.group_name)))) THEN
 RAISE EXCEPTION 'Published routine resource conflict' USING ERRCODE='23P01'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER routine_resource_conflict BEFORE INSERT OR UPDATE ON public.routine_slots
 FOR EACH ROW EXECUTE FUNCTION deptflow_private.routine_slot_guard();

CREATE FUNCTION public.commit_routine_draft(p_revision text,p_actor uuid,p_session_version integer,p_draft uuid,
 p_rows jsonb,p_metrics jsonb,p_publish boolean,p_replace boolean) RETURNS jsonb
 LANGUAGE plpgsql SET search_path='' AS $$
DECLARE j public.routine_generation_jobs; d public.routine_drafts; actor public.profiles;
 permissions jsonb; revision_value bigint; row_count integer; version_id uuid;
 sections text[]; teacher uuid; section_value text; BEGIN
 PERFORM pg_advisory_xact_lock(73012026,1);
 SELECT * INTO actor FROM public.profiles WHERE user_id=p_actor FOR UPDATE;
 SELECT a.permissions INTO permissions FROM public.admins a WHERE a.user_id=p_actor;
 IF actor.user_id IS NULL OR NOT actor.is_active OR actor.session_version IS DISTINCT FROM p_session_version
 OR NOT(upper(actor.role)='HEAD' OR (upper(actor.role)='ADMIN' AND
 (coalesce((permissions->>'all')::boolean,false) OR coalesce(permissions->'menus','[]'::jsonb) ? 'class-routine'))) THEN
 RAISE EXCEPTION 'Current routine administrator session required' USING ERRCODE='42501'; END IF;
 SELECT revision INTO revision_value FROM deptflow_private.routine_revision WHERE id=1;
 IF p_revision::bigint<>revision_value THEN RAISE EXCEPTION 'Scheduling snapshot changed' USING ERRCODE='40001'; END IF;
 SELECT * INTO d FROM public.routine_drafts WHERE id=p_draft FOR UPDATE;
 SELECT * INTO j FROM public.routine_generation_jobs WHERE id=d.job_id;
 IF d.id IS NULL OR j.solver_input IS NULL OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)=0 THEN
 RAISE EXCEPTION 'Complete draft state required' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO row_count FROM public.routine_draft_slots WHERE draft_id=p_draft;
 IF jsonb_array_length(p_rows)<>row_count OR
 (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_rows) x)<>row_count OR
 EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) x LEFT JOIN public.routine_draft_slots s
 ON s.id=(x->>'id')::uuid AND s.draft_id=p_draft WHERE s.id IS NULL OR s.activity_id IS NULL OR s.activity_id IS DISTINCT FROM x->>'activity_id') THEN
 RAISE EXCEPTION 'Rows must identify the complete selected draft' USING ERRCODE='22023'; END IF;
 IF p_metrics->>'hard_conflict_count' IS NULL OR (p_metrics->>'hard_conflict_count')::integer<0
 OR (p_metrics->>'score')::numeric NOT BETWEEN 0 AND 100 THEN
 RAISE EXCEPTION 'Validated draft metrics required' USING ERRCODE='22023'; END IF;
 IF p_publish AND (p_metrics->>'hard_conflict_count')::integer<>0 THEN
 RAISE EXCEPTION 'Conflicting draft cannot be published' USING ERRCODE='22023'; END IF;
 UPDATE public.routine_draft_slots s SET day_of_week=x.day_of_week,start_period=x.start_period,end_period=x.end_period,
 room_number=x.room_number,start_time=x.start_time,end_time=x.end_time,conflict_status=x.conflict_status,conflict_reasons=x.conflict_reasons
 FROM jsonb_to_recordset(p_rows) AS x(id uuid,day_of_week integer,start_period integer,end_period integer,
 room_number text,start_time time,end_time time,conflict_status text,conflict_reasons jsonb)
 WHERE s.id=x.id AND s.draft_id=p_draft;
 UPDATE public.routine_drafts SET score=(p_metrics->>'score')::numeric,total_penalty=(p_metrics->>'total_penalty')::numeric,
 penalty_components=p_metrics->'penalty_components',hard_conflict_count=(p_metrics->>'hard_conflict_count')::integer,
 soft_warning_count=(p_metrics->>'soft_warning_count')::integer,summary=p_metrics->'summary',
 is_selected=CASE WHEN p_publish THEN is_selected ELSE false END WHERE id=p_draft;
 IF p_publish THEN
  SELECT array_agg(DISTINCT section) INTO sections FROM public.routine_draft_slots WHERE draft_id=p_draft;
  IF p_replace THEN
   DELETE FROM public.routine_slots s USING public.course_offerings o
   WHERE s.offering_id=o.id AND o.session=j.session AND o.term=j.year||'-'||j.term AND s.section=ANY(sections);
  END IF;
  INSERT INTO public.routine_slots(offering_id,room_number,day_of_week,start_time,end_time,section,activity_id,source_draft_id,group_name)
  SELECT course_offering_id,room_number,day_of_week,start_time,end_time,section,activity_id,p_draft,group_name
  FROM public.routine_draft_slots WHERE draft_id=p_draft;
  INSERT INTO public.routine_versions(session,year,term,section,source_draft_id,published_by,change_summary)
  VALUES(j.session,j.year,j.term,j.section,p_draft,p_actor,jsonb_build_object('slot_count',row_count,'score',p_metrics->'score',
   'metrics',p_metrics,'generation_input',j.solver_input,'slots',
   (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.routine_draft_slots s WHERE s.draft_id=p_draft)))
  RETURNING id INTO version_id;
  UPDATE public.routine_drafts target SET is_selected=false FROM public.routine_generation_jobs jobs
  WHERE target.job_id=jobs.id AND jobs.session=j.session AND jobs.year=j.year AND jobs.term=j.term;
  UPDATE public.routine_drafts SET is_selected=true WHERE id=p_draft;
  FOREACH section_value IN ARRAY sections LOOP
   INSERT INTO public.notifications(type,title,body,target_type,target_value,target_year_term,created_by,created_by_role,metadata)
   VALUES('new_schedule','Routine Updated','The class routine has been updated.','SECTION',section_value,j.year||'-'||j.term,p_actor,'ADMIN',
    jsonb_build_object('version_id',version_id,'session',j.session));
  END LOOP;
  FOR teacher IN SELECT DISTINCT teacher_user_id FROM public.routine_draft_slots WHERE draft_id=p_draft LOOP
   INSERT INTO public.notifications(type,title,body,target_type,target_value,created_by,created_by_role,metadata)
   VALUES('new_schedule','Routine Updated','Your teaching timetable has been updated.','USER',teacher::text,p_actor,'ADMIN',jsonb_build_object('version_id',version_id));
  END LOOP;
 END IF;
 RETURN jsonb_build_object('success',true,'versionId',version_id,'publishedSlotsCount',CASE WHEN p_publish THEN row_count ELSE 0 END,
 'score',p_metrics->'score','hardConflictCount',p_metrics->'hard_conflict_count','softWarningCount',p_metrics->'soft_warning_count');
END $$;
REVOKE ALL ON FUNCTION public.commit_routine_draft(text,uuid,integer,uuid,jsonb,jsonb,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_routine_draft(text,uuid,integer,uuid,jsonb,jsonb,boolean,boolean) TO service_role;
