-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admins (
  user_id uuid NOT NULL,
  admin_uid text NOT NULL DEFAULT ('A-'::text || substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10)) UNIQUE,
  full_name text NOT NULL,
  phone text,
  permissions jsonb DEFAULT '{"all": true}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admins_pkey PRIMARY KEY (user_id),
  CONSTRAINT admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_code text NOT NULL,
  student_roll text NOT NULL,
  date date NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text])),
  section_or_group text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id)
);
CREATE TABLE public.attendance_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  status USER-DEFINED NOT NULL,
  marked_by_teacher_user_id uuid,
  remarks text,
  marked_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attendance_records_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.class_sessions(id),
  CONSTRAINT attendance_records_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id),
  CONSTRAINT attendance_records_marked_by_teacher_user_id_fkey FOREIGN KEY (marked_by_teacher_user_id) REFERENCES public.teachers(user_id)
);
CREATE TABLE public.class_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL,
  room_number text,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  topic text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT class_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT class_sessions_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id),
  CONSTRAINT class_sessions_room_number_fkey FOREIGN KEY (room_number) REFERENCES public.rooms(room_number)
);
CREATE TABLE public.cms_tv_announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT ''::text,
  type text NOT NULL DEFAULT 'notice'::text CHECK (type = ANY (ARRAY['notice'::text, 'class-test'::text, 'assignment'::text, 'lab-test'::text, 'quiz'::text, 'event'::text, 'other'::text])),
  course_code text,
  priority text NOT NULL DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  scheduled_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL DEFAULT 'Admin'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  target text NOT NULL DEFAULT 'all'::text,
  CONSTRAINT cms_tv_announcements_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_tv_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_tv_devices_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_tv_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  description text,
  image_url text,
  speaker_name text,
  speaker_image_url text,
  event_date date,
  event_time text,
  location text,
  badge_text text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  target text NOT NULL DEFAULT 'all'::text,
  CONSTRAINT cms_tv_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_tv_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT ''::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_tv_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_tv_ticker (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'SPECIAL UPDATE'::text,
  text text NOT NULL,
  type text NOT NULL DEFAULT 'notice'::text CHECK (type = ANY (ARRAY['notice'::text, 'class-test'::text, 'assignment'::text, 'lab-test'::text, 'quiz'::text, 'event'::text, 'other'::text])),
  course_code text,
  announcement_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  target text NOT NULL DEFAULT 'all'::text,
  CONSTRAINT cms_tv_ticker_pkey PRIMARY KEY (id),
  CONSTRAINT cms_tv_ticker_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.cms_tv_announcements(id)
);
CREATE TABLE public.course_offerings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL,
  term text NOT NULL CHECK (term ~ '^[1-4]-[1-2]$'::text),
  session text NOT NULL,
  batch text,
  academic_year text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT course_offerings_pkey PRIMARY KEY (id),
  CONSTRAINT course_offerings_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_offerings_teacher_user_id_fkey FOREIGN KEY (teacher_user_id) REFERENCES public.teachers(user_id)
);
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code = upper(code)),
  title text NOT NULL,
  credit numeric NOT NULL CHECK (credit > 0::numeric),
  course_type text DEFAULT 'Theory'::text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT courses_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cr_room_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  course_code text NOT NULL,
  teacher_user_id uuid NOT NULL,
  room_number text,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  term text NOT NULL,
  session text NOT NULL,
  section text,
  reason text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  admin_remarks text,
  admin_user_id uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  request_date date NOT NULL,
  CONSTRAINT cr_room_requests_pkey PRIMARY KEY (id),
  CONSTRAINT cr_room_requests_student_user_id_fkey FOREIGN KEY (student_user_id) REFERENCES public.students(user_id),
  CONSTRAINT cr_room_requests_teacher_user_id_fkey FOREIGN KEY (teacher_user_id) REFERENCES public.teachers(user_id),
  CONSTRAINT cr_room_requests_room_number_fkey FOREIGN KEY (room_number) REFERENCES public.rooms(room_number),
  CONSTRAINT cr_room_requests_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admins(user_id)
);
CREATE TABLE public.curriculum (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  term text NOT NULL CHECK (term ~ '^[1-4]-[1-2]$'::text),
  course_id uuid NOT NULL,
  syllabus_year text DEFAULT '2024'::text,
  is_elective boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  elective_group text CHECK (elective_group IS NULL OR (elective_group = ANY (ARRAY['OPTIONAL_I'::text, 'OPTIONAL_II'::text, 'OPTIONAL_III'::text]))),
  CONSTRAINT curriculum_pkey PRIMARY KEY (id),
  CONSTRAINT curriculum_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.device_push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform = ANY (ARRAY['android'::text, 'ios'::text, 'web'::text])),
  provider text NOT NULL DEFAULT 'onesignal'::text,
  token text NOT NULL,
  app_version text,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT device_push_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT device_push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL,
  student_user_id uuid NOT NULL,
  enrollment_status text DEFAULT 'ENROLLED'::text,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT enrollments_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id),
  CONSTRAINT enrollments_student_user_id_fkey FOREIGN KEY (student_user_id) REFERENCES public.students(user_id)
);
CREATE TABLE public.exam_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  obtained_marks numeric NOT NULL CHECK (obtained_marks >= 0::numeric),
  remarks text,
  published_at timestamp with time zone,
  CONSTRAINT exam_scores_pkey PRIMARY KEY (id),
  CONSTRAINT exam_scores_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id),
  CONSTRAINT exam_scores_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id)
);
CREATE TABLE public.exams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL,
  name text NOT NULL,
  exam_type text NOT NULL,
  max_marks numeric NOT NULL CHECK (max_marks > 0::numeric),
  exam_date date,
  exam_time time without time zone,
  duration_minutes integer,
  room_numbers ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  syllabus text,
  section text,
  created_by_student_user_id uuid,
  CONSTRAINT exams_pkey PRIMARY KEY (id),
  CONSTRAINT exams_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id),
  CONSTRAINT exams_created_by_student_user_id_fkey FOREIGN KEY (created_by_student_user_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.geo_attendance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  geo_room_id uuid NOT NULL,
  student_user_id uuid NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  distance_meters double precision NOT NULL,
  status text NOT NULL DEFAULT 'PRESENT'::text CHECK (status = ANY (ARRAY['PRESENT'::text, 'LATE'::text])),
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT geo_attendance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT geo_attendance_logs_room_fkey FOREIGN KEY (geo_room_id) REFERENCES public.geo_attendance_rooms(id),
  CONSTRAINT geo_attendance_logs_student_fkey FOREIGN KEY (student_user_id) REFERENCES public.students(user_id)
);
CREATE TABLE public.geo_attendance_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL,
  session_id uuid,
  teacher_user_id uuid NOT NULL,
  room_number text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  section text,
  CONSTRAINT geo_attendance_rooms_pkey PRIMARY KEY (id),
  CONSTRAINT geo_attendance_rooms_session_fkey FOREIGN KEY (session_id) REFERENCES public.class_sessions(id),
  CONSTRAINT geo_attendance_rooms_teacher_fkey FOREIGN KEY (teacher_user_id) REFERENCES public.teachers(user_id),
  CONSTRAINT geo_attendance_rooms_offering_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id)
);
CREATE TABLE public.notices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  author_user_id uuid,
  target_term text,
  target_session text,
  target_batch text,
  priority text DEFAULT 'NORMAL'::text,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notices_pkey PRIMARY KEY (id),
  CONSTRAINT notices_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.notification_push_outbox (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text])),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_push_outbox_pkey PRIMARY KEY (id),
  CONSTRAINT notification_push_outbox_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id)
);
CREATE TABLE public.notification_reads (
  notification_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_reads_pkey PRIMARY KEY (notification_id, user_id),
  CONSTRAINT notification_reads_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id),
  CONSTRAINT notification_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  icon text,
  target_type text NOT NULL DEFAULT 'USER'::text,
  target_value text,
  target_year_term text,
  created_by uuid,
  created_by_role text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.optional_course_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  offering_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT optional_course_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT oca_student_fkey FOREIGN KEY (student_user_id) REFERENCES public.students(user_id),
  CONSTRAINT oca_offering_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id),
  CONSTRAINT oca_admin_fkey FOREIGN KEY (assigned_by) REFERENCES public.admins(user_id)
);
CREATE TABLE public.profiles (
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  role USER-DEFINED NOT NULL,
  email text NOT NULL UNIQUE CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text),
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.room_booking_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_user_id uuid NOT NULL,
  offering_id uuid NOT NULL,
  room_number text NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_period text NOT NULL,
  end_period text NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  section text,
  purpose text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  requested_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  booking_date date NOT NULL,
  CONSTRAINT room_booking_requests_pkey PRIMARY KEY (id),
  CONSTRAINT rbr_teacher_fkey FOREIGN KEY (teacher_user_id) REFERENCES public.teachers(user_id),
  CONSTRAINT rbr_offering_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id),
  CONSTRAINT rbr_room_fkey FOREIGN KEY (room_number) REFERENCES public.rooms(room_number)
);
CREATE TABLE public.rooms (
  room_number text NOT NULL,
  building_name text,
  capacity integer CHECK (capacity > 0),
  room_type text,
  facilities ARRAY,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT rooms_pkey PRIMARY KEY (room_number)
);
CREATE TABLE public.routine_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL,
  room_number text,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  rrule text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  section text,
  valid_from date,
  valid_until date,
  CONSTRAINT routine_slots_pkey PRIMARY KEY (id),
  CONSTRAINT routine_slots_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id),
  CONSTRAINT routine_slots_room_number_fkey FOREIGN KEY (room_number) REFERENCES public.rooms(room_number)
);
CREATE TABLE public.students (
  user_id uuid NOT NULL,
  roll_no text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text NOT NULL,
  term text NOT NULL CHECK (term ~ '^[1-4]-[1-2]$'::text),
  session text NOT NULL,
  batch text,
  section text,
  cgpa numeric DEFAULT 0.00 CHECK (cgpa >= 0::numeric AND cgpa <= 4.00),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_cr boolean DEFAULT false,
  CONSTRAINT students_pkey PRIMARY KEY (user_id),
  CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.teachers (
  user_id uuid NOT NULL,
  teacher_uid text NOT NULL DEFAULT ('T-'::text || substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10)) UNIQUE,
  full_name text NOT NULL,
  phone text NOT NULL,
  designation USER-DEFINED NOT NULL DEFAULT 'LECTURER'::teacher_designation,
  department text DEFAULT 'CSE'::text,
  office_room text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  room_no smallint,
  date_of_join date,
  is_on_leave boolean NOT NULL DEFAULT false,
  leave_reason text,
  CONSTRAINT teachers_pkey PRIMARY KEY (user_id),
  CONSTRAINT teachers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.term_upgrade_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  current_term text NOT NULL CHECK (current_term ~ '^[1-4]-[1-2]$'::text),
  requested_term text NOT NULL CHECK (requested_term ~ '^[1-4]-[1-2]$'::text),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  reason text,
  admin_user_id uuid,
  admin_remarks text,
  requested_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT term_upgrade_requests_pkey PRIMARY KEY (id),
  CONSTRAINT term_upgrade_requests_student_user_id_fkey FOREIGN KEY (student_user_id) REFERENCES public.students(user_id),
  CONSTRAINT term_upgrade_requests_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admins(user_id)
);