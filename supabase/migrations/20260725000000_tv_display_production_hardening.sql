-- Academic database indexes required by the canonical TV snapshot resolver.
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
