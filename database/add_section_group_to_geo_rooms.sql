-- ============================================
-- Migration: Add section column to geo_attendance_rooms
-- Allows teachers to restrict geo-attendance rooms to specific sections/groups
-- e.g. 'Section A (01–60)', 'Group B1 (61–90)'
-- ============================================

ALTER TABLE public.geo_attendance_rooms
ADD COLUMN IF NOT EXISTS section text;

-- Add comment for documentation
COMMENT ON COLUMN public.geo_attendance_rooms.section IS 'Section or group filter, e.g. Section A (01–60), Group B1 (61–90)';
