// ==========================================
// API: /api/routine-slots
// Single Responsibility: HTTP layer — delegates to Supabase
// DRY: Uses shared query constants & response helpers
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { badRequest, conflict, guardSupabase, internalError, noContent, notFound, ok } from '@/lib/apiResponse';
import { requireField, requireFields } from '@/lib/validators';
import { ROUTINE_SLOT_WITH_DETAILS } from '@/lib/queryConstants';

// ── Helpers ────────────────────────────────────────────

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Derive term from course code digits (e.g., "CSE 3201" → "3-2"). */
function deriveTermFromCode(code: string): string | null {
  const digits = code.replace(/\D/g, '');
  if (digits.length < 2) return null;
  return `${digits[0]}-${digits[1]}`;
}

/** Check for room time conflicts, excluding slots for the same course (combined slots allowed). */
async function hasRoomConflict(
  roomNumber: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  courseId: string | null,
  excludeSlotId?: string,
): Promise<boolean> {
  let query = supabase
    .from('routine_slots')
    .select('id, offering_id, course_offerings!inner(course_id)')
    .eq('room_number', roomNumber)
    .eq('day_of_week', dayOfWeek)
    .lt('start_time', endTime)
    .gt('end_time', startTime);

  if (excludeSlotId) query = query.neq('id', excludeSlotId);

  const { data: conflicts } = await query;

  // Filter out same-course conflicts (combined slots are allowed)
  const realConflicts = (conflicts || []).filter((c: Record<string, unknown>) => {
    const offering = c.course_offerings as { course_id?: string } | null;
    return offering?.course_id !== courseId;
  });

  return realConflicts.length > 0;
}

// ── GET /api/routine-slots ─────────────────────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');
    const section = searchParams.get('section');

    let query = supabase
      .from('routine_slots')
      .select(ROUTINE_SLOT_WITH_DETAILS)
      .order('day_of_week')
      .order('start_time');

    if (section) query = query.eq('section', section);

    const { data, error } = await query;
    if (error) throw error;

    let filtered = data || [];
    if (term) {
      filtered = filtered.filter((slot: Record<string, unknown>) => {
        const offerings = slot.course_offerings as { courses?: { code?: string } } | null;
        const code = offerings?.courses?.code || '';
        return deriveTermFromCode(code) === term;
      });
    }

    return NextResponse.json(filtered);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to fetch routine slots'));
  }
}

// ── POST /api/routine-slots ────────────────────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { offering_id, room_number, day_of_week, start_time, end_time, section } = body;

    const fieldCheck = requireFields({ offering_id, room_number, day_of_week, start_time, end_time });
    if (!fieldCheck.valid) return badRequest(fieldCheck.error!);

    // Get the course_id for conflict check
    const { data: incomingOffering } = await supabase
      .from('course_offerings')
      .select('course_id')
      .eq('id', offering_id)
      .single();

    const courseId = incomingOffering?.course_id ?? null;

    if (await hasRoomConflict(room_number, day_of_week, start_time, end_time, courseId)) {
      return conflict('Room is already booked for this time slot');
    }

    const { data, error } = await supabase
      .from('routine_slots')
      .insert({ offering_id, room_number, day_of_week, start_time, end_time, section })
      .select(ROUTINE_SLOT_WITH_DETAILS)
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to add routine slot'));
  }
}

// ── PATCH /api/routine-slots ───────────────────────────

export async function PATCH(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    const idCheck = requireField(id, 'id');
    if (!idCheck.valid) return badRequest(idCheck.error!);

    // If changing room/time, check for conflicts
    if (updates.room_number || updates.start_time || updates.end_time || updates.day_of_week !== undefined) {
      const { data: existing } = await supabase.from('routine_slots').select('*').eq('id', id).single();
      if (!existing) return notFound('Slot not found');

      const room = updates.room_number || existing.room_number;
      const day = updates.day_of_week ?? existing.day_of_week;
      const start = updates.start_time || existing.start_time;
      const end = updates.end_time || existing.end_time;

      // Simple conflict check (no same-course exemption for patch)
      const { data: conflicts } = await supabase
        .from('routine_slots')
        .select('id')
        .eq('room_number', room)
        .eq('day_of_week', day)
        .lt('start_time', end)
        .gt('end_time', start)
        .neq('id', id);

      if (conflicts && conflicts.length > 0) return conflict('Room conflict at this time');
    }

    const { data, error } = await supabase
      .from('routine_slots')
      .update(updates)
      .eq('id', id)
      .select(ROUTINE_SLOT_WITH_DETAILS)
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to update routine slot'));
  }
}

// ── DELETE /api/routine-slots ──────────────────────────

export async function DELETE(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return badRequest('id is required');

    const { error } = await supabase.from('routine_slots').delete().eq('id', id);
    if (error) throw error;

    return noContent();
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to delete routine slot'));
  }
}
