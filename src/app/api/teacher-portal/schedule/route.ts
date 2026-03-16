// ==========================================
// API: /api/teacher-portal/schedule
// Returns schedule slots for a specific teacher
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { notifyAttendanceMarkingReminder, notifyCourseAnomalyAlert } from '@/lib/notifications';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

type OfferingRow = Record<string, unknown> & {
  id: string;
  term?: string | null;
  session?: string | null;
  courses?: { code?: string; title?: string } | null;
  routine_slots?: Array<Record<string, unknown>> | null;
};

type TeacherSlotContext = {
  offeringId: string;
  courseCode: string;
  courseTitle: string;
  term: string | null;
  session: string | null;
  slotId: string;
  roomNumber: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  section: string | null;
  validFrom: string | null;
  validUntil: string | null;
};

const DAY_INDEX_BY_NAME: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function getDhakaDateString(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function getDhakaDayIndex(now: Date): number {
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    weekday: 'long',
  }).format(now);
  return DAY_INDEX_BY_NAME[dayName] ?? now.getDay();
}

function getDhakaTimeString(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

function timeToMinutes(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  return (Number(hours) * 60) + Number(minutes);
}

function isSlotActiveOnDate(slot: TeacherSlotContext, date: string, dayIndex: number): boolean {
  if (slot.validFrom && slot.validUntil) {
    return slot.validFrom <= date && slot.validUntil >= date;
  }

  return slot.dayOfWeek === dayIndex;
}

async function syncTeacherScheduleNotifications(teacherId: string, offerings: OfferingRow[]) {
  const now = new Date();
  const today = getDhakaDateString(now);
  const dayIndex = getDhakaDayIndex(now);
  const nowMinutes = timeToMinutes(getDhakaTimeString(now));

  const slots: TeacherSlotContext[] = [];
  const courseCodes = new Set<string>();
  const offeringIds: string[] = [];

  for (const offering of offerings) {
    const course = (offering.courses ?? null) as { code?: string; title?: string } | null;
    const courseCode = course?.code?.trim() || '';
    const courseTitle = course?.title?.trim() || courseCode;
    const routineSlots = (offering.routine_slots ?? []) as Array<Record<string, unknown>>;

    if (!courseCode) continue;

    offeringIds.push(offering.id);
    courseCodes.add(courseCode);

    if (routineSlots.length === 0) {
      await notifyCourseAnomalyAlert({
        teacherUserId: teacherId,
        courseCode,
        title: `Course setup issue — ${courseCode}`,
        body: `${courseTitle} is assigned to you, but no schedule slot has been configured yet.`,
        dedupeKey: `course-anomaly:no-schedule:${offering.id}`,
        metadata: {
          offering_id: offering.id,
          anomaly: 'no_schedule',
        },
      });
      continue;
    }

    for (const slot of routineSlots) {
      slots.push({
        offeringId: offering.id,
        courseCode,
        courseTitle,
        term: (offering.term as string | null) ?? null,
        session: (offering.session as string | null) ?? null,
        slotId: (slot.id as string) ?? '',
        roomNumber: (slot.room_number as string | null) ?? null,
        dayOfWeek: Number(slot.day_of_week ?? -1),
        startTime: (slot.start_time as string) ?? '',
        endTime: (slot.end_time as string) ?? '',
        section: (slot.section as string | null) ?? null,
        validFrom: (slot.valid_from as string | null) ?? null,
        validUntil: (slot.valid_until as string | null) ?? null,
      });
    }
  }

  if (slots.length === 0) return;

  const { data: attendanceRows } = await supabase
    .from('attendance')
    .select('course_code, section_or_group')
    .eq('date', today)
    .in('course_code', [...courseCodes]);

  const attendanceKeys = new Set(
    (attendanceRows ?? []).map((row: { course_code: string; section_or_group?: string | null }) => `${row.course_code}::${row.section_or_group ?? ''}`),
  );
  const attendanceCourseCodes = new Set((attendanceRows ?? []).map((row: { course_code: string }) => row.course_code));

  const { data: geoRooms } = await supabase
    .from('geo_attendance_rooms')
    .select('offering_id')
    .eq('date', today)
    .in('offering_id', offeringIds);

  const geoOfferingIds = new Set((geoRooms ?? []).map((row: { offering_id: string }) => row.offering_id));

  for (const slot of slots) {
    if (!isSlotActiveOnDate(slot, today, dayIndex)) continue;

    const endMinutes = timeToMinutes(slot.endTime);
    if (nowMinutes < endMinutes || nowMinutes > endMinutes + 90) continue;

    const attendanceKey = `${slot.courseCode}::${slot.section ?? ''}`;
    const hasAttendance = attendanceKeys.has(attendanceKey) || attendanceCourseCodes.has(slot.courseCode);
    const hasGeoAttendance = geoOfferingIds.has(slot.offeringId);
    if (hasAttendance || hasGeoAttendance) continue;

    await notifyAttendanceMarkingReminder({
      teacherUserId: teacherId,
      courseCode: slot.courseCode,
      courseTitle: slot.courseTitle,
      date: today,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomNumber: slot.roomNumber,
      section: slot.section,
      offeringId: slot.offeringId,
    });
  }

  const activeSlots = slots
    .filter((slot) => isSlotActiveOnDate(slot, today, dayIndex))
    .sort((left, right) => {
      if (left.dayOfWeek !== right.dayOfWeek) return left.dayOfWeek - right.dayOfWeek;
      return timeToMinutes(left.startTime) - timeToMinutes(right.startTime);
    });

  for (let index = 0; index < activeSlots.length; index += 1) {
    const current = activeSlots[index];
    for (let compareIndex = index + 1; compareIndex < activeSlots.length; compareIndex += 1) {
      const next = activeSlots[compareIndex];
      if (current.dayOfWeek !== next.dayOfWeek) break;
      if (timeToMinutes(next.startTime) >= timeToMinutes(current.endTime)) break;

      const orderedSlotIds = [current.slotId, next.slotId].sort().join(':');
      await notifyCourseAnomalyAlert({
        teacherUserId: teacherId,
        courseCode: current.courseCode,
        title: `Schedule conflict detected — ${current.courseCode}`,
        body: `${current.courseCode} overlaps with ${next.courseCode} on your current teaching schedule. Review the time slots to avoid a clash.`,
        dedupeKey: `course-anomaly:schedule-conflict:${teacherId}:${orderedSlotIds}`,
        metadata: {
          anomaly: 'schedule_conflict',
          primary_offering_id: current.offeringId,
          conflicting_offering_id: next.offeringId,
          conflicting_course_code: next.courseCode,
        },
      });
    }
  }
}

// ── GET /api/teacher-portal/schedule ───────────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacher_id');

    if (!teacherId) return badRequest('Teacher ID is required');

    // Get course offerings for this teacher, then their routine slots
    const { data: offerings, error: offeringsError } = await supabase
      .from('course_offerings')
      .select(`
        id, term, session,
        courses (code, title),
        routine_slots (
          id, room_number, day_of_week, start_time, end_time, section, valid_from, valid_until
        )
      `)
      .eq('teacher_user_id', teacherId)
      .eq('is_active', true);

    if (offeringsError) throw offeringsError;

    await syncTeacherScheduleNotifications(teacherId, (offerings ?? []) as OfferingRow[]);

    // Flatten into schedule slots
    const slots = (offerings || []).flatMap((offering: Record<string, unknown>) => {
      const course = offering.courses as { code: string; title: string } | null;
      const routineSlots = (offering.routine_slots || []) as Array<{
        id: string;
        room_number: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
        section: string | null;
      }>;
      return routineSlots.map((slot) => ({
        id: slot.id,
        course_code: course?.code || '',
        course_title: course?.title || '',
        room_number: slot.room_number,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        section: slot.section,
        term: offering.term,
        session: offering.session,
      }));
    });

    return NextResponse.json(slots);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to fetch schedule'));
  }
}
