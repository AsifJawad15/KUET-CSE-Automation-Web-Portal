// ==========================================
// API: /api/teacher-portal/room-requests
// Handles teacher room booking requests
// ==========================================

import { badRequest, guardSupabase, internalError, ok } from '@/lib/apiResponse';
import { notifyAdminRoomRequestPending, notifyTeacherRoomApproved, notifyTeacherRoomRejected } from '@/lib/notifications';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { requireFields, runValidations } from '@/lib/validators';
import { NextRequest, NextResponse } from 'next/server';

const PERIODS = [
  { start: '08:00', end: '08:50' },
  { start: '08:50', end: '09:40' },
  { start: '09:40', end: '10:30' },
  { start: '10:40', end: '11:30' },
  { start: '11:30', end: '12:20' },
  { start: '12:20', end: '13:10' },
  { start: '14:30', end: '15:20' },
  { start: '15:20', end: '16:10' },
  { start: '16:10', end: '17:00' },
] as const;

type TimeRange = {
  start_time: string;
  end_time: string;
};

type PeriodRange = {
  start: string;
  end: string;
};

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDayName(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { weekday: 'long' });
}

function getPeriodInfo(startTime: string, endTime: string): { startPeriod: string; endPeriod: string } | null {
  const overlappingPeriods = PERIODS
    .map((period, index) => ({ period, index }))
    .filter(({ period }) => (
      timeToMinutes(period.start) < timeToMinutes(endTime)
      && timeToMinutes(period.end) > timeToMinutes(startTime)
    ));

  if (overlappingPeriods.length === 0) return null;

  return {
    startPeriod: String(overlappingPeriods[0].index + 1),
    endPeriod: String(overlappingPeriods[overlappingPeriods.length - 1].index + 1),
  };
}

function getDayOfWeek(date: string): number | null {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getDay();
}

function timeToMinutes(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  return (Number(hours) * 60) + Number(minutes);
}

function periodOverlapsTimeRange(period: PeriodRange, range: TimeRange): boolean {
  return timeToMinutes(period.start) < timeToMinutes(range.end_time)
    && timeToMinutes(period.end) > timeToMinutes(range.start_time);
}

function rangesOverlap(left: TimeRange, right: TimeRange): boolean {
  return timeToMinutes(left.start_time) < timeToMinutes(right.end_time)
    && timeToMinutes(left.end_time) > timeToMinutes(right.start_time);
}

function formatTime12Hour(value: string): string {
  const [rawHours = '0', rawMinutes = '0'] = value.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const normalizedHour = hours % 12 || 12;
  return `${normalizedHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function buildAvailableSlots(occupiedRanges: TimeRange[]) {
  const availablePeriods = PERIODS.filter((period) => (
    !occupiedRanges.some((occupied) => periodOverlapsTimeRange(period, occupied))
  ));

  return availablePeriods.map((period) => ({
    start_time: period.start,
    end_time: period.end,
    label: `${formatTime12Hour(period.start)} - ${formatTime12Hour(period.end)}`,
  }));
}

async function getOccupiedRanges(roomNumber: string, date: string, excludeRequestId?: string): Promise<TimeRange[]> {
  const dayOfWeek = getDayOfWeek(date);
  if (dayOfWeek == null) return [];

  const [routineResult, legacyRequestResult, bookingRequestResult, crRequestResult] = await Promise.allSettled([
    supabase
      .from('routine_slots')
      .select('start_time, end_time, valid_from, valid_until')
      .eq('room_number', roomNumber)
      .eq('day_of_week', dayOfWeek),
    supabase
      .from('room_requests')
      .select('id, start_time, end_time, status')
      .eq('room_number', roomNumber)
      .eq('date', date)
      .in('status', ['pending', 'approved']),
    supabase
      .from('room_booking_requests')
      .select('id, start_time, end_time, status')
      .eq('room_number', roomNumber)
      .eq('booking_date', date)
      .in('status', ['pending', 'approved']),
    supabase
      .from('cr_room_requests')
      .select('id, start_time, end_time, status')
      .eq('room_number', roomNumber)
      .eq('request_date', date)
      .in('status', ['pending', 'approved']),
  ]);

  if (routineResult.status !== 'fulfilled') {
    throw routineResult.reason;
  }
  if (routineResult.value.error) {
    throw routineResult.value.error;
  }

  const occupiedFromRoutine = (routineResult.value.data ?? [])
    .filter((slot) => {
      const validFrom = slot.valid_from as string | null;
      const validUntil = slot.valid_until as string | null;
      if (!validFrom && !validUntil) return true;
      return (!validFrom || validFrom <= date) && (!validUntil || validUntil >= date);
    })
    .map((slot) => ({
      start_time: slot.start_time as string,
      end_time: slot.end_time as string,
    }));

  const occupiedFromRequests = [legacyRequestResult, bookingRequestResult, crRequestResult]
    .flatMap((result) => {
      if (result.status !== 'fulfilled' || result.value.error) {
        return [];
      }

      return (result.value.data ?? [])
        .filter((request) => !excludeRequestId || request.id !== excludeRequestId)
        .map((request) => ({
          start_time: request.start_time as string,
          end_time: request.end_time as string,
        }));
    });

  return [...occupiedFromRoutine, ...occupiedFromRequests];
}

// ── POST /api/teacher-portal/room-requests ─────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { teacher_user_id, teacher_name, offering_id, room_number, date, start_time, end_time, purpose } = body;

    const validation = runValidations(
      requireFields({ teacher_user_id, offering_id, room_number, date, start_time, end_time, purpose }),
    );
    if (validation) return badRequest(validation);

    const dayOfWeek = getDayOfWeek(date);
    if (dayOfWeek == null) return badRequest('Invalid date');

    const periodInfo = getPeriodInfo(start_time, end_time);
    if (!periodInfo) return badRequest('Selected time slot does not match a valid class period');

    const occupiedRanges = await getOccupiedRanges(room_number, date);
    const requestedRange = { start_time, end_time };
    if (occupiedRanges.some((range) => rangesOverlap(range, requestedRange))) {
      return badRequest('Selected room is not free during that time on the chosen day');
    }

    const { data: offering, error: offeringError } = await supabase
      .from('course_offerings')
      .select(`
        id, teacher_user_id, batch,
        courses (code, title)
      `)
      .eq('id', offering_id)
      .eq('teacher_user_id', teacher_user_id)
      .maybeSingle();

    if (offeringError) throw offeringError;
    if (!offering) return badRequest('Selected course is not assigned to this teacher');

    const { data, error } = await supabase
      .from('room_booking_requests')
      .insert({
        teacher_user_id,
        offering_id,
        room_number,
        day_of_week: dayOfWeek,
        start_period: periodInfo.startPeriod,
        end_period: periodInfo.endPeriod,
        start_time,
        end_time,
        section: (offering.batch as string | null) ?? null,
        purpose,
        status: 'pending',
        booking_date: date,
      })
      .select()
      .single();

    if (error) throw error;

    // Notify admin so they can review and approve the request
    await notifyAdminRoomRequestPending({
      teacherUserId: teacher_user_id || null,
      teacherName: teacher_name || null,
      roomNumber: room_number,
      date,
      startTime: start_time,
      endTime: end_time,
      purpose: `${((offering.courses as { code?: string } | null)?.code || 'Course')} — ${purpose}`,
      requestId: data.id as string,
    });

    return ok(data);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to submit room request'));
  }
}

// ── PATCH /api/teacher-portal/room-requests ────────────

export async function PATCH(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { id, status, remarks, room_number } = body;

    const validation = runValidations(
      requireFields({ id, status }),
    );
    if (validation) return badRequest(validation);

    if (status !== 'approved' && status !== 'rejected') {
      return badRequest('status must be either approved or rejected');
    }

    const { data: existingRequest, error: lookupError } = await supabase
      .from('room_booking_requests')
      .select(`
        *,
        course_offerings!rbr_offering_fkey(
          id,
          courses(code, title)
        )
      `)
      .eq('id', id)
      .single();

    if (lookupError) throw lookupError;

    const updatePayload: Record<string, unknown> = { status };
    if (room_number) {
      updatePayload.room_number = room_number;
    }

    const { data, error } = await supabase
      .from('room_booking_requests')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    const teacherUserId = (existingRequest.teacher_user_id as string | null) ?? null;
    if (teacherUserId) {
      const period = `${existingRequest.start_time as string}–${existingRequest.end_time as string}`;
      const offering = existingRequest.course_offerings as {
        courses?: { code?: string; title?: string } | { code?: string; title?: string }[] | null;
      } | null;
      const courseRecord = Array.isArray(offering?.courses) ? offering?.courses[0] : offering?.courses;
      const courseCode = courseRecord?.code?.trim() || (existingRequest.purpose as string | null) || 'Room Request';
      const dayName = formatDayName(existingRequest.booking_date as string);
      const resolvedRoom = (room_number as string | undefined) || (existingRequest.room_number as string | null) || 'TBA';

      if (status === 'approved') {
        await notifyTeacherRoomApproved({
          teacherUserId,
          courseCode,
          roomNumber: resolvedRoom,
          period,
          dayName,
          remarks: remarks ?? null,
          requestId: id,
        });
      } else {
        await notifyTeacherRoomRejected({
          teacherUserId,
          courseCode,
          roomNumber: resolvedRoom,
          period,
          dayName,
          reason: remarks ?? 'No remarks provided.',
          requestId: id,
        });
      }
    }

    return ok(data);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to review room request'));
  }
}

// ── GET /api/teacher-portal/room-requests ──────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacher_id');
    const roomNumber = searchParams.get('room_number');
    const date = searchParams.get('date');
    const mode = searchParams.get('mode');

    if (mode === 'availability') {
      if (!roomNumber || !date) return badRequest('room_number and date are required');

      const occupiedRanges = await getOccupiedRanges(roomNumber, date);
      return ok({
        room_number: roomNumber,
        date,
        available_slots: buildAvailableSlots(occupiedRanges),
      });
    }

    let query = supabase
      .from('room_booking_requests')
      .select(`
        *,
        course_offerings!rbr_offering_fkey(
          id,
          batch,
          courses(code, title)
        )
      `)
      .order('created_at', { ascending: false });

    if (teacherId) {
      query = query.eq('teacher_user_id', teacherId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const normalized = (data || []).map((request) => {
      const offering = request.course_offerings as {
        id?: string;
        batch?: string | null;
        courses?: { code?: string; title?: string } | { code?: string; title?: string }[] | null;
      } | null;
      const courseRecord = Array.isArray(offering?.courses) ? offering?.courses[0] : offering?.courses;

      return {
        id: request.id,
        teacher_user_id: request.teacher_user_id,
        offering_id: offering?.id || request.offering_id,
        course_code: courseRecord?.code || '',
        course_title: courseRecord?.title || '',
        section: offering?.batch ?? request.section ?? null,
        room_number: request.room_number,
        date: request.booking_date,
        start_time: request.start_time,
        end_time: request.end_time,
        purpose: request.purpose,
        status: request.status,
        created_at: request.created_at,
      };
    });

    return NextResponse.json(normalized);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to fetch room requests'));
  }
}
