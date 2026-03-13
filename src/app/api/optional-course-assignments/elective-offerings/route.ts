// ==========================================
// API: /api/optional-course-assignments/elective-offerings
// Returns elective course offerings for a term with curriculum grouping
// Supports CRUD operations for managing elective offerings
// ==========================================

import { badRequest, created, guardSupabase, internalError, noContent, ok } from '@/lib/apiResponse';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── GET /api/optional-course-assignments/elective-offerings ────────────────
export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');

    if (!term) return badRequest('term parameter is required');

    // Get elective curriculum entries for this term
    const { data: curriculumEntries, error: currError } = await supabase
      .from('curriculum')
      .select('course_id, is_elective, elective_group')
      .eq('term', term)
      .eq('is_elective', true);

    if (currError) throw currError;
    if (!curriculumEntries || curriculumEntries.length === 0) {
      return NextResponse.json([]);
    }

    const courseIds = curriculumEntries.map((c: Record<string, unknown>) => c.course_id as string);
    const groupMap = new Map(
      curriculumEntries.map((c: Record<string, unknown>) => [c.course_id as string, c.elective_group as string | null])
    );

    // Get active offerings for these elective courses
    const { data: offerings, error: offError } = await supabase
      .from('course_offerings')
      .select(`
        id, course_id, teacher_user_id, term, session, batch, is_active,
        courses ( id, code, title, credit, course_type ),
        teachers!course_offerings_teacher_user_id_fkey ( full_name, teacher_uid )
      `)
      .in('course_id', courseIds)
      .eq('is_active', true);

    if (offError) throw offError;

    // Attach elective_group to each offering
    const result = (offerings || []).map((o: Record<string, unknown>) => ({
      ...o,
      elective_group: groupMap.get(o.course_id as string) || null,
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to fetch elective offerings'));
  }
}

// ── POST /api/optional-course-assignments/elective-offerings ───────────────
// Create a new course offering for an elective course
export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { course_id, teacher_user_id, term, session, batch } = body;

    if (!course_id) return badRequest('course_id is required');
    if (!teacher_user_id) return badRequest('teacher_user_id is required');
    if (!term) return badRequest('term is required');

    // Verify the course is an elective in the curriculum
    const { data: curriculum, error: currError } = await supabase
      .from('curriculum')
      .select('id, elective_group')
      .eq('course_id', course_id)
      .eq('term', term)
      .eq('is_elective', true)
      .maybeSingle();

    if (currError) throw currError;
    if (!curriculum) {
      return badRequest('This course is not marked as an elective for this term');
    }

    // Check for existing active offering with same course and teacher
    const { data: existing } = await supabase
      .from('course_offerings')
      .select('id')
      .eq('course_id', course_id)
      .eq('teacher_user_id', teacher_user_id)
      .eq('term', term)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      return badRequest('An active offering for this course with this teacher already exists');
    }

    const currentYear = new Date().getFullYear();
    const resolvedSession = session || `${currentYear - 1}-${currentYear}`;

    // Create the offering
    const { data: newOffering, error: insertError } = await supabase
      .from('course_offerings')
      .insert({
        course_id,
        teacher_user_id,
        term,
        session: resolvedSession,
        batch: batch || null,
        is_active: true,
      })
      .select(`
        id, course_id, teacher_user_id, term, session, batch, is_active,
        courses ( id, code, title, credit, course_type ),
        teachers!course_offerings_teacher_user_id_fkey ( full_name, teacher_uid )
      `)
      .single();

    if (insertError) throw insertError;

    // Add elective_group to response
    const result = {
      ...newOffering,
      elective_group: curriculum.elective_group,
    };

    return created(result);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to create elective offering'));
  }
}

// ── PATCH /api/optional-course-assignments/elective-offerings ──────────────
// Update an existing elective offering (change teacher, session, etc.)
export async function PATCH(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { id, teacher_user_id, session, batch, is_active } = body;

    if (!id) return badRequest('id is required');

    const updates: Record<string, unknown> = {};
    if (teacher_user_id !== undefined) updates.teacher_user_id = teacher_user_id;
    if (session !== undefined) updates.session = session;
    if (batch !== undefined) updates.batch = batch;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return badRequest('No fields to update');
    }

    const { data: updated, error: updateError } = await supabase
      .from('course_offerings')
      .update(updates)
      .eq('id', id)
      .select(`
        id, course_id, teacher_user_id, term, session, batch, is_active,
        courses ( id, code, title, credit, course_type ),
        teachers!course_offerings_teacher_user_id_fkey ( full_name, teacher_uid )
      `)
      .single();

    if (updateError) throw updateError;

    // Get elective_group from curriculum
    const { data: curriculum } = await supabase
      .from('curriculum')
      .select('elective_group')
      .eq('course_id', updated.course_id)
      .eq('is_elective', true)
      .maybeSingle();

    const result = {
      ...updated,
      elective_group: curriculum?.elective_group || null,
    };

    return ok(result);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to update elective offering'));
  }
}

// ── DELETE /api/optional-course-assignments/elective-offerings ─────────────
// Delete (deactivate) an elective offering
export async function DELETE(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const hardDelete = searchParams.get('hard') === 'true';

    if (!id) return badRequest('id parameter is required');

    if (hardDelete) {
      // First remove any optional_course_assignments for this offering
      await supabase
        .from('optional_course_assignments')
        .delete()
        .eq('offering_id', id);

      // Then delete the offering
      const { error: deleteError } = await supabase
        .from('course_offerings')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
    } else {
      // Soft delete: just mark as inactive
      const { error: updateError } = await supabase
        .from('course_offerings')
        .update({ is_active: false })
        .eq('id', id);

      if (updateError) throw updateError;
    }

    return noContent();
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to delete elective offering'));
  }
}
