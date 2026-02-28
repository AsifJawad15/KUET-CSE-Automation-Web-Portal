// ==========================================
// Routine File Parser
// Single Responsibility: Parse uploaded files into ParsedRoutineSlot[]
// Open/Closed: Each format parser is independent, easy to extend
// ==========================================

import { PERIODS } from './constants';
import type { ParsedRoutineSlot, DisplaySlot } from './types';

// ── Day Mapping ────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0, su: 0,
  monday: 1, mon: 1, mo: 1,
  tuesday: 2, tue: 2, tu: 2,
  wednesday: 3, wed: 3, we: 3,
  thursday: 4, thu: 4, th: 4,
};

function parseDayValue(raw: string): number | null {
  const key = raw.toLowerCase().trim();
  return DAY_MAP[key] ?? null;
}

// ── CSV Parser ─────────────────────────────────────────

/**
 * Parse CSV text into ParsedRoutineSlot[].
 * Expected columns: day, period_start, period_end, course_code,
 *   course_title (opt), course_type (opt), teacher_name, room_number
 */
export function parseCSVText(
  csvText: string,
  term: string,
  session: string,
  section: string,
): { slots: ParsedRoutineSlot[]; errors: string[] } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return { slots: [], errors: ['CSV must have header + at least 1 data row.'] };

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));

  // Flexible column lookup
  const col = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const dayIdx = col(['day']);
  const psIdx = col(['period_start', 'start_period', 'from']);
  const peIdx = col(['period_end', 'end_period', 'to']);
  const codeIdx = col(['course_code', 'code', 'course']);
  const titleIdx = col(['course_title', 'title']);
  const typeIdx = col(['course_type', 'type']);
  const teacherIdx = col(['teacher_name', 'teacher', 'instructor']);
  const roomIdx = col(['room_number', 'room']);

  if (dayIdx === -1 || codeIdx === -1 || teacherIdx === -1) {
    return { slots: [], errors: ['CSV must have day, course_code, teacher_name columns.'] };
  }

  const slots: ParsedRoutineSlot[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]
      .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      ?.map((c) => c.replace(/^"|"$/g, '').trim()) || lines[i].split(',').map((c) => c.trim());

    const dayVal = parseDayValue(cols[dayIdx] || '');
    if (dayVal === null) {
      errors.push(`Row ${i + 1}: Invalid day "${cols[dayIdx]}"`);
      continue;
    }

    const ps = (psIdx !== -1 ? parseInt(cols[psIdx]) : 1) - 1;
    const pe = (peIdx !== -1 ? parseInt(cols[peIdx]) : ps + 1) - 1;
    if (ps < 0 || pe >= PERIODS.length || ps > pe) {
      errors.push(`Row ${i + 1}: Invalid period range`);
      continue;
    }

    const courseCode = cols[codeIdx]?.trim();
    if (!courseCode) { errors.push(`Row ${i + 1}: Missing course code`); continue; }

    slots.push({
      day_of_week: dayVal,
      start_time: PERIODS[ps].start,
      end_time: PERIODS[pe].end,
      course_code: courseCode,
      course_title: titleIdx !== -1 ? (cols[titleIdx] || '') : '',
      course_type: typeIdx !== -1 ? (cols[typeIdx] || 'theory').toLowerCase() : 'theory',
      teacher_name: cols[teacherIdx]?.trim() || 'Unknown',
      room_number: roomIdx !== -1 ? (cols[roomIdx] || '') : '',
      section,
      term,
      session,
    });
  }

  return { slots, errors };
}

// ── Text Parser (for PDF/DOCX extracted text) ──────────

/**
 * Extract routine slots from raw text (PDF/DOCX).
 * Looks for course code patterns and maps them to days/periods.
 */
export function parseRoutineText(
  text: string,
  term: string,
  session: string,
  section: string,
): { slots: ParsedRoutineSlot[]; errors: string[] } {
  const slots: ParsedRoutineSlot[] = [];
  const errors: string[] = [];

  // Normalize whitespace
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  // Course code pattern: 2-5 uppercase letters + optional space + 3-4 digits + optional letter
  const COURSE_RE = /\b([A-Z]{2,5})\s*(\d{3,4}[A-Z]?)\b/g;

  // Try to parse line by line, detecting days
  let currentDay: number | null = null;
  let periodCounter = 0;

  for (const line of lines) {
    // Detect day
    const dayMatch = line.match(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Sun|Mon|Tue|Wed|Thu)\b/i);
    if (dayMatch) {
      const d = parseDayValue(dayMatch[1]);
      if (d !== null) {
        currentDay = d;
        periodCounter = 0;
      }
    }

    if (currentDay === null) continue;

    // Find all course codes in this line
    let match: RegExpExecArray | null;
    COURSE_RE.lastIndex = 0;
    while ((match = COURSE_RE.exec(line)) !== null) {
      const courseCode = `${match[1]} ${match[2]}`;

      // Look for teacher name/initials nearby (within ~40 chars after course code)
      const afterCourse = line.slice(match.index + match[0].length, match.index + match[0].length + 60);
      const teacherMatch = afterCourse.match(/([A-Z]{2,4}(?:\s*[&,/]\s*[A-Z]{2,4})?|(?:Dr\.|Prof\.|Mr\.|Ms\.)\s*[\w\s.]+?)(?=[,/\s]*\d|$)/i);
      const teacherName = teacherMatch ? teacherMatch[1].trim() : '';

      // Look for room number
      const roomMatch = afterCourse.match(/\b(\d{3,4}[A-Z]?|Lab[-\s]?\d*)\b/i);
      const roomNumber = roomMatch ? roomMatch[1] : '';

      // Determine period from position
      const periodIdx = Math.min(periodCounter, PERIODS.length - 1);

      // Detect lab/sessional by checking for multi-period indicators
      const isLab = /lab|sessional/i.test(courseCode) || /lab/i.test(afterCourse);
      const endPeriodIdx = isLab ? Math.min(periodIdx + 2, PERIODS.length - 1) : periodIdx;

      slots.push({
        day_of_week: currentDay,
        start_time: PERIODS[periodIdx].start,
        end_time: PERIODS[endPeriodIdx].end,
        course_code: courseCode,
        course_title: '',
        course_type: isLab ? 'lab' : 'theory',
        teacher_name: teacherName,
        room_number: roomNumber,
        section,
        term,
        session,
      });

      periodCounter++;
    }
  }

  if (slots.length === 0) {
    errors.push('Could not parse any routine slots from the text. Try CSV format instead.');
  }

  return { slots, errors };
}

// ── Conversion Helpers ─────────────────────────────────

/**
 * Convert ParsedRoutineSlot[] to DisplaySlot[] for grid rendering.
 * These slots have isImported=true and no DB backing.
 */
export function parsedToDisplaySlots(parsed: ParsedRoutineSlot[]): DisplaySlot[] {
  return parsed.map((p, i) => ({
    id: `imported-${i}`,
    slotIds: [`imported-${i}`],
    day_of_week: p.day_of_week,
    start_time: p.start_time,
    end_time: p.end_time,
    section: p.section,
    room_number: p.room_number,
    room_type: null,
    course_code: p.course_code,
    course_title: p.course_title,
    course_credit: 0,
    course_type: p.course_type,
    offering_term: p.term,
    offering_session: p.session,
    teachers: [{ full_name: p.teacher_name || 'Unknown', teacher_uid: '' }],
    isCombined: false,
    isImported: true,
    rawSlots: [],
  }));
}

/**
 * Generate a sample CSV template string for download.
 */
export function generateCSVTemplate(): string {
  return [
    'day,period_start,period_end,course_code,course_title,course_type,teacher_name,room_number',
    'Sunday,1,1,CSE 3201,Computer Networking,theory,Dr. Kazi Shahiduzzaman,201',
    'Sunday,2,3,CSE 3202,Database Lab,lab,Dr. Ahmed Rahman,Lab-1',
    'Monday,1,1,CSE 3203,Software Engineering,theory,Prof. Md. Kamal,202',
  ].join('\n');
}
