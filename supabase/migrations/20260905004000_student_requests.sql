CREATE FUNCTION deptflow_private.cr_scope(p_offering uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.students s JOIN public.course_offerings o ON o.id=p_offering
 WHERE s.user_id=auth.uid() AND s.is_cr AND s.term=o.term AND s.session=o.session
 AND (o.section IS NULL OR s.section=o.section) AND deptflow_private.current_role()='STUDENT')
$$;
REVOKE ALL ON FUNCTION deptflow_private.cr_scope(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION deptflow_private.cr_scope(uuid) TO authenticated,service_role;
GRANT INSERT,UPDATE,DELETE ON public.exams TO authenticated;
CREATE POLICY cr_exam_write ON public.exams FOR INSERT TO authenticated WITH CHECK
 (created_by_student_user_id=auth.uid() AND deptflow_private.cr_scope(offering_id));
CREATE POLICY cr_exam_update ON public.exams FOR UPDATE TO authenticated USING
 (created_by_student_user_id=auth.uid() AND deptflow_private.cr_scope(offering_id)) WITH CHECK
 (created_by_student_user_id=auth.uid() AND deptflow_private.cr_scope(offering_id));
CREATE POLICY cr_exam_delete ON public.exams FOR DELETE TO authenticated USING
 (created_by_student_user_id=auth.uid() AND deptflow_private.cr_scope(offering_id));
GRANT SELECT,INSERT ON public.term_upgrade_requests TO authenticated;
CREATE POLICY term_request_owner ON public.term_upgrade_requests FOR SELECT TO authenticated
 USING(student_user_id=auth.uid() AND deptflow_private.current_role()='STUDENT');
CREATE POLICY term_request_insert ON public.term_upgrade_requests FOR INSERT TO authenticated WITH CHECK
 (student_user_id=auth.uid() AND status='pending' AND admin_user_id IS NULL AND admin_remarks IS NULL AND reviewed_at IS NULL
 AND EXISTS(SELECT 1 FROM public.students s WHERE s.user_id=auth.uid() AND s.term=current_term) AND deptflow_private.current_role()='STUDENT');
GRANT INSERT ON public.room_booking_requests TO authenticated;
CREATE POLICY teacher_booking_insert ON public.room_booking_requests FOR INSERT TO authenticated WITH CHECK
 (teacher_user_id=auth.uid() AND deptflow_private.teaches(offering_id) AND status='pending');
GRANT UPDATE(full_name,phone) ON public.students TO authenticated;
GRANT UPDATE(full_name,phone) ON public.teachers TO authenticated;
CREATE POLICY student_profile_update ON public.students FOR UPDATE TO authenticated USING
 (user_id=auth.uid() AND deptflow_private.current_role()='STUDENT') WITH CHECK(user_id=auth.uid());
CREATE POLICY teacher_profile_update ON public.teachers FOR UPDATE TO authenticated USING
 (user_id=auth.uid() AND deptflow_private.current_role() IN ('TEACHER','HEAD')) WITH CHECK(user_id=auth.uid());
