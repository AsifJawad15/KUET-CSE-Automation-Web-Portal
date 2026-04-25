import { supabase } from '@/lib/supabase';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

type SearchIntent =
  | { type: 'student'; value: string }
  | { type: 'course'; value: string }
  | { type: 'teacher'; value: string }
  | { type: 'teacher-schedule'; value: string; scope: 'weekly' | 'next-week' }
  | { type: 'class-schedule'; term: string; section?: string; dayOfWeek?: number; label: string }
  | { type: 'room'; value: string }
  | { type: 'tv'; value?: string };

type StudentRow = {
  full_name?: string | null;
  roll_no?: string | null;
  phone?: string | null;
  term?: string | null;
  session?: string | null;
  batch?: string | null;
  section?: string | null;
  cgpa?: number | null;
  profile?: { email?: string | null; is_active?: boolean | null } | null;
};

type TeacherRow = {
  user_id?: string | null;
  full_name?: string | null;
  teacher_uid?: string | null;
  phone?: string | null;
  designation?: string | null;
  department?: string | null;
  office_room?: string | null;
  is_on_leave?: boolean | null;
  leave_reason?: string | null;
  profile?: { email?: string | null; is_active?: boolean | null } | null;
};

type RoutineSlotRow = {
  room_number?: string | null;
  day_of_week?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  section?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  course_offerings?: {
    term?: string | null;
    session?: string | null;
    courses?: {
      code?: string | null;
      title?: string | null;
      credit?: number | null;
      course_type?: string | null;
    } | null;
    teachers?: {
      full_name?: string | null;
    } | null;
  } | null;
};

type CourseRow = {
  code?: string | null;
  title?: string | null;
  credit?: number | null;
  course_type?: string | null;
  description?: string | null;
};

type RoomRow = {
  room_number?: string | null;
  building_name?: string | null;
  capacity?: number | null;
  room_type?: string | null;
  facilities?: string[] | null;
  is_active?: boolean | null;
  floor_number?: string | null;
};

export function detectSystemInfoSearch(message: string): SearchIntent | null {
  const text = message.trim();
  const normalized = text.toLowerCase();

  const classSchedule = parseClassScheduleIntent(text);
  if (classSchedule) return classSchedule;

  const teacherSchedule = parseTeacherScheduleIntent(text);
  if (teacherSchedule) return teacherSchedule;

  const roll = text.match(/\broll\s*(?:no\.?|number)?\s*[:#-]?\s*(\d{4,})\b/i)?.[1];
  if (roll || (/\bstudent\b/.test(normalized) && /\b\d{4,}\b/.test(normalized))) {
    return { type: 'student', value: roll ?? normalized.match(/\b\d{4,}\b/)?.[0] ?? '' };
  }

  const course = text.match(/\b([A-Z]{2,5})\s*-?\s*(\d{3,4})\b/i);
  if (course && (/\bcourse\b|\bsubject\b|\binfo\b|\bdetails\b/.test(normalized))) {
    return { type: 'course', value: `${course[1].toUpperCase()} ${course[2]}` };
  }

  const room = text.match(/\broom\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Z]?\d{2,4}[A-Z]?)\b/i)?.[1];
  if (room) return { type: 'room', value: room.toUpperCase() };

  if (/\btv\b|\bdisplay\b/.test(normalized) && /\b(info|status|device|devices|list|show)\b/.test(normalized)) {
    const target = text.match(/\bTV\s*-?\s*(\d+)\b/i)?.[1];
    return { type: 'tv', value: target ? `TV${target}` : undefined };
  }

  if (/\bteacher\b|\bfaculty\b|\bprofessor\b|\blecturer\b|\bsir\b|\bmadam\b|\bma'am\b|\binfo\b|\binformation\b|\bdetails\b/.test(normalized)) {
    const cleaned = cleanPersonQuery(text);
    if (cleaned.length >= 2) return { type: 'teacher', value: cleaned };
  }

  return null;
}

export async function answerSystemInfoSearch(intent: SearchIntent): Promise<string> {
  switch (intent.type) {
    case 'student':
      return searchStudent(intent.value);
    case 'course':
      return searchCourse(intent.value);
    case 'teacher':
      return searchTeacher(intent.value);
    case 'teacher-schedule':
      return searchTeacherSchedule(intent.value, intent.scope);
    case 'class-schedule':
      return searchClassSchedule(intent);
    case 'room':
      return searchRoom(intent.value);
    case 'tv':
      return searchTv(intent.value);
  }
}

function academicDb() {
  return isSupabaseAdminConfigured() ? getSupabaseAdmin() : supabase;
}

async function searchStudent(rollNo: string): Promise<string> {
  if (!rollNo) return 'Please provide a student roll number.';

  const { data, error } = await academicDb()
    .from('students')
    .select(`
      full_name, roll_no, phone, term, session, batch, section, cgpa,
      profile:profiles(email, is_active)
    `)
    .eq('roll_no', rollNo)
    .maybeSingle();

  if (error) throw error;
  if (!data) return `No student found for Roll No. ${rollNo}.`;

  const student = data as StudentRow;
  return [
    `Student Information`,
    `Roll: ${student.roll_no ?? rollNo}`,
    `Name: ${student.full_name ?? 'N/A'}`,
    `Email: ${student.profile?.email ?? 'N/A'}`,
    `Phone: ${student.phone ?? 'N/A'}`,
    `Term: ${student.term ?? 'N/A'}`,
    `Section: ${student.section ?? 'N/A'}`,
    `Session: ${student.session ?? 'N/A'}`,
    `Batch: ${student.batch ?? 'N/A'}`,
    `CGPA: ${student.cgpa ?? 'N/A'}`,
    `Status: ${student.profile?.is_active === false ? 'Inactive' : 'Active'}`,
  ].join('\n');
}

async function searchCourse(courseCode: string): Promise<string> {
  const normalizedCode = courseCode.replace(/\s+/, ' ').toUpperCase();
  const { data, error } = await academicDb()
    .from('courses')
    .select('code, title, credit, course_type, description')
    .eq('code', normalizedCode)
    .maybeSingle();

  if (error) throw error;
  if (!data) return `No course found for ${normalizedCode}.`;

  const course = data as CourseRow;
  return [
    `Course Information`,
    `Code: ${course.code ?? normalizedCode}`,
    `Title: ${course.title ?? 'N/A'}`,
    `Credit: ${course.credit ?? 'N/A'}`,
    `Type: ${course.course_type ?? 'N/A'}`,
    `Description: ${course.description ?? 'N/A'}`,
  ].join('\n');
}

async function searchTeacher(query: string): Promise<string> {
  const { data, error } = await academicDb()
    .from('teachers')
    .select(`
      user_id, full_name, teacher_uid, phone, designation, department, office_room, is_on_leave, leave_reason,
      profile:profiles(email, is_active)
    `)
    .or(`full_name.ilike.%${query}%,teacher_uid.ilike.%${query}%`)
    .limit(5);

  if (error) throw error;
  const teachers = (data ?? []) as TeacherRow[];
  if (teachers.length === 0) return `No teacher found for "${query}".`;

  return [
    teachers.length === 1 ? `Teacher Information` : `Teacher Search Results`,
    ...teachers.map((teacher, index) => [
      `${index + 1}. ${teacher.full_name ?? 'N/A'}`,
      `   ID: ${teacher.teacher_uid ?? 'N/A'}`,
      `   Designation: ${teacher.designation ?? 'N/A'}`,
      `   Email: ${teacher.profile?.email ?? 'N/A'}`,
      `   Phone: ${teacher.phone ?? 'N/A'}`,
      `   Office: ${teacher.office_room ?? 'N/A'}`,
      `   Status: ${teacher.is_on_leave ? `On leave${teacher.leave_reason ? ` (${teacher.leave_reason})` : ''}` : 'Available'}`,
    ].join('\n')),
  ].join('\n');
}

async function searchTeacherSchedule(query: string, scope: 'weekly' | 'next-week'): Promise<string> {
  const teacher = await findBestTeacher(query);
  if (!teacher?.user_id) return `No teacher found for "${query}".`;

  const slots = await fetchTeacherSlots(teacher.user_id);
  const heading = scope === 'next-week'
    ? `Next Week Schedule for ${teacher.full_name ?? query}`
    : `Weekly Schedule for ${teacher.full_name ?? query}`;

  const regularSlots = slots
    .filter((slot) => !slot.valid_from && !slot.valid_until)
    .sort(sortSlots);

  return formatGroupedSchedule(regularSlots, heading);
}

async function searchClassSchedule(intent: Extract<SearchIntent, { type: 'class-schedule' }>): Promise<string> {
  let query = academicDb()
    .from('routine_slots')
    .select(`
      room_number, day_of_week, start_time, end_time, section, valid_from, valid_until,
      course_offerings!inner (
        term, session,
        courses ( code, title, credit, course_type ),
        teachers!course_offerings_teacher_user_id_fkey ( full_name )
      )
    `)
    .eq('course_offerings.term', intent.term)
    .is('valid_from', null)
    .is('valid_until', null);

  if (intent.section) query = query.eq('section', intent.section);
  if (intent.dayOfWeek !== undefined) query = query.eq('day_of_week', intent.dayOfWeek);

  const { data, error } = await query;
  if (error) throw error;

  const slots = ((data ?? []) as RoutineSlotRow[]).sort(sortSlots);
  const dayPrefix = intent.dayOfWeek !== undefined ? `${DAY_NAMES[intent.dayOfWeek]} ` : '';
  const sectionSuffix = intent.section ? ` Section ${intent.section}` : '';
  return formatGroupedSchedule(
    slots,
    `${dayPrefix}Class Schedule for ${intent.label}${sectionSuffix}`,
  );
}

async function searchRoom(roomNumber: string): Promise<string> {
  const { data, error } = await academicDb()
    .from('rooms')
    .select('room_number, building_name, capacity, room_type, facilities, is_active, floor_number')
    .eq('room_number', roomNumber)
    .maybeSingle();

  if (error) throw error;
  if (!data) return `No room found for Room No. ${roomNumber}.`;

  const room = data as RoomRow;
  return [
    `Room Information`,
    `Room No.: ${room.room_number ?? roomNumber}`,
    `Building: ${room.building_name ?? 'N/A'}`,
    `Floor: ${room.floor_number ?? 'N/A'}`,
    `Type: ${room.room_type ?? 'N/A'}`,
    `Capacity: ${room.capacity ?? 'N/A'}`,
    `Facilities: ${room.facilities?.length ? room.facilities.join(', ') : 'N/A'}`,
    `Status: ${room.is_active === false ? 'Inactive' : 'Active'}`,
  ].join('\n');
}

async function searchTv(target?: string): Promise<string> {
  const { cmsSupabase } = await import('@/services/cmsService');

  let query = cmsSupabase
    .from('cms_tv_devices')
    .select('name, label, location, is_active, show_room_schedule')
    .order('name', { ascending: true });

  if (target) query = query.eq('name', target);

  const { data, error } = await query;
  if (error) throw error;

  const devices = (data ?? []) as Array<{
    name: string;
    label: string | null;
    location: string | null;
    is_active: boolean;
    show_room_schedule: boolean;
  }>;

  if (devices.length === 0) return target ? `No TV device found for ${target}.` : 'No TV devices found.';

  return [
    target ? `${target} Information` : 'TV Device Information',
    ...devices.map((device, index) => [
      `${index + 1}. ${device.name}${device.label ? ` (${device.label})` : ''}`,
      `   Location: ${device.location ?? 'N/A'}`,
      `   Status: ${device.is_active ? 'Active' : 'Inactive'}`,
      `   Room Schedule: ${device.show_room_schedule ? 'Shown' : 'Hidden'}`,
    ].join('\n')),
  ].join('\n');
}

async function findBestTeacher(query: string): Promise<TeacherRow | null> {
  const { data, error } = await academicDb()
    .from('teachers')
    .select(`
      user_id, full_name, teacher_uid, phone, designation, department, office_room, is_on_leave, leave_reason,
      profile:profiles(email, is_active)
    `)
    .or(`full_name.ilike.%${query}%,teacher_uid.ilike.%${query}%`)
    .limit(10);

  if (error) throw error;

  const teachers = (data ?? []) as TeacherRow[];
  if (teachers.length <= 1) return teachers[0] ?? null;

  const tokens = normalizeName(query).split(' ').filter(Boolean);
  return teachers
    .map((teacher) => ({
      teacher,
      score: tokens.filter((token) => normalizeName(teacher.full_name ?? '').includes(token)).length,
    }))
    .sort((left, right) => right.score - left.score)[0]?.teacher ?? teachers[0];
}

async function fetchTeacherSlots(teacherId: string): Promise<RoutineSlotRow[]> {
  const { data, error } = await academicDb()
    .from('routine_slots')
    .select(`
      room_number, day_of_week, start_time, end_time, section, valid_from, valid_until,
      course_offerings!inner (
        term, session, teacher_user_id, is_active,
        courses ( code, title, credit, course_type ),
        teachers!course_offerings_teacher_user_id_fkey ( full_name )
      )
    `)
    .eq('course_offerings.teacher_user_id', teacherId)
    .eq('course_offerings.is_active', true);

  if (error) throw error;
  return (data ?? []) as RoutineSlotRow[];
}

function parseTeacherScheduleIntent(text: string): SearchIntent | null {
  const lower = text.toLowerCase();
  if (!/\b(schedule|routine|timetable|class)\b/.test(lower)) return null;
  if (!/\bsir\b|\bmadam\b|\bma'am\b|\bteacher\b|\bfaculty\b/.test(lower)) return null;

  const scope = /\bnext\s+week\b|\bupcoming\s+week\b/.test(lower) ? 'next-week' : 'weekly';
  const teacherName = cleanPersonQuery(text)
    .replace(/\b(next|upcoming|full|all|weekly|week|schedule|routine|timetable|class|classes)\b/gi, '')
    .trim();

  return teacherName.length >= 2 ? { type: 'teacher-schedule', value: teacherName, scope } : null;
}

function parseClassScheduleIntent(text: string): SearchIntent | null {
  const lower = text.toLowerCase();
  if (!/\b(schedule|routine|timetable|class)\b/.test(lower)) return null;

  const term = parseTerm(text);
  if (!term) return null;

  const section = text.match(/\bsection\s*([A-Z])\b/i)?.[1]?.toUpperCase();
  const dayOfWeek = parseDayOfWeek(lower);

  return {
    type: 'class-schedule',
    term,
    section,
    dayOfWeek,
    label: termToLabel(term),
  };
}

function parseTerm(text: string): string | null {
  const direct = text.match(/\b([1-4])\s*[-/]\s*([1-2])\b/) ?? text.match(/\b([1-4])\s+([1-2])\b/);
  if (direct) return `${direct[1]}-${direct[2]}`;

  const year = parseOrdinal(text, 'year');
  const semester = parseOrdinal(text, 'semester') ?? parseOrdinal(text, 'term');
  if (year && semester) return `${year}-${semester}`;

  return null;
}

function parseOrdinal(text: string, unit: 'year' | 'semester' | 'term'): string | null {
  const match = text.match(new RegExp(`\\b(1st|first|1|2nd|second|2|3rd|third|3|4th|fourth|4)\\s+${unit}\\b`, 'i'));
  const value = match?.[1]?.toLowerCase();
  if (!value) return null;
  if (['1st', 'first', '1'].includes(value)) return '1';
  if (['2nd', 'second', '2'].includes(value)) return '2';
  if (['3rd', 'third', '3'].includes(value)) return '3';
  if (['4th', 'fourth', '4'].includes(value)) return '4';
  return null;
}

function parseDayOfWeek(text: string): number | undefined {
  return DAY_NAMES.findIndex((day) => text.includes(day.toLowerCase())) !== -1
    ? DAY_NAMES.findIndex((day) => text.includes(day.toLowerCase()))
    : undefined;
}

function cleanPersonQuery(text: string): string {
  return text
    .replace(/\b(give|find|show|get|search|full|all|info|information|details|about|teacher|faculty|professor|lecturer|schedule|routine|timetable|class|classes|next|week|sir|madam|ma'am)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function sortSlots(left: RoutineSlotRow, right: RoutineSlotRow): number {
  const leftDay = left.day_of_week ?? 0;
  const rightDay = right.day_of_week ?? 0;
  if (leftDay !== rightDay) return leftDay - rightDay;
  return String(left.start_time ?? '').localeCompare(String(right.start_time ?? ''));
}

function trimTime(value?: string | null): string {
  return value && value.length >= 5 ? value.slice(0, 5) : value || 'N/A';
}

function termToLabel(term: string): string {
  const [year, semester] = term.split('-');
  return `${ordinal(year)} Year ${ordinal(semester)} Semester`;
}

function ordinal(value: string): string {
  return value === '1' ? '1st' : value === '2' ? '2nd' : value === '3' ? '3rd' : `${value}th`;
}

function formatGroupedSchedule(slots: RoutineSlotRow[], heading: string): string {
  if (slots.length === 0) return `${heading}\nNo schedule slots found.`;

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
  const teacher = slot.course_offerings?.teachers?.full_name;
  const courseCode = course?.code ?? 'Course';
  const title = course?.title ? ` (${course.title})` : '';
  const room = slot.room_number || 'Not assigned';
  const section = slot.section ? `, Section ${slot.section}` : '';
  const teacherText = teacher ? `, ${teacher}` : '';
  return `${trimTime(slot.start_time)} - ${trimTime(slot.end_time)} : ${courseCode}${title} room No.: ${room}${section}${teacherText}`;
}
