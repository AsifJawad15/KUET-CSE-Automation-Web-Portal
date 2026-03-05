// ==========================================
// API: /api/teacher-portal/my-courses
// Returns courses assigned to a specific teacher
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── GET /api/teacher-portal/my-courses ─────────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacher_id');

    if (!teacherId) return badRequest('Teacher ID is required');

    const { data: offerings, error: offeringsError } = await supabase
      .from('course_offerings')
      .select(`
        id, term, session, batch,
        courses (id, code, title, credit, course_type)
      `)
      .eq('teacher_user_id', teacherId)
      .eq('is_active', true);

    if (offeringsError) throw offeringsError;

    const courses = (offerings || []).map((o: Record<string, unknown>) => {
      const course = o.courses as { id: string; code: string; title: string; credit: number; course_type: string } | null;
      return {
        offering_id: o.id,
        course_id: course?.id || '',
        course_code: course?.code || '',
        course_title: course?.title || '',
        credit: course?.credit || 0,
        course_type: course?.course_type || '',
        term: o.term,
        session: o.session,
        section: o.batch,
      };
    });

    return NextResponse.json(courses);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to fetch courses'));
  }
}
