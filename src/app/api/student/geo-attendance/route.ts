// ==========================================
// API: /api/student/geo-attendance
// Student submits geo-attendance + checks open rooms
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseServer';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { GEO_ATTENDANCE_DEFAULTS } from '@/lib/geoAttendanceConfig';
import { requireServerSession } from '@/lib/serverAuth';

import { authThrottle } from '@/lib/authThrottle';
function extractError(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }
export async function POST(request: NextRequest) {
  const auth = await requireServerSession(request, { roles: ['student'] });
  if (auth.response) return auth.response;
  const limited = authThrottle(`geo:${auth.user.id}`);
  if (limited) return limited;
  try {
    const body = await request.json();
    if (typeof body.geo_room_id !== 'string' || !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) return badRequest('Invalid attendance request');
    const { data, error } = await supabase.rpc('submit_geo_attendance', {
      p_student: auth.user.id, p_room: body.geo_room_id, p_lat: body.latitude,
      p_lon: body.longitude, p_code: body.verification_code ?? null,
    });
    if (error) {
      const status = error.code === '23505' ? 409 : error.code === '42501' ? 403 : error.code === '22023' ? 400 : 503;
      return NextResponse.json({ success: false, error: status === 503 ? 'Attendance service unavailable' : error.message }, { status });
    }
    return NextResponse.json(data);
  } catch { return internalError('Attendance service unavailable'); }
}
// ── GET: Get open rooms for a student ─────────────────

export async function GET(request: NextRequest) {
  // ── Auth guard ──
  const auth = await requireServerSession(request, { roles: ['student'] });
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    // Force student_user_id from verified session
    const studentUserId = auth.user.id;

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

    const { data: enrolled, error: enrolledError } = await supabase.from('enrollments')
      .select('offering_id').eq('student_user_id', studentUserId).eq('enrollment_status', 'ENROLLED');
    if (enrolledError) throw enrolledError;
    const offeringIds = (enrolled ?? []).map(e => e.offering_id);
    if (!offeringIds.length) return NextResponse.json([]);
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
      .in('offering_id', offeringIds)
      .gt('end_time', new Date().toISOString())
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
