// ==========================================
// API: /api/teacher-portal/room-requests
// Handles teacher room booking requests
// ==========================================

import { badRequest, guardSupabase, internalError, ok } from '@/lib/apiResponse';
import { notifyAdminRoomRequestPending, notifyTeacherRoomApproved, notifyTeacherRoomRejected } from '@/lib/notifications';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { requireFields, runValidations } from '@/lib/validators';
import { NextRequest, NextResponse } from 'next/server';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDayName(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { weekday: 'long' });
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

    // Notify admin so they can review and approve the request
    await notifyAdminRoomRequestPending({
      teacherUserId: teacher_user_id || null,
      teacherName: teacher_name || null,
      roomNumber: room_number,
      date,
      startTime: start_time,
      endTime: end_time,
      purpose,
      requestId: data.id as string,
    });

    return ok(data);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to submit room request'));
  }
}

// ── PATCH /api/teacher-portal/room-requests ────────────

export async function PATCH(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { id, status, remarks, room_number } = body;

    const validation = runValidations(
      requireFields({ id, status }),
    );
    if (validation) return badRequest(validation);

    if (status !== 'approved' && status !== 'rejected') {
      return badRequest('status must be either approved or rejected');
    }

    const { data: existingRequest, error: lookupError } = await supabase
      .from('room_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (lookupError) throw lookupError;

    const updatePayload: Record<string, unknown> = { status };
    if (room_number) {
      updatePayload.room_number = room_number;
    }

    const { data, error } = await supabase
      .from('room_requests')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    const teacherUserId = (existingRequest.teacher_user_id as string | null) ?? null;
    if (teacherUserId) {
      const period = `${existingRequest.start_time as string}–${existingRequest.end_time as string}`;
      const courseCode = (existingRequest.purpose as string | null) || 'Room Request';
      const dayName = formatDayName(existingRequest.date as string);
      const resolvedRoom = (room_number as string | undefined) || (existingRequest.room_number as string | null) || 'TBA';

      if (status === 'approved') {
        await notifyTeacherRoomApproved({
          teacherUserId,
          courseCode,
          roomNumber: resolvedRoom,
          period,
          dayName,
          remarks: remarks ?? null,
          requestId: id,
        });
      } else {
        await notifyTeacherRoomRejected({
          teacherUserId,
          courseCode,
          roomNumber: resolvedRoom,
          period,
          dayName,
          reason: remarks ?? 'No remarks provided.',
          requestId: id,
        });
      }
    }

    return ok(data);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to review room request'));
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
