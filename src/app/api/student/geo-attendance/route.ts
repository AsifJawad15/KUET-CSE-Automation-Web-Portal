// ==========================================
// API: /api/student/geo-attendance
// Student submits geo-attendance + checks open rooms
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';

// KUET CSE Building coordinates (fallback when room has no stored coordinates)
const BUILDING_LAT = 22.8993;
const BUILDING_LNG = 89.5023;
/** Max distance when a room has its own GPS coordinates. */
const ROOM_MAX_DISTANCE = 30;
/** Fallback max distance when a room has no stored GPS coordinates. */
const BUILDING_MAX_DISTANCE = 100;

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Calculate distance between two coordinates using the Haversine formula.
 * Returns distance in meters.
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── POST: Student submits geo-attendance ──────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { geo_room_id, student_user_id, latitude, longitude } = body;

    if (!geo_room_id || !student_user_id || latitude == null || longitude == null) {
      return badRequest('Missing required fields: geo_room_id, student_user_id, latitude, longitude');
    }

    // Validate coordinates are reasonable numbers
    if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return badRequest('Invalid coordinates');
    }

    // 1. Check if the room is active and not expired
    const { data: room, error: roomError } = await supabase
      .from('geo_attendance_rooms')
      .select('*, course_offerings!inner(id, term, courses!inner(code))')
      .eq('id', geo_room_id)
      .single();

    if (roomError || !room) {
      return badRequest('Attendance room not found');
    }

    if (!room.is_active) {
      return badRequest('This attendance room is no longer active');
    }

    const now = new Date();
    if (new Date(room.end_time) <= now) {
      // Auto-close the room
      await supabase
        .from('geo_attendance_rooms')
        .update({ is_active: false })
        .eq('id', geo_room_id);
      return badRequest('This attendance room has expired');
    }

    // 2. Check if student is enrolled in this course
    const { data: enrollment, error: enrollError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('offering_id', room.offering_id)
      .eq('student_user_id', student_user_id)
      .maybeSingle();

    // If no enrollment found, try to auto-create one (matching existing pattern)
    let enrollmentId: string;
    if (!enrollment) {
      // Check student's term matches
      const { data: student } = await supabase
        .from('students')
        .select('term')
        .eq('user_id', student_user_id)
        .single();

      const { data: offering } = await supabase
        .from('course_offerings')
        .select('term')
        .eq('id', room.offering_id)
        .single();

      if (!student || !offering || student.term !== offering.term) {
        return badRequest('You are not enrolled in this course');
      }

      const { data: newEnrollment, error: newEnrError } = await supabase
        .from('enrollments')
        .insert({
          offering_id: room.offering_id,
          student_user_id,
          enrollment_status: 'ENROLLED',
        })
        .select('id')
        .single();

      if (newEnrError) {
        if (newEnrError.code === '23505') {
          // Duplicate - fetch existing
          const { data: existing } = await supabase
            .from('enrollments')
            .select('id')
            .eq('offering_id', room.offering_id)
            .eq('student_user_id', student_user_id)
            .single();
          enrollmentId = existing?.id;
        } else {
          throw newEnrError;
        }
      } else {
        enrollmentId = newEnrollment.id;
      }
    } else {
      enrollmentId = enrollment.id;
    }

    if (!enrollmentId) {
      return badRequest('Could not verify enrollment');
    }

    // 3. Determine target coordinates and max distance
    //    Use room-specific GPS coords (30 m) if stored; else building center (100 m)
    let targetLat = BUILDING_LAT;
    let targetLng = BUILDING_LNG;
    let maxDistance = BUILDING_MAX_DISTANCE;

    if (room.room_number) {
      const { data: roomRow } = await supabase
        .from('rooms')
        .select('latitude, longitude')
        .eq('room_number', room.room_number)
        .maybeSingle();
      if (roomRow?.latitude != null && roomRow?.longitude != null) {
        targetLat = roomRow.latitude as number;
        targetLng = roomRow.longitude as number;
        maxDistance = ROOM_MAX_DISTANCE;
      }
    }

    const distance = haversineDistance(latitude, longitude, targetLat, targetLng);

    if (distance > maxDistance) {
      const label = maxDistance === ROOM_MAX_DISTANCE ? 'room' : 'building';
      return NextResponse.json({
        success: false,
        error: `You are ${Math.round(distance)}m from the ${label}. Must be within ${maxDistance}m.`,
        distance: Math.round(distance),
      }, { status: 403 });
    }

    // 4. Check if already submitted
    const { data: existingLog } = await supabase
      .from('geo_attendance_logs')
      .select('id')
      .eq('geo_room_id', geo_room_id)
      .eq('student_user_id', student_user_id)
      .maybeSingle();

    if (existingLog) {
      return NextResponse.json({
        success: false,
        error: 'You have already submitted attendance for this session',
      }, { status: 409 });
    }

    // 5. Save geo-attendance log
    const { error: logError } = await supabase
      .from('geo_attendance_logs')
      .insert({
        geo_room_id,
        student_user_id,
        latitude,
        longitude,
        distance_meters: Math.round(distance),
        status: 'PRESENT',
      });

    if (logError) throw logError;

    // 6. Also save to attendance_records (the main attendance system)
    const { error: attendError } = await supabase
      .from('attendance_records')
      .upsert({
        session_id: room.session_id,
        enrollment_id: enrollmentId,
        status: 'PRESENT',
        marked_by_teacher_user_id: room.teacher_user_id,
        remarks: `Geo-attendance: ${Math.round(distance)}m`,
      }, { onConflict: 'session_id,enrollment_id' });

    if (attendError) {
      console.error('Failed to save attendance_record:', attendError);
    }

    // 7. Also save to flat `attendance` table (same as manual/CSV attendance)
    //    so geo-attendance is treated identically in preview and reports
    try {
      const courseCode = room.course_offerings?.courses?.code;
      const { data: studentData } = await supabase
        .from('students')
        .select('roll_no')
        .eq('user_id', student_user_id)
        .single();
      const studentRoll = studentData?.roll_no;
      const attendanceDate = room.date || new Date().toISOString().split('T')[0];

      if (courseCode && studentRoll) {
        await supabase
          .from('attendance')
          .upsert({
            course_code: courseCode,
            student_roll: studentRoll,
            date: attendanceDate,
            status: 'present',
            section_or_group: room.section || null,
          }, { onConflict: 'course_code,student_roll,date' });
      }
    } catch (flatErr) {
      console.error('Failed to save to flat attendance table:', flatErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Attendance recorded successfully',
      distance: Math.round(distance),
    });
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to record attendance'));
  }
}

// ── GET: Get open rooms for a student ─────────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const studentUserId = searchParams.get('student_user_id');

    if (!studentUserId) return badRequest('student_user_id is required');

    // Get student's term and roll number for section filtering
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('term, roll_no')
      .eq('user_id', studentUserId)
      .single();

    if (studentError || !student) return badRequest('Student not found');

    // Extract numeric suffix from roll number for section matching
    const rollMatch = (student.roll_no || '').match(/(\d{1,3})$/);
    const rollSuffix = rollMatch ? parseInt(rollMatch[1], 10) : 0;

    // Close expired rooms first
    await supabase
      .from('geo_attendance_rooms')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('end_time', new Date().toISOString());

    // Get all active rooms for courses in student's term
    const { data: rooms, error: roomsError } = await supabase
      .from('geo_attendance_rooms')
      .select(`
        *,
        course_offerings!inner (
          id, term,
          courses!inner ( code, title, course_type )
        ),
        teachers!geo_attendance_rooms_teacher_fkey ( full_name )
      `)
      .eq('is_active', true)
      .eq('course_offerings.term', student.term)
      .order('start_time', { ascending: true });

    if (roomsError) throw roomsError;

    // Check which rooms the student already submitted attendance for
    const roomIds = (rooms || []).map((r: { id: string }) => r.id);
    let submittedRoomIds: string[] = [];

    if (roomIds.length > 0) {
      const { data: logs } = await supabase
        .from('geo_attendance_logs')
        .select('geo_room_id')
        .eq('student_user_id', studentUserId)
        .in('geo_room_id', roomIds);

      submittedRoomIds = (logs || []).map((l: { geo_room_id: string }) => l.geo_room_id);
    }

    const enrichedRooms = (rooms || [])
      .filter((room: Record<string, unknown>) => {
        // Filter by section if the room has one
        const section = room.section as string | null;
        if (!section || !rollSuffix) return true;
        const sec = section.toUpperCase().trim();
        const matchSec = (code: string) =>
          sec === code || sec.startsWith(`SECTION ${code}`) || sec.startsWith(`GROUP ${code}`);
        // Theory sections
        if (matchSec('A') && !matchSec('A1') && !matchSec('A2')) return rollSuffix >= 1 && rollSuffix <= 60;
        if (matchSec('B') && !matchSec('B1') && !matchSec('B2')) return rollSuffix >= 61 && rollSuffix <= 120;
        // Lab groups
        if (matchSec('A1')) return rollSuffix >= 1 && rollSuffix <= 30;
        if (matchSec('A2')) return rollSuffix >= 31 && rollSuffix <= 60;
        if (matchSec('B1')) return rollSuffix >= 61 && rollSuffix <= 90;
        if (matchSec('B2')) return rollSuffix >= 91 && rollSuffix <= 120;
        return true;
      })
      .map((room: Record<string, unknown>) => ({
        ...room,
        already_submitted: submittedRoomIds.includes(room.id as string),
      }));

    return NextResponse.json(enrichedRooms);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to fetch open rooms'));
  }
}
