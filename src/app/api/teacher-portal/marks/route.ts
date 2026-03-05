// ==========================================
// API: /api/teacher-portal/marks
// Handles exam marks upload (CSV bulk)
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { requireField, runValidations } from '@/lib/validators';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── POST /api/teacher-portal/marks ─────────────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const records = body.items || body.records;

    if (!Array.isArray(records) || records.length === 0) {
      return badRequest('No marks records provided');
    }

    let inserted = 0;
    const errors: string[] = [];

    for (const record of records) {
      const validation = runValidations(
        requireField(record.course_code, 'Course Code'),
        requireField(record.student_roll, 'Student Roll'),
        requireField(record.exam_type, 'Exam Type'),
      );
      if (validation) {
        errors.push(validation);
        continue;
      }

      const marks = parseFloat(record.marks);
      const totalMarks = parseFloat(record.total_marks);
      if (isNaN(marks) || isNaN(totalMarks) || marks < 0 || totalMarks <= 0) {
        errors.push(`Roll ${record.student_roll}: Invalid marks value`);
        continue;
      }
      if (marks > totalMarks) {
        errors.push(`Roll ${record.student_roll}: Marks (${marks}) exceed total (${totalMarks})`);
        continue;
      }

      const { error } = await supabase
        .from('exam_marks')
        .upsert({
          course_code: record.course_code,
          student_roll: record.student_roll,
          exam_type: record.exam_type,
          marks,
          total_marks: totalMarks,
        }, { onConflict: 'course_code,student_roll,exam_type' });

      if (error) {
        errors.push(`Roll ${record.student_roll}: ${error.message}`);
      } else {
        inserted++;
      }
    }

    return NextResponse.json({ inserted, skipped: 0, errors });
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to save marks'));
  }
}

// ── GET /api/teacher-portal/marks ──────────────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const courseCode = searchParams.get('course_code');

    if (!courseCode) return badRequest('Course code is required');

    let query = supabase
      .from('exam_marks')
      .select('*')
      .eq('course_code', courseCode);

    const examType = searchParams.get('exam_type');
    if (examType) {
      query = query.eq('exam_type', examType);
    }

    const { data, error } = await query.order('student_roll');
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to fetch marks'));
  }
}
