-- ============================================================
-- TV Display — Add Target Column Migration
-- Run AFTER tv_display_setup.sql and tv_display_v2_setup.sql
-- Adds per-TV targeting (TV1, TV2, all) to content tables
-- ============================================================
-- This allows the admin panel to send specific content to TV1,
-- TV2, or both TVs simultaneously. The Electron desktop player
-- subscribes to its own target and also receives 'all' content.
-- ============================================================


-- ═══════════════════════════════════════════════
-- 1) Add target column to cms_tv_announcements
-- ═══════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cms_tv_announcements'
      AND column_name = 'target'
  ) THEN
    ALTER TABLE public.cms_tv_announcements
      ADD COLUMN target TEXT NOT NULL DEFAULT 'all'
      CHECK (target IN ('all', 'TV1', 'TV2'));
  END IF;
END $$;


-- ═══════════════════════════════════════════════
-- 2) Add target column to cms_tv_ticker
-- ═══════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cms_tv_ticker'
      AND column_name = 'target'
  ) THEN
    ALTER TABLE public.cms_tv_ticker
      ADD COLUMN target TEXT NOT NULL DEFAULT 'all'
      CHECK (target IN ('all', 'TV1', 'TV2'));
  END IF;
END $$;


-- ═══════════════════════════════════════════════
-- 3) Add target column to cms_tv_events
-- ═══════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cms_tv_events'
      AND column_name = 'target'
  ) THEN
    ALTER TABLE public.cms_tv_events
      ADD COLUMN target TEXT NOT NULL DEFAULT 'all'
      CHECK (target IN ('all', 'TV1', 'TV2'));
  END IF;
END $$;


-- ═══════════════════════════════════════════════
-- 4) Indexes for target-filtered queries
-- ═══════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tv_announcements_target
  ON public.cms_tv_announcements (target, is_active);

CREATE INDEX IF NOT EXISTS idx_tv_ticker_target
  ON public.cms_tv_ticker (target, is_active);

CREATE INDEX IF NOT EXISTS idx_tv_events_target
  ON public.cms_tv_events (target, is_active);


-- ═══════════════════════════════════════════════
-- 5) Enable Realtime on all TV tables
-- (Required for Electron desktop player subscriptions)
-- ═══════════════════════════════════════════════

-- These may fail if already added; that's okay
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cms_tv_announcements;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cms_tv_ticker;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cms_tv_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cms_tv_settings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ═══════════════════════════════════════════════
-- DONE! Verify:
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'cms_tv_announcements' AND column_name = 'target';
--
-- All existing rows will have target = 'all' (shown on both TVs).
-- New content can be targeted to 'TV1', 'TV2', or 'all'.
-- ═══════════════════════════════════════════════
