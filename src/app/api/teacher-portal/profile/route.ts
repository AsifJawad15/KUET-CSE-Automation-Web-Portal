import { POST as changePassword } from '@/app/api/auth/password/route';
import { requireServerSession } from '@/lib/serverAuth';
// ==========================================
// API: /api/teacher-portal/profile
// Handles teacher profile update & password change
// ==========================================

import { NextRequest } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseServer';
import { badRequest, guardSupabase, internalError, noContent } from '@/lib/apiResponse';
import { requireField, runValidations } from '@/lib/validators';
import { hashPassword, comparePassword, validatePassword } from '@/lib/passwordUtils';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── PATCH /api/teacher-portal/profile ──────────────────

export async function PATCH(request: NextRequest) {
  const auth = await requireServerSession(request, { roles: ['teacher', 'head'] });
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { action } = body;
    const userId = auth.user.id;

    const idCheck = requireField(userId, 'User ID');
    if (!idCheck.valid) return badRequest(idCheck.error!);

    // ── Change Password ──
    if (action === 'change_password') {
      return changePassword(new NextRequest(request.url, { method: 'POST', headers: request.headers,
        body: JSON.stringify({ current_password: body.current_password, new_password: body.new_password }) }));
    }

    // ── Update Profile ──
    const { full_name, phone, designation, office_room } = body;
    const updates: Record<string, string> = {};
    if (full_name) updates.full_name = full_name;
    if (phone) updates.phone = phone;
    if (designation) updates.designation = designation;
    if (office_room !== undefined) updates.office_room = office_room;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('teachers')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;
    }

    return noContent();
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to update profile'));
  }
}
