CREATE UNIQUE INDEX class_offering_start ON public.class_sessions(offering_id,starts_at);
CREATE FUNCTION public.record_teacher_attendance(p_teacher uuid,p_offering uuid,p_starts timestamptz,p_room text,p_entries jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE item record; session_id uuid; enrollment_id uuid; course text; roll text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.course_offerings o JOIN public.profiles p ON p.user_id=o.teacher_user_id
 WHERE o.id=p_offering AND o.teacher_user_id=p_teacher AND o.is_active AND p.is_active AND upper(p.role) IN ('TEACHER','HEAD')) THEN
 RAISE EXCEPTION 'Teacher not assigned' USING ERRCODE='42501'; END IF;
 IF p_starts IS NULL OR jsonb_typeof(p_entries)<>'object' OR (SELECT count(*) FROM jsonb_each(p_entries))>500 THEN
 RAISE EXCEPTION 'Invalid attendance batch' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT * FROM jsonb_each_text(p_entries) LOOP
  IF item.value NOT IN ('PRESENT','ABSENT','LATE') OR NOT EXISTS(SELECT 1 FROM public.enrollments
   WHERE offering_id=p_offering AND student_user_id=item.key::uuid AND enrollment_status='ENROLLED') THEN
   RAISE EXCEPTION 'Valid status and active enrolment required' USING ERRCODE='22023'; END IF;
 END LOOP;
 INSERT INTO public.class_sessions(offering_id,room_number,starts_at,ends_at)
 VALUES(p_offering,p_room,p_starts,p_starts+interval '50 minutes') ON CONFLICT(offering_id,starts_at)
 DO UPDATE SET room_number=excluded.room_number RETURNING id INTO session_id;
 SELECT c.code INTO course FROM public.course_offerings o JOIN public.courses c ON c.id=o.course_id WHERE o.id=p_offering;
 FOR item IN SELECT * FROM jsonb_each_text(p_entries) LOOP
  SELECT e.id,s.roll_no INTO enrollment_id,roll FROM public.enrollments e JOIN public.students s ON s.user_id=e.student_user_id
   WHERE e.offering_id=p_offering AND e.student_user_id=item.key::uuid AND e.enrollment_status='ENROLLED';
  INSERT INTO public.attendance_records(session_id,enrollment_id,status,marked_by_teacher_user_id)
  VALUES(session_id,enrollment_id,item.value,p_teacher) ON CONFLICT ON CONSTRAINT attendance_records_session_id_enrollment_id_key
  DO UPDATE SET status=excluded.status,marked_by_teacher_user_id=excluded.marked_by_teacher_user_id,marked_at=now();
  INSERT INTO public.attendance(offering_id,course_code,student_roll,date,status)
  VALUES(p_offering,course,roll,(p_starts AT TIME ZONE 'Asia/Dhaka')::date,lower(item.value))
  ON CONFLICT(offering_id,student_roll,date) DO UPDATE SET status=excluded.status;
 END LOOP;
 RETURN session_id;
END $$;
REVOKE ALL ON FUNCTION public.record_teacher_attendance(uuid,uuid,timestamptz,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_teacher_attendance(uuid,uuid,timestamptz,text,jsonb) TO service_role;
