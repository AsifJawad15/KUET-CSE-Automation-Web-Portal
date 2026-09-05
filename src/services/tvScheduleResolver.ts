import 'server-only';

import {
  addDaysToDateKey,
  getDateKeyWeekday,
  type RoutineDisplaySlot,
  type TvSnapshotSchedule,
} from '../../shared/tv-display/domain';
import { ROUTINE_SLOT_WITH_DETAILS } from '@/lib/queryConstants';
import { supabase } from '@/lib/supabaseServer';

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) return asRow(value[0]);
  return value as Row;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nullableText(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function normalizeRoutine(
  row: Row,
  date: string,
  source: RoutineDisplaySlot['source'] = 'routine',
): RoutineDisplaySlot {
  const offering = asRow(row.course_offerings);
  const course = asRow(offering?.courses);
  const teacher = asRow(offering?.teachers);
  return {
    id: text(row.id, `${source}-${date}-${text(row.room_number)}-${text(row.start_time)}`),
    source,
    date,
    roomNumber: text(row.room_number, 'TBA'),
    startTime: text(row.start_time),
    endTime: text(row.end_time),
    section: nullableText(row.section),
    courseCode: text(course?.code, source === 'admin-booking' ? 'Reserved' : 'N/A'),
    courseTitle: text(course?.title, text(course?.code, 'Reserved')),
    teacherName: nullableText(teacher?.full_name),
    term: nullableText(offering?.term),
    session: nullableText(offering?.session),
    bookingType: nullableText(row.booking_type),
  };
}

function withinDateRange(row: Row, date: string): boolean {
  const validFrom = nullableText(row.valid_from);
  const validUntil = nullableText(row.valid_until);
  return (!validFrom || validFrom <= date) && (!validUntil || validUntil >= date);
}

function dedupeKey(slot: RoutineDisplaySlot): string {
  return `${slot.date}|${slot.roomNumber}|${slot.startTime}|${slot.endTime}`;
}

export async function resolveTvScheduleRange(
  from: string,
  dayCount = 14,
): Promise<TvSnapshotSchedule> {
  const through = addDaysToDateKey(from, dayCount - 1);

  const [routineResult, crResult, teacherResult, adminResult] = await Promise.all([
    supabase.from('routine_slots').select(ROUTINE_SLOT_WITH_DETAILS).order('start_time'),
    supabase
      .from('cr_room_requests')
      .select(`
        id, course_code, room_number, start_time, end_time, term, session,
        section, request_date,
        teachers!cr_room_requests_teacher_user_id_fkey(full_name, teacher_uid)
      `)
      .eq('status', 'approved')
      .not('room_number', 'is', null)
      .gte('request_date', from)
      .lte('request_date', through),
    supabase
      .from('room_booking_requests')
      .select(`
        id, offering_id, room_number, start_time, end_time, section, booking_date,
        course_offerings!rbr_offering_fkey(
          id, term, session, batch,
          courses(code, title, credit, course_type),
          teachers!course_offerings_teacher_user_id_fkey(full_name, teacher_uid)
        )
      `)
      .eq('status', 'approved')
      .gte('booking_date', from)
      .lte('booking_date', through),
    supabase
      .from('admin_direct_bookings')
      .select('id, room_number, start_time, end_time, label, booking_type, booking_date')
      .eq('status', 'approved')
      .gte('booking_date', from)
      .lte('booking_date', through),
  ]);

  if (routineResult.error) throw routineResult.error;
  if (crResult.error) console.warn('TV schedule CR booking merge unavailable:', crResult.error.message);
  if (teacherResult.error) console.warn('TV schedule teacher booking merge unavailable:', teacherResult.error.message);
  if (adminResult.error) console.warn('TV schedule admin booking merge unavailable:', adminResult.error.message);

  const crRows = (crResult.data ?? []) as unknown as Row[];
  const courseCodes = [...new Set(crRows.map((row) => text(row.course_code)).filter(Boolean))];
  const courseResult = courseCodes.length
    ? await supabase.from('courses').select('code, title').in('code', courseCodes)
    : { data: [], error: null };
  if (courseResult.error) console.warn('TV schedule course labels unavailable:', courseResult.error.message);
  const courseMap = new Map(
    ((courseResult.data ?? []) as Row[]).map((row) => [text(row.code), row]),
  );

  const days: Record<string, RoutineDisplaySlot[]> = {};
  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = addDaysToDateKey(from, offset);
    const weekday = getDateKeyWeekday(date);
    const slots = new Map<string, RoutineDisplaySlot>();

    for (const row of (routineResult.data ?? []) as unknown as Row[]) {
      const hasDateScope = !!nullableText(row.valid_from) || !!nullableText(row.valid_until);
      if (
        (!hasDateScope && Number(row.day_of_week) !== weekday) ||
        (hasDateScope && !withinDateRange(row, date))
      ) {
        continue;
      }
      const slot = normalizeRoutine(row, date);
      slots.set(dedupeKey(slot), slot);
    }

    for (const row of crRows.filter((item) => item.request_date === date)) {
      const courseCode = text(row.course_code, 'N/A');
      const course = courseMap.get(courseCode);
      const teacher = asRow(row.teachers);
      const slot: RoutineDisplaySlot = {
        id: `cr-${text(row.id)}`,
        source: 'cr-booking',
        date,
        roomNumber: text(row.room_number, 'TBA'),
        startTime: text(row.start_time),
        endTime: text(row.end_time),
        section: nullableText(row.section),
        courseCode,
        courseTitle: text(course?.title, courseCode),
        teacherName: nullableText(teacher?.full_name),
        term: nullableText(row.term),
        session: nullableText(row.session),
        bookingType: null,
      };
      if (!slots.has(dedupeKey(slot))) slots.set(dedupeKey(slot), slot);
    }

    for (const row of ((teacherResult.data ?? []) as unknown as Row[]).filter(
      (item) => item.booking_date === date,
    )) {
      const slot = normalizeRoutine(
        { ...row, id: `tb-${text(row.id)}` },
        date,
        'teacher-booking',
      );
      if (!slots.has(dedupeKey(slot))) slots.set(dedupeKey(slot), slot);
    }

    for (const row of ((adminResult.data ?? []) as unknown as Row[]).filter(
      (item) => item.booking_date === date,
    )) {
      const label = text(row.label, 'Reserved');
      const slot: RoutineDisplaySlot = {
        id: `ab-${text(row.id)}`,
        source: 'admin-booking',
        date,
        roomNumber: text(row.room_number, 'TBA'),
        startTime: text(row.start_time),
        endTime: text(row.end_time),
        section: null,
        courseCode: label,
        courseTitle: label,
        teacherName: null,
        term: null,
        session: null,
        bookingType: nullableText(row.booking_type),
      };
      if (!slots.has(dedupeKey(slot))) slots.set(dedupeKey(slot), slot);
    }

    days[date] = [...slots.values()].sort(
      (a, b) => a.startTime.localeCompare(b.startTime) || a.roomNumber.localeCompare(b.roomNumber),
    );
  }

  return { from, through, days };
}
