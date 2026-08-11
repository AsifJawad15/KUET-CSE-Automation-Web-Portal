-- Performance Indexes Migration
-- This migration adds performance indexes for foreign keys, composite query patterns, and lookups.

-- 1. Foreign Key Indexes to prevent sequential scans on joins and filters
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_enrollment_id ON public.attendance_records(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_marked_by_teacher ON public.attendance_records(marked_by_teacher_user_id);

CREATE INDEX IF NOT EXISTS idx_class_sessions_offering_id ON public.class_sessions(offering_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_room_number ON public.class_sessions(room_number);

CREATE INDEX IF NOT EXISTS idx_course_offerings_course_id ON public.course_offerings(course_id);
CREATE INDEX IF NOT EXISTS idx_course_offerings_teacher_user_id ON public.course_offerings(teacher_user_id);

CREATE INDEX IF NOT EXISTS idx_curriculum_course_id ON public.curriculum(course_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_offering_id ON public.enrollments(offering_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_user_id ON public.enrollments(student_user_id);

CREATE INDEX IF NOT EXISTS idx_exam_scores_exam_id ON public.exam_scores(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_scores_enrollment_id ON public.exam_scores(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_exams_offering_id ON public.exams(offering_id);
CREATE INDEX IF NOT EXISTS idx_exams_created_by_student ON public.exams(created_by_student_user_id);

CREATE INDEX IF NOT EXISTS idx_geo_attendance_logs_geo_room_id ON public.geo_attendance_logs(geo_room_id);
CREATE INDEX IF NOT EXISTS idx_geo_attendance_logs_student_user_id ON public.geo_attendance_logs(student_user_id);

CREATE INDEX IF NOT EXISTS idx_geo_attendance_rooms_offering_id ON public.geo_attendance_rooms(offering_id);
CREATE INDEX IF NOT EXISTS idx_geo_attendance_rooms_session_id ON public.geo_attendance_rooms(session_id);
CREATE INDEX IF NOT EXISTS idx_geo_attendance_rooms_teacher_user_id ON public.geo_attendance_rooms(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_geo_attendance_rooms_room_number ON public.geo_attendance_rooms(room_number);

CREATE INDEX IF NOT EXISTS idx_notices_author_user_id ON public.notices(author_user_id);

CREATE INDEX IF NOT EXISTS idx_optional_course_assignments_student ON public.optional_course_assignments(student_user_id);
CREATE INDEX IF NOT EXISTS idx_optional_course_assignments_offering ON public.optional_course_assignments(offering_id);
CREATE INDEX IF NOT EXISTS idx_optional_course_assignments_assigned_by ON public.optional_course_assignments(assigned_by);

CREATE INDEX IF NOT EXISTS idx_room_booking_requests_teacher ON public.room_booking_requests(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_room_booking_requests_offering ON public.room_booking_requests(offering_id);
CREATE INDEX IF NOT EXISTS idx_room_booking_requests_room ON public.room_booking_requests(room_number);

CREATE INDEX IF NOT EXISTS idx_routine_slots_offering_id ON public.routine_slots(offering_id);
CREATE INDEX IF NOT EXISTS idx_routine_slots_room_number ON public.routine_slots(room_number);

CREATE INDEX IF NOT EXISTS idx_term_upgrade_requests_student ON public.term_upgrade_requests(student_user_id);
CREATE INDEX IF NOT EXISTS idx_term_upgrade_requests_admin ON public.term_upgrade_requests(admin_user_id);

-- 2. Composite Indexes for conflict checking and scheduling queries (Highly frequent lookups)
-- routine_slots conflict check: (room_number, day_of_week, start_time, end_time)
CREATE INDEX IF NOT EXISTS idx_routine_slots_conflict ON public.routine_slots(room_number, day_of_week, start_time, end_time);

-- room_booking_requests conflict check: (room_number, booking_date, start_time, end_time)
CREATE INDEX IF NOT EXISTS idx_room_booking_requests_conflict ON public.room_booking_requests(room_number, booking_date, start_time, end_time);

-- cr_room_requests conflict check: (room_number, request_date, start_time, end_time)
CREATE INDEX IF NOT EXISTS idx_cr_room_requests_conflict ON public.cr_room_requests(room_number, request_date, start_time, end_time);

-- class_sessions date scope queries: (room_number, starts_at, ends_at)
CREATE INDEX IF NOT EXISTS idx_class_sessions_time_scope ON public.class_sessions(room_number, starts_at, ends_at);

-- notices target audience & publication: (is_published, target_term, target_session, target_batch)
CREATE INDEX IF NOT EXISTS idx_notices_targeting ON public.notices(is_published, target_term, target_session, target_batch);
