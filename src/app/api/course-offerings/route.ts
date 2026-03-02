// ==========================================
// API: /api/course-offerings
// Single Responsibility: HTTP layer — delegates to Supabase
// DRY: Uses shared query constants & response helpers
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { badRequest, conflict, guardSupabase, internalError, noContent, ok } from '@/lib/apiResponse';
import { requireField, requireFields } from '@/lib/validators';
import { COURSE_OFFERING_WITH_DETAILS } from '@/lib/queryConstants';

// ── Helpers ────────────────────────────────────────────

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Resolve a term from the curriculum table or course code pattern. */
async function resolveTerm(courseId: string, providedTerm?: string): Promise<string> {
  if (providedTerm) return providedTerm;

  // Try curriculum table
  const { data: curriculumEntry } = await supabase
    .from('curriculum')
    .select('term')
    .eq('course_id', courseId)
    .limit(1)
    .maybeSingle();

  if (curriculumEntry?.term) return curriculumEntry.term;

  // Try course code pattern (e.g., CSE 3200 → "3-1")
  const { data: courseData } = await supabase
    .from('courses')
    .select('code')
    .eq('id', courseId)
    .single();

  if (courseData?.code) {
    const match = courseData.code.match(/\d/);
    if (match) {
      const year = Math.min(Math.ceil(parseInt(match[0]) / 1), 4);
      return `${year}-1`;
    }
  }

  return '1-1'; // Ultimate fallback
}

/** Resolve a session string from provided value or current academic year. */
function resolveSession(provided?: string): string {
  if (provided) return provided;
  const currentYear = new Date().getFullYear();
  return `${currentYear - 1}-${currentYear}`;
}

// ── GET /api/course-offerings ──────────────────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('course_id');

    let query = supabase
      .from('course_offerings')
      .select(COURSE_OFFERING_WITH_DETAILS)
      .order('created_at', { ascending: false });

    if (courseId) query = query.eq('course_id', courseId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to fetch course offerings'));
  }
}

// ── POST /api/course-offerings ─────────────────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { course_id, teacher_user_id, section, term, session } = body;

    const fieldCheck = requireFields({ course_id, teacher_user_id });
    if (!fieldCheck.valid) return badRequest(fieldCheck.error!);

    // Check for duplicate assignment
    const { data: existing } = await supabase
      .from('course_offerings')
      .select('id')
      .eq('course_id', course_id)
      .eq('teacher_user_id', teacher_user_id)
      .maybeSingle();

    if (existing) return conflict('This teacher is already assigned to this course');

    const resolvedTerm = await resolveTerm(course_id, term);
    const resolvedSession = resolveSession(session);

    const insertData: Record<string, unknown> = {
      course_id,
      teacher_user_id,
      term: resolvedTerm,
      session: resolvedSession,
    };
    if (section) insertData.section = section;

    const { data, error } = await supabase
      .from('course_offerings')
      .insert(insertData)
      .select(COURSE_OFFERING_WITH_DETAILS)
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to assign teacher'));
  }
}

// ── PATCH /api/course-offerings ────────────────────────

export async function PATCH(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { id, teacher_user_id, section } = body;

    const idCheck = requireField(id, 'Offering ID');
    if (!idCheck.valid) return badRequest(idCheck.error!);

    const updates: Record<string, unknown> = {};
    if (teacher_user_id !== undefined) updates.teacher_user_id = teacher_user_id;
    if (section !== undefined) updates.section = section;

    if (Object.keys(updates).length === 0) return badRequest('No fields to update');

    const { data, error } = await supabase
      .from('course_offerings')
      .update(updates)
      .eq('id', id)
      .select(COURSE_OFFERING_WITH_DETAILS)
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to update offering'));
  }
}

// ── DELETE /api/course-offerings ───────────────────────

export async function DELETE(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return badRequest('Offering ID is required');

    const { error } = await supabase
      .from('course_offerings')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.message.includes('foreign key') || error.message.includes('violates')) {
        return conflict('Cannot remove: this offering has routine slots or other references. Delete those first.');
      }
      throw error;
    }
    return ok({ deleted: true });
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to remove assignment'));
  }
}
