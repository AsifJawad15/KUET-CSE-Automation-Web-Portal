import { supabase } from '@/lib/supabase';

export type TeacherAssistantIntent =
  | 'assigned-courses'
  | 'today-schedule'
  | 'tomorrow-schedule'
  | 'next-class'
  | 'next-week-schedule'
  | 'weekly-schedule';

type TeacherCourseOfferingRow = {
  id: string;
  term: string | null;
  session: string | null;
  batch: string | null;
  courses?: {
    code?: string | null;
    title?: string | null;
    credit?: number | null;
    course_type?: string | null;
  } | null;
};

type RoutineSlotRow = {
  id: string;
  room_number: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  section: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  course_offerings?: {
    term?: string | null;
    session?: string | null;
    batch?: string | null;
    courses?: {
      code?: string | null;
      title?: string | null;
      credit?: number | null;
      course_type?: string | null;
    } | null;
  } | null;
};

type DateInfo = {
  dateKey: string;
  dayName: string;
  dayIndex: number;
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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function detectTeacherDataIntent(message: string): TeacherAssistantIntent | null {
  const text = message.toLowerCase();

  if (/\b(next|upcoming|nearest)\s+(class|lecture|period)\b/.test(text)) return 'next-class';
  if (/\btomorrow\b/.test(text) && hasScheduleWord(text)) return 'tomorrow-schedule';
  if (/\bnext\s+week\b|\bupcoming\s+week\b/.test(text) && hasScheduleWord(text)) return 'next-week-schedule';
  if (
    /\b(full|all|complete|weekly|week)\s+(class\s+)?(schedule|routine|timetable)\b/.test(text) ||
    /\b(schedule|routine|timetable)\s+(for\s+)?(this\s+)?(full\s+)?week\b/.test(text)
  ) return 'weekly-schedule';
  if (/\btoday'?s?\b/.test(text) && hasScheduleWord(text)) return 'today-schedule';
  if (hasAssignedCourseIntent(text)) return 'assigned-courses';
  if (/\bmy\s+(schedule|routine|timetable)\b/.test(text)) return 'weekly-schedule';

  return null;
}

export async function answerTeacherDataIntent(
  intent: TeacherAssistantIntent,
  teacherId: string,
): Promise<string> {
  switch (intent) {
    case 'assigned-courses':
      return getAssignedCoursesAnswer(teacherId);
    case 'today-schedule':
      return getScheduleForDateAnswer(teacherId, getDhakaDateInfo(), 'today');
    case 'tomorrow-schedule':
      return getScheduleForDateAnswer(teacherId, getDhakaDateInfo(addDays(new Date(), 1)), 'tomorrow');
    case 'next-class':
      return getNextClassAnswer(teacherId);
    case 'next-week-schedule':
      return getNextWeekScheduleAnswer(teacherId);
    case 'weekly-schedule':
      return getWeeklyScheduleAnswer(teacherId);
  }
}

function hasScheduleWord(text: string): boolean {
  return /\b(schedule|routine|timetable|class|classes|room|period|lecture)\b/.test(text);
}

function hasAssignedCourseIntent(text: string): boolean {
  return (
    /\b(my\s+)?assigned\s+courses?\b/.test(text) ||
    /\bcourses?\s+assigned\b/.test(text) ||
    /\bassigned\s+subjects?\b/.test(text) ||
    /\bsubjects?\s+assigned\b/.test(text) ||
    /\bwhich\s+courses?\b/.test(text) ||
    /\bwhat\s+courses?\b/.test(text) ||
    /\bmy\s+courses?\b/.test(text) ||
    /\bcurrent\s+courses?\b/.test(text) ||
    /\bcourses?\s+(am\s+i\s+)?(teaching|taking|assigned)\b/.test(text)
  );
}

function getDhakaDateInfo(now = new Date()): DateInfo {
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    weekday: 'long',
  }).format(now);

  return {
    dateKey,
    dayName,
    dayIndex: DAY_INDEX_BY_NAME[dayName] ?? now.getDay(),
  };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function dateInfoFromKey(dateKey: string): DateInfo {
  const [year, month, day] = dateKey.split('-').map(Number);
  return getDhakaDateInfo(new Date(Date.UTC(year, month - 1, day, 12)));
}

function trimTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function timeToMinutes(value: string): number {
  const [hour = '0', minute = '0'] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

function isSlotActiveForDate(slot: RoutineSlotRow, dateKey: string, dayIndex: number): boolean {
  if (slot.valid_from || slot.valid_until) {
    const startsBefore = !slot.valid_from || slot.valid_from <= dateKey;
    const endsAfter = !slot.valid_until || slot.valid_until >= dateKey;
    return startsBefore && endsAfter;
  }

  return slot.day_of_week === dayIndex;
}

async function fetchTeacherSlots(teacherId: string): Promise<RoutineSlotRow[]> {
  const { data, error } = await supabase
    .from('routine_slots')
    .select(`
      id, room_number, day_of_week, start_time, end_time, section, valid_from, valid_until,
      course_offerings!inner (
        term, session, batch, teacher_user_id, is_active,
        courses ( code, title, credit, course_type )
      )
    `)
    .eq('course_offerings.teacher_user_id', teacherId)
    .eq('course_offerings.is_active', true);

  if (error) throw error;

  return (data ?? []) as RoutineSlotRow[];
}

async function fetchTeacherOfferings(teacherId: string): Promise<TeacherCourseOfferingRow[]> {
  const { data, error } = await supabase
    .from('course_offerings')
    .select(`
      id, term, session, batch,
      courses ( code, title, credit, course_type )
    `)
    .eq('teacher_user_id', teacherId)
    .eq('is_active', true)
    .order('term', { ascending: true });

  if (error) throw error;

  return (data ?? []) as TeacherCourseOfferingRow[];
}

async function getAssignedCoursesAnswer(teacherId: string): Promise<string> {
  const offerings = await fetchTeacherOfferings(teacherId);

  if (offerings.length === 0) {
    return 'No active course assignments were found for you right now.';
  }

  const lines = offerings.map((offering, index) => {
    const course = offering.courses;
    const code = course?.code?.trim() || 'Course';
    const title = course?.title?.trim() ? ` - ${course.title.trim()}` : '';
    const credit = course?.credit != null ? `, ${course.credit} credit` : '';
    const type = course?.course_type?.trim() ? `, ${course.course_type}` : '';
    const term = offering.term?.trim() ? `Term: ${offering.term}` : 'Term: N/A';
    const session = offering.session?.trim() ? `, Session: ${offering.session}` : '';
    return `${index + 1}. ${code}${title} (${term}${session}${credit}${type})`;
  });

  return [`Your active assigned courses:`, ...lines].join('\n');
}

async function getScheduleForDateAnswer(
  teacherId: string,
  dateInfo: DateInfo,
  label: string,
): Promise<string> {
  const slots = (await fetchTeacherSlots(teacherId))
    .filter((slot) => isSlotActiveForDate(slot, dateInfo.dateKey, dateInfo.dayIndex))
    .sort(sortSlots);

  return formatDaySchedule(slots, `${label} (${dateInfo.dayName}, ${dateInfo.dateKey})`);
}

async function getWeeklyScheduleAnswer(teacherId: string): Promise<string> {
  const slots = (await fetchTeacherSlots(teacherId))
    .filter((slot) => !slot.valid_from && !slot.valid_until)
    .sort(sortSlots);

  return formatGroupedSchedule(slots, 'Your weekly schedule:');
}

async function getNextWeekScheduleAnswer(teacherId: string): Promise<string> {
  const today = getDhakaDateInfo();
  const daysUntilNextSunday = today.dayIndex === 0 ? 7 : 7 - today.dayIndex;
  const startKey = addDaysToDateKey(today.dateKey, daysUntilNextSunday);
  const dateInfos = Array.from({ length: 7 }, (_, index) => dateInfoFromKey(addDaysToDateKey(startKey, index)));
  const slots = await fetchTeacherSlots(teacherId);

  const lines: string[] = [`Your next week schedule (${startKey} to ${dateInfos[6].dateKey}):`];

  for (const dateInfo of dateInfos) {
    const daySlots = slots
      .filter((slot) => isSlotActiveForDate(slot, dateInfo.dateKey, dateInfo.dayIndex))
      .sort(sortSlots);

    if (daySlots.length === 0) continue;

    lines.push(`${dateInfo.dayName}, ${dateInfo.dateKey}:`);
    lines.push(...daySlots.map((slot) => `- ${formatSlot(slot)}`));
  }

  if (lines.length === 1) {
    return `No scheduled classes were found for next week (${startKey} to ${dateInfos[6].dateKey}).`;
  }

  return lines.join('\n');
}

async function getNextClassAnswer(teacherId: string): Promise<string> {
  const now = new Date();
  const today = getDhakaDateInfo(now);
  const currentDhakaTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  const currentMinutes = timeToMinutes(currentDhakaTime);
  const slots = await fetchTeacherSlots(teacherId);

  for (let offset = 0; offset < 14; offset += 1) {
    const dateInfo = dateInfoFromKey(addDaysToDateKey(today.dateKey, offset));
    const daySlots = slots
      .filter((slot) => isSlotActiveForDate(slot, dateInfo.dateKey, dateInfo.dayIndex))
      .filter((slot) => offset > 0 || timeToMinutes(slot.start_time) >= currentMinutes)
      .sort(sortSlots);

    if (daySlots.length > 0) {
      return `Your next class is on ${dateInfo.dayName}, ${dateInfo.dateKey}:\n${formatSlot(daySlots[0])}`;
    }
  }

  return 'No upcoming class was found in the next 14 days.';
}

function sortSlots(left: RoutineSlotRow, right: RoutineSlotRow): number {
  if (left.day_of_week !== right.day_of_week) return left.day_of_week - right.day_of_week;
  return left.start_time.localeCompare(right.start_time);
}

function formatDaySchedule(slots: RoutineSlotRow[], label: string): string {
  if (slots.length === 0) return `You have no scheduled classes for ${label}.`;
  return [`Your schedule for ${label}:`, ...slots.map(formatSlot)].join('\n');
}

function formatGroupedSchedule(slots: RoutineSlotRow[], heading: string): string {
  if (slots.length === 0) return 'No weekly schedule slots were found for you.';

  const lines = [heading];
  for (let dayIndex = 0; dayIndex < DAY_NAMES.length; dayIndex += 1) {
    const daySlots = slots.filter((slot) => slot.day_of_week === dayIndex).sort(sortSlots);
    if (daySlots.length === 0) continue;
    lines.push(`${DAY_NAMES[dayIndex]}:`);
    lines.push(...daySlots.map((slot) => `- ${formatSlot(slot)}`));
  }

  return lines.join('\n');
}

function formatSlot(slot: RoutineSlotRow): string {
  const course = slot.course_offerings?.courses;
  const courseCode = course?.code?.trim() || 'Course';
  const title = course?.title?.trim();
  const section = slot.section?.trim();
  const sectionText = section ? `, Section ${section}` : '';
  const room = slot.room_number?.trim() || 'Not assigned';
  const time = `${trimTime(slot.start_time)} - ${trimTime(slot.end_time)}`;
  const courseLabel = title ? `${courseCode} (${title})` : courseCode;
  return `${time} : ${courseLabel} room No.: ${room}${sectionText}`;
}
