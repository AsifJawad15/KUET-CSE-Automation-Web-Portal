// ==========================================
// API: /api/teacher-portal/profile
// Handles teacher profile update & password change
// ==========================================

import { NextRequest } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError, noContent } from '@/lib/apiResponse';
import { requireField, runValidations } from '@/lib/validators';
import { hashPassword, comparePassword, validatePassword } from '@/lib/passwordUtils';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── PATCH /api/teacher-portal/profile ──────────────────

export async function PATCH(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { userId, action } = body;

    const idCheck = requireField(userId, 'User ID');
    if (!idCheck.valid) return badRequest(idCheck.error!);

    // ── Change Password ──
    if (action === 'change_password') {
      const { current_password, new_password } = body;

      const validation = runValidations(
        requireField(current_password, 'Current password'),
        requireField(new_password, 'New password'),
      );
      if (validation) return badRequest(validation);

      const passwordCheck = validatePassword(new_password);
      if (!passwordCheck.isValid) return badRequest(passwordCheck.error!);

      // Verify current password
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('password_hash')
        .eq('user_id', userId)
        .single();

      if (fetchError || !profile) {
        return badRequest('User not found');
      }

      const isValid = await comparePassword(current_password, profile.password_hash);
      if (!isValid) {
        return badRequest('Current password is incorrect');
      }

      const newHash = await hashPassword(new_password);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ password_hash: newHash })
        .eq('user_id', userId);

      if (updateError) throw updateError;
      return noContent();
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
