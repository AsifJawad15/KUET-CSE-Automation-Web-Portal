-- Migration: admin_direct_bookings table
-- Allows admins to book rooms directly without needing a course offering or teacher link
-- These bookings appear on the Schedule and TV display pages

CREATE TABLE IF NOT EXISTS public.admin_direct_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_number text NOT NULL,
  booking_date date NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  booking_type text NOT NULL DEFAULT 'periodic' CHECK (booking_type IN ('periodic', 'continuous')),
  label text NOT NULL DEFAULT 'Reserved',
  booked_by_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'cancelled')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_direct_bookings_pkey PRIMARY KEY (id),
  CONSTRAINT admin_direct_bookings_room_fkey FOREIGN KEY (room_number) REFERENCES public.rooms(room_number),
  CONSTRAINT admin_direct_bookings_user_fkey FOREIGN KEY (booked_by_user_id) REFERENCES public.profiles(user_id)
);

-- Indexes for fast conflict + date lookup
CREATE INDEX IF NOT EXISTS idx_admin_direct_bookings_room_date
  ON public.admin_direct_bookings(room_number, booking_date);

CREATE INDEX IF NOT EXISTS idx_admin_direct_bookings_date
  ON public.admin_direct_bookings(booking_date);

-- Enable RLS (admin access only via service role)
ALTER TABLE public.admin_direct_bookings ENABLE ROW LEVEL SECURITY;

-- Allow all operations via service role (Next.js API uses service role for admin)
CREATE POLICY "Service role full access" ON public.admin_direct_bookings
  USING (true)
  WITH CHECK (true);
