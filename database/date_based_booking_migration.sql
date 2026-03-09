-- ==========================================
-- Migration: Date-Based Booking & Routine Auto-Sync
-- ==========================================
-- This migration converts the booking system from day_of_week-only
-- to date-based booking so that classes/bookings are tied to specific dates.
-- The permanent routine (routine_slots) stays day_of_week based (weekly repeat),
-- but bookings are now date-specific with auto-sync from the routine.
-- ==========================================

-- ── 1. Add `booking_date` to room_booking_requests ──────

ALTER TABLE room_booking_requests
  ADD COLUMN IF NOT EXISTS booking_date DATE;

-- Backfill: set booking_date to created_at::date for existing rows
UPDATE room_booking_requests
  SET booking_date = (created_at AT TIME ZONE 'Asia/Dhaka')::date
  WHERE booking_date IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE room_booking_requests
  ALTER COLUMN booking_date SET NOT NULL;

-- ── 2. Add `booking_date` to cr_room_requests ──────────

-- cr_room_requests already has `request_date` but it's not used in conflict logic.
-- We will use `request_date` as the actual booking date going forward.
-- Backfill any nulls.
UPDATE cr_room_requests
  SET request_date = (created_at AT TIME ZONE 'Asia/Dhaka')::date
  WHERE request_date IS NULL;

-- Make it NOT NULL
ALTER TABLE cr_room_requests
  ALTER COLUMN request_date SET NOT NULL;

-- ── 3. Add `valid_from` and `valid_until` to routine_slots ──
-- This lets the system know when a routine is active (e.g., a semester date range).
-- If NULL, the routine is considered always active (backward compatible).

ALTER TABLE routine_slots
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_until DATE;

-- ── 4. Create indexes for date-based queries ───────────

CREATE INDEX IF NOT EXISTS idx_rbr_booking_date
  ON room_booking_requests(booking_date);

CREATE INDEX IF NOT EXISTS idx_rbr_room_date
  ON room_booking_requests(room_number, booking_date);

CREATE INDEX IF NOT EXISTS idx_cr_room_request_date
  ON cr_room_requests(request_date);

CREATE INDEX IF NOT EXISTS idx_cr_room_request_room_date
  ON cr_room_requests(room_number, request_date);

CREATE INDEX IF NOT EXISTS idx_routine_slots_validity
  ON routine_slots(valid_from, valid_until);

-- ── 5. Helper function: Check if a routine slot is valid on a given date ──

CREATE OR REPLACE FUNCTION is_routine_valid_on_date(
  slot_valid_from DATE,
  slot_valid_until DATE,
  check_date DATE
) RETURNS BOOLEAN AS $$
BEGIN
  -- If no validity range, always valid (permanent routine)
  IF slot_valid_from IS NULL AND slot_valid_until IS NULL THEN
    RETURN TRUE;
  END IF;
  -- If only valid_from is set
  IF slot_valid_from IS NOT NULL AND slot_valid_until IS NULL THEN
    RETURN check_date >= slot_valid_from;
  END IF;
  -- If only valid_until is set
  IF slot_valid_from IS NULL AND slot_valid_until IS NOT NULL THEN
    RETURN check_date <= slot_valid_until;
  END IF;
  -- Both set
  RETURN check_date >= slot_valid_from AND check_date <= slot_valid_until;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── 6. Done ────────────────────────────────────────────
-- After running this migration:
-- 1. room_booking_requests now has booking_date (DATE, NOT NULL)
-- 2. cr_room_requests.request_date is now NOT NULL and used for conflict logic
-- 3. routine_slots has optional valid_from/valid_until for semester-scoping
-- 4. All conflict checks should filter by booking_date / request_date
-- 5. Routine auto-sync: When loading a day's schedule, combine:
--    a) routine_slots WHERE day_of_week = X AND is_valid_on_date(valid_from, valid_until, target_date)
--    b) room_booking_requests WHERE booking_date = target_date AND status = 'approved'
--    c) cr_room_requests WHERE request_date = target_date AND status = 'approved'
