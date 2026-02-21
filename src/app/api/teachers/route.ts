// ==========================================
// API: /api/teachers
// Single Responsibility: HTTP layer — delegates to Supabase
// Uses shared response helpers, validators & query constants
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { hashPassword, generateTeacherPassword } from '@/lib/passwordUtils';
import { badRequest, guardSupabase, internalError, conflict, noContent, ok } from '@/lib/apiResponse';
import { requireField, requireFields, runValidations, validateEmail } from '@/lib/validators';
import { WITH_PROFILE } from '@/lib/queryConstants';

// ── Helpers ────────────────────────────────────────────

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isDuplicateError(error: { message: string }): boolean {
  return error.message.includes('unique') || error.message.includes('duplicate');
}

// ── POST /api/teachers ─────────────────────────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
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
    const { error: profileError } = await supabase
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
    const { error: teacherError } = await supabase
      .from('teachers')
      .insert({ user_id: tempUserId, full_name, phone, designation });

    if (teacherError) throw teacherError;

    // 3. Fetch complete teacher data
    const { data: teacherData, error: fetchError } = await supabase
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

export async function GET() {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { data, error } = await supabase
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
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) return badRequest('User ID required');

    const { error } = await supabase
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
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { userId, action, full_name, phone, designation } = body;

    const idCheck = requireField(userId, 'User ID');
    if (!idCheck.valid) return badRequest(idCheck.error!);

    // ── Reset password ──
    if (action === 'reset_password') {
      const newPassword = generateTeacherPassword();
      const passwordHash = await hashPassword(newPassword);

      const { error } = await supabase
        .from('profiles')
        .update({ password_hash: passwordHash })
        .eq('user_id', userId);

      if (error) throw error;
      return ok({ newPassword });
    }

    // ── Toggle leave status ──
    if (action === 'toggle_leave') {
      const { is_on_leave, leave_reason } = body;

      const { error } = await supabase
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
        const { error } = await supabase
          .from('teachers')
          .update(teacherUpdates)
          .eq('user_id', userId);

        if (error) throw error;
      }

      return noContent();
    }

    return badRequest('Invalid action');
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to update teacher'));
  }
}
