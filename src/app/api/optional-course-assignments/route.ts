// ==========================================
// API: /api/optional-course-assignments
// Single Responsibility: HTTP layer for optional course assignment CRUD
// ==========================================

import { badRequest, created, guardSupabase, internalError, noContent } from '@/lib/apiResponse';
import { createNotification, getOfferingNotificationContext } from '@/lib/notifications';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── GET /api/optional-course-assignments ───────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');
    const studentUserId = searchParams.get('student_user_id');
    const offeringId = searchParams.get('offering_id');

    let query = supabase
      .from('optional_course_assignments')
      .select(`
        id,
        student_user_id,
        offering_id,
        assigned_by,
        assigned_at,
        students!oca_student_fkey (
          user_id, roll_no, full_name, term, session, batch, section
        ),
        course_offerings!oca_offering_fkey (
          id, course_id, teacher_user_id, term, session, is_active,
          courses ( id, code, title, credit, course_type ),
          teachers!course_offerings_teacher_user_id_fkey ( full_name, teacher_uid )
        )
      `)
      .order('assigned_at', { ascending: false });

    if (studentUserId) query = query.eq('student_user_id', studentUserId);
    if (offeringId) query = query.eq('offering_id', offeringId);

    const { data, error } = await query;
    if (error) throw error;

    // Filter by term if provided (filter by the offering's term)
    let result = data || [];
    if (term) {
      result = result.filter((row: Record<string, unknown>) => {
        const offering = row.course_offerings as Record<string, unknown> | null;
        return offering?.term === term;
      });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to fetch optional course assignments'));
  }
}

// ── POST /api/optional-course-assignments ──────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { student_user_ids, offering_id, assigned_by } = body;

    // Validate
    if (!offering_id) return badRequest('offering_id is required');
    if (!student_user_ids || !Array.isArray(student_user_ids) || student_user_ids.length === 0) {
      return badRequest('student_user_ids must be a non-empty array');
    }

    // Verify the offering exists and is for an elective course
    const { data: offering, error: offeringError } = await supabase
      .from('course_offerings')
      .select('id, course_id, term')
      .eq('id', offering_id)
      .single();

    if (offeringError || !offering) {
      return badRequest('Course offering not found');
    }

    // Insert assignments (skip duplicates)
    const rows = student_user_ids.map((sid: string) => ({
      student_user_id: sid,
      offering_id,
      assigned_by: assigned_by || null,
    }));

    const { data, error } = await supabase
      .from('optional_course_assignments')
      .upsert(rows, { onConflict: 'student_user_id,offering_id', ignoreDuplicates: true })
      .select(`
        id,
        student_user_id,
        offering_id,
        assigned_at,
        students!oca_student_fkey ( roll_no, full_name )
      `);

    if (error) throw error;

    const offeringContext = await getOfferingNotificationContext(offering_id);
    if (offeringContext) {
      for (const studentId of student_user_ids as string[]) {
        await createNotification({
          type: 'optional_course',
          title: `Optional course assigned: ${offeringContext.courseCode}`,
          body: `You have been assigned ${offeringContext.courseTitle}. Check your routine and course list for details.`,
          targetType: 'USER',
          targetValue: studentId,
          createdBy: assigned_by || null,
          createdByRole: 'ADMIN',
          metadata: {
            offering_id,
            course_code: offeringContext.courseCode,
            course_title: offeringContext.courseTitle,
            term: offeringContext.term,
          },
          dedupeKey: `optional-course:${offering_id}:${studentId}`,
        });
      }
    }

    return created({
      assigned_count: data?.length ?? 0,
      assignments: data,
    });
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to assign optional courses'));
  }
}

// ── DELETE /api/optional-course-assignments ─────────────

export async function DELETE(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const studentUserId = searchParams.get('student_user_id');
    const offeringId = searchParams.get('offering_id');
    const assignmentId = searchParams.get('id');

    if (assignmentId) {
      // Delete by assignment ID
      const { error } = await supabase
        .from('optional_course_assignments')
        .delete()
        .eq('id', assignmentId);
      if (error) throw error;
    } else if (studentUserId && offeringId) {
      // Delete by student + offering combo
      const { error } = await supabase
        .from('optional_course_assignments')
        .delete()
        .eq('student_user_id', studentUserId)
        .eq('offering_id', offeringId);
      if (error) throw error;
    } else {
      return badRequest('Provide either id, or both student_user_id and offering_id');
    }

    return noContent();
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to remove optional course assignment'));
  }
}
