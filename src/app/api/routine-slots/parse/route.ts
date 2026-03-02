// ==========================================
// API: /api/routine-slots/parse
// Parse uploaded files (CSV/DOCX) into structured routine data
// Handles KUET class schedule grid format
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { internalError, badRequest } from '@/lib/apiResponse';

// ── Types ──────────────────────────────────────────────

interface ParsedSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  course_code: string;
  course_title: string;
  course_type: string;
  teacher_name: string;
  room_number: string;
  section: string;
  term: string;
  session: string;
}

interface TeacherInfo {
  fullName: string;
  initials: string;
}

interface CourseInfo {
  code: string;
  title: string;
  type: string;
}

// ── Constants ──────────────────────────────────────────

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
];

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0, su: 0,
  monday: 1, mon: 1, mo: 1,
  tuesday: 2, tue: 2, tu: 2,
  wednesday: 3, wed: 3, we: 3,
  thursday: 4, thu: 4, th: 4,
  saturday: 5, sat: 5, sa: 5,
  friday: 6, fri: 6, fr: 6,
};

const LAB_COURSE_PATTERN = /\blab(?:oratory)?\b|\bsessional\b|\bdevelopment\s+project\b|\bseminar\b|\btechnical\s+writing\b/i;

// ── Helpers ────────────────────────────────────────────

function parseDayValue(raw: string): number | null {
  const cleaned = raw.toLowerCase().trim().replace(/[^a-z]/g, '');
  if (DAY_MAP[cleaned] !== undefined) return DAY_MAP[cleaned];
  for (const [key, val] of Object.entries(DAY_MAP)) {
    if (key.startsWith(cleaned) && cleaned.length >= 2) return val;
  }
  return null;
}

/** Normalize course code: "CSE3201" → "CSE 3201" */
function normalizeCourseCode(raw: string): string {
  let code = raw.trim().toUpperCase();
  code = code.replace(/[^A-Z0-9\s]+$/, '');
  code = code.replace(/([A-Z])(\d)/, '$1 $2');
  return code;
}

/** Determine if a course is a lab/sessional based on code or title */
function isLabCourse(code: string, title: string): boolean {
  const digits = code.replace(/[^0-9]/g, '');
  if (digits.length >= 4) {
    const lastDigit = parseInt(digits[3]);
    if (lastDigit === 0 || lastDigit % 2 === 0) return true;
  }
  return LAB_COURSE_PATTERN.test(title) || LAB_COURSE_PATTERN.test(code);
}

/** Derive term from course code digits e.g. "CSE 3201" → "3-2" */
function deriveTermFromCode(code: string): string | null {
  const digits = code.replace(/[^0-9]/g, '');
  if (digits.length >= 2) {
    const year = parseInt(digits[0]);
    const sem = parseInt(digits[1]);
    if (year >= 1 && year <= 4 && sem >= 1 && sem <= 2) return `${year}-${sem}`;
  }
  return null;
}

/** Parse session from text like "2023-2024" */
function parseSessionStr(text: string): string | null {
  const match = text.match(/\b(20\d{2})\s*[-–]\s*(20\d{2})\b/);
  return match ? `${match[1]}-${match[2]}` : null;
}

/** Parse section from text like "SEC - A" */
function parseSectionStr(text: string): string | null {
  const match = text.match(/\bSEC(?:TION)?\s*[-–:]\s*([A-Z])\b/i);
  return match ? match[1].toUpperCase() : null;
}

/** Parse term from text like "3rd Year 2nd Term" */
function parseTermStr(text: string): string | null {
  const ytMatch = text.match(/(\d)\s*(?:st|nd|rd|th|"|")?\s*Year\s*(\d)\s*(?:st|nd|rd|th|"|")?\s*Term/i);
  if (ytMatch) return `${ytMatch[1]}-${ytMatch[2]}`;
  const dirMatch = text.match(/\b([1-4])\s*[-–]\s*([12])\b/);
  return dirMatch ? `${dirMatch[1]}-${dirMatch[2]}` : null;
}

// ── Teacher List Parser ────────────────────────────────

function parseTeacherList(text: string): TeacherInfo[] {
  const teachers: TeacherInfo[] = [];
  const pattern = /(?:Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.|Md\.)\s*(?:Md\.?\s*)?([A-Za-z][\w\s.'-]+?)\s*\(([A-Z]{2,5})\)/g;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const fullName = m[0].split('(')[0].trim();
    const initials = m[2].trim();
    if (!teachers.find(t => t.initials === initials)) {
      teachers.push({ fullName, initials });
    }
  }
  return teachers;
}

// ── Course List Parser ─────────────────────────────────

function parseCourseList(text: string): CourseInfo[] {
  const courses: CourseInfo[] = [];
  // Parse line by line to avoid greedy cross-line matching
  const lines = text.split(/\n/);
  for (const line of lines) {
    const pattern = /([A-Z]{2,5}\s*\d{3,4}[A-Z]?)\s*[|:]\s*([A-Za-z][^\n|]*?)\s*$/gm;
    let m;
    while ((m = pattern.exec(line)) !== null) {
      const code = normalizeCourseCode(m[1]);
      let title = m[2].trim().replace(/\s+/g, ' ');
      // Truncate title if it contains another course code
      const nextCode = title.match(/\b[A-Z]{2,5}\s*\d{3,4}/);
      if (nextCode) title = title.slice(0, nextCode.index).trim();
      if (!title || !code) continue;
      if (!courses.find(c => c.code === code)) {
        courses.push({ code, title, type: isLabCourse(code, title) ? 'Lab' : 'Theory' });
      }
    }
  }
  return courses;
}

// ── Room Assignment Parser ─────────────────────────────

function parseRoomAssignments(text: string): Map<string, string> {
  const roomMap = new Map<string, string>();
  const roomLines = text.match(/Room\s*No\.?\s*:?\s*(.*?)(?:\n|$)/gi);
  if (!roomLines) return roomMap;

  for (const line of roomLines) {
    // Theory room
    const theoryMatch = line.match(/Theory\s*:?\s*([\w-]+)/i);
    if (theoryMatch) roomMap.set('default', theoryMatch[1]);

    // Lab rooms: CSE-201 (3212), CSE-103 (3218)
    const labPattern = /([\w-]+)\s*\(([^)]+)\)/g;
    let m;
    while ((m = labPattern.exec(line)) !== null) {
      const room = m[1].trim();
      const nums = m[2].split(/[,\s]+/).filter(Boolean);
      for (const num of nums) {
        const cleaned = num.replace(/[^0-9]/g, '');
        if (cleaned.length >= 3) roomMap.set(cleaned, room);
      }
    }
  }
  return roomMap;
}

function findRoom(code: string, roomMap: Map<string, string>, courseType: string): string {
  const digits = code.replace(/[^0-9]/g, '');
  if (roomMap.has(digits)) return roomMap.get(digits)!;
  if (digits.length >= 4 && roomMap.has(digits.slice(-4))) return roomMap.get(digits.slice(-4))!;
  if (courseType !== 'Lab' && roomMap.has('default')) return roomMap.get('default')!;
  return roomMap.get('default') || '';
}

// ── Grid Schedule Parser ───────────────────────────────

function parseScheduleGrid(
  text: string,
  teachers: TeacherInfo[],
  courses: CourseInfo[],
  roomMap: Map<string, string>,
  term: string,
  session: string,
  section: string,
): { slots: ParsedSlot[]; errors: string[] } {
  const slots: ParsedSlot[] = [];
  const errors: string[] = [];

  // Build lookups
  const initialsMap = new Map<string, string>();
  for (const t of teachers) initialsMap.set(t.initials, t.fullName);

  const courseMap = new Map<string, CourseInfo>();
  for (const c of courses) {
    courseMap.set(c.code, c);
    const digits = c.code.replace(/[^0-9]/g, '');
    if (!courseMap.has(digits)) courseMap.set(digits, c);
  }

  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const COURSE_RE = /\b([A-Z]{2,5})\s*[-]?\s*(\d{3,4})[A-Za-z]?\b/g;
  const DAY_RE = /\b(Sun(?:day)?|Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Sat(?:urday)?|Fri(?:day)?|Sund|Mond|Tuesd|Wednesd|Thursd|Saturd)\b/i;

  let currentDay: number | null = null;
  let periodCounter = 0;
  const processedKeys = new Set<string>();
  // Track lab period start per day so parallel labs share the same slot
  const labPeriodStartPerDay = new Map<number, number>();

  // Known non-course uppercase codes to ignore
  const IGNORE_CODES = new Set(['SEC', 'ECE', 'EEE', 'BME', 'IPE', 'URP', 'BEE', 'TUM', 'AND', 'THE', 'FOR', 'LAB']);

  for (const line of lines) {
    // Skip header/footer lines
    if (/Department of|University of|List of|Room\s*No|Course Coordinator|Head of|Class Starting|Period|Recess/i.test(line)) continue;

    // Detect day
    const dayMatch = line.match(DAY_RE);
    if (dayMatch) {
      const d = parseDayValue(dayMatch[1]);
      if (d !== null) {
        currentDay = d;
        periodCounter = 0;
      }
    }

    if (currentDay === null) continue;

    // Find all course codes on this line
    COURSE_RE.lastIndex = 0;
    let courseMatch: RegExpExecArray | null;
    const foundCourses: { code: string; matchStart: number; endPos: number; afterText: string }[] = [];

    while ((courseMatch = COURSE_RE.exec(line)) !== null) {
      const prefix = courseMatch[1];
      const codeNum = courseMatch[2];
      const fullCode = normalizeCourseCode(`${prefix}${codeNum}`);

      // Validate: must have first digit 1-4 (year) and 4+ digits total
      const firstDigit = parseInt(codeNum[0]);
      if (firstDigit < 1 || firstDigit > 4) continue;
      if (IGNORE_CODES.has(prefix) && !courseMap.has(fullCode) && codeNum.length < 4) continue;

      foundCourses.push({
        code: fullCode,
        matchStart: courseMatch.index,
        endPos: courseMatch.index + courseMatch[0].length,
        afterText: '',
      });
    }

    // Set afterText for each course: limited to text before the NEXT course code
    for (let ci = 0; ci < foundCourses.length; ci++) {
      const nextStart = ci + 1 < foundCourses.length
        ? foundCourses[ci + 1].matchStart
        : line.length;
      foundCourses[ci].afterText = line.slice(foundCourses[ci].endPos, nextStart).trim();
    }

    for (const { code, afterText } of foundCourses) {
      const courseInfo = courseMap.get(code);
      const courseTitle = courseInfo?.title || '';
      const courseIsLab = courseInfo ? courseInfo.type === 'Lab' : isLabCourse(code, courseTitle);
      const courseType = courseIsLab ? 'Lab' : 'Theory';

      // ── Extract teacher ──
      let teacherName = '';

      // Pattern 1: (INITIALS) immediately after code — e.g. "CSE 3219 (EK)"
      const parenMatch = afterText.match(/^\s*\(([A-Z]{2,5})\)/);
      if (parenMatch && initialsMap.has(parenMatch[1])) {
        teacherName = initialsMap.get(parenMatch[1])!;
      }

      // Pattern 2: (INIT1/INIT2) or (INIT1+INIT2) — combined teachers
      if (!teacherName) {
        const comboMatch = afterText.match(/^\s*\(([A-Z]{2,5})\s*[/+&,]\s*([A-Z]{2,5})\)/);
        if (comboMatch) {
          const t1 = initialsMap.get(comboMatch[1]) || comboMatch[1];
          teacherName = t1; // Use first teacher
        }
      }

      // Pattern 3: Section split — (A1/A2) (TEACHER + TEACHER) or (A1/A2)(TEACHER+TEACHER)
      if (!teacherName) {
        const splitRe = /\(([AB])(\d)\/([AB])(\d)\)\s*\(?([A-Z]{2,5})\s*[+/&,]\s*([A-Z]{2,5})\)?/;
        const splitMatch = afterText.match(splitRe);
        if (splitMatch) {
          // splitMatch: (A1/A2) (TEACHER1 + TEACHER2)
          // If we're parsing section A: A1 → TEACHER1, A2 → TEACHER2
          const sub1 = parseInt(splitMatch[2]);
          const t1 = splitMatch[5];
          const t2 = splitMatch[6];
          // Default: use first teacher (for 1st sub-group)
          // If section matches the 2nd group: use t2
          if (sub1 === 1) {
            teacherName = initialsMap.get(t1) || t1;
          } else {
            teacherName = initialsMap.get(t2) || t2;
          }
        }
      }

      // Pattern 4: Standalone initials after the course code
      if (!teacherName) {
        const standaloneMatch = afterText.match(/\b([A-Z]{2,5})\b/);
        if (standaloneMatch && initialsMap.has(standaloneMatch[1])) {
          teacherName = initialsMap.get(standaloneMatch[1])!;
        }
      }

      // ── Room ──
      const room = findRoom(code, roomMap, courseType);

      // ── Period tracking ──
      // Determine if this is a 3-period lab session vs 1-period class:
      // Only use 3-period span if:
      //   a) Section split (A1/A2) or (B1/B2) present (clear lab indicator), OR
      //   b) Title explicitly contains "Laboratory" and course is lab type
      const hasSectionSplit = /\([AB]\d\/[AB]\d\)/.test(afterText);
      const isFullLab = courseIsLab && (hasSectionSplit || /laboratory/i.test(courseTitle));

      let periodIdx: number;
      let endIdx: number;

      if (isFullLab) {
        // Full lab session: 3 periods. Parallel labs on the same day share the same period range.
        if (labPeriodStartPerDay.has(currentDay)) {
          periodIdx = labPeriodStartPerDay.get(currentDay)!;
        } else {
          periodIdx = Math.min(periodCounter, PERIODS.length - 1);
          labPeriodStartPerDay.set(currentDay, periodIdx);
          periodCounter += 3;
        }
        endIdx = Math.min(periodIdx + 2, PERIODS.length - 1);
      } else {
        // Theory or non-lab sessional (project, seminar, etc.): 1 period
        periodIdx = Math.min(periodCounter, PERIODS.length - 1);
        endIdx = periodIdx;
        periodCounter += 1;
      }

      // ── Dedup ──
      const slotKey = `${currentDay}-${code}-${section}-${teacherName}`;
      if (processedKeys.has(slotKey)) continue;
      processedKeys.add(slotKey);

      slots.push({
        day_of_week: currentDay,
        start_time: PERIODS[periodIdx].start,
        end_time: PERIODS[endIdx].end,
        course_code: code,
        course_title: courseTitle,
        course_type: courseType,
        teacher_name: teacherName || 'TBA',
        room_number: room,
        section,
        term: term || deriveTermFromCode(code) || '',
        session,
      });
    }
  }

  if (slots.length === 0) {
    errors.push('Could not parse routine slots from the text. Try using CSV format for best results.');
  }

  return { slots, errors };
}

// ── CSV Parser ─────────────────────────────────────────

function parseCSVServer(
  text: string,
  term: string,
  session: string,
  section: string,
): { slots: ParsedSlot[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { slots: [], errors: ['CSV must have header + data rows.'] };

  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const col = (names: string[]) => header.findIndex(h => names.some(n => h.includes(n)));

  const dayIdx = col(['day']);
  const psIdx = col(['period_start', 'start_period', 'from', 'start']);
  const peIdx = col(['period_end', 'end_period', 'to', 'end']);
  const codeIdx = col(['course_code', 'code', 'course']);
  const titleIdx = col(['course_title', 'title', 'name']);
  const typeIdx = col(['course_type', 'type']);
  const teacherIdx = col(['teacher_name', 'teacher', 'instructor', 'faculty']);
  const roomIdx = col(['room_number', 'room', 'venue']);
  const sectionIdx = col(['section', 'sec']);

  if (dayIdx === -1 || codeIdx === -1) {
    return { slots: [], errors: ['CSV must have at least "day" and "course_code" columns.'] };
  }

  const slots: ParsedSlot[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]
      .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      ?.map(c => c.replace(/^"|"$/g, '').trim()) || lines[i].split(',').map(c => c.trim());

    const dayVal = parseDayValue(cols[dayIdx] || '');
    if (dayVal === null) { errors.push(`Row ${i + 1}: Invalid day "${cols[dayIdx]}"`); continue; }

    // Handle time columns: can be period numbers (1-9) or time strings (HH:MM)
    let startTime: string;
    let endTime: string;
    const rawStart = psIdx !== -1 ? (cols[psIdx] || '').trim() : '';
    const rawEnd = peIdx !== -1 ? (cols[peIdx] || '').trim() : '';

    if (rawStart.includes(':')) {
      // Time string format (HH:MM) — use directly
      startTime = rawStart;
      endTime = rawEnd.includes(':') ? rawEnd : rawStart;
    } else if (rawStart) {
      // Period number format (1-9) — map to PERIODS
      const ps = parseInt(rawStart) - 1;
      const pe = rawEnd ? parseInt(rawEnd) - 1 : ps;
      if (ps < 0 || ps >= PERIODS.length || pe < 0 || pe >= PERIODS.length) {
        errors.push(`Row ${i + 1}: Invalid period (${rawStart}-${rawEnd})`);
        continue;
      }
      startTime = PERIODS[ps].start;
      endTime = PERIODS[Math.max(ps, pe)].end;
    } else {
      // No start/end — default to period 1
      startTime = PERIODS[0].start;
      endTime = PERIODS[0].end;
    }

    const rawCode = cols[codeIdx]?.trim();
    if (!rawCode) { errors.push(`Row ${i + 1}: Missing course code`); continue; }

    const courseCode = normalizeCourseCode(rawCode);
    const courseTitle = titleIdx !== -1 ? (cols[titleIdx] || '') : '';
    const courseType = typeIdx !== -1 ? (cols[typeIdx] || 'Theory') : (isLabCourse(courseCode, courseTitle) ? 'Lab' : 'Theory');

    slots.push({
      day_of_week: dayVal,
      start_time: startTime,
      end_time: endTime,
      course_code: courseCode,
      course_title: courseTitle,
      course_type: courseType,
      teacher_name: teacherIdx !== -1 ? (cols[teacherIdx] || 'TBA') : 'TBA',
      room_number: roomIdx !== -1 ? (cols[roomIdx] || '') : '',
      section: sectionIdx !== -1 ? (cols[sectionIdx] || section) : section,
      term: term || deriveTermFromCode(courseCode) || '',
      session,
    });
  }

  return { slots, errors };
}

// ── Full Text Parser ───────────────────────────────────

/** Split text into section blocks: { 'A': text, 'B': text } */
function splitBySections(text: string): Map<string, string> {
  const blocks = new Map<string, string>();
  // Find all section markers: SEC-A, SEC - A, SECTION A, Sec A, etc.
  const SEC_RE = /\bSEC(?:TION)?\s*[-–:\s]*([A-Z])\b/gi;
  const markers: { section: string; index: number }[] = [];
  let m;
  while ((m = SEC_RE.exec(text)) !== null) {
    markers.push({ section: m[1].toUpperCase(), index: m.index });
  }

  if (markers.length === 0) {
    // No section markers found — treat entire text as one block
    return blocks;
  }

  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
    const sec = markers[i].section;
    const blockText = text.slice(start, end);
    // Append if section appears multiple times (e.g. header + schedule)
    blocks.set(sec, (blocks.get(sec) || '') + '\n' + blockText);
  }

  return blocks;
}

function parseTextServer(
  text: string,
  term: string,
  session: string,
  section: string,
): { slots: ParsedSlot[]; errors: string[] } {
  const info: string[] = [];

  // Auto-detect metadata from full text (before splitting by section)
  const detectedTerm = parseTermStr(text) || term;
  const detectedSession = parseSessionStr(text) || session;

  if (detectedTerm && detectedTerm !== term) info.push(`Auto-detected term: ${detectedTerm}`);
  if (detectedSession && detectedSession !== session) info.push(`Auto-detected session: ${detectedSession}`);

  // Extract metadata from full text
  const teachers = parseTeacherList(text);
  if (teachers.length > 0) {
    info.push(`Found ${teachers.length} teacher(s): ${teachers.map(t => `${t.initials}=${t.fullName}`).join(', ')}`);
  }

  const courses = parseCourseList(text);
  if (courses.length > 0) {
    info.push(`Found ${courses.length} course(s): ${courses.map(c => `${c.code} (${c.type})`).join(', ')}`);
  }

  const roomMap = parseRoomAssignments(text);
  if (roomMap.size > 0) {
    const entries = Array.from(roomMap.entries()).map(([k, v]) => `${k}→${v}`).join(', ');
    info.push(`Room assignments: ${entries}`);
  }

  // Split text by section blocks
  const sectionBlocks = splitBySections(text);
  const allSlots: ParsedSlot[] = [];
  const allErrors: string[] = [...info];
  const useTerm = detectedTerm || term;
  const useSession = detectedSession || session;

  if (sectionBlocks.size > 0) {
    // Parse each section block separately
    info.push(`Found section blocks: ${Array.from(sectionBlocks.keys()).join(', ')}`);

    // If user specified a section, only parse that one; otherwise parse all
    const targetSections = section
      ? sectionBlocks.has(section.toUpperCase()) ? [section.toUpperCase()] : Array.from(sectionBlocks.keys())
      : Array.from(sectionBlocks.keys());

    for (const sec of targetSections) {
      const blockText = sectionBlocks.get(sec);
      if (!blockText) continue;

      const result = parseScheduleGrid(
        blockText, teachers, courses, roomMap,
        useTerm, useSession, sec,
      );

      if (result.slots.length > 0) {
        allSlots.push(...result.slots);
        allErrors.push(`Section ${sec}: parsed ${result.slots.length} slot(s)`);
      }
      allErrors.push(...result.errors);
    }
  } else {
    // No section markers — parse full text with provided section
    const result = parseScheduleGrid(
      text, teachers, courses, roomMap,
      useTerm, useSession, section || 'A',
    );
    allSlots.push(...result.slots);
    allErrors.push(...result.errors);
  }

  return { slots: allSlots, errors: allErrors };
}

// ── POST Handler ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const term = (formData.get('term') as string) || '';
    const session = (formData.get('session') as string) || '';
    const section = (formData.get('section') as string) || 'A';

    if (!file) return badRequest('No file provided');

    const fileName = file.name.toLowerCase();
    let result: { slots: ParsedSlot[]; errors: string[] };

    if (fileName.endsWith('.csv')) {
      const text = await file.text();
      result = parseCSVServer(text, term, session, section);
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const mammoth = await import('mammoth');
      const docResult = await mammoth.extractRawText({ buffer });
      result = parseTextServer(docResult.value, term, session, section);
      if (result.slots.length === 0) {
        result.errors.push('Extracted text preview (first 500 chars): ' + docResult.value.slice(0, 500));
      }
    } else {
      return badRequest('Unsupported file format. Use CSV or DOCX.');
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to parse file';
    return internalError(msg);
  }
}
