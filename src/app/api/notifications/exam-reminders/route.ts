// ==========================================
// API: /api/notifications/exam-reminders
// Triggers exam reminder notifications for upcoming exams.
// Intended for cron use (Vercel Cron / external scheduler).
// ==========================================

import { NextRequest, NextResponse } from 'next/server';

import { guardSupabase, internalError, unauthorized } from '@/lib/apiResponse';
import { notifyExamReminder } from '@/lib/notifications';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type ExamRow = {
  id: string;
  name?: string | null;
  exam_type?: string | null;
  exam_date?: string | null;
  exam_time?: string | null;
  room_numbers?: string[] | null;
  course_offerings?: {
    term?: string | null;
    section?: string | null;
    courses?: { code?: string | null; title?: string | null } | { code?: string | null; title?: string | null }[] | null;
  } | null;
};

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function parseDhakaDateTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}+06:00`);
}

function dayToIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayDhaka(): string {
  const nowDhaka = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  return dayToIso(nowDhaka);
}

function getFutureDhaka(daysAhead: number): string {
  const nowDhaka = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  nowDhaka.setDate(nowDhaka.getDate() + daysAhead);
  return dayToIso(nowDhaka);
}

function isAuthorized(request: NextRequest): boolean {
  const requiredKey = process.env.NOTIFICATION_CRON_KEY;
  if (!requiredKey) return true;

  const providedKey = request.headers.get('x-notification-cron-key') || new URL(request.url).searchParams.get('key');
  return providedKey === requiredKey;
}

async function runExamReminderSweep(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  if (!isAuthorized(request)) {
    return unauthorized('Invalid cron key');
  }

  try {
    const { searchParams } = new URL(request.url);
    const leadMinutes = Number(searchParams.get('lead_minutes') || 120);
    const maxLeadMinutes = Number.isFinite(leadMinutes) && leadMinutes > 0
      ? Math.min(Math.floor(leadMinutes), 24 * 60)
      : 120;

    const today = getTodayDhaka();
    const upperDate = getFutureDhaka(2);

    const { data, error } = await supabase
      .from('exams')
      .select(`
        id,
        name,
        exam_type,
        exam_date,
        exam_time,
        room_numbers,
        course_offerings!inner(
          term,
          section,
          courses!inner(code, title)
        )
      `)
      .gte('exam_date', today)
      .lte('exam_date', upperDate)
      .not('exam_date', 'is', null)
      .not('exam_time', 'is', null);

    if (error) throw error;

    const now = new Date();
    let scanned = 0;
    let reminded = 0;

    for (const row of ((data || []) as ExamRow[])) {
      scanned += 1;
      if (!row.exam_date || !row.exam_time) continue;

      const offering = row.course_offerings;
      const courses = offering?.courses;
      const resolvedCourse = Array.isArray(courses) ? courses[0] : courses;
      const courseCode = resolvedCourse?.code?.trim();
      const courseTitle = resolvedCourse?.title?.trim();
      const term = offering?.term?.trim();

      if (!courseCode || !term) continue;

      const examAt = parseDhakaDateTime(row.exam_date, row.exam_time);
      const minutesRemaining = Math.round((examAt.getTime() - now.getTime()) / 60000);

      if (minutesRemaining <= 0 || minutesRemaining > maxLeadMinutes) continue;

      await notifyExamReminder({
        examId: row.id,
        examName: row.name || null,
        examType: row.exam_type || null,
        courseCode,
        courseTitle: courseTitle || courseCode,
        examDate: row.exam_date,
        examTime: row.exam_time,
        roomNumbers: row.room_numbers || [],
        term,
        section: offering?.section || null,
        minutesRemaining,
      });
      reminded += 1;
    }

    return NextResponse.json({
      ok: true,
      scanned,
      reminders_created: reminded,
      lead_minutes: maxLeadMinutes,
    });
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to run exam reminder sweep'));
  }
}

export async function POST(request: NextRequest) {
  return runExamReminderSweep(request);
}

export async function GET(request: NextRequest) {
  return runExamReminderSweep(request);
}
