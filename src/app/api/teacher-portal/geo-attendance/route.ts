// ==========================================
// API: /api/teacher-portal/geo-attendance
// Teacher opens/closes geo-attendance rooms
// Room limits: max 2 active rooms for theory, max 4 for lab
// ==========================================

import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { notifyGeoAttendanceRoomOpened } from '@/lib/geoAttendanceNotifications';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

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
    const { offering_id, teacher_user_id, room_number, section, start_time, end_time, geo_room_location_id, range_meters } = body;

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

    // Resolve the offering first (without inner joins) to avoid false "not found" from relation issues.
    const { data: offering, error: offeringError } = await supabase
      .from('course_offerings')
      .select('id, term, batch, course_id, teacher_user_id')
      .eq('id', offering_id)
      .maybeSingle();

    if (offeringError) {
      return badRequest(`Course offering lookup failed: ${offeringError.message}`);
    }

    if (!offering) {
      return badRequest('Course offering not found. Please refresh your course list and try again.');
    }

    if (offering.teacher_user_id !== teacher_user_id) {
      return badRequest('Selected course offering is not assigned to this teacher.');
    }

    const { data: courseRow, error: courseError } = await supabase
      .from('courses')
      .select('code, title, course_type')
      .eq('id', offering.course_id)
      .maybeSingle();

    if (courseError) {
      return badRequest(`Failed to load course details for offering: ${courseError.message}`);
    }

    const courseType = (courseRow?.course_type || 'theory').toLowerCase();
    const courseCode = courseRow?.code || null;
    const offeringTerm = offering.term as string | null;
    const resolvedSection = (section || null) as string | null;
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
        geo_room_location_id: geo_room_location_id || null,
        range_meters: typeof range_meters === 'number' ? range_meters : 30,
        date: new Date().toISOString().split('T')[0],
        start_time,
        end_time,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Notify target students immediately when a geo-attendance room is opened.
    if (courseCode && offeringTerm) {
      const startMs = new Date(start_time).getTime();
      const endMs = new Date(end_time).getTime();
      const computedDuration = Number.isFinite(startMs) && Number.isFinite(endMs)
        ? Math.max(1, Math.round((endMs - startMs) / 60000))
        : 50;

      const endDate = new Date(end_time);
      const endLabel = Number.isNaN(endDate.getTime())
        ? end_time
        : endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      await notifyGeoAttendanceRoomOpened({
        teacherUserId: teacher_user_id,
        offeringId: offering_id,
        courseCode,
        term: offeringTerm,
        section: resolvedSection,
        roomNumber: room_number || null,
        durationMinutes: computedDuration,
        endTime: endLabel,
        roomId: data.id,
      });
    }

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
        ),
        geo_room_locations ( id, room_name, latitude, longitude, plus_code, floor_number )
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
