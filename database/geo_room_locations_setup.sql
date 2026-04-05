-- ============================================
-- Geo Room Locations - Database Setup
-- Admin-managed room coordinates for geo-attendance
-- ============================================
-- Each room has a name, GPS coordinate, and plus code.
-- Teachers select a room when opening geo-attendance, and
-- can set a custom range (default 30m).
-- ============================================

-- Table: geo_room_locations
-- Admin-managed list of rooms with GPS coordinates
CREATE TABLE IF NOT EXISTS public.geo_room_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_name text NOT NULL UNIQUE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  plus_code text,                      -- e.g. 'VGX2+QJQ Khulna'
  building_name text DEFAULT 'CSE Building',
  floor_number text,                   -- e.g. '1st', '2nd', '5th'
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT geo_room_locations_pkey PRIMARY KEY (id)
);

-- Add room reference and range to geo_attendance_rooms
ALTER TABLE public.geo_attendance_rooms
  ADD COLUMN IF NOT EXISTS geo_room_location_id uuid REFERENCES public.geo_room_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS range_meters integer NOT NULL DEFAULT 30;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_geo_room_locations_active ON public.geo_room_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_geo_attendance_rooms_location ON public.geo_attendance_rooms(geo_room_location_id);

-- Enable RLS
ALTER TABLE public.geo_room_locations ENABLE ROW LEVEL SECURITY;

-- Development policy (replace with role-based in production)
CREATE POLICY "dev_all_geo_room_locations" ON public.geo_room_locations FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Seed initial rooms with GPS coordinates
-- Decoded from Google Plus Codes for KUET CSE Building
-- ============================================
INSERT INTO public.geo_room_locations (room_name, latitude, longitude, plus_code, floor_number) VALUES
  ('CSE-104', 22.899484, 89.501513, 'VGX2+QJQ Khulna', '1st'),
  ('CSE-103', 22.899141, 89.501913, 'VGX2+MQ3 Khulna', '1st'),
  ('202',     22.899141, 89.501738, 'VGX2+MM6 Khulna', '2nd'),
  ('102',     22.899234, 89.501613, 'VGX2+MJX Khulna', '1st'),
  ('502',     22.899453, 89.501513, 'VGX2+QJG Khulna', '5th')
ON CONFLICT (room_name) DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  plus_code = EXCLUDED.plus_code,
  floor_number = EXCLUDED.floor_number,
  updated_at = now();

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Geo Room Locations table created & seeded!';
  RAISE NOTICE '📍 5 rooms added: CSE-104, CSE-103, 202, 102, 502';
  RAISE NOTICE '📏 Default range: 30 meters per room';
  RAISE NOTICE '🔗 geo_attendance_rooms now has geo_room_location_id + range_meters';
END $$;
