-- Migration: Add GPS coordinates to rooms table for per-room geo-attendance
-- NOTE: rooms table already has plus_code (text) and floor_number columns.
-- This migration adds latitude + longitude (auto-populated from Plus Code by the web API).
--
-- How to set room coordinates:
--   1. Open the web admin panel → Room Allocation → edit a room
--   2. Enter the Plus Code in the format:  VGX2+QJQ Khulna
--      (copy directly from Google Maps → share → Plus Code)
--   3. Saving auto-decodes the Plus Code → stores lat/lng in the DB.
--
-- KUET CSE Building Plus Code: VGX2+QJQ Khulna
--   Decodes to: latitude ≈ 22.8994°N, longitude ≈ 89.502°E

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS latitude  double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

COMMENT ON COLUMN public.rooms.latitude  IS 'GPS latitude decoded from plus_code; used for 30 m geo-attendance radius check';
COMMENT ON COLUMN public.rooms.longitude IS 'GPS longitude decoded from plus_code; used for 30 m geo-attendance radius check';

-- Optional: manually set coordinates using the decoded KUET CSE building location.
-- UPDATE public.rooms SET latitude = 22.8994, longitude = 89.502  WHERE room_number = 'CSE-101';
-- UPDATE public.rooms SET latitude = 22.8994, longitude = 89.502  WHERE room_number = 'CSE-201';
-- (Repeat for each room, adjusting coords to each room's actual Plus Code.)
