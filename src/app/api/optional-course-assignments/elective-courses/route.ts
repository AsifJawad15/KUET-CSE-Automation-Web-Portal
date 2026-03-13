// ==========================================
// API: /api/optional-course-assignments/elective-courses
// Returns elective courses from curriculum for a given term
// Used by admin to create new course offerings
// ==========================================

import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');

    if (!term) return badRequest('term parameter is required');

    // Get elective curriculum entries for this term with course details
    const { data: curriculumEntries, error: currError } = await supabase
      .from('curriculum')
      .select(`
        id,
        course_id,
        term,
        is_elective,
        elective_group,
        courses ( id, code, title, credit, course_type )
      `)
      .eq('term', term)
      .eq('is_elective', true)
      .order('elective_group');

    if (currError) throw currError;

    // Deduplicate by course_id and format response
    const seen = new Set<string>();
    const result = (curriculumEntries || [])
      .filter((entry: Record<string, unknown>) => {
        const courseId = entry.course_id as string;
        if (seen.has(courseId)) return false;
        seen.add(courseId);
        return true;
      })
      .map((entry: Record<string, unknown>) => {
        const course = entry.courses as Record<string, unknown> | null;
        return {
          id: course?.id || entry.course_id,
          code: course?.code || '',
          title: course?.title || '',
          credit: course?.credit || 0,
          course_type: course?.course_type || 'Theory',
          elective_group: entry.elective_group || null,
        };
      })
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));

    return NextResponse.json(result);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to fetch elective courses'));
  }
}
