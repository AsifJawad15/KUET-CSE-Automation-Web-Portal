-- Database-enforced serialization covers every booking writer.
CREATE FUNCTION deptflow_private.check_room_booking() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE booking_day date; BEGIN
 IF NEW.status<>'approved' THEN RETURN NEW; END IF;
 booking_day:=CASE WHEN TG_TABLE_NAME='cr_room_requests' THEN (to_jsonb(NEW)->>'request_date')::date ELSE (to_jsonb(NEW)->>'booking_date')::date END;
 IF NEW.start_time>=NEW.end_time THEN RAISE EXCEPTION 'Invalid booking interval' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(NEW.room_number),hashtext(booking_day::text));
 IF EXISTS(SELECT 1 FROM public.admin_direct_bookings b WHERE b.status='approved' AND b.room_number=NEW.room_number AND b.booking_date=booking_day
 AND (TG_TABLE_NAME<>'admin_direct_bookings' OR b.id<>NEW.id) AND b.start_time<NEW.end_time AND NEW.start_time<b.end_time)
 OR EXISTS(SELECT 1 FROM public.room_booking_requests b WHERE b.status='approved' AND b.room_number=NEW.room_number AND b.booking_date=booking_day
 AND (TG_TABLE_NAME<>'room_booking_requests' OR b.id<>NEW.id) AND b.start_time<NEW.end_time AND NEW.start_time<b.end_time)
 OR EXISTS(SELECT 1 FROM public.cr_room_requests b WHERE b.status='approved' AND b.room_number=NEW.room_number AND b.request_date=booking_day
 AND (TG_TABLE_NAME<>'cr_room_requests' OR b.id<>NEW.id) AND b.start_time<NEW.end_time AND NEW.start_time<b.end_time)
 OR EXISTS(SELECT 1 FROM public.routine_slots b WHERE b.room_number=NEW.room_number AND b.day_of_week=extract(dow FROM booking_day)::integer
 AND (b.valid_from IS NULL OR b.valid_from<=booking_day) AND (b.valid_until IS NULL OR b.valid_until>=booking_day)
 AND b.start_time<NEW.end_time AND NEW.start_time<b.end_time) THEN
 RAISE EXCEPTION 'Room already booked' USING ERRCODE='23P01'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['admin_direct_bookings','room_booking_requests','cr_room_requests'] LOOP
 EXECUTE format('CREATE TRIGGER room_booking_conflict BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION deptflow_private.check_room_booking()',t);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.device_push_tokens TO authenticated;
CREATE POLICY device_owner ON public.device_push_tokens TO authenticated
 USING(user_id=auth.uid() AND deptflow_private.current_role() IS NOT NULL)
 WITH CHECK(user_id=auth.uid() AND deptflow_private.current_role() IS NOT NULL);
CREATE UNIQUE INDEX device_push_identity ON public.device_push_tokens(user_id,platform,token);
CREATE UNIQUE INDEX device_push_unique_token ON public.device_push_tokens(token);
GRANT SELECT ON public.geo_attendance_rooms,public.geo_attendance_logs,public.geo_attendance_codes,
 public.room_booking_requests,public.cr_room_requests,public.admin_direct_bookings,public.optional_course_assignments TO authenticated;
CREATE POLICY geo_room_scope ON public.geo_attendance_rooms FOR SELECT TO authenticated
 USING(deptflow_private.enrolled(offering_id) OR deptflow_private.teaches(offering_id));
CREATE POLICY geo_log_scope ON public.geo_attendance_logs FOR SELECT TO authenticated USING
 (student_user_id=auth.uid() AND deptflow_private.current_role() IS NOT NULL OR EXISTS
 (SELECT 1 FROM public.geo_attendance_rooms r WHERE r.id=geo_room_id AND deptflow_private.teaches(r.offering_id)));
CREATE POLICY geo_code_teacher ON public.geo_attendance_codes FOR SELECT TO authenticated USING
 (EXISTS(SELECT 1 FROM public.geo_attendance_rooms r WHERE r.id=room_id AND deptflow_private.teaches(r.offering_id)));
CREATE POLICY teacher_booking_read ON public.room_booking_requests FOR SELECT TO authenticated USING
 (teacher_user_id=auth.uid() AND deptflow_private.current_role() IS NOT NULL);
CREATE POLICY cr_booking_read ON public.cr_room_requests FOR SELECT TO authenticated USING
 ((student_user_id=auth.uid() OR teacher_user_id=auth.uid()) AND deptflow_private.current_role() IS NOT NULL);
CREATE POLICY reservation_read ON public.admin_direct_bookings FOR SELECT TO authenticated USING
 (deptflow_private.current_role() IS NOT NULL);
CREATE POLICY optional_own ON public.optional_course_assignments FOR SELECT TO authenticated USING
 ((student_user_id=auth.uid() AND deptflow_private.current_role() IS NOT NULL) OR deptflow_private.teaches(offering_id));
