-- Reconstructed authenticated boundary; evaluated as a new release.
CREATE SCHEMA IF NOT EXISTS deptflow_private;
ALTER TABLE public.profiles ADD CONSTRAINT supported_profile_role CHECK(upper(role) IN ('ADMIN','HEAD','TEACHER','STUDENT','STAFF'));
ALTER TABLE public.enrollments ADD CONSTRAINT enrollment_offering_student UNIQUE(offering_id,student_user_id);
REVOKE ALL ON SCHEMA deptflow_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA deptflow_private TO authenticated, service_role;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
CREATE TABLE public.password_recovery_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
  consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION deptflow_private.current_role() RETURNS text LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = '' AS $$
 SELECT upper(role) FROM public.profiles WHERE user_id=auth.uid() AND is_active
$$;
CREATE FUNCTION deptflow_private.teaches(p_offering uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.course_offerings o JOIN public.profiles p ON p.user_id=o.teacher_user_id
 WHERE o.id=p_offering AND o.teacher_user_id=auth.uid() AND o.is_active AND p.is_active AND upper(p.role) IN ('TEACHER','HEAD'))
$$;
CREATE FUNCTION deptflow_private.enrolled(p_offering uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.enrollments e JOIN public.profiles p ON p.user_id=e.student_user_id
 WHERE e.offering_id=p_offering AND e.student_user_id=auth.uid() AND e.enrollment_status='ENROLLED' AND p.is_active AND upper(p.role)='STUDENT')
$$;
CREATE FUNCTION deptflow_private.admin_module(p_menu text) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p LEFT JOIN public.admins a ON a.user_id=p.user_id
 WHERE p.user_id=auth.uid() AND p.is_active AND
 (upper(p.role)='HEAD' OR (upper(p.role)='ADMIN' AND
 (coalesce((a.permissions->>'all')::boolean,false) OR coalesce(a.permissions->'menus','[]'::jsonb) ? p_menu))))
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA deptflow_private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA deptflow_private TO authenticated, service_role;
DO $$ DECLARE t record; p record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t.tablename);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t.tablename);
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t.tablename LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t.tablename);
  END LOOP;
 END LOOP;
END $$;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT(user_id,role,email,is_active,last_login,created_at,updated_at) ON public.profiles TO authenticated;
CREATE POLICY profile_own ON public.profiles FOR SELECT TO authenticated
 USING(user_id=auth.uid() AND deptflow_private.current_role() IS NOT NULL);
GRANT SELECT ON public.students,public.teachers,public.courses,public.curriculum,public.course_offerings,
 public.rooms,public.time_periods,public.routine_slots,public.teacher_availability,public.enrollments,
 public.class_sessions,public.attendance_records,public.exams,public.exam_scores,public.notices TO authenticated;
CREATE POLICY students_visible ON public.students FOR SELECT TO authenticated USING
 (deptflow_private.current_role() IS NOT NULL AND (user_id=auth.uid() OR EXISTS
 (SELECT 1 FROM public.enrollments e WHERE e.student_user_id=students.user_id AND deptflow_private.teaches(e.offering_id))));
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['teachers','courses','curriculum','course_offerings','rooms','time_periods','routine_slots','teacher_availability'] LOOP
  EXECUTE format('CREATE POLICY signed_read ON public.%I FOR SELECT TO authenticated USING(deptflow_private.current_role() IS NOT NULL)',t);
 END LOOP;
END $$;
CREATE POLICY enrollment_scope ON public.enrollments FOR SELECT TO authenticated USING
 ((student_user_id=auth.uid() AND deptflow_private.current_role() IS NOT NULL) OR deptflow_private.teaches(offering_id));
CREATE POLICY session_scope ON public.class_sessions FOR SELECT TO authenticated USING
 (deptflow_private.teaches(offering_id) OR deptflow_private.enrolled(offering_id));
CREATE POLICY attendance_scope ON public.attendance_records FOR SELECT TO authenticated USING
 (EXISTS(SELECT 1 FROM public.enrollments e WHERE e.id=attendance_records.enrollment_id AND
 (e.student_user_id=auth.uid() OR deptflow_private.teaches(e.offering_id))));
CREATE POLICY exams_scope ON public.exams FOR SELECT TO authenticated USING
 (deptflow_private.enrolled(offering_id) OR deptflow_private.teaches(offering_id));
CREATE POLICY scores_scope ON public.exam_scores FOR SELECT TO authenticated USING
 (published_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.enrollments e WHERE e.id=exam_scores.enrollment_id
 AND (e.student_user_id=auth.uid() OR deptflow_private.teaches(e.offering_id))));
CREATE POLICY notice_scope ON public.notices FOR SELECT TO authenticated USING
 (deptflow_private.current_role() IS NOT NULL AND is_published AND (expires_at IS NULL OR expires_at>now())
 AND (target_term IS NULL OR EXISTS(SELECT 1 FROM public.students s WHERE s.user_id=auth.uid()
 AND s.term=notices.target_term AND (notices.target_session IS NULL OR s.session=notices.target_session)
 AND (notices.target_batch IS NULL OR s.batch=notices.target_batch))));
CREATE FUNCTION deptflow_private.invalidate_sessions() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.password_hash IS DISTINCT FROM OLD.password_hash OR NEW.role IS DISTINCT FROM OLD.role
 OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN NEW.session_version:=OLD.session_version+1; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER profile_session_version BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION deptflow_private.invalidate_sessions();
CREATE FUNCTION public.revoke_user_sessions(p_user_id uuid) RETURNS void LANGUAGE sql SET search_path='' AS $$
 UPDATE public.profiles SET session_version=session_version+1 WHERE user_id=p_user_id
$$;
CREATE FUNCTION public.consume_password_recovery(p_email text,p_token_hash text,p_password_hash text)
 RETURNS boolean LANGUAGE plpgsql SET search_path='' AS $$
DECLARE target uuid; BEGIN
 SELECT r.user_id INTO target FROM public.password_recovery_tokens r JOIN public.profiles p ON p.user_id=r.user_id
 WHERE lower(p.email)=lower(p_email) AND r.token_hash=p_token_hash AND r.expires_at>now()
 AND r.consumed_at IS NULL AND p.is_active FOR UPDATE OF r;
 IF target IS NULL THEN RETURN false; END IF;
 UPDATE public.password_recovery_tokens SET consumed_at=now() WHERE token_hash=p_token_hash;
 UPDATE public.profiles SET password_hash=p_password_hash WHERE user_id=target;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid),public.consume_password_recovery(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid),public.consume_password_recovery(text,text,text) TO service_role;
