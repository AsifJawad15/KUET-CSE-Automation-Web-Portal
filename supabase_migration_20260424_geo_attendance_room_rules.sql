ALTER TABLE public.geo_attendance_rooms
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS absence_grace_minutes integer;

UPDATE public.geo_attendance_rooms
SET duration_minutes = GREATEST(
  1,
  CEIL(EXTRACT(EPOCH FROM (end_time - start_time)) / 60.0)::integer
)
WHERE duration_minutes IS NULL;

UPDATE public.geo_attendance_rooms
SET absence_grace_minutes = 5
WHERE absence_grace_minutes IS NULL;

ALTER TABLE public.geo_attendance_rooms
  ALTER COLUMN range_meters SET DEFAULT 30,
  ALTER COLUMN duration_minutes SET DEFAULT 50,
  ALTER COLUMN duration_minutes SET NOT NULL,
  ALTER COLUMN absence_grace_minutes SET DEFAULT 5,
  ALTER COLUMN absence_grace_minutes SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geo_attendance_rooms_range_meters_check'
  ) THEN
    ALTER TABLE public.geo_attendance_rooms
      ADD CONSTRAINT geo_attendance_rooms_range_meters_check
      CHECK (range_meters BETWEEN 1 AND 500);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geo_attendance_rooms_duration_minutes_check'
  ) THEN
    ALTER TABLE public.geo_attendance_rooms
      ADD CONSTRAINT geo_attendance_rooms_duration_minutes_check
      CHECK (duration_minutes BETWEEN 1 AND 600);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geo_attendance_rooms_absence_grace_minutes_check'
  ) THEN
    ALTER TABLE public.geo_attendance_rooms
      ADD CONSTRAINT geo_attendance_rooms_absence_grace_minutes_check
      CHECK (absence_grace_minutes BETWEEN 1 AND duration_minutes);
  END IF;
END $$;
