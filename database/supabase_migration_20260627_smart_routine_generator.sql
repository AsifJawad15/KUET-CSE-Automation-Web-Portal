-- Migration: Smart Routine Generator
-- Create constraint-aware routine recommendation system tables and seed data

-- 1. Time Periods Table
CREATE TABLE IF NOT EXISTS public.time_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  period_no integer NOT NULL UNIQUE,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_break boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT time_periods_pkey PRIMARY KEY (id)
);

-- Seed default periods 1 to 9 if empty
INSERT INTO public.time_periods (period_no, start_time, end_time, is_break, sort_order) VALUES
(1, '08:00:00', '08:50:00', false, 1),
(2, '08:50:00', '09:40:00', false, 2),
(3, '09:40:00', '10:30:00', false, 3),
(4, '10:40:00', '11:30:00', false, 4),
(5, '11:30:00', '12:20:00', false, 5),
(6, '12:20:00', '13:10:00', false, 6),
(7, '14:30:00', '15:20:00', false, 7),
(8, '15:20:00', '16:10:00', false, 8),
(9, '16:10:00', '17:00:00', false, 9)
ON CONFLICT (period_no) DO NOTHING;

-- 2. Routine Generation Jobs Table
CREATE TABLE IF NOT EXISTS public.routine_generation_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session text NOT NULL,
  year integer NOT NULL,
  term integer NOT NULL,
  section text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  requested_by uuid,
  constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text,
  best_score numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT routine_generation_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT routine_generation_jobs_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL
);

-- 3. Routine Drafts Table
CREATE TABLE IF NOT EXISTS public.routine_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  draft_name text NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  hard_conflict_count integer NOT NULL DEFAULT 0,
  soft_warning_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_selected boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT routine_drafts_pkey PRIMARY KEY (id),
  CONSTRAINT routine_drafts_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.routine_generation_jobs(id) ON DELETE CASCADE
);

-- 4. Routine Draft Slots Table
CREATE TABLE IF NOT EXISTS public.routine_draft_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL,
  course_offering_id uuid,
  course_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL,
  room_number text,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_period integer NOT NULL,
  end_period integer NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  year integer,
  term integer,
  section text,
  group_name text,
  course_type text,
  is_lab boolean NOT NULL DEFAULT false,
  is_combined boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  conflict_status text NOT NULL DEFAULT 'valid' CHECK (conflict_status IN ('valid', 'warning', 'conflict')),
  conflict_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT routine_draft_slots_pkey PRIMARY KEY (id),
  CONSTRAINT routine_draft_slots_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.routine_drafts(id) ON DELETE CASCADE,
  CONSTRAINT routine_draft_slots_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  CONSTRAINT routine_draft_slots_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE,
  CONSTRAINT routine_draft_slots_teacher_user_id_fkey FOREIGN KEY (teacher_user_id) REFERENCES public.teachers(user_id) ON DELETE CASCADE,
  CONSTRAINT routine_draft_slots_room_number_fkey FOREIGN KEY (room_number) REFERENCES public.rooms(room_number) ON DELETE CASCADE
);

-- 5. Teacher Availability Table
CREATE TABLE IF NOT EXISTS public.teacher_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_user_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_period integer NOT NULL,
  end_period integer NOT NULL,
  availability_type text NOT NULL CHECK (availability_type IN ('available', 'unavailable', 'preferred', 'not_preferred')),
  priority integer NOT NULL DEFAULT 1,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT teacher_availability_pkey PRIMARY KEY (id),
  CONSTRAINT teacher_availability_teacher_user_id_fkey FOREIGN KEY (teacher_user_id) REFERENCES public.teachers(user_id) ON DELETE CASCADE
);

-- 6. Course Schedule Requirements Table
CREATE TABLE IF NOT EXISTS public.course_schedule_requirements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session text NOT NULL,
  year integer NOT NULL,
  term integer NOT NULL,
  section text,
  course_id uuid NOT NULL,
  course_offering_id uuid,
  course_type text,
  required_theory_slots integer NOT NULL DEFAULT 0,
  required_lab_slots integer NOT NULL DEFAULT 0,
  lab_duration_periods integer NOT NULL DEFAULT 3,
  theory_duration_periods integer NOT NULL DEFAULT 1,
  needs_combined_section boolean NOT NULL DEFAULT false,
  lab_groups text[] NOT NULL DEFAULT '{}'::text[],
  preferred_room_type text,
  preferred_room_numbers text[] NOT NULL DEFAULT '{}'::text[],
  priority integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT course_schedule_requirements_pkey PRIMARY KEY (id),
  CONSTRAINT course_schedule_requirements_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE,
  CONSTRAINT course_schedule_requirements_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id) ON DELETE CASCADE
);

-- 7. Routine Constraints Table
CREATE TABLE IF NOT EXISTS public.routine_constraints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  constraint_key text NOT NULL UNIQUE,
  constraint_type text NOT NULL CHECK (constraint_type IN ('hard', 'soft')),
  weight integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT routine_constraints_pkey PRIMARY KEY (id)
);

-- Seed default constraints
INSERT INTO public.routine_constraints (constraint_key, constraint_type, weight, is_active, description) VALUES
('teacher_overlap', 'hard', 1, true, 'Same teacher cannot be scheduled in multiple overlapping slots'),
('room_overlap', 'hard', 1, true, 'Same room cannot be scheduled in multiple overlapping slots'),
('section_overlap', 'hard', 1, true, 'Same section cannot have multiple overlapping slots'),
('group_overlap', 'hard', 1, true, 'Same lab group cannot have multiple overlapping slots'),
('locked_slots', 'hard', 1, true, 'Existing routine slots in other batches/sections are locked and occupied'),
('room_type_match', 'hard', 1, true, 'Theory courses must use classroom/seminar rooms, lab courses must use lab rooms'),
('teacher_unavailability', 'hard', 1, true, 'Respect teacher unavailability schedules'),
('break_lunch_violation', 'hard', 1, true, 'No class can be scheduled across break or lunch intervals'),
('student_gap', 'soft', 5, true, 'Minimize gap periods for students in a single day'),
('teacher_gap', 'soft', 3, true, 'Minimize gap periods for teachers in a single day'),
('day_balance', 'soft', 4, true, 'Balance total scheduled periods across the days of the week'),
('consecutive_periods', 'soft', 10, true, 'Avoid scheduling more than 3 consecutive periods for any section or teacher'),
('morning_theory', 'soft', 2, true, 'Prefer scheduling theory classes in morning periods (periods 1-3)'),
('room_preference', 'soft', 5, true, 'Prefer course coordinator selected rooms'),
('last_period', 'soft', 4, true, 'Avoid scheduling classes in the last period of the day (period 9)'),
('course_day_spread', 'soft', 8, true, 'Avoid scheduling theory and lab of the same course on the same day')
ON CONFLICT (constraint_key) DO NOTHING;

-- 8. Routine Versions Table
CREATE TABLE IF NOT EXISTS public.routine_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session text NOT NULL,
  year integer NOT NULL,
  term integer NOT NULL,
  section text NOT NULL,
  source_draft_id uuid,
  published_by uuid,
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  change_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT routine_versions_pkey PRIMARY KEY (id),
  CONSTRAINT routine_versions_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL
);

-- 9. Create Indexes
CREATE INDEX IF NOT EXISTS idx_routine_draft_slots_draft_id ON public.routine_draft_slots(draft_id);
CREATE INDEX IF NOT EXISTS idx_routine_draft_slots_time ON public.routine_draft_slots(day_of_week, start_period, end_period);
CREATE INDEX IF NOT EXISTS idx_routine_draft_slots_room ON public.routine_draft_slots(room_number);
CREATE INDEX IF NOT EXISTS idx_teacher_availability_lookup ON public.teacher_availability(teacher_user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_course_schedule_reqs ON public.course_schedule_requirements(session, year, term, section);

-- 10. Enable Row Level Security (RLS) on new tables
ALTER TABLE public.time_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_draft_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_schedule_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_versions ENABLE ROW LEVEL SECURITY;

-- 11. Create policies to allow all operations via service role (admin/head operations are done in API routes)
CREATE POLICY "Service role full access on time_periods" ON public.time_periods USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on routine_generation_jobs" ON public.routine_generation_jobs USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on routine_drafts" ON public.routine_drafts USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on routine_draft_slots" ON public.routine_draft_slots USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on teacher_availability" ON public.teacher_availability USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on course_schedule_requirements" ON public.course_schedule_requirements USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on routine_constraints" ON public.routine_constraints USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on routine_versions" ON public.routine_versions USING (true) WITH CHECK (true);
