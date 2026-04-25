// ==========================================
// API: /api/teacher-portal/geo-attendance
// Teacher opens/closes geo-attendance rooms
// Room limits: max 2 active rooms for theory, max 4 for lab
// ==========================================

import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import {
  GEO_ATTENDANCE_DEFAULTS,
  GEO_ATTENDANCE_LIMITS,
  GeoAttendanceInputError,
  parseGeoAttendanceInteger,
} from '@/lib/geoAttendanceConfig';
import { notifyGeoAttendanceRoomOpened } from '@/lib/geoAttendanceNotifications';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

type RollRange = {
  min: number;
  max: number;
};

type GeoAttendanceTargetStudent = {
  user_id: string;
  roll_no: string;
  section: string | null;
};

function normalizeSection(section: string | null | undefined): string | null {
  const cleaned = cleanText(section);
  if (!cleaned) return null;

  const normalized = cleaned.toUpperCase();
  if (/^[A-Z]\d?$/.test(normalized)) {
    return normalized;
  }

  const named = cleaned.match(/\b(section|group)\s+([A-Za-z]\d?)\b/i);
  if (named) {
    return named[2].toUpperCase();
  }

  return normalized;
}

function getRollRange(section: string | null | undefined): RollRange | null {
  switch (normalizeSection(section)) {
    case 'A':
      return { min: 1, max: 60 };
    case 'B':
      return { min: 61, max: 120 };
    case 'A1':
      return { min: 1, max: 30 };
    case 'A2':
      return { min: 31, max: 60 };
    case 'B1':
      return { min: 61, max: 90 };
    case 'B2':
      return { min: 91, max: 120 };
    default:
      return null;
  }
}

function extractRollSuffix(rollNo: string | null | undefined): number | null {
  const digits = rollNo?.replace(/\D/g, '') ?? '';
  if (!digits) return null;

  const suffix = digits.slice(-3);
  const parsed = Number.parseInt(suffix, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isTargetStudentForSection(
  student: Pick<GeoAttendanceTargetStudent, 'roll_no' | 'section'>,
  section: string | null | undefined,
): boolean {
  const normalizedSection = normalizeSection(section);
  if (!normalizedSection) return true;

  const studentSection = cleanText(student.section)?.toUpperCase();
  if (studentSection === normalizedSection) {
    return true;
  }

  const rollRange = getRollRange(section);
  const rollSuffix = extractRollSuffix(student.roll_no);
  return !!rollRange &&
    rollSuffix !== null &&
    rollSuffix >= rollRange.min &&
    rollSuffix <= rollRange.max;
}

async function resolveGeoAttendanceTargetStudents(opts: {
  offeringId: string;
  term: string | null;
  section?: string | null;
}): Promise<GeoAttendanceTargetStudent[]> {
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('student_user_id')
    .eq('offering_id', opts.offeringId);

  if (enrollmentError) throw enrollmentError;

  const enrolledUserIds = [...new Set(
    (enrollments || [])
      .map((row) => cleanText(row.student_user_id))
      .filter(Boolean),
  )] as string[];

  if (enrolledUserIds.length > 0) {
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('user_id, roll_no, section')
      .in('user_id', enrolledUserIds);

    if (studentError) throw studentError;

    return (students || [])
      .map((row) => ({
        user_id: row.user_id,
        roll_no: row.roll_no,
        section: row.section,
      }))
      .filter((row) => cleanText(row.user_id) && cleanText(row.roll_no))
      .filter((row) => isTargetStudentForSection(row, opts.section));
  }

  if (!opts.term) {
    return [];
  }

  const { data: students, error: fallbackError } = await supabase
    .from('students')
    .select('user_id, roll_no, section')
    .eq('term', opts.term);

  if (fallbackError) throw fallbackError;

  return (students || [])
    .map((row) => ({
      user_id: row.user_id,
      roll_no: row.roll_no,
      section: row.section,
    }))
    .filter((row) => cleanText(row.user_id) && cleanText(row.roll_no))
    .filter((row) => isTargetStudentForSection(row, opts.section));
}

async function seedDefaultGeoAttendanceAbsences(opts: {
  offeringId: string;
  sessionId: string;
  teacherUserId: string;
  courseCode: string | null;
  term: string | null;
  section?: string | null;
  attendanceDate: string;
}) {
  const targetStudents = await resolveGeoAttendanceTargetStudents({
    offeringId: opts.offeringId,
    term: opts.term,
    section: opts.section,
  });

  if (targetStudents.length === 0) {
    return;
  }

  const studentUserIds = targetStudents.map((student) => student.user_id);

  const { data: existingEnrollments, error: existingEnrollmentError } = await supabase
    .from('enrollments')
    .select('id, student_user_id')
    .eq('offering_id', opts.offeringId)
    .in('student_user_id', studentUserIds);

  if (existingEnrollmentError) throw existingEnrollmentError;

  const enrollmentByStudentId = new Map<string, string>();
  for (const row of existingEnrollments || []) {
    const studentUserId = cleanText(row.student_user_id);
    const enrollmentId = cleanText(row.id);
    if (studentUserId && enrollmentId) {
      enrollmentByStudentId.set(studentUserId, enrollmentId);
    }
  }

  const missingStudentUserIds = studentUserIds.filter(
    (studentUserId) => !enrollmentByStudentId.has(studentUserId),
  );

  if (missingStudentUserIds.length > 0) {
    const { data: insertedEnrollments, error: insertEnrollmentError } = await supabase
      .from('enrollments')
      .insert(
        missingStudentUserIds.map((studentUserId) => ({
          offering_id: opts.offeringId,
          student_user_id: studentUserId,
          enrollment_status: 'ENROLLED',
        })),
      )
      .select('id, student_user_id');

    if (insertEnrollmentError) throw insertEnrollmentError;

    for (const row of insertedEnrollments || []) {
      const studentUserId = cleanText(row.student_user_id);
      const enrollmentId = cleanText(row.id);
      if (studentUserId && enrollmentId) {
        enrollmentByStudentId.set(studentUserId, enrollmentId);
      }
    }
  }

  const attendanceRows = targetStudents
    .map((student) => {
      const enrollmentId = enrollmentByStudentId.get(student.user_id);
      if (!enrollmentId) return null;
      return {
        session_id: opts.sessionId,
        enrollment_id: enrollmentId,
        status: 'ABSENT',
        marked_by_teacher_user_id: opts.teacherUserId,
        remarks: 'No geo-attendance response received.',
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (attendanceRows.length > 0) {
    const { error: attendanceError } = await supabase
      .from('attendance_records')
      .upsert(attendanceRows, { onConflict: 'session_id,enrollment_id' });

    if (attendanceError) throw attendanceError;
  }

  if (opts.courseCode) {
    const flatAttendanceRows = targetStudents.map((student) => ({
      course_code: opts.courseCode,
      student_roll: student.roll_no,
      date: opts.attendanceDate,
      status: 'absent',
      section_or_group: opts.section || null,
    }));

    const { error: flatAttendanceError } = await supabase
      .from('attendance')
      .upsert(flatAttendanceRows, { onConflict: 'course_code,student_roll,date' });

    if (flatAttendanceError) throw flatAttendanceError;
  }
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
    const offering_id = cleanText(body.offering_id);
    const teacher_user_id = cleanText(body.teacher_user_id);
    const room_number = cleanText(body.room_number);
    const section = cleanText(body.section);

    if (!offering_id || !teacher_user_id || !room_number) {
      return badRequest('Missing required fields: offering_id, teacher_user_id, room_number');
    }

    let rangeMeters: number;
    let durationMinutes: number;
    let absenceGraceMinutes: number;

    try {
      rangeMeters = parseGeoAttendanceInteger(
        body.range_meters,
        'range_meters',
        GEO_ATTENDANCE_DEFAULTS.rangeMeters,
        GEO_ATTENDANCE_LIMITS.rangeMeters,
      );
      durationMinutes = parseGeoAttendanceInteger(
        body.duration_minutes,
        'duration_minutes',
        GEO_ATTENDANCE_DEFAULTS.durationMinutes,
        GEO_ATTENDANCE_LIMITS.durationMinutes,
      );
      absenceGraceMinutes = parseGeoAttendanceInteger(
        body.absence_grace_minutes,
        'absence_grace_minutes',
        GEO_ATTENDANCE_DEFAULTS.absenceGraceMinutes,
        {
          min: GEO_ATTENDANCE_LIMITS.absenceGraceMinutes.min,
          max: Math.min(
            GEO_ATTENDANCE_LIMITS.absenceGraceMinutes.max,
            durationMinutes,
          ),
        },
      );
    } catch (error: unknown) {
      if (error instanceof GeoAttendanceInputError) {
        return badRequest(error.message);
      }
      throw error;
    }

    const startAt = (() => {
      const parsed = new Date(body.start_time ?? Date.now());
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    })();

    if (!startAt) {
      return badRequest('start_time must be a valid ISO timestamp.');
    }

    const endAt = new Date(startAt.getTime() + durationMinutes * 60000);
    const start_time = startAt.toISOString();
    const end_time = endAt.toISOString();

    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('room_number, is_active, latitude, longitude')
      .eq('room_number', room_number)
      .maybeSingle();

    if (roomError) {
      return badRequest(`Room lookup failed: ${roomError.message}`);
    }

    if (!roomData || roomData.is_active !== true) {
      return badRequest('Please choose an active room with GPS coordinates.');
    }

    if (roomData.latitude == null || roomData.longitude == null) {
      return badRequest(
        'The selected room is missing GPS coordinates. Update the room location first.',
      );
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
    const resolvedSection = section;
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

    let sessionId: string | null = null;
    let roomId: string | null = null;

    try {
      const attendanceDate = new Date(start_time).toISOString().split('T')[0];

      const { data: sessionData, error: sessionError } = await supabase
        .from('class_sessions')
        .insert({
          offering_id,
          starts_at: start_time,
          ends_at: end_time,
          room_number,
          topic: 'Geo-Attendance Session',
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;

      const createdSessionId = sessionData.id;
      sessionId = createdSessionId;

      const { data, error } = await supabase
        .from('geo_attendance_rooms')
        .insert({
          offering_id,
          session_id: sessionId,
          teacher_user_id,
          room_number,
          section: resolvedSection,
          range_meters: rangeMeters,
          duration_minutes: durationMinutes,
          absence_grace_minutes: absenceGraceMinutes,
          date: attendanceDate,
          start_time,
          end_time,
          is_active: true,
        })
        .select('*')
        .single();

      if (error) throw error;

      roomId = data.id;

      await seedDefaultGeoAttendanceAbsences({
        offeringId: offering_id,
        sessionId: createdSessionId,
        teacherUserId: teacher_user_id,
        courseCode,
        term: offeringTerm,
        section: resolvedSection,
        attendanceDate,
      });

      // Notify target students immediately when a geo-attendance room is opened.
      if (courseCode && offeringTerm) {
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
          roomNumber: room_number,
          durationMinutes,
          endTime: endLabel,
          roomId,
        });
      }

      return NextResponse.json({ success: true, data });
    } catch (error) {
      if (roomId) {
        await supabase
          .from('geo_attendance_rooms')
          .delete()
          .eq('id', roomId);
      }

      if (sessionId) {
        await supabase
          .from('class_sessions')
          .delete()
          .eq('id', sessionId);
      }

      throw error;
    }
  } catch (error: unknown) {
    if (error instanceof GeoAttendanceInputError) {
      return badRequest(error.message);
    }
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
      const { data: roomMeta, error: roomMetaError } = await supabase
        .from('geo_attendance_rooms')
        .select('session_id, offering_id')
        .eq('id', roomId)
        .maybeSingle();

      if (roomMetaError) throw roomMetaError;

      const { data: logs, error: logsError } = await supabase
        .from('geo_attendance_logs')
        .select(`
          *,
          students!geo_attendance_logs_student_fkey ( roll_no, full_name )
        `)
        .eq('geo_room_id', roomId)
        .order('submitted_at', { ascending: true });

      if (logsError) throw logsError;

      const enrichedLogs = (logs || []) as Array<Record<string, unknown>>;
      if (!roomMeta?.offering_id || !roomMeta.session_id || enrichedLogs.length === 0) {
        return NextResponse.json(enrichedLogs);
      }

      const studentIds = [...new Set(
        enrichedLogs
          .map((log) => cleanText(log.student_user_id))
          .filter(Boolean),
      )] as string[];

      if (studentIds.length === 0) {
        return NextResponse.json(enrichedLogs);
      }

      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('id, student_user_id')
        .eq('offering_id', roomMeta.offering_id)
        .in('student_user_id', studentIds);

      if (enrollmentError) throw enrollmentError;

      const enrollmentByStudentId = new Map<string, string>();
      for (const row of enrollments || []) {
        const studentId = cleanText(row.student_user_id);
        const enrollmentId = cleanText(row.id);
        if (studentId && enrollmentId) {
          enrollmentByStudentId.set(studentId, enrollmentId);
        }
      }

      const enrollmentIds = [...new Set(enrollmentByStudentId.values())];
      if (enrollmentIds.length === 0) {
        return NextResponse.json(enrichedLogs);
      }

      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('id, enrollment_id, status')
        .eq('session_id', roomMeta.session_id)
        .in('enrollment_id', enrollmentIds);

      if (attendanceError) throw attendanceError;

      const attendanceByEnrollmentId = new Map<
        string,
        { id: string; status: string }
      >();

      for (const row of attendanceRecords || []) {
        const enrollmentId = cleanText(row.enrollment_id);
        const recordId = cleanText(row.id);
        const status = cleanText(row.status);
        if (enrollmentId && recordId && status) {
          attendanceByEnrollmentId.set(enrollmentId, {
            id: recordId,
            status,
          });
        }
      }

      for (const log of enrichedLogs) {
        const studentId = cleanText(log.student_user_id);
        const enrollmentId = studentId
          ? enrollmentByStudentId.get(studentId)
          : null;
        const attendance = enrollmentId
          ? attendanceByEnrollmentId.get(enrollmentId)
          : null;

        if (attendance) {
          log.attendance_status = attendance.status;
          log.attendance_record_id = attendance.id;
        }
      }

      return NextResponse.json(enrichedLogs);
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
        course_offerings (
          id, term,
          courses ( code, title, course_type )
        )
      `)
      .order('created_at', { ascending: false });

    if (teacherId) query = query.eq('teacher_user_id', teacherId);
    if (offeringId) query = query.eq('offering_id', offeringId);
    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;

    // For each room, get the count of attendance submissions
    const rooms = (data || []) as unknown as Record<string, unknown>[];
    if (rooms.length > 0) {
      const roomIds = rooms.map((r) => r.id as string);
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
        room.submission_count = countMap.get(room.id as string) || 0;
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
