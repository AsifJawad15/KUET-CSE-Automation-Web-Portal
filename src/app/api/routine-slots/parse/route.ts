// ==========================================
// API: /api/routine-slots/parse
// Parse uploaded files (CSV/PDF/DOCX) into structured routine data
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

// ── Helpers ────────────────────────────────────────────

function parseDayValue(raw: string): number | null {
  return DAY_MAP[raw.toLowerCase().trim()] ?? null;
}

/** Normalize course code: "CSE3201" → "CSE 3201" */
function normalizeCourseCode(raw: string): string {
  let code = raw.trim().toUpperCase();
  code = code.replace(/([A-Z])(\d)/, '$1 $2');
  return code;
}

// ── CSV Parser ─────────────────────────────────────────

function parseCSVServer(
  text: string,
  term: string,
  session: string,
  section: string,
): { slots: ParsedSlot[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { slots: [], errors: ['CSV must have header + data rows.'] };

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const col = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));

  const dayIdx = col(['day']);
  const psIdx = col(['period_start', 'start_period', 'from', 'start']);
  const peIdx = col(['period_end', 'end_period', 'to', 'end']);
  const codeIdx = col(['course_code', 'code', 'course']);
  const titleIdx = col(['course_title', 'title', 'name']);
  const typeIdx = col(['course_type', 'type']);
  const teacherIdx = col(['teacher_name', 'teacher', 'instructor', 'faculty']);
  const roomIdx = col(['room_number', 'room', 'venue']);

  if (dayIdx === -1 || codeIdx === -1) {
    return { slots: [], errors: ['CSV must have at least "day" and "course_code" columns.'] };
  }

  const slots: ParsedSlot[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted CSV fields properly
    const cols = lines[i]
      .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      ?.map((c) => c.replace(/^"|"$/g, '').trim()) || lines[i].split(',').map((c) => c.trim());

    const dayVal = parseDayValue(cols[dayIdx] || '');
    if (dayVal === null) { errors.push(`Row ${i + 1}: Invalid day "${cols[dayIdx]}"`); continue; }

    const ps = (psIdx !== -1 ? parseInt(cols[psIdx]) : 1) - 1;
    const pe = (peIdx !== -1 ? parseInt(cols[peIdx]) : ps + 1) - 1;
    if (ps < 0 || pe < 0 || pe >= PERIODS.length) { errors.push(`Row ${i + 1}: Invalid period`); continue; }

    const code = cols[codeIdx]?.trim();
    if (!code) { errors.push(`Row ${i + 1}: Missing course code`); continue; }

    slots.push({
      day_of_week: dayVal,
      start_time: PERIODS[ps].start,
      end_time: PERIODS[Math.max(ps, pe)].end,
      course_code: normalizeCourseCode(code),
      course_title: titleIdx !== -1 ? (cols[titleIdx] || '') : '',
      course_type: typeIdx !== -1 ? (cols[typeIdx] || 'theory').toLowerCase() : 'theory',
      teacher_name: teacherIdx !== -1 ? (cols[teacherIdx] || '') : '',
      room_number: roomIdx !== -1 ? (cols[roomIdx] || '') : '',
      section, term, session,
    });
  }

  return { slots, errors };
}

// ── Text Parser (PDF/DOCX) ────────────────────────────

/**
 * Parse routine data from extracted text.
 * Handles two formats:
 *  1) Structured: Lines with day names followed by course entries
 *  2) Tabular: Course code + teacher + room patterns on lines
 */
function parseTextServer(
  text: string,
  term: string,
  session: string,
  section: string,
): { slots: ParsedSlot[]; errors: string[] } {
  const slots: ParsedSlot[] = [];
  const errors: string[] = [];

  // Normalize the text
  const rawLines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  // Course code regex: 2-5 uppercase letters + optional space + 3-4 digits + optional letter
  const COURSE_RE = /\b([A-Z]{2,5})\s*[-]?\s*(\d{3,4}[A-Z]?)\b/g;

  // Day detection regex
  const DAY_RE = /\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Saturday|Friday|Sun|Mon|Tue|Wed|Thu|Sat|Fri)\b/i;

  // Teacher name patterns — full name or initials
  const TEACHER_FULL_RE = /(?:Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.|Md\.)\s*[A-Z][a-zA-Z.\s]+/;
  const TEACHER_INITIALS_RE = /\b([A-Z]{2,5})\b/;

  // Room pattern
  const ROOM_RE = /\b(\d{3,4}[A-Z]?)\b|(?:Room|Rm)\s*[-:]?\s*(\S+)/i;
  const LAB_ROOM_RE = /\b(Lab[-\s]?\d*|(?:ECE|CSE|EEE)\s*Lab[-\s]?\d*)\b/i;

  let currentDay: number | null = null;
  let periodCounter = 0;

  for (const line of rawLines) {
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

    // Find all course codes in this line
    COURSE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = COURSE_RE.exec(line)) !== null) {
      const courseCode = normalizeCourseCode(`${match[1]}${match[2]}`);

      // Extract context after the course code
      const afterCourse = line.slice(match.index + match[0].length).trim();
      const beforeCourse = line.slice(0, match.index).trim();
      const surroundingText = beforeCourse + ' ' + afterCourse;

      // Teacher detection — try full name first, then initials
      let teacherName = '';
      const fullTeacher = afterCourse.match(TEACHER_FULL_RE);
      if (fullTeacher) {
        teacherName = fullTeacher[0].trim();
      } else {
        // Look for initials (2-4 uppercase letters) after course code
        const afterClean = afterCourse.replace(COURSE_RE, '').replace(/\d{3,4}/g, '');
        const initialsMatch = afterClean.match(TEACHER_INITIALS_RE);
        if (initialsMatch && !/^(LAB|AND|THE|FOR|CSE|ECE|EEE|BME|IPE|ME|CE|URP)$/i.test(initialsMatch[1])) {
          teacherName = initialsMatch[1];
        }
      }

      // Room detection
      let roomNumber = '';
      const labRoom = surroundingText.match(LAB_ROOM_RE);
      const regularRoom = afterCourse.match(ROOM_RE);
      if (labRoom) {
        roomNumber = labRoom[1];
      } else if (regularRoom) {
        roomNumber = regularRoom[1] || regularRoom[2] || '';
      }

      // Is it a lab/sessional?
      const isLab = /lab|sessional/i.test(surroundingText) || /lab/i.test(courseCode);

      // Determine period
      const periodIdx = Math.min(periodCounter, PERIODS.length - 1);
      const endIdx = isLab ? Math.min(periodIdx + 2, PERIODS.length - 1) : periodIdx;

      slots.push({
        day_of_week: currentDay,
        start_time: PERIODS[periodIdx].start,
        end_time: PERIODS[endIdx].end,
        course_code: courseCode,
        course_title: '',
        course_type: isLab ? 'lab' : 'theory',
        teacher_name: teacherName,
        room_number: roomNumber,
        section, term, session,
      });
      periodCounter += isLab ? 3 : 1;
    }
  }

  if (slots.length === 0) {
    errors.push('Could not parse routine slots from the text. Try using CSV format for best results.');
  }
  return { slots, errors };
}

// ── PDF Text Extraction ───────────────────────────────

async function extractPDFText(arrayBuf: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuf),
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  const textParts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // Group text items by Y-coordinate to reconstruct rows
    const items: { str: string; x: number; y: number }[] = [];
    for (const item of content.items) {
      if ('str' in item && (item as { str: string }).str.trim()) {
        const typed = item as { str: string; transform: number[] };
        items.push({
          str: typed.str,
          x: typed.transform?.[4] || 0,
          y: typed.transform?.[5] || 0,
        });
      }
    }

    // Sort by Y descending (top to bottom), then X ascending (left to right)
    items.sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 3) return yDiff; // different row
      return a.x - b.x; // same row, sort by x
    });

    // Group items into rows (items within ~5 units of Y are same row)
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let lastY = items[0]?.y ?? 0;

    for (const item of items) {
      if (Math.abs(item.y - lastY) > 5) {
        if (currentRow.length > 0) rows.push(currentRow);
        currentRow = [];
        lastY = item.y;
      }
      currentRow.push(item.str);
    }
    if (currentRow.length > 0) rows.push(currentRow);

    // Join row items with spaces, rows with newlines
    const pageText = rows.map((r) => r.join('  ')).join('\n');
    textParts.push(pageText);
  }

  await doc.destroy();
  return textParts.join('\n');
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
    if (!term || !session) return badRequest('term and session are required');

    const fileName = file.name.toLowerCase();
    let result: { slots: ParsedSlot[]; errors: string[] };

    if (fileName.endsWith('.csv')) {
      const text = await file.text();
      result = parseCSVServer(text, term, session, section);
    } else if (fileName.endsWith('.pdf')) {
      const arrayBuf = await file.arrayBuffer();
      try {
        const pdfText = await extractPDFText(arrayBuf);
        result = parseTextServer(pdfText, term, session, section);
        // If parsing extracted text found nothing, include the raw text for debugging
        if (result.slots.length === 0) {
          result.errors.push('Extracted text preview (first 500 chars): ' + pdfText.slice(0, 500));
        }
      } catch (pdfErr: unknown) {
        const pdfMsg = pdfErr instanceof Error ? pdfErr.message : '';
        return badRequest(`Failed to read PDF: ${pdfMsg.includes('Invalid PDF') ? 'The file may be corrupted or not a valid PDF.' : pdfMsg}`);
      }
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const mammoth = await import('mammoth');
      const docResult = await mammoth.extractRawText({ buffer });
      result = parseTextServer(docResult.value, term, session, section);
      if (result.slots.length === 0) {
        result.errors.push('Extracted text preview (first 500 chars): ' + docResult.value.slice(0, 500));
      }
    } else {
      return badRequest('Unsupported file format. Use CSV, PDF, or DOCX.');
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to parse file';
    return internalError(msg);
  }
}
