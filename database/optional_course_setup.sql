-- ============================================================
-- Optional Course Allocation Feature — Database Setup
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add elective_group column to curriculum table
ALTER TABLE public.curriculum
  ADD COLUMN IF NOT EXISTS elective_group text
    CHECK (elective_group IS NULL OR elective_group IN ('OPTIONAL_I', 'OPTIONAL_II', 'OPTIONAL_III'));

-- 2. Create optional_course_assignments table
CREATE TABLE IF NOT EXISTS public.optional_course_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  offering_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT optional_course_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT oca_student_fkey FOREIGN KEY (student_user_id) REFERENCES public.students(user_id) ON DELETE CASCADE,
  CONSTRAINT oca_offering_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  CONSTRAINT oca_admin_fkey FOREIGN KEY (assigned_by) REFERENCES public.admins(user_id),
  CONSTRAINT oca_unique_assignment UNIQUE (student_user_id, offering_id)
);

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_oca_student ON public.optional_course_assignments(student_user_id);
CREATE INDEX IF NOT EXISTS idx_oca_offering ON public.optional_course_assignments(offering_id);

-- 4. RLS policies
ALTER TABLE public.optional_course_assignments ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY oca_admin_all ON public.optional_course_assignments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Students can read their own assignments
CREATE POLICY oca_student_select ON public.optional_course_assignments
  FOR SELECT
  USING (student_user_id = auth.uid());

-- 5. Insert all 4th Year 1st Term (4-1) courses
INSERT INTO public.courses (code, title, credit, course_type, description) VALUES
  -- Mandatory 4-1 courses
  ('CSE 4000', 'Capstone Project/Thesis', 1.50, 'Lab', 'Capstone project or thesis (evaluated at end of 4-2)'),
  ('CSE 4101', 'Computer Graphics and Image Processing', 3.00, 'Theory', 'Computer graphics and image processing fundamentals'),
  ('CSE 4102', 'Computer Graphics and Image Processing Laboratory', 0.75, 'Lab', 'Lab for CSE 4101'),
  ('CSE 4105', 'Computer Networks', 3.00, 'Theory', 'Computer networking fundamentals'),
  ('CSE 4106', 'Computer Networks Laboratory', 1.50, 'Lab', 'Lab for CSE 4105'),
  ('CSE 4115', 'Computer Security', 3.00, 'Theory', 'Computer security principles'),
  ('CSE 4116', 'Computer Security Laboratory', 0.75, 'Lab', 'Lab for CSE 4115'),
  -- Optional-I courses
  ('CSE 4103', 'VLSI Design', 3.00, 'Theory', 'VLSI design fundamentals'),
  ('CSE 4104', 'VLSI Design Laboratory', 0.75, 'Lab', 'Lab for CSE 4103'),
  ('CSE 4107', 'Digital Signal Processing', 3.00, 'Theory', 'Digital signal processing theory'),
  ('CSE 4108', 'Digital Signal Processing Laboratory', 0.75, 'Lab', 'Lab for CSE 4107'),
  ('CSE 4111', 'Machine Learning', 3.00, 'Theory', 'Machine learning algorithms and applications'),
  ('CSE 4112', 'Machine Learning Laboratory', 0.75, 'Lab', 'Lab for CSE 4111'),
  ('CSE 4117', 'Modeling and Simulation', 3.00, 'Theory', 'Modeling and simulation techniques'),
  ('CSE 4118', 'Modeling and Simulation Laboratory', 0.75, 'Lab', 'Lab for CSE 4117'),
  ('CSE 4121', 'Natural Language Processing', 3.00, 'Theory', 'NLP fundamentals and applications'),
  ('CSE 4122', 'Natural Language Processing Laboratory', 0.75, 'Lab', 'Lab for CSE 4121'),
  ('CSE 4129', 'Ubiquitous Computing', 3.00, 'Theory', 'Ubiquitous computing concepts'),
  ('CSE 4130', 'Ubiquitous Computing Laboratory', 0.75, 'Lab', 'Lab for CSE 4129'),
  ('CSE 4131', 'Pattern Recognition', 3.00, 'Theory', 'Pattern recognition theory'),
  ('CSE 4132', 'Pattern Recognition Laboratory', 0.75, 'Lab', 'Lab for CSE 4131')
ON CONFLICT (code) DO NOTHING;

-- 6. Insert all 4th Year 2nd Term (4-2) courses
INSERT INTO public.courses (code, title, credit, course_type, description) VALUES
  -- Mandatory 4-2 courses
  ('IEM 4227', 'Industrial Management', 3.00, 'Theory', 'Industrial management principles'),
  ('HUM 4207', 'Entrepreneurship Development', 2.00, 'Theory', 'Entrepreneurship development'),
  -- Optional-II courses
  ('CSE 4211', 'Algorithm Engineering', 3.00, 'Theory', 'Advanced algorithm engineering'),
  ('CSE 4213', 'Fault Tolerant System', 3.00, 'Theory', 'Fault tolerant system design'),
  ('CSE 4215', 'E-Commerce', 3.00, 'Theory', 'E-commerce systems'),
  ('CSE 4219', 'Distributed Database Systems', 3.00, 'Theory', 'Distributed database systems'),
  ('CSE 4227', 'Human Computer Interaction', 3.00, 'Theory', 'HCI principles and design'),
  ('CSE 4229', 'Digital Forensic', 3.00, 'Theory', 'Digital forensics techniques'),
  ('CSE 4231', 'Control Systems Engineering', 3.00, 'Theory', 'Control systems engineering'),
  ('CSE 4233', 'Robotics', 3.00, 'Theory', 'Robotics fundamentals'),
  ('CSE 4235', 'Multimedia Technology', 3.00, 'Theory', 'Multimedia technology'),
  ('CSE 4237', 'Computational Geometry', 3.00, 'Theory', 'Computational geometry'),
  ('CSE 4239', 'Data Mining', 3.00, 'Theory', 'Data mining techniques'),
  ('CSE 4241', 'Biomedical Engineering', 3.00, 'Theory', 'Biomedical engineering basics'),
  ('CSE 4243', 'Parallel and Distributed Processing', 3.00, 'Theory', 'Parallel and distributed processing'),
  ('CSE 4245', 'Principles of Programming Languages', 3.00, 'Theory', 'Programming language principles'),
  ('CSE 4247', 'Graph Theory', 3.00, 'Theory', 'Graph theory'),
  ('CSE 4249', 'Bioinformatics', 3.00, 'Theory', 'Bioinformatics'),
  ('CSE 4251', 'Software Architecture', 3.00, 'Theory', 'Software architecture design'),
  -- Optional-III courses
  ('CSE 4203', 'Peripherals and Interfacing', 3.00, 'Theory', 'Peripherals and interfacing'),
  ('CSE 4204', 'Peripherals and Interfacing Laboratory', 0.75, 'Lab', 'Lab for CSE 4203'),
  ('CSE 4217', 'Computer Vision', 3.00, 'Theory', 'Computer vision'),
  ('CSE 4218', 'Computer Vision Laboratory', 0.75, 'Lab', 'Lab for CSE 4217'),
  ('CSE 4221', 'High Performance Computing', 3.00, 'Theory', 'High performance computing'),
  ('CSE 4222', 'High Performance Computing Laboratory', 0.75, 'Lab', 'Lab for CSE 4221'),
  ('CSE 4223', 'Digital System Design', 3.00, 'Theory', 'Digital system design'),
  ('CSE 4224', 'Digital System Design Laboratory', 0.75, 'Lab', 'Lab for CSE 4223'),
  ('CSE 4225', 'Real-time Embedded Systems', 3.00, 'Theory', 'Real-time embedded systems'),
  ('CSE 4226', 'Real-time Embedded Systems Laboratory', 0.75, 'Lab', 'Lab for CSE 4225')
ON CONFLICT (code) DO NOTHING;

-- 7. Insert curriculum entries for 4-1 (mandatory courses)
INSERT INTO public.curriculum (term, course_id, syllabus_year, is_elective, elective_group)
SELECT '4-1', id, '2024', false, NULL FROM public.courses WHERE code IN (
  'CSE 4000', 'CSE 4101', 'CSE 4102', 'CSE 4105', 'CSE 4106', 'CSE 4115', 'CSE 4116'
)
ON CONFLICT DO NOTHING;

-- 8. Insert curriculum entries for 4-1 (Optional-I courses)
INSERT INTO public.curriculum (term, course_id, syllabus_year, is_elective, elective_group)
SELECT '4-1', id, '2024', true, 'OPTIONAL_I' FROM public.courses WHERE code IN (
  'CSE 4103', 'CSE 4104', 'CSE 4107', 'CSE 4108', 'CSE 4111', 'CSE 4112',
  'CSE 4117', 'CSE 4118', 'CSE 4121', 'CSE 4122', 'CSE 4129', 'CSE 4130',
  'CSE 4131', 'CSE 4132'
)
ON CONFLICT DO NOTHING;

-- 9. Insert curriculum entries for 4-2 (mandatory courses)
INSERT INTO public.curriculum (term, course_id, syllabus_year, is_elective, elective_group)
SELECT '4-2', id, '2024', false, NULL FROM public.courses WHERE code IN (
  'CSE 4000', 'IEM 4227', 'HUM 4207'
)
ON CONFLICT DO NOTHING;

-- 10. Insert curriculum entries for 4-2 (Optional-II courses)
INSERT INTO public.curriculum (term, course_id, syllabus_year, is_elective, elective_group)
SELECT '4-2', id, '2024', true, 'OPTIONAL_II' FROM public.courses WHERE code IN (
  'CSE 4211', 'CSE 4213', 'CSE 4215', 'CSE 4219', 'CSE 4227', 'CSE 4229',
  'CSE 4231', 'CSE 4233', 'CSE 4235', 'CSE 4237', 'CSE 4239', 'CSE 4241',
  'CSE 4243', 'CSE 4245', 'CSE 4247', 'CSE 4249', 'CSE 4251'
)
ON CONFLICT DO NOTHING;

-- 11. Insert curriculum entries for 4-2 (Optional-III courses)
INSERT INTO public.curriculum (term, course_id, syllabus_year, is_elective, elective_group)
SELECT '4-2', id, '2024', true, 'OPTIONAL_III' FROM public.courses WHERE code IN (
  'CSE 4203', 'CSE 4204', 'CSE 4217', 'CSE 4218', 'CSE 4221', 'CSE 4222',
  'CSE 4223', 'CSE 4224', 'CSE 4225', 'CSE 4226'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- DONE! Run optional_course_test_data.sql next for dummy data.
-- ============================================================
