-- ============================================================
-- TV Display CMS Tables — Setup SQL
-- Run in your CMS Supabase project SQL Editor
-- Project: https://jabzmmmjafuqynjyhkrv.supabase.co
-- ============================================================
-- This creates 3 tables for the TV Display feature:
--   1. cms_tv_announcements  — Announcements shown on the TV
--   2. cms_tv_ticker         — Scrolling ticker / special update items
--   3. cms_tv_settings       — Key-value config for TV display behavior
-- ============================================================


-- ═══════════════════════════════════════════════
-- TABLE 1: cms_tv_announcements
-- Stores announcements displayed on the TV screen
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

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_tv_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tv_announcements_updated_at
  BEFORE UPDATE ON public.cms_tv_announcements
  FOR EACH ROW EXECUTE FUNCTION update_tv_announcements_updated_at();

-- Index for active announcements (used by TV display page)
CREATE INDEX IF NOT EXISTS idx_tv_announcements_active
  ON public.cms_tv_announcements (is_active, priority DESC, created_at DESC);

COMMENT ON TABLE public.cms_tv_announcements IS 'Announcements displayed on the department TV screens';


-- ═══════════════════════════════════════════════
-- TABLE 2: cms_tv_ticker
-- Scrolling ticker / "Special Update" / "Breaking News" items
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

-- Index for active ticker items
CREATE INDEX IF NOT EXISTS idx_tv_ticker_active
  ON public.cms_tv_ticker (is_active, sort_order ASC);

COMMENT ON TABLE public.cms_tv_ticker IS 'Scrolling ticker items shown at the bottom of the TV display';


-- ═══════════════════════════════════════════════
-- TABLE 3: cms_tv_settings
-- Key-value configuration for TV display behavior
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cms_tv_settings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_tv_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tv_settings_updated_at
  BEFORE UPDATE ON public.cms_tv_settings
  FOR EACH ROW EXECUTE FUNCTION update_tv_settings_updated_at();

COMMENT ON TABLE public.cms_tv_settings IS 'Key-value configuration for TV display behavior (scroll speed, rotation interval, etc.)';


-- ═══════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Public read (anon key), authenticated write
-- ═══════════════════════════════════════════════

-- Enable RLS on all 3 tables
ALTER TABLE public.cms_tv_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_tv_ticker        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_tv_settings      ENABLE ROW LEVEL SECURITY;

-- Allow anyone to READ (public TV display page uses anon key)
CREATE POLICY "Public read access" ON public.cms_tv_announcements FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.cms_tv_ticker        FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.cms_tv_settings      FOR SELECT USING (true);

-- Allow anyone to INSERT/UPDATE/DELETE (admin uses anon key with CMS client)
-- In production you'd restrict this to authenticated/admin users
CREATE POLICY "Public write access" ON public.cms_tv_announcements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public write access" ON public.cms_tv_ticker        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public write access" ON public.cms_tv_settings      FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════
-- SEED DATA — Default settings + sample announcements
-- ═══════════════════════════════════════════════

-- Default TV display settings
INSERT INTO public.cms_tv_settings (key, value) VALUES
  ('scroll_speed',           '50'),
  ('rotation_interval_sec',  '15'),
  ('semester_label',         'SPRING 2026'),
  ('department_name',        'Department of Computer Science & Engineering'),
  ('department_short',       'CSE | KUET'),
  ('show_clock',             'true'),
  ('headline_prefix',        'HEADLINES'),
  ('ticker_label',           'SPECIAL UPDATE'),
  ('enabled_sections',       '["announcements","routine","stats"]')
ON CONFLICT (key) DO NOTHING;

-- Sample announcements
INSERT INTO public.cms_tv_announcements (title, content, type, course_code, priority, scheduled_date, is_active, created_by) VALUES
  (
    'Lab Test 2 — CSE 3202',
    'Lab Test 2 for Software Engineering Lab. Topics: Design Patterns, UML to Code.',
    'lab-test',
    'CSE 3202',
    'high',
    '2026-03-10',
    true,
    'Admin'
  ),
  (
    'CT-1 Scheduled for CSE 3201',
    'Class Test 1 for Software Engineering. Syllabus: Chapter 1-3, Software Process Models.',
    'class-test',
    'CSE 3201',
    'high',
    '2026-03-12',
    true,
    'Admin'
  ),
  (
    'Mid-Term Exam Schedule Published',
    'The mid-term examination schedule for Spring 2026 semester has been published. Please check your respective class groups.',
    'notice',
    NULL,
    'medium',
    NULL,
    true,
    'Admin'
  ),
  (
    'Assignment 2 — CSE 3203',
    'Submit your network topology assignment by March 15, 2026. Include Wireshark captures.',
    'assignment',
    'CSE 3203',
    'medium',
    '2026-03-15',
    true,
    'Admin'
  ),
  (
    'Workshop on AI & Machine Learning',
    'A workshop on recent advances in AI and Machine Learning will be held on March 20, 2026 at the CSE Seminar Hall.',
    'event',
    NULL,
    'low',
    '2026-03-20',
    true,
    'Admin'
  );

-- Sample ticker items
INSERT INTO public.cms_tv_ticker (label, text, type, course_code, is_active, sort_order) VALUES
  ('SPECIAL UPDATE', 'Lab Test 2 — CSE 3202: Topics: Design Patterns, UML to Code', 'lab-test', 'CSE 3202', true, 1),
  ('EXAM NOTICE', 'CT-1 Scheduled for CSE 3201 — Syllabus: Chapter 1-3', 'class-test', 'CSE 3201', true, 2),
  ('ANNOUNCEMENT', 'Mid-Term Exam Schedule Published — Check your class groups', 'notice', NULL, true, 3);


-- ═══════════════════════════════════════════════
-- DONE! Verify by running:
--   SELECT count(*) FROM cms_tv_announcements;  -- should be 5
--   SELECT count(*) FROM cms_tv_ticker;          -- should be 3
--   SELECT count(*) FROM cms_tv_settings;        -- should be 9
-- ═══════════════════════════════════════════════
