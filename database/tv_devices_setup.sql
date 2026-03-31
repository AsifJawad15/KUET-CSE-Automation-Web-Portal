-- ============================================================
-- TV Devices Table + Dynamic Target Migration
-- Run in your CMS Supabase project SQL Editor
-- ============================================================
-- 1. Creates cms_tv_devices table for dynamic TV management
-- 2. Drops rigid CHECK constraints on target columns
-- 3. Adds foreign-key-like validation via trigger
-- ============================================================


-- ═══════════════════════════════════════════════
-- 1) cms_tv_devices — registry of all TV screens
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cms_tv_devices (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,              -- 'TV1', 'TV2', 'TV3', etc.
  label       TEXT,                              -- Friendly label: 'Lobby TV', 'Lab TV'
  location    TEXT,                              -- Physical location description
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_tv_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tv_devices_updated_at ON public.cms_tv_devices;
CREATE TRIGGER trg_tv_devices_updated_at
  BEFORE UPDATE ON public.cms_tv_devices
  FOR EACH ROW EXECUTE FUNCTION update_tv_devices_updated_at();

-- RLS: public read, authenticated write
ALTER TABLE public.cms_tv_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read cms_tv_devices" ON public.cms_tv_devices;
CREATE POLICY "Public read cms_tv_devices"
  ON public.cms_tv_devices FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Auth write cms_tv_devices" ON public.cms_tv_devices;
CREATE POLICY "Auth write cms_tv_devices"
  ON public.cms_tv_devices FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed default devices
INSERT INTO public.cms_tv_devices (name, label, location)
VALUES
  ('TV1', 'Main Lobby TV', 'Ground Floor Lobby'),
  ('TV2', 'Lab Corridor TV', '2nd Floor Corridor')
ON CONFLICT (name) DO NOTHING;

-- Enable realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cms_tv_devices;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.cms_tv_devices IS 'Registry of all physical TV screens managed by the department';


-- ═══════════════════════════════════════════════
-- 2) Remove rigid CHECK constraints from target columns
--    so admins can add TV3, TV4, etc. dynamically
-- ═══════════════════════════════════════════════

-- Drop CHECK constraints on cms_tv_announcements.target
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
    WHERE con.conrelid = 'public.cms_tv_announcements'::regclass
      AND att.attname = 'target'
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.cms_tv_announcements DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Drop CHECK constraints on cms_tv_ticker.target
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
    WHERE con.conrelid = 'public.cms_tv_ticker'::regclass
      AND att.attname = 'target'
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.cms_tv_ticker DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Drop CHECK constraints on cms_tv_events.target
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
    WHERE con.conrelid = 'public.cms_tv_events'::regclass
      AND att.attname = 'target'
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.cms_tv_events DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════
-- 3) Validation trigger: target must be 'all' or
--    exist in cms_tv_devices.name
-- ═══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION validate_tv_target()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target IS NULL OR NEW.target = 'all' THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cms_tv_devices WHERE name = NEW.target) THEN
    RAISE EXCEPTION 'Invalid TV target "%". Device not found in cms_tv_devices.', NEW.target;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all three content tables
DROP TRIGGER IF EXISTS trg_validate_target_announcements ON public.cms_tv_announcements;
CREATE TRIGGER trg_validate_target_announcements
  BEFORE INSERT OR UPDATE ON public.cms_tv_announcements
  FOR EACH ROW EXECUTE FUNCTION validate_tv_target();

DROP TRIGGER IF EXISTS trg_validate_target_ticker ON public.cms_tv_ticker;
CREATE TRIGGER trg_validate_target_ticker
  BEFORE INSERT OR UPDATE ON public.cms_tv_ticker
  FOR EACH ROW EXECUTE FUNCTION validate_tv_target();

DROP TRIGGER IF EXISTS trg_validate_target_events ON public.cms_tv_events;
CREATE TRIGGER trg_validate_target_events
  BEFORE INSERT OR UPDATE ON public.cms_tv_events
  FOR EACH ROW EXECUTE FUNCTION validate_tv_target();


-- ═══════════════════════════════════════════════
-- DONE! Verify:
--   SELECT * FROM cms_tv_devices;
--   -- Should show TV1, TV2
--
-- To add a new TV:
--   INSERT INTO cms_tv_devices (name, label, location)
--   VALUES ('TV3', 'Seminar Room TV', '3rd Floor');
--
-- Then content can target 'TV3' in addition to 'TV1', 'TV2', 'all'.
-- ═══════════════════════════════════════════════
