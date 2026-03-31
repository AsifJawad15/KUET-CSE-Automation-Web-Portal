-- ============================================================
-- TV Display — COMPLETE Setup (Tables + Target Column)
-- Run this ONCE in your CMS Supabase SQL Editor
-- Project: https://jabzmmmjafuqynjyhkrv.supabase.co
-- ============================================================
-- This creates ALL tables needed for TV Display:
--   1. cms_tv_announcements
--   2. cms_tv_ticker
--   3. cms_tv_settings
--   4. cms_tv_events
-- Then adds the 'target' column (TV1/TV2/all) for multi-TV support.
-- ============================================================


-- ═══════════════════════════════════════════════
-- TABLE 1: cms_tv_announcements
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cms_tv_announcements (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL DEFAULT '',
  type          TEXT NOT NULL DEFAULT 'notice'
                  CHECK (type IN ('notice','class-test','assignment','lab-test','quiz','event','other')),
  course_code   TEXT DEFAULT NULL,
  priority      TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high')),
  scheduled_date DATE DEFAULT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    TEXT NOT NULL DEFAULT 'Admin',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_tv_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tv_announcements_updated_at ON public.cms_tv_announcements;
CREATE TRIGGER trg_tv_announcements_updated_at
  BEFORE UPDATE ON public.cms_tv_announcements
  FOR EACH ROW EXECUTE FUNCTION update_tv_announcements_updated_at();

CREATE INDEX IF NOT EXISTS idx_tv_announcements_active
  ON public.cms_tv_announcements (is_active, priority DESC, created_at DESC);


-- ═══════════════════════════════════════════════
-- TABLE 2: cms_tv_ticker
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cms_tv_ticker (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label           TEXT NOT NULL DEFAULT 'SPECIAL UPDATE',
  text            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'notice'
                    CHECK (type IN ('notice','class-test','assignment','lab-test','quiz','event','other')),
  course_code     TEXT DEFAULT NULL,
  announcement_id UUID DEFAULT NULL REFERENCES public.cms_tv_announcements(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tv_ticker_active
  ON public.cms_tv_ticker (is_active, sort_order ASC);


-- ═══════════════════════════════════════════════
-- TABLE 3: cms_tv_settings
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cms_tv_settings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_tv_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tv_settings_updated_at ON public.cms_tv_settings;
CREATE TRIGGER trg_tv_settings_updated_at
  BEFORE UPDATE ON public.cms_tv_settings
  FOR EACH ROW EXECUTE FUNCTION update_tv_settings_updated_at();


-- ═══════════════════════════════════════════════
-- TABLE 4: cms_tv_events
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cms_tv_events (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title             TEXT NOT NULL,
  subtitle          TEXT DEFAULT NULL,
  description       TEXT DEFAULT NULL,
  image_url         TEXT DEFAULT NULL,
  speaker_name      TEXT DEFAULT NULL,
  speaker_image_url TEXT DEFAULT NULL,
  event_date        DATE DEFAULT NULL,
  event_time        TEXT DEFAULT NULL,
  location          TEXT DEFAULT NULL,
  badge_text        TEXT DEFAULT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  display_order     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_tv_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tv_events_updated_at ON public.cms_tv_events;
CREATE TRIGGER trg_tv_events_updated_at
  BEFORE UPDATE ON public.cms_tv_events
  FOR EACH ROW EXECUTE FUNCTION update_tv_events_updated_at();

CREATE INDEX IF NOT EXISTS idx_tv_events_active
  ON public.cms_tv_events (is_active, display_order ASC);


-- ═══════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════

ALTER TABLE public.cms_tv_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_tv_ticker        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_tv_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_tv_events        ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe re-run)
DO $$ BEGIN DROP POLICY IF EXISTS "Public read access" ON public.cms_tv_announcements; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Public write access" ON public.cms_tv_announcements; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Public read access" ON public.cms_tv_ticker; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Public write access" ON public.cms_tv_ticker; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Public read access" ON public.cms_tv_settings; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Public write access" ON public.cms_tv_settings; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Public read access" ON public.cms_tv_events; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Public write access" ON public.cms_tv_events; EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "Public read access" ON public.cms_tv_announcements FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.cms_tv_announcements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read access" ON public.cms_tv_ticker        FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.cms_tv_ticker        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read access" ON public.cms_tv_settings      FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.cms_tv_settings      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read access" ON public.cms_tv_events        FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.cms_tv_events        FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════
-- ADD TARGET COLUMN (TV1 / TV2 / all)
-- ═══════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cms_tv_announcements'
      AND column_name = 'target'
  ) THEN
    ALTER TABLE public.cms_tv_announcements
      ADD COLUMN target TEXT NOT NULL DEFAULT 'all';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cms_tv_ticker'
      AND column_name = 'target'
  ) THEN
    ALTER TABLE public.cms_tv_ticker
      ADD COLUMN target TEXT NOT NULL DEFAULT 'all';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cms_tv_events'
      AND column_name = 'target'
  ) THEN
    ALTER TABLE public.cms_tv_events
      ADD COLUMN target TEXT NOT NULL DEFAULT 'all';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tv_announcements_target
  ON public.cms_tv_announcements (target, is_active);
CREATE INDEX IF NOT EXISTS idx_tv_ticker_target
  ON public.cms_tv_ticker (target, is_active);
CREATE INDEX IF NOT EXISTS idx_tv_events_target
  ON public.cms_tv_events (target, is_active);


-- ═══════════════════════════════════════════════
-- ENABLE REALTIME
-- ═══════════════════════════════════════════════

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cms_tv_announcements; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cms_tv_ticker; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cms_tv_events; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cms_tv_settings; EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ═══════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════

-- Settings
INSERT INTO public.cms_tv_settings (key, value) VALUES
  ('scroll_speed',           '50'),
  ('rotation_interval_sec',  '15'),
  ('semester_label',         'SPRING 2026'),
  ('department_name',        'Department of Computer Science & Engineering'),
  ('department_short',       'CSE | KUET'),
  ('show_clock',             'true'),
  ('headline_prefix',        'HEADLINES'),
  ('ticker_label',           'SPECIAL UPDATE'),
  ('enabled_sections',       '["announcements","routine","stats"]'),
  ('tv_room_number',         'ROOM 301'),
  ('tv_class_label',         'CLASS 4B'),
  ('event_rotation_sec',     '8')
ON CONFLICT (key) DO NOTHING;

-- Sample announcements
INSERT INTO public.cms_tv_announcements (title, content, type, course_code, priority, scheduled_date, is_active, created_by) VALUES
  ('Lab Test 2 — CSE 3202', 'Lab Test 2 for Software Engineering Lab. Topics: Design Patterns, UML to Code.', 'lab-test', 'CSE 3202', 'high', '2026-03-10', true, 'Admin'),
  ('CT-1 Scheduled for CSE 3201', 'Class Test 1 for Software Engineering. Syllabus: Chapter 1-3, Software Process Models.', 'class-test', 'CSE 3201', 'high', '2026-03-12', true, 'Admin'),
  ('Mid-Term Exam Schedule Published', 'The mid-term examination schedule for Spring 2026 semester has been published.', 'notice', NULL, 'medium', NULL, true, 'Admin'),
  ('Assignment 2 — CSE 3203', 'Submit your network topology assignment by March 15, 2026. Include Wireshark captures.', 'assignment', 'CSE 3203', 'medium', '2026-03-15', true, 'Admin'),
  ('Workshop on AI & Machine Learning', 'A workshop on recent advances in AI and ML will be held on March 20, 2026 at the CSE Seminar Hall.', 'event', NULL, 'low', '2026-03-20', true, 'Admin')
ON CONFLICT DO NOTHING;

-- Sample ticker items
INSERT INTO public.cms_tv_ticker (label, text, type, course_code, is_active, sort_order) VALUES
  ('SPECIAL UPDATE', 'Lab Test 2 — CSE 3202: Topics: Design Patterns, UML to Code', 'lab-test', 'CSE 3202', true, 1),
  ('EXAM NOTICE', 'CT-1 Scheduled for CSE 3201 — Syllabus: Chapter 1-3', 'class-test', 'CSE 3201', true, 2),
  ('ANNOUNCEMENT', 'Mid-Term Exam Schedule Published — Check your class groups', 'notice', NULL, true, 3)
ON CONFLICT DO NOTHING;

-- Sample events
INSERT INTO public.cms_tv_events (title, subtitle, description, event_date, event_time, location, badge_text, speaker_name, is_active, display_order) VALUES
  ('AI & Ethics', 'Guest Lecture', 'An in-depth lecture on the ethical implications of modern AI systems.', '2026-03-26', '2 PM', 'Auditorium B', 'Speaker', 'Dr. Rahman', true, 1),
  ('Coding Hackathon', 'Registration Open', 'Annual CSE department coding hackathon. Teams of 3.', '2026-04-05', '9 AM', 'CSE Lab Complex', 'Deadline: April 2nd', NULL, true, 2),
  ('Workshop on Cloud Computing', 'Hands-on Session', 'Learn AWS and GCP fundamentals with practical deployment exercises.', '2026-03-30', '10 AM', 'Seminar Hall', 'Speaker', 'Prof. Karim', true, 3),
  ('IEEE Student Branch Meeting', 'Monthly Meetup', 'Discussion on upcoming conferences and branch activities.', '2026-03-15', '3 PM', 'Room 204', NULL, NULL, true, 4)
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════
-- VERIFICATION QUERIES (run separately to check)
-- ═══════════════════════════════════════════════
-- SELECT count(*) FROM cms_tv_announcements;  -- should be 5
-- SELECT count(*) FROM cms_tv_ticker;          -- should be 3
-- SELECT count(*) FROM cms_tv_settings;        -- should be 12
-- SELECT count(*) FROM cms_tv_events;          -- should be 4
--
-- SELECT column_name, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'cms_tv_announcements' AND column_name = 'target';
-- ═══════════════════════════════════════════════
