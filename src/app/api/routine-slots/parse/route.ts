// ==========================================
// API: /api/routine-slots/parse
// Single Responsibility: Parse uploaded files (CSV/PDF/DOCX) into structured routine data
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
  sunday: 0, sun: 0, monday: 1, mon: 1,
  tuesday: 2, tue: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
};

// ── Helpers ────────────────────────────────────────────

function parseDayValue(raw: string): number | null {
  return DAY_MAP[raw.toLowerCase().trim()] ?? null;
}

function parseCSVServer(text: string, term: string, session: string, section: string): { slots: ParsedSlot[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { slots: [], errors: ['CSV must have header + data rows.'] };

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const col = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));

  const dayIdx = col(['day']);
  const psIdx = col(['period_start', 'start_period', 'from']);
  const peIdx = col(['period_end', 'end_period', 'to']);
  const codeIdx = col(['course_code', 'code', 'course']);
  const titleIdx = col(['course_title', 'title']);
  const typeIdx = col(['course_type', 'type']);
  const teacherIdx = col(['teacher_name', 'teacher', 'instructor']);
  const roomIdx = col(['room_number', 'room']);

  if (dayIdx === -1 || codeIdx === -1)
    return { slots: [], errors: ['CSV must have day and course_code columns.'] };

  const slots: ParsedSlot[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    const dayVal = parseDayValue(cols[dayIdx] || '');
    if (dayVal === null) { errors.push(`Row ${i + 1}: Invalid day`); continue; }

    const ps = (psIdx !== -1 ? parseInt(cols[psIdx]) : 1) - 1;
    const pe = (peIdx !== -1 ? parseInt(cols[peIdx]) : ps + 1) - 1;
    if (ps < 0 || pe >= PERIODS.length) { errors.push(`Row ${i + 1}: Invalid period`); continue; }

    const code = cols[codeIdx]?.trim();
    if (!code) { errors.push(`Row ${i + 1}: Missing course code`); continue; }

    slots.push({
      day_of_week: dayVal,
      start_time: PERIODS[ps].start,
      end_time: PERIODS[pe].end,
      course_code: code,
      course_title: titleIdx !== -1 ? (cols[titleIdx] || '') : '',
      course_type: typeIdx !== -1 ? (cols[typeIdx] || 'theory').toLowerCase() : 'theory',
      teacher_name: teacherIdx !== -1 ? (cols[teacherIdx] || '') : '',
      room_number: roomIdx !== -1 ? (cols[roomIdx] || '') : '',
      section, term, session,
    });
  }

  return { slots, errors };
}

function parseTextServer(text: string, term: string, session: string, section: string): { slots: ParsedSlot[]; errors: string[] } {
  const slots: ParsedSlot[] = [];
  const errors: string[] = [];
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const COURSE_RE = /\b([A-Z]{2,5})\s*(\d{3,4}[A-Z]?)\b/g;
  let currentDay: number | null = null;
  let periodCounter = 0;

  for (const line of lines) {
    const dayMatch = line.match(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Sun|Mon|Tue|Wed|Thu)\b/i);
    if (dayMatch) {
      const d = parseDayValue(dayMatch[1]);
      if (d !== null) { currentDay = d; periodCounter = 0; }
    }
    if (currentDay === null) continue;

    COURSE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = COURSE_RE.exec(line)) !== null) {
      const courseCode = `${match[1]} ${match[2]}`;
      const afterCourse = line.slice(match.index + match[0].length, match.index + match[0].length + 60);

      const teacherMatch = afterCourse.match(/([A-Z]{2,4}(?:\s*[&,/]\s*[A-Z]{2,4})?)/);
      const roomMatch = afterCourse.match(/\b(\d{3,4}[A-Z]?|Lab[-\s]?\d*)\b/i);

      const periodIdx = Math.min(periodCounter, PERIODS.length - 1);
      const isLab = /lab|sessional/i.test(afterCourse);
      const endIdx = isLab ? Math.min(periodIdx + 2, PERIODS.length - 1) : periodIdx;

      slots.push({
        day_of_week: currentDay,
        start_time: PERIODS[periodIdx].start,
        end_time: PERIODS[endIdx].end,
        course_code: courseCode,
        course_title: '',
        course_type: isLab ? 'lab' : 'theory',
        teacher_name: teacherMatch?.[1]?.trim() || '',
        room_number: roomMatch?.[1] || '',
        section, term, session,
      });
      periodCounter++;
    }
  }

  if (slots.length === 0) errors.push('Could not parse routine slots from text. Try CSV format.');
  return { slots, errors };
}

// ── PDF Text Extraction (pdfjs-dist, no worker) ───────

async function extractPDFText(arrayBuf: ArrayBuffer): Promise<string> {
  // Use pdfjs-dist legacy build which works without a worker in Node.js
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
    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
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
      } catch (pdfErr: unknown) {
        const pdfMsg = pdfErr instanceof Error ? pdfErr.message : '';
        return badRequest(`Failed to read PDF: ${pdfMsg.includes('Invalid PDF') ? 'The file may be corrupted or not a valid PDF.' : pdfMsg}`);
      }
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const mammoth = await import('mammoth');
      const docResult = await mammoth.extractRawText({ buffer });
      result = parseTextServer(docResult.value, term, session, section);
    } else {
      return badRequest('Unsupported file format. Use CSV, PDF, or DOCX.');
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to parse file';
    return internalError(msg);
  }
}
