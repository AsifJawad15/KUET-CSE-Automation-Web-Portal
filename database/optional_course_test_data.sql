-- ============================================================
-- Optional Course Allocation — Test Data
-- Run this AFTER optional_course_setup.sql
-- ============================================================
-- Test Credentials:
--   Student (sakib): sakib2007020@stud.kuet.ac.bd / 2007020
--   Other students:  student2007001@stud.kuet.ac.bd / student123
--                    student2007002@stud.kuet.ac.bd / student123
--                    student2007061@stud.kuet.ac.bd / student123
--                    student2007062@stud.kuet.ac.bd / student123
-- ============================================================

-- ── 1. Test Teacher ─────────────────────────────────────────

INSERT INTO public.profiles (user_id, role, email, password_hash)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'TEACHER',
  'teacher.optional@cse.kuet.ac.bd',
  '$2b$10$WNBgYFVA5cGm4pp/5TrnaOfSEPWHrDdwq08WI8Ib1fN5iFgSCI2iW' -- student123
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.teachers (user_id, teacher_uid, full_name, phone, designation, department)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'T-OPT-TEST01',
  'Dr. Optional Course Teacher',
  '+8801700000099',
  'ASSISTANT_PROFESSOR',
  'CSE'
)
ON CONFLICT (user_id) DO NOTHING;

-- ── 2. Test Students (Section A: rolls ≤ 060, Section B: rolls > 060) ───────

INSERT INTO public.profiles (user_id, role, email, password_hash) VALUES
  ('20070000-0000-0000-0000-000000000020', 'STUDENT', 'sakib2007020@stud.kuet.ac.bd',     '$2b$10$UptKW4.lpEdThoZ6sZlk0OuVWvZD9cSog1kGoT53jbN8jOXFaPu/G'),
  ('20070000-0000-0000-0000-000000000001', 'STUDENT', 'student2007001@stud.kuet.ac.bd',   '$2b$10$WNBgYFVA5cGm4pp/5TrnaOfSEPWHrDdwq08WI8Ib1fN5iFgSCI2iW'),
  ('20070000-0000-0000-0000-000000000002', 'STUDENT', 'student2007002@stud.kuet.ac.bd',   '$2b$10$WNBgYFVA5cGm4pp/5TrnaOfSEPWHrDdwq08WI8Ib1fN5iFgSCI2iW'),
  ('20070000-0000-0000-0000-000000000061', 'STUDENT', 'student2007061@stud.kuet.ac.bd',   '$2b$10$WNBgYFVA5cGm4pp/5TrnaOfSEPWHrDdwq08WI8Ib1fN5iFgSCI2iW'),
  ('20070000-0000-0000-0000-000000000062', 'STUDENT', 'student2007062@stud.kuet.ac.bd',   '$2b$10$WNBgYFVA5cGm4pp/5TrnaOfSEPWHrDdwq08WI8Ib1fN5iFgSCI2iW')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.students (user_id, roll_no, full_name, phone, term, session, batch, section) VALUES
  ('20070000-0000-0000-0000-000000000020', '2007020', 'Md. Sakib Hossain',  '+8801800000020', '4-1', '2020-21', '2020', 'A'),
  ('20070000-0000-0000-0000-000000000001', '2007001', 'Ahmed Rahman',        '+8801800000001', '4-1', '2020-21', '2020', 'A'),
  ('20070000-0000-0000-0000-000000000002', '2007002', 'Fatema Khatun',       '+8801800000002', '4-1', '2020-21', '2020', 'A'),
  ('20070000-0000-0000-0000-000000000061', '2007061', 'Rahim Uddin',         '+8801800000061', '4-1', '2020-21', '2020', 'B'),
  ('20070000-0000-0000-0000-000000000062', '2007062', 'Sumaiya Begum',       '+8801800000062', '4-1', '2020-21', '2020', 'B')
ON CONFLICT (roll_no) DO NOTHING;

-- ── 3. Create course offerings for 4-1 elective courses ─────────────────────
--  We create offerings for two Optional-I pairs so students get different ones

-- Offering A: CSE 4111 (Machine Learning) — Sakib + Student001
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'a0000000-0000-0000-0001-000000000001',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-1',
  '2020-21',
  '2020',
  true
FROM public.courses c WHERE c.code = 'CSE 4111'
ON CONFLICT (id) DO NOTHING;

-- Offering B: CSE 4112 (Machine Learning Lab) — Sakib + Student001
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'a0000000-0000-0000-0001-000000000002',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-1',
  '2020-21',
  '2020',
  true
FROM public.courses c WHERE c.code = 'CSE 4112'
ON CONFLICT (id) DO NOTHING;

-- Offering C: CSE 4121 (NLP) — Student002 + Student061
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'a0000000-0000-0000-0002-000000000001',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-1',
  '2020-21',
  '2020',
  true
FROM public.courses c WHERE c.code = 'CSE 4121'
ON CONFLICT (id) DO NOTHING;

-- Offering D: CSE 4122 (NLP Lab) — Student002 + Student061
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'a0000000-0000-0000-0002-000000000002',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-1',
  '2020-21',
  '2020',
  true
FROM public.courses c WHERE c.code = 'CSE 4122'
ON CONFLICT (id) DO NOTHING;

-- Offering E: CSE 4107 (DSP) — Student062
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'a0000000-0000-0000-0003-000000000001',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-1',
  '2020-21',
  '2020',
  true
FROM public.courses c WHERE c.code = 'CSE 4107'
ON CONFLICT (id) DO NOTHING;

-- Offering F: CSE 4108 (DSP Lab) — Student062
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'a0000000-0000-0000-0003-000000000002',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-1',
  '2020-21',
  '2020',
  true
FROM public.courses c WHERE c.code = 'CSE 4108'
ON CONFLICT (id) DO NOTHING;

-- ── 4. Assign optional courses to specific students ─────────────────────────
--
--  Sakib  (2007020) → Machine Learning + Lab
--  Student001       → Machine Learning + Lab
--  Student002       → NLP + Lab
--  Student061       → NLP + Lab
--  Student062       → DSP + Lab
--
-- (Each student gets a DIFFERENT optional pair — demonstrates the feature)

INSERT INTO public.optional_course_assignments (student_user_id, offering_id) VALUES
  -- Sakib: Machine Learning (theory + lab)
  ('20070000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0001-000000000001'),
  ('20070000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0001-000000000002'),
  -- Student001: Machine Learning (theory + lab)
  ('20070000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0001-000000000001'),
  ('20070000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0001-000000000002'),
  -- Student002: NLP (theory + lab)
  ('20070000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0002-000000000001'),
  ('20070000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0002-000000000002'),
  -- Student061: NLP (theory + lab)
  ('20070000-0000-0000-0000-000000000061', 'a0000000-0000-0000-0002-000000000001'),
  ('20070000-0000-0000-0000-000000000061', 'a0000000-0000-0000-0002-000000000002'),
  -- Student062: DSP (theory + lab)
  ('20070000-0000-0000-0000-000000000062', 'a0000000-0000-0000-0003-000000000001'),
  ('20070000-0000-0000-0000-000000000062', 'a0000000-0000-0000-0003-000000000002')
ON CONFLICT (student_user_id, offering_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4TH YEAR 2ND TERM (4-2) TEST DATA
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 5. 4-2 Term Test Students ────────────────────────────────────────────────
-- These students are in their final semester

INSERT INTO public.profiles (user_id, role, email, password_hash) VALUES
  ('20060000-0000-0000-0000-000000000001', 'STUDENT', 'student2006001@stud.kuet.ac.bd','$2b$10$WNBgYFVA5cGm4pp/5TrnaOfSEPWHrDdwq08WI8Ib1fN5iFgSCI2iW'),
  ('20060000-0000-0000-0000-000000000002', 'STUDENT', 'student2006002@stud.kuet.ac.bd','$2b$10$WNBgYFVA5cGm4pp/5TrnaOfSEPWHrDdwq08WI8Ib1fN5iFgSCI2iW'),
  ('20060000-0000-0000-0000-000000000003', 'STUDENT', 'student2006003@stud.kuet.ac.bd','$2b$10$WNBgYFVA5cGm4pp/5TrnaOfSEPWHrDdwq08WI8Ib1fN5iFgSCI2iW'),
  ('20060000-0000-0000-0000-000000000061', 'STUDENT', 'student2006061@stud.kuet.ac.bd','$2b$10$WNBgYFVA5cGm4pp/5TrnaOfSEPWHrDdwq08WI8Ib1fN5iFgSCI2iW'),
  ('20060000-0000-0000-0000-000000000062', 'STUDENT', 'student2006062@stud.kuet.ac.bd','$2b$10$WNBgYFVA5cGm4pp/5TrnaOfSEPWHrDdwq08WI8Ib1fN5iFgSCI2iW')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.students (user_id, roll_no, full_name, phone, term, session, batch, section) VALUES
  ('20060000-0000-0000-0000-000000000001', '2006001', 'Karim Ahmed',       '+8801700000001', '4-2', '2019-20', '2019', 'A'),
  ('20060000-0000-0000-0000-000000000002', '2006002', 'Nusrat Jahan',      '+8801700000002', '4-2', '2019-20', '2019', 'A'),
  ('20060000-0000-0000-0000-000000000003', '2006003', 'Tanvir Hassan',     '+8801700000003', '4-2', '2019-20', '2019', 'A'),
  ('20060000-0000-0000-0000-000000000061', '2006061', 'Sharmin Akter',     '+8801700000061', '4-2', '2019-20', '2019', 'B'),
  ('20060000-0000-0000-0000-000000000062', '2006062', 'Imran Khan',        '+8801700000062', '4-2', '2019-20', '2019', 'B')
ON CONFLICT (roll_no) DO NOTHING;

-- ── 6. 4-2 Term Mandatory Course Offerings ──────────────────────────────────

-- IEM 4227 (Industrial Management)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0001-000000000001',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'IEM 4227'
ON CONFLICT (id) DO NOTHING;

-- HUM 4207 (Entrepreneurship Development)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0001-000000000002',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'HUM 4207'
ON CONFLICT (id) DO NOTHING;

-- CSE 4000 (Capstone - 4-2 version)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0001-000000000003',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4000'
ON CONFLICT (id) DO NOTHING;

-- ── 7. 4-2 Term Optional-II Course Offerings ────────────────────────────────
-- Optional-II: Theory-only courses, students pick 2

-- CSE 4211 (Algorithm Engineering)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0002-000000000001',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4211'
ON CONFLICT (id) DO NOTHING;

-- CSE 4213 (Fault Tolerant System)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0002-000000000002',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4213'
ON CONFLICT (id) DO NOTHING;

-- CSE 4219 (Distributed Database Systems)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0002-000000000003',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4219'
ON CONFLICT (id) DO NOTHING;

-- CSE 4227 (Human Computer Interaction)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0002-000000000004',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4227'
ON CONFLICT (id) DO NOTHING;

-- CSE 4233 (Robotics)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0002-000000000005',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4233'
ON CONFLICT (id) DO NOTHING;

-- CSE 4239 (Data Mining)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0002-000000000006',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4239'
ON CONFLICT (id) DO NOTHING;

-- CSE 4251 (Software Architecture)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0002-000000000007',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4251'
ON CONFLICT (id) DO NOTHING;

-- ── 8. 4-2 Term Optional-III Course Offerings ───────────────────────────────
-- Optional-III: Theory + Lab courses, students pick 1 pair

-- CSE 4217/4218 (Computer Vision + Lab)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0003-000000000001',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4217'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0003-000000000002',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4218'
ON CONFLICT (id) DO NOTHING;

-- CSE 4221/4222 (High Performance Computing + Lab)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0003-000000000003',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4221'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0003-000000000004',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4222'
ON CONFLICT (id) DO NOTHING;

-- CSE 4225/4226 (Real-time Embedded Systems + Lab)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0003-000000000005',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4225'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0003-000000000006',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4226'
ON CONFLICT (id) DO NOTHING;

-- CSE 4203/4204 (Peripherals and Interfacing + Lab)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0003-000000000007',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4203'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0003-000000000008',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4204'
ON CONFLICT (id) DO NOTHING;

-- CSE 4223/4224 (Digital System Design + Lab)
INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0003-000000000009',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4223'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.course_offerings (id, course_id, teacher_user_id, term, session, batch, is_active)
SELECT
  'b0000000-0000-0000-0003-000000000010',
  c.id,
  '10000000-0000-0000-0000-000000000001',
  '4-2',
  '2019-20',
  '2019',
  true
FROM public.courses c WHERE c.code = 'CSE 4224'
ON CONFLICT (id) DO NOTHING;

-- ── 9. 4-2 Term Optional Course Assignments ─────────────────────────────────
-- Each student gets 2x Optional-II + 1x Optional-III pair

-- Student 2006001: Algorithm Engineering + Distributed DB + Computer Vision pair
INSERT INTO public.optional_course_assignments (student_user_id, offering_id) VALUES
  ('20060000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0002-000000000001'), -- Algorithm Engineering
  ('20060000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0002-000000000003'), -- Distributed DB
  ('20060000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0003-000000000001'), -- Computer Vision
  ('20060000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0003-000000000002') -- CV Lab
ON CONFLICT (student_user_id, offering_id) DO NOTHING;

-- Student 2006002: HCI + Robotics + High Performance Computing pair
INSERT INTO public.optional_course_assignments (student_user_id, offering_id) VALUES
  ('20060000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0002-000000000004'), -- HCI
  ('20060000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0002-000000000005'), -- Robotics
  ('20060000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0003-000000000003'), -- HPC
  ('20060000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0003-000000000004') -- HPC Lab
ON CONFLICT (student_user_id, offering_id) DO NOTHING;

-- Student 2006003: Data Mining + Software Architecture + Embedded Systems pair
INSERT INTO public.optional_course_assignments (student_user_id, offering_id) VALUES
  ('20060000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0002-000000000006'), -- Data Mining
  ('20060000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0002-000000000007'), -- Software Architecture
  ('20060000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0003-000000000005'), -- Embedded Systems
  ('20060000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0003-000000000006') -- Embedded Lab
ON CONFLICT (student_user_id, offering_id) DO NOTHING;

-- Student 2006061: Fault Tolerant + Algorithm Engineering + Peripherals pair
INSERT INTO public.optional_course_assignments (student_user_id, offering_id) VALUES
  ('20060000-0000-0000-0000-000000000061', 'b0000000-0000-0000-0002-000000000002'), -- Fault Tolerant
  ('20060000-0000-0000-0000-000000000061', 'b0000000-0000-0000-0002-000000000001'), -- Algorithm Engineering
  ('20060000-0000-0000-0000-000000000061', 'b0000000-0000-0000-0003-000000000007'), -- Peripherals
  ('20060000-0000-0000-0000-000000000061', 'b0000000-0000-0000-0003-000000000008') -- Peripherals Lab
ON CONFLICT (student_user_id, offering_id) DO NOTHING;

-- Student 2006062: HCI + Data Mining + Digital System Design pair
INSERT INTO public.optional_course_assignments (student_user_id, offering_id) VALUES
  ('20060000-0000-0000-0000-000000000062', 'b0000000-0000-0000-0002-000000000004'), -- HCI
  ('20060000-0000-0000-0000-000000000062', 'b0000000-0000-0000-0002-000000000006'), -- Data Mining
  ('20060000-0000-0000-0000-000000000062', 'b0000000-0000-0000-0003-000000000009'), -- Digital System Design
  ('20060000-0000-0000-0000-000000000062', 'b0000000-0000-0000-0003-000000000010') -- DSD Lab
ON CONFLICT (student_user_id, offering_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 10. Verification queries ──────────────────────────────────────────────────

DO $$
DECLARE
  student_41_count INT;
  student_42_count INT;
  offering_41_count INT;
  offering_42_count INT;
  assignment_count INT;
BEGIN
  SELECT COUNT(*) INTO student_41_count FROM public.students
    WHERE roll_no IN ('2007020','2007001','2007002','2007061','2007062');
  SELECT COUNT(*) INTO student_42_count FROM public.students
    WHERE roll_no IN ('2006001','2006002','2006003','2006061','2006062');
  SELECT COUNT(*) INTO offering_41_count FROM public.course_offerings
    WHERE id::text LIKE 'a0000000-0000-0000%';
  SELECT COUNT(*) INTO offering_42_count FROM public.course_offerings
    WHERE id::text LIKE 'b0000000-0000-0000%';
  SELECT COUNT(*) INTO assignment_count FROM public.optional_course_assignments;

  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Test data inserted successfully';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📊 4th Year 1st Term (4-1):';
  RAISE NOTICE '   👥 Test students: %', student_41_count;
  RAISE NOTICE '   📚 Course offerings: %', offering_41_count;
  RAISE NOTICE '';
  RAISE NOTICE '📊 4th Year 2nd Term (4-2):';
  RAISE NOTICE '   👥 Test students: %', student_42_count;
  RAISE NOTICE '   📚 Course offerings: %', offering_42_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Total optional course assignments: %', assignment_count;
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '🔑 Test Credentials:';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '── 4-1 Term Students ──';
  RAISE NOTICE '   sakib2007020@stud.kuet.ac.bd / 2007020  → ML + Lab';
  RAISE NOTICE '   student2007001@stud.kuet.ac.bd / student123 → ML + Lab';
  RAISE NOTICE '   student2007002@stud.kuet.ac.bd / student123 → NLP + Lab';
  RAISE NOTICE '   student2007061@stud.kuet.ac.bd / student123 → NLP + Lab';
  RAISE NOTICE '   student2007062@stud.kuet.ac.bd / student123 → DSP + Lab';
  RAISE NOTICE '';
  RAISE NOTICE '── 4-2 Term Students ──';
  RAISE NOTICE '   student2006001@stud.kuet.ac.bd / student123 → Algo Eng + Dist DB + CV';
  RAISE NOTICE '   student2006002@stud.kuet.ac.bd / student123 → HCI + Robotics + HPC';
  RAISE NOTICE '   student2006003@stud.kuet.ac.bd / student123 → Data Mining + SW Arch + Embedded';
  RAISE NOTICE '   student2006061@stud.kuet.ac.bd / student123 → Fault Tolerant + Algo + Peripherals';
  RAISE NOTICE '   student2006062@stud.kuet.ac.bd / student123 → HCI + Data Mining + DSD';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
