-- ============================================================
-- Add show_room_schedule column to cms_tv_devices
-- Run in CMS Supabase project SQL Editor
-- ============================================================

ALTER TABLE public.cms_tv_devices
  ADD COLUMN IF NOT EXISTS show_room_schedule BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.cms_tv_devices.show_room_schedule
  IS 'Whether to display the Live/Upcoming room schedule panel on this TV';

-- Refresh API schema cache
NOTIFY pgrst, 'reload schema';
