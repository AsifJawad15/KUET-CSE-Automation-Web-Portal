import { NextRequest, NextResponse } from 'next/server';

import { badRequest, conflict, internalError, noContent, ok } from '@/lib/apiResponse';
import { generateSecurePassword, hashPassword } from '@/lib/passwordUtils';
import { requireField, requireFields, runValidations, validateEmail } from '@/lib/validators';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { requireServerSession } from '@/lib/serverAuth';

interface AdminPermissions {
  all?: boolean;
  menus?: string[];
  source?: string;
}

function normalizeAdminPermissions(raw: unknown): AdminPermissions {
  if (!raw || typeof raw !== 'object') {
    return { all: false, menus: [], source: 'staff_management_custom' };
  }

  const candidate = raw as { all?: unknown; menus?: unknown; source?: unknown };
  const menus = Array.isArray(candidate.menus)
    ? candidate.menus.filter((menu): menu is string => typeof menu === 'string' && menu.trim().length > 0)
    : [];

  return {
    all: candidate.all === true,
    menus,
    source: typeof candidate.source === 'string' ? candidate.source : 'staff_management_custom',
  };
}

async function loadAdminPermissionsMap() {
  const { data: adminRows, error } = await getSupabaseAdmin()
    .from('admins')
    .select('user_id, permissions');

  if (error) throw error;

  return new Map(
    (adminRows ?? []).map((admin) => [
      admin.user_id,
      normalizeAdminPermissions(admin.permissions),
    ]),
  );
}

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

    const permissionMap = await loadAdminPermissionsMap();
    const withPermissions = (data ?? []).map((staff) => ({
      ...staff,
      admin_permissions: permissionMap.get(staff.user_id) ?? null,
    }));

    return NextResponse.json(withPermissions);
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
    const { full_name, email, phone, designation, is_admin, password, permissions } = body;
    const isAdmin = !!is_admin;
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';

    const validationError = runValidations(
      requireFields({ full_name, email, designation }),
      validateEmail(email ?? ''),
    );
    if (validationError) return badRequest(validationError);
    if (isAdmin && !normalizedPhone) {
      return badRequest('Mobile number is required for admin accounts');
    }

    const db = getSupabaseAdmin();
    const userId = crypto.randomUUID();
    const plainPassword = isAdmin ? normalizedPhone : (password || generateSecurePassword(12));
    const passwordHash = await hashPassword(plainPassword);
    const role = isAdmin ? 'ADMIN' : 'STAFF';

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
      phone: normalizedPhone || null,
      designation,
      is_admin: isAdmin,
    });

    if (staffError) throw staffError;

    if (isAdmin) {
      const normalizedPermissions = normalizeAdminPermissions(permissions);
      await db.from('admins').upsert({
        user_id: userId,
        full_name,
        phone: normalizedPhone || null,
        permissions: normalizedPermissions.all
          ? { all: true, source: normalizedPermissions.source }
          : {
              all: false,
              menus: normalizedPermissions.menus,
              source: normalizedPermissions.source,
            },
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

    let adminPermissions: AdminPermissions | null = null;
    if (isAdmin) {
      const { data: adminRow } = await db
        .from('admins')
        .select('permissions')
        .eq('user_id', userId)
        .maybeSingle();
      adminPermissions = normalizeAdminPermissions(adminRow?.permissions ?? null);
    }

    return ok({
      ...data,
      admin_permissions: adminPermissions,
      generatedPassword: isAdmin ? undefined : plainPassword,
    });
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

    if (action !== 'set_admin' && action !== 'set_permissions') {
      return badRequest('Invalid action');
    }

    const db = getSupabaseAdmin();
    const { data: staff, error: staffFetchError } = await db
      .from('staffs')
      .select('user_id, full_name, phone, is_admin')
      .eq('user_id', userId)
      .single();

    if (staffFetchError) throw staffFetchError;

    if (action === 'set_permissions') {
      const normalizedPermissions = normalizeAdminPermissions(body.permissions);

      if (!staff.is_admin) {
        return badRequest('Only admin staff can receive module permissions');
      }

      await db.from('admins').upsert({
        user_id: userId,
        full_name: staff.full_name,
        phone: staff.phone || null,
        permissions: normalizedPermissions.all
          ? { all: true, source: normalizedPermissions.source }
          : {
              all: false,
              menus: normalizedPermissions.menus,
              source: normalizedPermissions.source,
            },
      });

      return noContent();
    }

    const makeAdmin = !!body.is_admin;

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
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const mode = (url.searchParams.get('mode') || '').toLowerCase();
    const hardDelete = mode === 'hard' || mode === 'permanent' || mode === 'full';
    if (!userId) return badRequest('User ID required');

    if (hardDelete) {
      if (userId === auth.user.id) {
        return badRequest('You cannot remove your own account');
      }

      const db = getSupabaseAdmin();

      const { error: adminDeleteError } = await db
        .from('admins')
        .delete()
        .eq('user_id', userId);
      if (adminDeleteError) throw adminDeleteError;

      const { error: staffDeleteError } = await db
        .from('staffs')
        .delete()
        .eq('user_id', userId);
      if (staffDeleteError) throw staffDeleteError;

      const { error: profileDeleteError } = await db
        .from('profiles')
        .delete()
        .eq('user_id', userId);
      if (profileDeleteError) throw profileDeleteError;

      return noContent();
    }

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
