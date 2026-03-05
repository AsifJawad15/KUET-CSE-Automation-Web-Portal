// ==========================================
// API: /api/teacher-portal/room-requests
// Handles teacher room booking requests
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError, ok } from '@/lib/apiResponse';
import { requireFields, runValidations } from '@/lib/validators';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── POST /api/teacher-portal/room-requests ─────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { teacher_user_id, teacher_name, room_number, date, start_time, end_time, purpose } = body;

    const validation = runValidations(
      requireFields({ room_number, date, start_time, end_time, purpose }),
    );
    if (validation) return badRequest(validation);

    const { data, error } = await supabase
      .from('room_requests')
      .insert({
        teacher_user_id: teacher_user_id || null,
        teacher_name: teacher_name || null,
        room_number,
        date,
        start_time,
        end_time,
        purpose,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to submit room request'));
  }
}

// ── GET /api/teacher-portal/room-requests ──────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacher_id');

    let query = supabase
      .from('room_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (teacherId) {
      query = query.eq('teacher_user_id', teacherId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to fetch room requests'));
  }
}
