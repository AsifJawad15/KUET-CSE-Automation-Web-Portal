-- ============================================================
-- Fix: Remove hardcoded CHECK constraints on target column
-- Run on CMS Supabase project (jabzmmmjafuqynjyhkrv)
-- ============================================================
-- The original migration added CHECK (target IN ('all','TV1','TV2'))
-- which blocks dynamic device names (TV3, TV4, etc.)
-- This drops those constraints so any device name works.
-- ============================================================

-- Drop CHECK constraints from cms_tv_announcements
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'cms_tv_announcements'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%target%'
  LOOP
    EXECUTE format('ALTER TABLE public.cms_tv_announcements DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Dropped constraint % from cms_tv_announcements', r.conname;
  END LOOP;
END $$;

-- Drop CHECK constraints from cms_tv_ticker
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'cms_tv_ticker'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%target%'
  LOOP
    EXECUTE format('ALTER TABLE public.cms_tv_ticker DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Dropped constraint % from cms_tv_ticker', r.conname;
  END LOOP;
END $$;

-- Drop CHECK constraints from cms_tv_events
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'cms_tv_events'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%target%'
  LOOP
    EXECUTE format('ALTER TABLE public.cms_tv_events DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Dropped constraint % from cms_tv_events', r.conname;
  END LOOP;
END $$;

-- Verify: should return 0 rows
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname IN ('cms_tv_announcements', 'cms_tv_ticker', 'cms_tv_events')
  AND con.contype = 'c'
  AND pg_get_constraintdef(con.oid) LIKE '%target%';
