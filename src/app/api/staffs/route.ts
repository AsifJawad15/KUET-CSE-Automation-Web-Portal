import { NextRequest, NextResponse } from 'next/server';

import { badRequest, conflict, internalError, noContent, ok } from '@/lib/apiResponse';
import { generateSecurePassword, hashPassword } from '@/lib/passwordUtils';
import { requireField, requireFields, runValidations, validateEmail } from '@/lib/validators';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { requireServerSession } from '@/lib/serverAuth';

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

export async function GET(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('staffs')
      .select(`
        *,
        profile:profiles(user_id, role, email, is_active, created_at, updated_at)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to fetch staff'));
  }
}

export async function POST(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const body = await request.json();
    const { full_name, email, phone, designation, is_admin, password } = body;

    const validationError = runValidations(
      requireFields({ full_name, email, designation }),
      validateEmail(email ?? ''),
    );
    if (validationError) return badRequest(validationError);

    const db = getSupabaseAdmin();
    const userId = crypto.randomUUID();
    const plainPassword = password || generateSecurePassword(12);
    const passwordHash = await hashPassword(plainPassword);
    const role = is_admin ? 'ADMIN' : 'STAFF';

    const { error: profileError } = await db.from('profiles').insert({
      user_id: userId,
      role,
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      is_active: true,
    });

    if (profileError) {
      if (isDuplicateError(profileError)) return conflict('A user with this email already exists');
      throw profileError;
    }

    const { error: staffError } = await db.from('staffs').insert({
      user_id: userId,
      full_name,
      phone: phone || null,
      designation,
      is_admin: !!is_admin,
    });

    if (staffError) throw staffError;

    if (is_admin) {
      await db.from('admins').upsert({
        user_id: userId,
        full_name,
        phone: phone || null,
        permissions: { all: true, source: 'staff_management' },
      });
    }

    const { data, error: fetchError } = await db
      .from('staffs')
      .select(`
        *,
        profile:profiles(user_id, role, email, is_active, created_at, updated_at)
      `)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;
    return ok({ ...data, generatedPassword: plainPassword });
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to add staff'));
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const body = await request.json();
    const { userId, action } = body;
    const idCheck = requireField(userId, 'User ID');
    if (!idCheck.valid) return badRequest(idCheck.error!);

    if (action !== 'set_admin') return badRequest('Invalid action');

    const db = getSupabaseAdmin();
    const makeAdmin = !!body.is_admin;

    const { data: staff, error: staffFetchError } = await db
      .from('staffs')
      .select('user_id, full_name, phone')
      .eq('user_id', userId)
      .single();

    if (staffFetchError) throw staffFetchError;

    await db.from('staffs').update({ is_admin: makeAdmin }).eq('user_id', userId);
    await db
      .from('profiles')
      .update({ role: makeAdmin ? 'ADMIN' : 'STAFF' })
      .eq('user_id', userId);

    if (makeAdmin) {
      await db.from('admins').upsert({
        user_id: userId,
        full_name: staff.full_name,
        phone: staff.phone || null,
        permissions: { all: true, source: 'staff_management' },
      });
    } else {
      await db.from('admins').delete().eq('user_id', userId);
    }

    return noContent();
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to update staff'));
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const userId = new URL(request.url).searchParams.get('userId');
    if (!userId) return badRequest('User ID required');

    const { error } = await getSupabaseAdmin()
      .from('profiles')
      .update({ is_active: false })
      .eq('user_id', userId);

    if (error) throw error;
    return noContent();
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to deactivate staff'));
  }
}
