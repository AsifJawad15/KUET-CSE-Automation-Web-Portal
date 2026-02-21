// ==========================================
// API: /api/term-upgrades
// Single Responsibility: HTTP layer — delegates to Supabase
// Uses shared response helpers, validators & query constants
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, conflict, created, guardSupabase, internalError, noContent, notFound, ok, serviceUnavailable } from '@/lib/apiResponse';
import { requireFields, validateUUID } from '@/lib/validators';
import { TERM_UPGRADE_WITH_STUDENT } from '@/lib/queryConstants';

// ── Helpers ────────────────────────────────────────────

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const VALID_REVIEW_STATUSES = ['approved', 'rejected'] as const;

// ── GET /api/term-upgrades ─────────────────────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const studentUserId = searchParams.get('studentUserId');
    const status = searchParams.get('status');

    let query = supabase
      .from('term_upgrade_requests')
      .select(TERM_UPGRADE_WITH_STUDENT)
      .order('requested_at', { ascending: false });

    if (studentUserId) query = query.eq('student_user_id', studentUserId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to fetch term upgrade requests'));
  }
}

// ── POST /api/term-upgrades ────────────────────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { student_user_id, current_term, requested_term, reason } = body;

    const fieldCheck = requireFields({ student_user_id, current_term, requested_term });
    if (!fieldCheck.valid) return badRequest(fieldCheck.error!);

    // Check for existing pending request
    const { data: existing } = await supabase
      .from('term_upgrade_requests')
      .select('id')
      .eq('student_user_id', student_user_id)
      .eq('status', 'pending')
      .limit(1);

    if (existing && existing.length > 0) {
      return conflict('You already have a pending term upgrade request');
    }

    const { data, error } = await supabase
      .from('term_upgrade_requests')
      .insert({
        student_user_id,
        current_term,
        requested_term,
        reason: reason || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return created(data);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to create term upgrade request'));
  }
}

// ── PATCH /api/term-upgrades (approve/reject) ──────────

export async function PATCH(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { id, status, admin_user_id, admin_remarks } = body;

    const fieldCheck = requireFields({ id, status });
    if (!fieldCheck.valid) return badRequest(fieldCheck.error!);

    if (!VALID_REVIEW_STATUSES.includes(status)) {
      return badRequest(`status must be "approved" or "rejected"`);
    }

    // Validate admin_user_id is a valid UUID, otherwise set to null
    const validAdminId = admin_user_id
      ? (validateUUID(admin_user_id).valid ? admin_user_id : null)
      : null;

    // Fetch the request
    const { data: upgradeRequest, error: fetchError } = await supabase
      .from('term_upgrade_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !upgradeRequest) return notFound('Request not found');
    if (upgradeRequest.status !== 'pending') return badRequest('This request has already been reviewed');

    // Update request status
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('term_upgrade_requests')
      .update({
        status,
        admin_user_id: validAdminId,
        admin_remarks: admin_remarks || null,
        reviewed_at: now,
        updated_at: now,
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // If approved, update the student's term
    if (status === 'approved') {
      const { error: studentUpdateError } = await supabase
        .from('students')
        .update({
          term: upgradeRequest.requested_term,
          updated_at: now,
        })
        .eq('user_id', upgradeRequest.student_user_id);

      if (studentUpdateError) {
        // Rollback request status on failure
        await supabase
          .from('term_upgrade_requests')
          .update({ status: 'pending', admin_user_id: null, admin_remarks: null, reviewed_at: null })
          .eq('id', id);

        return internalError('Failed to update student term: ' + studentUpdateError.message);
      }
    }

    return ok({ status });
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to review term upgrade request'));
  }
}

// ── DELETE /api/term-upgrades ──────────────────────────

export async function DELETE(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return badRequest('id is required');

    const { error } = await supabase
      .from('term_upgrade_requests')
      .delete()
      .eq('id', id)
      .eq('status', 'pending'); // Only allow deleting pending requests

    if (error) throw error;
    return noContent();
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to delete term upgrade request'));
  }
}
