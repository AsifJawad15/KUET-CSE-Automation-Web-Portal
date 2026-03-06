// ==========================================
// API: /api/teacher-portal/attendance
// Handles attendance upload (CSV bulk) and manual save
// Writes to BOTH flat `attendance` table AND normalized
// `class_sessions` + `enrollments` + `attendance_records`
// so all attendance methods share the same count.
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { requireField, runValidations } from '@/lib/validators';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// Map flat status strings to the attendance_status enum used in attendance_records
function toNormalizedStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'present': return 'PRESENT';
    case 'absent': return 'ABSENT';
    case 'late': return 'LATE';
    default: return 'ABSENT';
  }
}

// ── POST /api/teacher-portal/attendance ────────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const records = body.items || body.records;
    // Optional: offering_id and teacher_id for normalized write
    const offeringId: string | undefined = body.offering_id;
    const teacherId: string | undefined = body.teacher_id;

    if (!Array.isArray(records) || records.length === 0) {
      return badRequest('No attendance records provided');
    }

    let inserted = 0;
    const errors: string[] = [];

    // 1. Write to flat `attendance` table (backward-compatible)
    for (const record of records) {
      const validation = runValidations(
        requireField(record.course_code, 'Course Code'),
        requireField(record.student_roll, 'Student Roll'),
        requireField(record.date, 'Date'),
        requireField(record.status, 'Status'),
      );
      if (validation) {
        errors.push(validation);
        continue;
      }

      const { error } = await supabase
        .from('attendance')
        .upsert({
          course_code: record.course_code,
          student_roll: record.student_roll,
          date: record.date,
          status: record.status,
          section_or_group: record.section_or_group || null,
        }, { onConflict: 'course_code,student_roll,date' });

      if (error) {
        errors.push(`Roll ${record.student_roll}: ${error.message}`);
      } else {
        inserted++;
      }
    }

    // 2. Also write to normalized tables (class_sessions + attendance_records)
    //    Group records by course_code + date to create one session per group
    await syncToNormalizedTables(records, offeringId, teacherId);

    return NextResponse.json({ inserted, skipped: 0, errors });
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to save attendance'));
  }
}

/**
 * Syncs attendance records to the normalized schema:
 * class_sessions → enrollments → attendance_records
 *
 * Groups records by (course_code, date) — each group becomes one class_session.
 * Looks up offering_id from course_code if not provided.
 * Looks up student user_ids from roll_no.
 */
async function syncToNormalizedTables(
  records: Array<{ course_code: string; student_roll: string; date: string; status: string }>,
  explicitOfferingId?: string,
  teacherId?: string,
) {
  try {
    // Group by course_code + date
    const groups = new Map<string, typeof records>();
    for (const r of records) {
      if (!r.course_code || !r.student_roll || !r.date || !r.status) continue;
      const key = `${r.course_code}::${r.date}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    for (const [key, groupRecords] of groups) {
      const [courseCode, dateStr] = key.split('::');

      // Resolve offering_id
      let resolvedOfferingId = explicitOfferingId;
      if (!resolvedOfferingId) {
        const { data: course } = await supabase
          .from('courses')
          .select('id')
          .eq('code', courseCode)
          .single();
        if (!course) continue;

        const { data: offering } = await supabase
          .from('course_offerings')
          .select('id')
          .eq('course_id', course.id)
          .eq('is_active', true)
          .limit(1)
          .single();
        if (!offering) continue;
        resolvedOfferingId = offering.id;
      }

      // Create class_session (or find existing for same offering+date)
      const sessionDate = new Date(dateStr);
      const sessionStart = sessionDate.toISOString();
      const sessionEnd = new Date(sessionDate.getTime() + 60 * 60 * 1000).toISOString();

      // Check if a session already exists for this offering + date
      const dayStart = `${dateStr}T00:00:00.000Z`;
      const dayEnd = `${dateStr}T23:59:59.999Z`;
      const { data: existingSession } = await supabase
        .from('class_sessions')
        .select('id')
        .eq('offering_id', resolvedOfferingId)
        .gte('starts_at', dayStart)
        .lte('starts_at', dayEnd)
        .limit(1)
        .maybeSingle();

      let sessionId: string;
      if (existingSession) {
        sessionId = existingSession.id;
      } else {
        const { data: newSession, error: sessionError } = await supabase
          .from('class_sessions')
          .insert({
            offering_id: resolvedOfferingId,
            starts_at: sessionStart,
            ends_at: sessionEnd,
            topic: 'Web Attendance',
          })
          .select('id')
          .single();
        if (sessionError || !newSession) continue;
        sessionId = newSession.id;
      }

      // Look up student user_ids from roll numbers
      const rolls = groupRecords.map(r => r.student_roll);
      const { data: students } = await supabase
        .from('students')
        .select('user_id, roll_no')
        .in('roll_no', rolls);
      if (!students || students.length === 0) continue;

      const rollToUserId = new Map<string, string>();
      for (const s of students) {
        rollToUserId.set(s.roll_no, s.user_id);
      }

      // Ensure enrollments exist
      const studentUserIds = [...rollToUserId.values()];
      const { data: existingEnrollments } = await supabase
        .from('enrollments')
        .select('id, student_user_id')
        .eq('offering_id', resolvedOfferingId)
        .in('student_user_id', studentUserIds);

      const enrollmentMap = new Map<string, string>();
      for (const e of (existingEnrollments || [])) {
        enrollmentMap.set(e.student_user_id, e.id);
      }

      // Create missing enrollments
      const missingUserIds = studentUserIds.filter(id => !enrollmentMap.has(id));
      if (missingUserIds.length > 0) {
        const { data: newEnrollments } = await supabase
          .from('enrollments')
          .insert(missingUserIds.map(uid => ({
            offering_id: resolvedOfferingId,
            student_user_id: uid,
            enrollment_status: 'ENROLLED',
          })))
          .select('id, student_user_id');

        for (const e of (newEnrollments || [])) {
          enrollmentMap.set(e.student_user_id, e.id);
        }
      }

      // Upsert attendance_records
      const attendanceRows = groupRecords
        .filter(r => rollToUserId.has(r.student_roll))
        .map(r => {
          const userId = rollToUserId.get(r.student_roll)!;
          const enrollmentId = enrollmentMap.get(userId);
          if (!enrollmentId) return null;
          return {
            session_id: sessionId,
            enrollment_id: enrollmentId,
            status: toNormalizedStatus(r.status),
            marked_by_teacher_user_id: teacherId || null,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (attendanceRows.length > 0) {
        await supabase
          .from('attendance_records')
          .upsert(attendanceRows, { onConflict: 'session_id,enrollment_id' });
      }
    }
  } catch {
    // Non-fatal: normalized sync failure should not break the main attendance save
    console.error('Failed to sync to normalized tables');
  }
}

// ── GET /api/teacher-portal/attendance ─────────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const courseCode = searchParams.get('course_code');

    if (!courseCode) return badRequest('Course code is required');

    let query = supabase
      .from('attendance')
      .select('*')
      .eq('course_code', courseCode)
      .order('date', { ascending: false });

    const date = searchParams.get('date');
    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query;
    if (error) throw error;

    const flatRecords = data || [];

    // Also fetch geo-attendance records for this course to merge into the view
    // Look up offering_id for this course_code
    const { data: offerings } = await supabase
      .from('course_offerings')
      .select('id')
      .eq('course_id', courseCode);

    // Try with courses.code join if direct lookup fails
    let offeringIds: string[] = (offerings || []).map((o: { id: string }) => o.id);

    if (offeringIds.length === 0) {
      const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('code', courseCode);

      if (courses && courses.length > 0) {
        const courseIds = courses.map((c: { id: string }) => c.id);
        const { data: offeringsVia } = await supabase
          .from('course_offerings')
          .select('id')
          .in('course_id', courseIds);
        offeringIds = (offeringsVia || []).map((o: { id: string }) => o.id);
      }
    }

    if (offeringIds.length > 0) {
      // Get geo-attendance rooms for these offerings
      let geoRoomsQuery = supabase
        .from('geo_attendance_rooms')
        .select('id, date')
        .in('offering_id', offeringIds);

      if (date) {
        geoRoomsQuery = geoRoomsQuery.eq('date', date);
      }

      const { data: geoRooms } = await geoRoomsQuery;

      if (geoRooms && geoRooms.length > 0) {
        const geoRoomIds = geoRooms.map((r: { id: string }) => r.id);
        const roomDateMap = new Map(geoRooms.map((r: { id: string; date: string }) => [r.id, r.date]));

        // Get geo-attendance logs with student info
        const { data: geoLogs } = await supabase
          .from('geo_attendance_logs')
          .select('geo_room_id, student_user_id, status, students!geo_attendance_logs_student_fkey(roll_no)')
          .in('geo_room_id', geoRoomIds);

        if (geoLogs && geoLogs.length > 0) {
          // Build a set of existing (roll, date) keys from flat records
          const existingKeys = new Set(
            flatRecords.map((r: { student_roll: string; date: string }) => `${r.student_roll}::${r.date}`)
          );

          // Add geo-attendance as flat attendance records (only if not already present)
          for (const log of geoLogs) {
            const students = log.students as unknown as { roll_no: string } | { roll_no: string }[] | null;
            const rollNo = Array.isArray(students) ? students[0]?.roll_no : students?.roll_no;
            const logDate = roomDateMap.get(log.geo_room_id);
            if (!rollNo || !logDate) continue;

            const key = `${rollNo}::${logDate}`;
            if (!existingKeys.has(key)) {
              flatRecords.push({
                course_code: courseCode,
                student_roll: rollNo,
                date: logDate,
                status: (log.status || 'PRESENT').toLowerCase(),
                section_or_group: null,
              });
              existingKeys.add(key);
            }
          }
        }
      }
    }

    return NextResponse.json(flatRecords);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to fetch attendance'));
  }
}
