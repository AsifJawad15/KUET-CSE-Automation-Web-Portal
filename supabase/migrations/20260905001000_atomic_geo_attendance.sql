ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_session_id_enrollment_id_key UNIQUE(session_id,enrollment_id);
CREATE UNIQUE INDEX geo_attendance_one_submission ON public.geo_attendance_logs(geo_room_id,student_user_id);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS offering_id uuid REFERENCES public.course_offerings(id);
CREATE UNIQUE INDEX attendance_offering_roll_date ON public.attendance(offering_id,student_roll,date);
CREATE FUNCTION public.submit_geo_attendance(p_student uuid,p_room uuid,p_lat float8,p_lon float8,p_code text)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r public.geo_attendance_rooms; e public.enrollments; s public.students;
 lat float8; lon float8; distance float8; result_status text; course text; target_section text; roll_suffix integer; student_section text; BEGIN
 SELECT * INTO r FROM public.geo_attendance_rooms WHERE id=p_room FOR UPDATE;
 IF r.id IS NULL OR NOT r.is_active OR now()<r.start_time OR now()>=r.end_time THEN
  RAISE EXCEPTION 'Attendance room is not open' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=p_student AND is_active AND upper(role)='STUDENT') THEN
  RAISE EXCEPTION 'Student account unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM public.enrollments WHERE student_user_id=p_student AND offering_id=r.offering_id AND enrollment_status='ENROLLED';
 IF e.id IS NULL THEN RAISE EXCEPTION 'Active enrolment required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.course_offerings o JOIN public.profiles p ON p.user_id=o.teacher_user_id
 WHERE o.id=r.offering_id AND o.teacher_user_id=r.teacher_user_id AND o.is_active AND p.is_active AND upper(p.role) IN ('TEACHER','HEAD')) THEN
  RAISE EXCEPTION 'Attendance teacher or offering unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.students WHERE user_id=p_student;
 IF r.section IS NOT NULL THEN
  target_section:=upper(regexp_replace(trim(r.section),'^(section|group)[[:space:]]+','','i'));
  roll_suffix:=coalesce(substring(s.roll_no FROM '([0-9]{1,3})$')::integer,0);
  student_section:=coalesce(upper(s.section),CASE WHEN roll_suffix BETWEEN 1 AND 60 THEN 'A' WHEN roll_suffix BETWEEN 61 AND 120 THEN 'B' END);
  IF NOT coalesce((CASE target_section
   WHEN 'A' THEN student_section='A' WHEN 'B' THEN student_section='B'
   WHEN 'A1' THEN student_section='A' AND roll_suffix BETWEEN 1 AND 30
   WHEN 'A2' THEN student_section='A' AND roll_suffix BETWEEN 31 AND 60
   WHEN 'B1' THEN student_section='B' AND roll_suffix BETWEEN 61 AND 90
   WHEN 'B2' THEN student_section='B' AND roll_suffix BETWEEN 91 AND 120 ELSE false END),false) THEN
   RAISE EXCEPTION 'Student section or lab group does not match' USING ERRCODE='42501'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.geo_attendance_codes WHERE room_id=p_room AND code IS DISTINCT FROM p_code) THEN
  RAISE EXCEPTION 'Invalid verification code' USING ERRCODE='22023'; END IF;
 SELECT latitude,longitude INTO lat,lon FROM public.rooms WHERE room_number=r.room_number AND is_active;
 IF lat IS NULL OR lon IS NULL OR p_lat IS NULL OR p_lon IS NULL OR NOT(lat BETWEEN -90 AND 90) OR NOT(lon BETWEEN -180 AND 180)
 OR NOT(p_lat BETWEEN -90 AND 90) OR NOT(p_lon BETWEEN -180 AND 180) THEN
  RAISE EXCEPTION 'Valid room and student coordinates required' USING ERRCODE='22023'; END IF;
 distance:=6371000*2*asin(sqrt(least(1.0,power(sin(radians(p_lat-lat)/2),2)+cos(radians(lat))*cos(radians(p_lat))*power(sin(radians(p_lon-lon)/2),2))));
 IF distance>r.range_meters THEN RAISE EXCEPTION 'Outside attendance radius' USING ERRCODE='22023'; END IF;
 IF r.session_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.class_sessions WHERE id=r.session_id AND offering_id=r.offering_id) THEN
  RAISE EXCEPTION 'Class session does not match attendance offering' USING ERRCODE='22023'; END IF;
 SELECT c.code INTO course FROM public.course_offerings o JOIN public.courses c ON c.id=o.course_id WHERE o.id=r.offering_id;
 result_status:='PRESENT';
 INSERT INTO public.geo_attendance_logs(geo_room_id,student_user_id,latitude,longitude,distance_meters,status)
 VALUES(p_room,p_student,p_lat,p_lon,distance,result_status);
 INSERT INTO public.attendance_records(session_id,enrollment_id,status,marked_by_teacher_user_id)
 VALUES(r.session_id,e.id,result_status,r.teacher_user_id);
 INSERT INTO public.attendance(offering_id,course_code,student_roll,date,status,section_or_group)
 VALUES(r.offering_id,course,s.roll_no,(r.start_time AT TIME ZONE 'Asia/Dhaka')::date,lower(result_status),r.section)
 ON CONFLICT(offering_id,student_roll,date) DO UPDATE SET status=excluded.status,section_or_group=excluded.section_or_group;
 RETURN jsonb_build_object('success',true,'status',result_status,'distance_meters',distance);
END $$;
REVOKE ALL ON FUNCTION public.submit_geo_attendance(uuid,uuid,float8,float8,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_geo_attendance(uuid,uuid,float8,float8,text) TO service_role;
