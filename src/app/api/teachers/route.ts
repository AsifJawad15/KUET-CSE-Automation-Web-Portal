// ==========================================
// API: /api/teachers
// Single Responsibility: HTTP layer — delegates to Supabase
// Uses shared response helpers, validators & query constants
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, generateTeacherPassword } from '@/lib/passwordUtils';
import { badRequest, internalError, conflict, noContent, ok } from '@/lib/apiResponse';
import { requireField, requireFields, runValidations, validateEmail } from '@/lib/validators';
import { WITH_PROFILE } from '@/lib/queryConstants';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { requireServerSession } from '@/lib/serverAuth';

// ── Helpers ────────────────────────────────────────────

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isDuplicateError(error: { message: string }): boolean {
  return error.message.includes('unique') || error.message.includes('duplicate');
}

function serviceGuard() {
  if (!isSupabaseAdminConfigured()) {
    return internalError('Secure Supabase service role is not configured.');
  }
  return null;
}

// ── POST /api/teachers ─────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const db = getSupabaseAdmin();
    const body = await request.json();
    const { full_name, email, phone, designation, password } = body;

    const validationError = runValidations(
      requireFields({ full_name, email, designation }),
      validateEmail(email ?? ''),
    );
    if (validationError) return badRequest(validationError);

    // Generate UUID and password
    const tempUserId = crypto.randomUUID();
    const plainPassword = password || generateTeacherPassword();
    const passwordHash = await hashPassword(plainPassword);

    // 1. Create profile (auth only)
    const { error: profileError } = await db
      .from('profiles')
      .insert({
        user_id: tempUserId,
        role: 'TEACHER',
        email,
        password_hash: passwordHash,
        is_active: true,
      });

    if (profileError) {
      if (isDuplicateError(profileError)) return conflict('A teacher with this email already exists');
      throw profileError;
    }

    // 2. Create teacher record
    const { error: teacherError } = await db
      .from('teachers')
      .insert({ user_id: tempUserId, full_name, phone, designation });

    if (teacherError) throw teacherError;

    // 3. Fetch complete teacher data
    const { data: teacherData, error: fetchError } = await db
      .from('teachers')
      .select(WITH_PROFILE)
      .eq('user_id', tempUserId)
      .single();

    if (fetchError) throw fetchError;

    return ok({ ...teacherData, generatedPassword: plainPassword });
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to add teacher'));
  }
}

// ── GET /api/teachers ──────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = requireServerSession(request);
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('teachers')
      .select(WITH_PROFILE)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to fetch teachers'));
  }
}

// ── DELETE /api/teachers ───────────────────────────────

export async function DELETE(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) return badRequest('User ID required');

    const { error } = await getSupabaseAdmin()
      .from('profiles')
      .update({ is_active: false })
      .eq('user_id', userId);

    if (error) throw error;
    return noContent();
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to deactivate teacher'));
  }
}

// ── PATCH /api/teachers ────────────────────────────────

export async function PATCH(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const db = getSupabaseAdmin();
    const body = await request.json();
    const { userId, action, full_name, phone, designation } = body;

    const idCheck = requireField(userId, 'User ID');
    if (!idCheck.valid) return badRequest(idCheck.error!);

    // ── Reset password ──
    if (action === 'reset_password') {
      const newPassword = generateTeacherPassword();
      const passwordHash = await hashPassword(newPassword);

      const { error } = await db
        .from('profiles')
        .update({ password_hash: passwordHash })
        .eq('user_id', userId);

      if (error) throw error;
      return ok({ newPassword });
    }

    // ── Toggle leave status ──
    if (action === 'toggle_leave') {
      const { is_on_leave, leave_reason } = body;

      const { error } = await db
        .from('teachers')
        .update({
          is_on_leave: !!is_on_leave,
          leave_reason: is_on_leave ? (leave_reason || null) : null,
        })
        .eq('user_id', userId);

      if (error) throw error;
      return noContent();
    }

    // ── Update profile ──
    if (action === 'update_profile') {
      const teacherUpdates: Record<string, string> = {};
      if (full_name) teacherUpdates.full_name = full_name;
      if (phone) teacherUpdates.phone = phone;
      if (designation) teacherUpdates.designation = designation;

      if (Object.keys(teacherUpdates).length > 0) {
        const { error } = await db
          .from('teachers')
          .update(teacherUpdates)
          .eq('user_id', userId);

        if (error) throw error;
      }

      return noContent();
    }

    // ── Promote/demote Department Head ──
    if (action === 'set_head') {
      const makeHead = !!body.is_head;

      if (makeHead) {
        const { data: existingHeads, error: existingError } = await db
          .from('teachers')
          .select('user_id')
          .eq('is_head', true)
          .neq('user_id', userId);

        if (existingError) throw existingError;

        const previousHeadIds = (existingHeads || [])
          .map((row: { user_id: string }) => row.user_id)
          .filter(Boolean);

        if (previousHeadIds.length > 0) {
          await db
            .from('teachers')
            .update({ is_head: false })
            .in('user_id', previousHeadIds);
          await db
            .from('profiles')
            .update({ role: 'TEACHER' })
            .in('user_id', previousHeadIds);
        }
      }

      const { error: teacherError } = await db
        .from('teachers')
        .update({ is_head: makeHead })
        .eq('user_id', userId);

      if (teacherError) throw teacherError;

      const { error: profileError } = await db
        .from('profiles')
        .update({ role: makeHead ? 'HEAD' : 'TEACHER' })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      return noContent();
    }

    return badRequest('Invalid action');
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to update teacher'));
  }
}
