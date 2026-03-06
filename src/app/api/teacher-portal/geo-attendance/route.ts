// ==========================================
// API: /api/teacher-portal/geo-attendance
// Teacher opens/closes geo-attendance rooms
// Room limits: max 2 active rooms for theory, max 4 for lab
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// Room limits per course type
const MAX_THEORY_ROOMS = 2;
const MAX_LAB_ROOMS = 4;

// ── POST: Open a geo-attendance room ──────────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { offering_id, teacher_user_id, room_number, section, start_time, end_time } = body;

    if (!offering_id || !teacher_user_id || !start_time || !end_time) {
      return badRequest('Missing required fields: offering_id, teacher_user_id, start_time, end_time');
    }

    // Auto-close expired rooms first
    await supabase
      .from('geo_attendance_rooms')
      .update({ is_active: false })
      .eq('teacher_user_id', teacher_user_id)
      .eq('is_active', true)
      .lt('end_time', new Date().toISOString());

    // Check course type to determine room limit
    const { data: offering, error: offeringError } = await supabase
      .from('course_offerings')
      .select('id, courses!inner(course_type)')
      .eq('id', offering_id)
      .single();

    if (offeringError || !offering) {
      return badRequest('Course offering not found');
    }

    const courseType = ((offering.courses as { course_type: string })?.course_type || 'theory').toLowerCase();
    const maxRooms = courseType === 'lab' ? MAX_LAB_ROOMS : MAX_THEORY_ROOMS;

    // Count currently active rooms for this teacher
    const { data: activeRooms, error: countError } = await supabase
      .from('geo_attendance_rooms')
      .select('id')
      .eq('teacher_user_id', teacher_user_id)
      .eq('is_active', true);

    if (countError) throw countError;

    const activeCount = activeRooms?.length || 0;
    if (activeCount >= maxRooms) {
      return badRequest(
        `You already have ${activeCount} active room(s). Maximum allowed for ${courseType} is ${maxRooms}. Close an existing room first.`
      );
    }

    // Create a class_session for this geo-attendance
    const { data: sessionData, error: sessionError } = await supabase
      .from('class_sessions')
      .insert({
        offering_id,
        starts_at: start_time,
        ends_at: end_time,
        room_number: room_number || null,
        topic: 'Geo-Attendance Session',
      })
      .select('id')
      .single();

    if (sessionError) throw sessionError;

    // Create the geo-attendance room
    const { data, error } = await supabase
      .from('geo_attendance_rooms')
      .insert({
        offering_id,
        session_id: sessionData.id,
        teacher_user_id,
        room_number: room_number || null,
        section: section || null,
        date: new Date().toISOString().split('T')[0],
        start_time,
        end_time,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to open geo-attendance room'));
  }
}

// ── GET: Get active/recent geo-attendance rooms ───────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacher_user_id');
    const offeringId = searchParams.get('offering_id');
    const activeOnly = searchParams.get('active_only') === 'true';
    const roomId = searchParams.get('room_id');

    // If room_id is provided, return attendance logs for that room
    if (roomId) {
      const { data: logs, error: logsError } = await supabase
        .from('geo_attendance_logs')
        .select(`
          *,
          students!geo_attendance_logs_student_fkey ( roll_no, full_name )
        `)
        .eq('geo_room_id', roomId)
        .order('submitted_at', { ascending: true });

      if (logsError) throw logsError;
      return NextResponse.json(logs || []);
    }

    // Auto-close expired rooms
    await supabase
      .from('geo_attendance_rooms')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('end_time', new Date().toISOString());

    let query = supabase
      .from('geo_attendance_rooms')
      .select(`
        *,
        course_offerings!inner (
          id, term,
          courses!inner ( code, title, course_type )
        )
      `)
      .order('created_at', { ascending: false });

    if (teacherId) query = query.eq('teacher_user_id', teacherId);
    if (offeringId) query = query.eq('offering_id', offeringId);
    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;

    // For each room, get the count of attendance submissions
    const rooms = data || [];
    if (rooms.length > 0) {
      const roomIds = rooms.map((r: { id: string }) => r.id);
      const { data: logCounts } = await supabase
        .from('geo_attendance_logs')
        .select('geo_room_id')
        .in('geo_room_id', roomIds);

      const countMap = new Map<string, number>();
      for (const log of (logCounts || [])) {
        const rid = log.geo_room_id;
        countMap.set(rid, (countMap.get(rid) || 0) + 1);
      }

      for (const room of rooms) {
        (room as Record<string, unknown>).submission_count = countMap.get(room.id) || 0;
      }
    }

    return NextResponse.json(rooms);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to fetch geo-attendance rooms'));
  }
}

// ── PATCH: Close a geo-attendance room ────────────────

export async function PATCH(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { room_id, teacher_user_id } = body;

    if (!room_id) return badRequest('room_id is required');

    let query = supabase
      .from('geo_attendance_rooms')
      .update({ is_active: false })
      .eq('id', room_id);

    if (teacher_user_id) query = query.eq('teacher_user_id', teacher_user_id);

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Room closed' });
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to close geo-attendance room'));
  }
}
