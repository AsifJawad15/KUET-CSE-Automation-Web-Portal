// ==========================================
// API: /api/teacher-portal/course-students
// Returns students enrolled in a specific course
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { WITH_PROFILE } from '@/lib/queryConstants';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── GET /api/teacher-portal/course-students ────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const courseCode = searchParams.get('course_code');

    if (!courseCode) return badRequest('Course code is required');

    const term = searchParams.get('term');
    const section = searchParams.get('section');

    // Find the course first
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('code', courseCode)
      .single();

    if (courseError || !course) {
      return NextResponse.json([]);
    }

    // Find the offering
    let offeringQuery = supabase
      .from('course_offerings')
      .select('term, session, batch')
      .eq('course_id', course.id)
      .eq('is_active', true);

    if (term) offeringQuery = offeringQuery.eq('term', term);

    const { data: offerings, error: offeringsError } = await offeringQuery;
    if (offeringsError) throw offeringsError;

    if (!offerings || offerings.length === 0) {
      return NextResponse.json([]);
    }

    // Get the term from the offering
    const offeringTerm = offerings[0].term;

    // Find students matching term (session formats differ between tables)
    let studentQuery = supabase
      .from('students')
      .select(WITH_PROFILE)
      .eq('term', offeringTerm)
      .order('roll_no');

    if (section) {
      studentQuery = studentQuery.eq('section', section);
    }

    const { data: students, error: studentsError } = await studentQuery;
    if (studentsError) throw studentsError;

    interface StudentRow {
      roll_no: string;
      full_name: string;
      phone: string;
      section: string | null;
      term: string;
      session: string;
      profile: { email: string } | null;
    }

    const result = (students as StudentRow[] || []).map((s) => ({
      roll_no: s.roll_no,
      full_name: s.full_name,
      email: s.profile?.email || '',
      phone: s.phone,
      section: s.section,
      term: s.term,
      session: s.session,
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to fetch course students'));
  }
}
