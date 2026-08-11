// ==========================================
// API: /api/schedule/book-room
// Admin direct room booking — saves to admin_direct_bookings table
// Periodic: picks a standard KUET period (blank slot on selected room+day)
// Continuous: custom start/end time range
// Does NOT modify routine_slots
// Appears on TV/Schedule via merged GET /api/routine-slots response
// ==========================================

import { badRequest, internalError, ok } from '@/lib/apiResponse';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { NextRequest } from 'next/server';
import { withAdminRateLimit } from '@/lib/withRateLimit';

const PERIODS = [
  { id: 1, start: '08:00', end: '08:50', label: '8:00 AM – 8:50 AM' },
  { id: 2, start: '08:50', end: '09:40', label: '8:50 AM – 9:40 AM' },
  { id: 3, start: '09:40', end: '10:30', label: '9:40 AM – 10:30 AM' },
  { id: 4, start: '10:40', end: '11:30', label: '10:40 AM – 11:30 AM' },
  { id: 5, start: '11:30', end: '12:20', label: '11:30 AM – 12:20 PM' },
  { id: 6, start: '12:20', end: '13:10', label: '12:20 PM – 1:10 PM' },
  { id: 7, start: '14:30', end: '15:20', label: '2:30 PM – 3:20 PM' },
  { id: 8, start: '15:20', end: '16:10', label: '3:20 PM – 4:10 PM' },
  { id: 9, start: '16:10', end: '17:00', label: '4:10 PM – 5:00 PM' },
] as const;

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function timeToMinutes(t: string): number {
  const [h = '0', m = '0'] = t.split(':');
  return Number(h) * 60 + Number(m);
}

function rangesOverlap(
  a: { start_time: string; end_time: string },
  b: { start_time: string; end_time: string },
): boolean {
  return (
    timeToMinutes(a.start_time) < timeToMinutes(b.end_time) &&
    timeToMinutes(a.end_time) > timeToMinutes(b.start_time)
  );
}

function getDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00`).getDay();
}

/** Fetch all occupied time ranges for a room on a specific date from all booking sources. */
async function getOccupiedRanges(
  roomNumber: string,
  date: string,
): Promise<{ start_time: string; end_time: string }[]> {
  const dow = getDayOfWeek(date);

  const [routineRes, bookingRes, crRes, adminRes] = await Promise.allSettled([
    // Permanent routine slots + date-scoped ones
    supabase
      .from('routine_slots')
      .select('start_time, end_time, valid_from, valid_until')
      .eq('room_number', roomNumber)
      .eq('day_of_week', dow),
    // Teacher room booking requests
    supabase
      .from('room_booking_requests')
      .select('start_time, end_time')
      .eq('room_number', roomNumber)
      .eq('booking_date', date)
      .in('status', ['pending', 'approved']),
    // CR room requests
    supabase
      .from('cr_room_requests')
      .select('start_time, end_time')
      .eq('room_number', roomNumber)
      .eq('request_date', date)
      .in('status', ['pending', 'approved']),
    // Admin direct bookings (our new table)
    supabase
      .from('admin_direct_bookings')
      .select('start_time, end_time')
      .eq('room_number', roomNumber)
      .eq('booking_date', date)
      .eq('status', 'approved'),
  ]);

  const occupied: { start_time: string; end_time: string }[] = [];

  // routine_slots — check date range validity
  if (routineRes.status === 'fulfilled' && !routineRes.value.error) {
    for (const slot of routineRes.value.data ?? []) {
      const vf = slot.valid_from as string | null;
      const vu = slot.valid_until as string | null;
      const isActive =
        (!vf && !vu) ||
        ((!vf || vf <= date) && (!vu || vu >= date));
      if (isActive) {
        occupied.push({ start_time: slot.start_time as string, end_time: slot.end_time as string });
      }
    }
  }

  for (const result of [bookingRes, crRes, adminRes]) {
    if (result.status === 'fulfilled' && !result.value.error) {
      for (const r of result.value.data ?? []) {
        occupied.push({ start_time: r.start_time as string, end_time: r.end_time as string });
      }
    }
  }

  return occupied;
}

// ── GET /api/schedule/book-room — room period availability ──

export const GET = withAdminRateLimit(async function GET(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  if (!isSupabaseConfigured()) return internalError('Supabase not configured');

  try {
    const { searchParams } = new URL(request.url);
    const room_number = searchParams.get('room_number');
    const date = searchParams.get('date');

    if (!room_number || !date) {
      return badRequest('room_number and date are required');
    }

    const occupied = await getOccupiedRanges(room_number, date);

    const periodsWithAvailability = PERIODS.map((p) => ({
      id: p.id,
      start: p.start,
      end: p.end,
      label: p.label,
      available: !occupied.some((o) =>
        rangesOverlap(o, { start_time: p.start, end_time: p.end }),
      ),
    }));

    return ok({
      room_number,
      date,
      periods: periodsWithAvailability,
    });
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to fetch room availability'));
  }
});

// ── POST /api/schedule/book-room — create admin booking ──

export const POST = withAdminRateLimit(async function POST(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  if (!isSupabaseAdminConfigured()) return internalError('Supabase admin not configured');

  const db = getSupabaseAdmin();

  try {
    const body = await request.json();
    const {
      room_number,
      booking_date,
      start_time,
      end_time,
      booking_type,
      label,
    } = body as {
      room_number: string;
      booking_date: string;
      start_time: string;
      end_time: string;
      booking_type: 'periodic' | 'continuous';
      label?: string;
    };

    if (!room_number || !booking_date || !start_time || !end_time || !booking_type) {
      return badRequest('room_number, booking_date, start_time, end_time, and booking_type are required');
    }

    if (timeToMinutes(end_time) <= timeToMinutes(start_time)) {
      return badRequest('end_time must be after start_time');
    }

    // Conflict check
    const occupied = await getOccupiedRanges(room_number, booking_date);
    if (occupied.some((r) => rangesOverlap(r, { start_time, end_time }))) {
      return badRequest('This room is already booked for the selected time slot on this date');
    }

    const dow = getDayOfWeek(booking_date);
    const bookingLabel = label?.trim() || (booking_type === 'periodic' ? 'Reserved (Periodic)' : 'Reserved (Continuous)');

    const { data, error } = await db
      .from('admin_direct_bookings')
      .insert({
        room_number,
        booking_date,
        day_of_week: dow,
        start_time,
        end_time,
        booking_type,
        label: bookingLabel,
        booked_by_user_id: auth.user.id,
        status: 'approved',
      })
      .select()
      .single();

    if (error) {
      console.error('[schedule/book-room] Insert error:', error.message);
      return internalError(`Failed to book room: ${error.message}`);
    }

    return ok({
      id: data.id,
      room_number,
      booking_date,
      start_time,
      end_time,
      booking_type,
      label: bookingLabel,
      status: 'approved',
    });
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to book room'));
  }
});

// ── DELETE /api/schedule/book-room — cancel admin booking ──

export const DELETE = withAdminRateLimit(async function DELETE(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  if (!isSupabaseAdminConfigured()) return internalError('Supabase admin not configured');

  const db = getSupabaseAdmin();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('id is required');

    const { error } = await db
      .from('admin_direct_bookings')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) return internalError(extractError(error, 'Failed to cancel booking'));

    return ok({ cancelled: true });
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to cancel booking'));
  }
});
