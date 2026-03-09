// ==========================================
// API: /api/students/cr
// Manages CR (Class Representative) designation
// ==========================================

import { badRequest, guardSupabase, internalError, ok } from '@/lib/apiResponse';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { requireField } from '@/lib/validators';
import { NextRequest } from 'next/server';

// ── PATCH /api/students/cr — Toggle CR status ──────────

export async function PATCH(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { user_id, is_cr } = body;

    const validation = requireField(user_id, 'user_id');
    if (!validation.valid) return badRequest(validation.error!);

    if (typeof is_cr !== 'boolean') {
      return badRequest('is_cr must be a boolean');
    }

    const { data, error } = await supabase
      .from('students')
      .update({ is_cr })
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update CR status';
    return internalError(message);
  }
}
