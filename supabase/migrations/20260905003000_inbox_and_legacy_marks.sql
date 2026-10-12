CREATE FUNCTION deptflow_private.notification_visible(n public.notifications) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT deptflow_private.current_role() IS NOT NULL AND (n.expires_at IS NULL OR n.expires_at>now()) AND
 CASE n.target_type
 WHEN 'ALL' THEN true
 WHEN 'USER' THEN n.target_value=auth.uid()::text
 WHEN 'TEACHER' THEN n.target_value=auth.uid()::text AND deptflow_private.current_role() IN ('TEACHER','HEAD')
 WHEN 'ROLE' THEN upper(n.target_value)=deptflow_private.current_role()
 WHEN 'YEAR_TERM' THEN EXISTS(SELECT 1 FROM public.students s WHERE s.user_id=auth.uid() AND s.term=n.target_value)
 WHEN 'SECTION' THEN EXISTS(SELECT 1 FROM public.students s WHERE s.user_id=auth.uid() AND s.section=n.target_value AND (n.target_year_term IS NULL OR n.target_year_term=s.term))
 WHEN 'COURSE' THEN EXISTS(SELECT 1 FROM public.course_offerings o JOIN public.courses c ON c.id=o.course_id
 WHERE (o.id::text=n.target_value OR c.code=n.target_value) AND (deptflow_private.enrolled(o.id) OR deptflow_private.teaches(o.id)))
 ELSE false END
$$;
REVOKE ALL ON FUNCTION deptflow_private.notification_visible(public.notifications) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION deptflow_private.notification_visible(public.notifications) TO authenticated,service_role;
GRANT SELECT ON public.notifications TO authenticated;
CREATE POLICY inbox_audience ON public.notifications FOR SELECT TO authenticated USING(deptflow_private.notification_visible(notifications));
GRANT SELECT,INSERT ON public.notification_reads TO authenticated;
CREATE POLICY read_owner ON public.notification_reads TO authenticated USING
 (user_id=auth.uid() AND deptflow_private.current_role() IS NOT NULL) WITH CHECK
 (user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.notifications n WHERE n.id=notification_id));
CREATE FUNCTION public.notification_unread_count() RETURNS bigint LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT count(*) FROM public.notifications n WHERE NOT EXISTS
 (SELECT 1 FROM public.notification_reads r WHERE r.notification_id=n.id AND r.user_id=auth.uid())
$$;
CREATE FUNCTION public.mark_all_notifications_read() RETURNS void LANGUAGE sql SET search_path='' AS $$
 INSERT INTO public.notification_reads(notification_id,user_id)
 SELECT id,auth.uid() FROM public.notifications ON CONFLICT(notification_id,user_id) DO NOTHING
$$;
REVOKE ALL ON FUNCTION public.notification_unread_count(),public.mark_all_notifications_read() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.notification_unread_count(),public.mark_all_notifications_read() TO authenticated;
CREATE FUNCTION deptflow_private.enqueue_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN INSERT INTO public.notification_push_outbox(notification_id) VALUES(NEW.id) ON CONFLICT(notification_id) DO NOTHING; RETURN NEW; END $$;
CREATE TRIGGER notification_outbox AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION deptflow_private.enqueue_notification();
CREATE TABLE public.exam_marks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offering_id uuid REFERENCES public.course_offerings(id),
 course_code text NOT NULL,student_roll text NOT NULL,exam_type text NOT NULL,
 marks numeric NOT NULL CHECK(marks>=0),total_marks numeric NOT NULL CHECK(total_marks>0 AND marks<=total_marks),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(offering_id,student_roll,exam_type)
);
ALTER TABLE public.exam_marks ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.exam_marks TO service_role;
GRANT SELECT ON public.exam_marks,public.attendance TO authenticated;
CREATE POLICY marks_scope ON public.exam_marks FOR SELECT TO authenticated USING
 (offering_id IS NOT NULL AND (deptflow_private.teaches(offering_id) OR EXISTS(SELECT 1 FROM public.students s
 WHERE s.user_id=auth.uid() AND s.roll_no=student_roll AND deptflow_private.enrolled(offering_id))));
CREATE POLICY legacy_attendance_scope ON public.attendance FOR SELECT TO authenticated USING
 (offering_id IS NOT NULL AND (deptflow_private.teaches(offering_id) OR EXISTS(SELECT 1 FROM public.students s
 WHERE s.user_id=auth.uid() AND s.roll_no=student_roll AND deptflow_private.enrolled(offering_id))));
