// ==========================================
// API: /api/students
// Single Responsibility: HTTP layer — delegates to Supabase
// Uses shared response helpers, validators & query constants
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, getStudentInitialPassword } from '@/lib/passwordUtils';
import { badRequest, conflict, internalError, noContent, ok } from '@/lib/apiResponse';
import { requireFields, runValidations, validateEmail, validateTerm } from '@/lib/validators';
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

// ── POST /api/students ─────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const db = getSupabaseAdmin();
    const body = await request.json();
    const { full_name, email, phone, roll_no, term, session } = body;

    const validationError = runValidations(
      requireFields({ full_name, email, roll_no, term, session }),
      validateEmail(email ?? ''),
    );
    if (validationError) return badRequest(validationError);

    // Generate UUID and password
    const tempUserId = crypto.randomUUID();
    const initialPassword = getStudentInitialPassword(roll_no);
    const passwordHash = await hashPassword(initialPassword);

    // 1. Create profile (auth only)
    const { error: profileError } = await db
      .from('profiles')
      .insert({
        user_id: tempUserId,
        role: 'STUDENT',
        email,
        password_hash: passwordHash,
        is_active: true,
      });

    if (profileError) {
      if (isDuplicateError(profileError)) return conflict('A student with this email already exists');
      throw profileError;
    }

    // 2. Create student record
    const { error: studentError } = await db
      .from('students')
      .insert({ user_id: tempUserId, roll_no, full_name, phone, term, session });

    if (studentError) {
      if (isDuplicateError(studentError)) return conflict('A student with this roll number already exists');
      throw studentError;
    }

    // 3. Fetch complete student data
    const { data: studentData, error: fetchError } = await db
      .from('students')
      .select(WITH_PROFILE)
      .eq('user_id', tempUserId)
      .single();

    if (fetchError) throw fetchError;

    return ok({ ...studentData, initialPassword });
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to add student'));
  }
}

// ── GET /api/students ──────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = requireServerSession(request);
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('students')
      .select(WITH_PROFILE)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to fetch students'));
  }
}

// ── PATCH /api/students ────────────────────────────────

export async function PATCH(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const body = await request.json();
    const { user_id, term } = body;

    const validationError = runValidations(
      requireFields({ user_id, term }),
      validateTerm(term ?? ''),
    );
    if (validationError) return badRequest(validationError);

    const { error } = await getSupabaseAdmin()
      .from('students')
      .update({ term, updated_at: new Date().toISOString() })
      .eq('user_id', user_id);

    if (error) throw error;
    return ok({ user_id, term });
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to update student term'));
  }
}

// ── DELETE /api/students ───────────────────────────────

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
    return internalError(extractErrorMessage(error, 'Failed to deactivate student'));
  }
}
