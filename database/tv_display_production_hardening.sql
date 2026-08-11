-- TV Display production hardening
-- Safe to run repeatedly. Run the CMS section in the CMS project and the
-- schedule section in the academic project when those are separate projects.

-- ── CMS project ─────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.cms_tv_devices
  ADD COLUMN IF NOT EXISTS show_room_schedule boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_cms_tv_announcements_display
  ON public.cms_tv_announcements (target, priority DESC, created_at DESC)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cms_tv_ticker_display
  ON public.cms_tv_ticker (target, sort_order)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cms_tv_events_display
  ON public.cms_tv_events (target, display_order)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cms_tv_devices_active_name
  ON public.cms_tv_devices (name)
  WHERE is_active = true;

DO $$
DECLARE
  table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH table_name IN ARRAY ARRAY[
      'cms_tv_announcements',
      'cms_tv_ticker',
      'cms_tv_events',
      'cms_tv_settings',
      'cms_tv_devices'
    ]
    LOOP
      IF to_regclass('public.' || table_name) IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND schemaname = 'public'
             AND tablename = table_name
         )
      THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
          table_name
        );
      END IF;
    END LOOP;
  END IF;
END
$$;

-- ── Academic/schedule project ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_routine_slots_tv_schedule
  ON public.routine_slots (day_of_week, valid_from, valid_until, start_time);
CREATE INDEX IF NOT EXISTS idx_cr_room_requests_tv_date
  ON public.cr_room_requests (request_date, status)
  WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_room_booking_requests_tv_date
  ON public.room_booking_requests (booking_date, status)
  WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_admin_direct_bookings_tv_date
  ON public.admin_direct_bookings (booking_date, status)
  WHERE status = 'approved';

-- RLS is intentionally not toggled here. Existing projects use different CMS
-- authentication claims. Apply project-specific SELECT-only public policies and
-- authenticated-admin write policies before enabling RLS to avoid locking out
-- the current admin portal.
