-- ============================================
-- Create the 'attendance' table for teacher portal
-- Run this in the Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_code text NOT NULL,
  student_roll text NOT NULL,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  section_or_group text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_unique_record UNIQUE (course_code, student_roll, date)
);

-- Index for fast lookups by course
CREATE INDEX IF NOT EXISTS idx_attendance_course_code ON public.attendance(course_code);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(course_code, date);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated + anon users (matches existing app pattern)
CREATE POLICY "Allow all access to attendance" ON public.attendance
  FOR ALL USING (true) WITH CHECK (true);
