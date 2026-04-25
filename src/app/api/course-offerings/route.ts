// ==========================================
// API: /api/course-offerings
// Single Responsibility: HTTP layer — delegates to Supabase
// DRY: Uses shared query constants & response helpers
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { badRequest, conflict, internalError, ok } from '@/lib/apiResponse';
import { requireField, requireFields } from '@/lib/validators';
import { COURSE_OFFERING_WITH_DETAILS } from '@/lib/queryConstants';
import { notifyTeacherCourseAssigned, notifyStudentCourseAssigned } from '@/lib/notifications';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { requireServerSession } from '@/lib/serverAuth';
import { hashPassword } from '@/lib/passwordUtils';

// ── Helpers ────────────────────────────────────────────

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function serviceGuard() {
  if (!isSupabaseAdminConfigured()) {
    return internalError('Secure Supabase service role is not configured.');
  }
  return null;
}

/** Resolve a term from the curriculum table or course code pattern. */
async function resolveTerm(db: ReturnType<typeof getSupabaseAdmin>, courseId: string, providedTerm?: string): Promise<string> {
  if (providedTerm) return providedTerm;

  // Try curriculum table
  const { data: curriculumEntry } = await db
    .from('curriculum')
    .select('term')
    .eq('course_id', courseId)
    .limit(1)
    .maybeSingle();

  if (curriculumEntry?.term) return curriculumEntry.term;

  // Try course code pattern (e.g., CSE 3200 → "3-1")
  const { data: courseData } = await db
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

function normalizeExternalTeacherName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned.length > 0 ? cleaned : null;
}

function buildExternalTeacherEmail(name: string, userId: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 40) || 'external.teacher';
  return `${slug}.${userId.slice(0, 8)}@external.kuet-cse.local`;
}

async function findOrCreateExternalTeacher(
  db: ReturnType<typeof getSupabaseAdmin>,
  fullName: string,
): Promise<string> {
  const { data: existing, error: existingError } = await db
    .from('teachers')
    .select('user_id')
    .ilike('full_name', fullName)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.user_id) return existing.user_id;

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(crypto.randomUUID());

  const { error: profileError } = await db
    .from('profiles')
    .insert({
      user_id: userId,
      role: 'TEACHER',
      email: buildExternalTeacherEmail(fullName, userId),
      password_hash: passwordHash,
      is_active: false,
    });

  if (profileError) throw profileError;

  const { error: teacherError } = await db
    .from('teachers')
    .insert({
      user_id: userId,
      full_name: fullName,
      phone: 'External',
      designation: 'LECTURER',
      department: 'External',
    });

  if (teacherError) throw teacherError;
  return userId;
}

// ── GET /api/course-offerings ──────────────────────────

export async function GET(request: NextRequest) {
  const auth = requireServerSession(request);
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const db = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('course_id');

    let query = db
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
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const db = getSupabaseAdmin();
    const body = await request.json();
    const { course_id, section, term, session } = body;
    let { teacher_user_id } = body;
    const externalTeacherName = normalizeExternalTeacherName(body.external_teacher_name);

    const fieldCheck = requireFields({ course_id });
    if (!fieldCheck.valid) return badRequest(fieldCheck.error!);
    if (!teacher_user_id && !externalTeacherName) {
      return badRequest('Teacher or external teacher name is required');
    }

    const isExternalTeacher = !teacher_user_id && !!externalTeacherName;
    if (!teacher_user_id && externalTeacherName) {
      teacher_user_id = await findOrCreateExternalTeacher(db, externalTeacherName);
    }

    // Check for duplicate assignment
    const { data: existing } = await db
      .from('course_offerings')
      .select('id')
      .eq('course_id', course_id)
      .eq('teacher_user_id', teacher_user_id)
      .maybeSingle();

    if (existing) return conflict('This teacher is already assigned to this course');

    const resolvedTerm = await resolveTerm(db, course_id, term);
    const resolvedSession = resolveSession(session);

    const insertData: Record<string, unknown> = {
      course_id,
      teacher_user_id,
      term: resolvedTerm,
      session: resolvedSession,
    };
    if (section) insertData.section = section;

    const { data, error } = await db
      .from('course_offerings')
      .insert(insertData)
      .select(COURSE_OFFERING_WITH_DETAILS)
      .single();

    if (error) throw error;

    // Send notification to the teacher about the new course assignment
    try {
      const courses = (data as Record<string, unknown>).courses as { code?: string; title?: string } | null;
      const courseCode = courses?.code ?? 'Unknown';
      const courseTitle = courses?.title ?? courseCode;
      const teachers = (data as Record<string, unknown>).teachers as { full_name?: string; department?: string } | null;
      const teacherName = teachers?.full_name ?? null;
      await Promise.all([
        isExternalTeacher
          ? Promise.resolve()
          : notifyTeacherCourseAssigned({
              teacherUserId: teacher_user_id,
              courseCode,
              courseTitle,
              term: resolvedTerm,
              section: section ?? null,
            }),
        notifyStudentCourseAssigned({
          courseCode,
          courseTitle,
          teacherName,
          term: resolvedTerm,
          section: section ?? null,
        }),
      ]);
    } catch (notifErr) {
      // Non-critical: log but don't fail the assignment
      console.error('[course-offerings] Failed to send assignment notification:', notifErr);
    }

    return ok(data);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to assign teacher'));
  }
}

// ── PATCH /api/course-offerings ────────────────────────

export async function PATCH(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const db = getSupabaseAdmin();
    const body = await request.json();
    const { id, teacher_user_id, section } = body;

    const idCheck = requireField(id, 'Offering ID');
    if (!idCheck.valid) return badRequest(idCheck.error!);

    const updates: Record<string, unknown> = {};
    if (teacher_user_id !== undefined) updates.teacher_user_id = teacher_user_id;
    if (section !== undefined) updates.section = section;

    if (Object.keys(updates).length === 0) return badRequest('No fields to update');

    const { data, error } = await db
      .from('course_offerings')
      .update(updates)
      .eq('id', id)
      .select(COURSE_OFFERING_WITH_DETAILS)
      .single();

    if (error) throw error;

    // Notify new teacher if teacher assignment changed
    if (teacher_user_id) {
      try {
        const courses = (data as Record<string, unknown>).courses as { code?: string; title?: string } | null;
        const courseCode = courses?.code ?? 'Unknown';
        const courseTitle = courses?.title ?? courseCode;
        const term = (data as Record<string, unknown>).term as string ?? '';
        const sec = (data as Record<string, unknown>).section as string | null;
        const teachers = (data as Record<string, unknown>).teachers as { full_name?: string } | null;
        const teacherName = teachers?.full_name ?? null;
        await Promise.all([
          notifyTeacherCourseAssigned({
            teacherUserId: teacher_user_id,
            courseCode,
            courseTitle,
            term,
            section: sec,
          }),
          notifyStudentCourseAssigned({
            courseCode,
            courseTitle,
            teacherName,
            term,
            section: sec,
          }),
        ]);
      } catch (notifErr) {
        console.error('[course-offerings] Failed to send reassignment notification:', notifErr);
      }
    }

    return ok(data);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to update offering'));
  }
}

// ── DELETE /api/course-offerings ───────────────────────

export async function DELETE(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return badRequest('Offering ID is required');

    const { error } = await getSupabaseAdmin()
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
