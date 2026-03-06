-- ============================================
-- Geo-Attendance System - Database Setup
-- "Open Room" feature for proximity-based attendance
-- ============================================
-- KUET CSE Building Location: 22.8993°N, 89.5023°E
-- Radius: 200 meters
-- ============================================

-- Table: geo_attendance_rooms
-- Tracks when a teacher "opens" a room for geo-based attendance
CREATE TABLE IF NOT EXISTS public.geo_attendance_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL,
  session_id uuid, -- linked class_session (created when room opens)
  teacher_user_id uuid NOT NULL,
  room_number text,
  section text, -- e.g. 'Section A (01–60)', 'Group B1 (61–90)'
  date date NOT NULL DEFAULT CURRENT_DATE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT geo_attendance_rooms_pkey PRIMARY KEY (id),
  CONSTRAINT geo_attendance_rooms_offering_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  CONSTRAINT geo_attendance_rooms_session_fkey FOREIGN KEY (session_id) REFERENCES public.class_sessions(id) ON DELETE SET NULL,
  CONSTRAINT geo_attendance_rooms_teacher_fkey FOREIGN KEY (teacher_user_id) REFERENCES public.teachers(user_id),
  CONSTRAINT geo_attendance_rooms_time_check CHECK (end_time > start_time)
);

-- Table: geo_attendance_logs
-- Records each student's geo-attendance submission
CREATE TABLE IF NOT EXISTS public.geo_attendance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  geo_room_id uuid NOT NULL,
  student_user_id uuid NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  distance_meters double precision NOT NULL,
  status text NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'LATE')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT geo_attendance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT geo_attendance_logs_room_fkey FOREIGN KEY (geo_room_id) REFERENCES public.geo_attendance_rooms(id) ON DELETE CASCADE,
  CONSTRAINT geo_attendance_logs_student_fkey FOREIGN KEY (student_user_id) REFERENCES public.students(user_id) ON DELETE CASCADE,
  CONSTRAINT geo_attendance_logs_unique UNIQUE (geo_room_id, student_user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_geo_rooms_offering ON public.geo_attendance_rooms(offering_id);
CREATE INDEX IF NOT EXISTS idx_geo_rooms_teacher ON public.geo_attendance_rooms(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_geo_rooms_active ON public.geo_attendance_rooms(is_active, date);
CREATE INDEX IF NOT EXISTS idx_geo_rooms_date ON public.geo_attendance_rooms(date);
CREATE INDEX IF NOT EXISTS idx_geo_logs_room ON public.geo_attendance_logs(geo_room_id);
CREATE INDEX IF NOT EXISTS idx_geo_logs_student ON public.geo_attendance_logs(student_user_id);

-- Enable RLS
ALTER TABLE public.geo_attendance_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_attendance_logs ENABLE ROW LEVEL SECURITY;

-- Development policies (replace with proper role-based policies in production)
CREATE POLICY "dev_all_geo_rooms" ON public.geo_attendance_rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all_geo_logs" ON public.geo_attendance_logs FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Function: Auto-close expired geo rooms
-- Runs periodically to deactivate rooms past their end_time
-- ============================================
CREATE OR REPLACE FUNCTION close_expired_geo_rooms()
RETURNS void AS $$
BEGIN
  UPDATE public.geo_attendance_rooms
  SET is_active = false
  WHERE is_active = true AND end_time <= now();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Geo-Attendance tables created!';
  RAISE NOTICE '📍 Building location: 22.8993°N, 89.5023°E';
  RAISE NOTICE '📏 Attendance radius: 200 meters';
  RAISE NOTICE '🏫 geo_attendance_rooms: Teacher opens/closes room';
  RAISE NOTICE '📝 geo_attendance_logs: Student attendance submissions';
END $$;
