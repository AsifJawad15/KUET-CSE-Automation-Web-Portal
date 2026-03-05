// ==========================================
// API: /api/teacher-portal/attendance
// Handles attendance upload (CSV bulk) and manual save
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { requireField, runValidations } from '@/lib/validators';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── POST /api/teacher-portal/attendance ────────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const records = body.items || body.records;

    if (!Array.isArray(records) || records.length === 0) {
      return badRequest('No attendance records provided');
    }

    let inserted = 0;
    const errors: string[] = [];

    for (const record of records) {
      const validation = runValidations(
        requireField(record.course_code, 'Course Code'),
        requireField(record.student_roll, 'Student Roll'),
        requireField(record.date, 'Date'),
        requireField(record.status, 'Status'),
      );
      if (validation) {
        errors.push(validation);
        continue;
      }

      const { error } = await supabase
        .from('attendance')
        .upsert({
          course_code: record.course_code,
          student_roll: record.student_roll,
          date: record.date,
          status: record.status,
          section_or_group: record.section_or_group || null,
        }, { onConflict: 'course_code,student_roll,date' });

      if (error) {
        errors.push(`Roll ${record.student_roll}: ${error.message}`);
      } else {
        inserted++;
      }
    }

    return NextResponse.json({ inserted, skipped: 0, errors });
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to save attendance'));
  }
}

// ── GET /api/teacher-portal/attendance ─────────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const courseCode = searchParams.get('course_code');

    if (!courseCode) return badRequest('Course code is required');

    let query = supabase
      .from('attendance')
      .select('*')
      .eq('course_code', courseCode)
      .order('date', { ascending: false });

    const date = searchParams.get('date');
    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to fetch attendance'));
  }
}
