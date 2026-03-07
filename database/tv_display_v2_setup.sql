-- ============================================================
-- TV Display V2 — Info Board Layout Migration
-- Run AFTER tv_display_setup.sql in your CMS Supabase SQL Editor
-- Adds: cms_tv_events table + new settings for room/class config
-- ============================================================


-- ═══════════════════════════════════════════════
-- TABLE: cms_tv_events
-- Event cards displayed in the left "News & Events" panel
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

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_tv_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tv_events_updated_at
  BEFORE UPDATE ON public.cms_tv_events
  FOR EACH ROW EXECUTE FUNCTION update_tv_events_updated_at();

-- Index for active events
CREATE INDEX IF NOT EXISTS idx_tv_events_active
  ON public.cms_tv_events (is_active, display_order ASC);

COMMENT ON TABLE public.cms_tv_events IS 'Event cards displayed on the TV info board left panel (News & Events carousel)';


-- ═══════════════════════════════════════════════
-- RLS — Same pattern as existing TV tables
-- ═══════════════════════════════════════════════

ALTER TABLE public.cms_tv_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON public.cms_tv_events FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.cms_tv_events FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════
-- NEW SETTINGS — Room display + event carousel config
-- ═══════════════════════════════════════════════

INSERT INTO public.cms_tv_settings (key, value) VALUES
  ('tv_room_number',      'ROOM 301'),
  ('tv_class_label',      'CLASS 4B'),
  ('event_rotation_sec',  '8')
ON CONFLICT (key) DO NOTHING;


-- ═══════════════════════════════════════════════
-- SEED DATA — Sample event cards
-- ═══════════════════════════════════════════════

INSERT INTO public.cms_tv_events (title, subtitle, description, image_url, speaker_name, speaker_image_url, event_date, event_time, location, badge_text, is_active, display_order) VALUES
  (
    'AI & Ethics',
    'Guest Lecture',
    'An in-depth lecture on the ethical implications of modern AI systems, covering bias, transparency, and accountability.',
    NULL,
    'Dr. Rahman',
    NULL,
    '2026-03-26',
    '2 PM',
    'Auditorium B',
    'Speaker',
    true,
    1
  ),
  (
    'Coding Hackathon',
    'Registration Open',
    'Annual CSE department coding hackathon. Teams of 3. Build innovative solutions in 24 hours.',
    NULL,
    NULL,
    NULL,
    '2026-04-05',
    '9 AM',
    'CSE Lab Complex',
    'Deadline: April 2nd',
    true,
    2
  ),
  (
    'Workshop on Cloud Computing',
    'Hands-on Session',
    'Learn AWS and GCP fundamentals with practical deployment exercises.',
    NULL,
    'Prof. Karim',
    NULL,
    '2026-03-30',
    '10 AM',
    'Seminar Hall',
    'Speaker',
    true,
    3
  ),
  (
    'IEEE Student Branch Meeting',
    'Monthly Meetup',
    'Discussion on upcoming conferences, paper submissions, and branch activities.',
    NULL,
    NULL,
    NULL,
    '2026-03-15',
    '3 PM',
    'Room 204',
    NULL,
    true,
    4
  );


-- ═══════════════════════════════════════════════
-- DONE! Verify:
--   SELECT count(*) FROM cms_tv_events;    -- should be 4
--   SELECT * FROM cms_tv_settings WHERE key LIKE 'tv_%' OR key = 'event_rotation_sec';
-- ═══════════════════════════════════════════════
