// ==========================================
// API: /api/cr-room-requests
// Handles CR room request CRUD and admin approval
// ==========================================

import { badRequest, guardSupabase, internalError, ok } from '@/lib/apiResponse';
import { requireServerSession } from '@/lib/serverAuth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { requireFields } from '@/lib/validators';
import { notificationBroker } from '@/lib/notificationBroker';
import { NextRequest, NextResponse } from 'next/server';
import { withAdminRateLimit } from '@/lib/withRateLimit';

// ── GET /api/cr-room-requests ──────────────────────────

export async function GET(request: NextRequest) {
  // ── Auth guard ──
  const auth = requireServerSession(request);
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('cr_room_requests')
      .select(`
        *,
        students!cr_room_requests_student_user_id_fkey(full_name, roll_no, term, session),
        teachers!cr_room_requests_teacher_user_id_fkey(full_name, teacher_uid)
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Students can only see their own requests
    if (auth.user.role === 'student') {
      query = query.eq('student_user_id', auth.user.id);
    } else {
      const student_user_id = searchParams.get('student_user_id');
      if (student_user_id) {
        query = query.eq('student_user_id', student_user_id);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch room requests';
    return internalError(message);
  }
}

// ── POST /api/cr-room-requests — Create request with FCFS auto-assignment ────

export async function POST(request: NextRequest) {
  // ── Auth guard ──
  const auth = requireServerSession(request);
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { course_code, teacher_user_id, day_of_week, start_time, end_time, term, session, section, reason, request_date } = body;

    // Force student_user_id from verified session
    const student_user_id = auth.user.id;

    const validation = requireFields({ student_user_id, course_code, teacher_user_id, day_of_week, start_time, end_time, term, session, request_date });
    if (!validation.valid) return badRequest(validation.error!);

    // Verify the student is a CR
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('is_cr')
      .eq('user_id', student_user_id)
      .single();

    if (studentError || !student) return badRequest('Student not found');
    if (!student.is_cr) return badRequest('Only Class Representatives can make room requests');

    // FCFS: Find rooms already booked for this specific date + time
    const { data: bookedRequests } = await supabase
      .from('cr_room_requests')
      .select('room_number')
      .eq('request_date', request_date)
      .lt('start_time', end_time)
      .gt('end_time', start_time)
      .eq('status', 'approved')
      .not('room_number', 'is', null);

    const bookedRoomNumbers = new Set((bookedRequests || []).map(r => r.room_number));

    // Also check room_booking_requests for teacher bookings on this date
    const { data: teacherBookings } = await supabase
      .from('room_booking_requests')
      .select('room_number')
      .eq('booking_date', request_date)
      .lt('start_time', end_time)
      .gt('end_time', start_time)
      .eq('status', 'approved')
      .not('room_number', 'is', null);

    (teacherBookings || []).forEach(b => bookedRoomNumbers.add(b.room_number));

    // Also check routine_slots for conflicts on this day_of_week
    // (permanent schedule that's valid on the requested date)
    const { data: bookedSlots } = await supabase
      .from('routine_slots')
      .select('room_number, valid_from, valid_until')
      .eq('day_of_week', day_of_week)
      .lt('start_time', end_time)
      .gt('end_time', start_time)
      .not('room_number', 'is', null);

    // Only count routine slots that are valid on the requested date
    (bookedSlots || []).forEach(s => {
      const vFrom = s.valid_from ? new Date(s.valid_from) : null;
      const vUntil = s.valid_until ? new Date(s.valid_until) : null;
      const reqDate = new Date(request_date);
      const isValid = (!vFrom || reqDate >= vFrom) && (!vUntil || reqDate <= vUntil);
      if (isValid) bookedRoomNumbers.add(s.room_number);
    });

    // Get all active rooms and find the first available one
    const { data: allRooms } = await supabase
      .from('rooms')
      .select('room_number, room_type, capacity')
      .eq('is_active', true)
      .order('room_number', { ascending: true });

    const availableRoom = (allRooms || []).find(r => !bookedRoomNumbers.has(r.room_number));

    if (!availableRoom) {
      return badRequest('No rooms available for the requested time slot');
    }

    const insertData: Record<string, unknown> = {
      student_user_id,
      course_code,
      teacher_user_id,
      room_number: availableRoom.room_number,
      day_of_week,
      start_time,
      end_time,
      term,
      session,
      section: section || null,
      reason: reason || null,
      request_date,
      status: 'pending',
      reviewed_at: null,
    };

    const { data, error } = await supabase
      .from('cr_room_requests')
      .insert(insertData)
      .select(`
        *,
        students!cr_room_requests_student_user_id_fkey(full_name, roll_no, term, session),
        teachers!cr_room_requests_teacher_user_id_fkey(full_name, teacher_uid)
      `)
      .single();

    if (error) throw error;

    if (teacher_user_id) {
      const studentRecord = (data as Record<string, unknown>).students as Record<string, unknown> | null;
      await notificationBroker.publish('cr_room_request.submitted', {
        teacherUserId: teacher_user_id,
        courseCode: course_code,
        roomNumber: availableRoom.room_number,
        requestDate: request_date,
        startTime: start_time,
        endTime: end_time,
        term,
        section: section || null,
        studentName: studentRecord?.full_name as string | null,
        studentRoll: studentRecord?.roll_no as string | null,
        createdBy: student_user_id,
        requestId: (data as Record<string, unknown>).id as string,
      });
    }

    return ok(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create room request';
    return internalError(message);
  }
}

// ── PATCH /api/cr-room-requests — Admin Review ──────────

export const PATCH = withAdminRateLimit(async function PATCH(request: NextRequest) {
  // ── Auth guard: admin/head only ──
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { id, status, remarks, room_number } = body;

    const validation = requireFields({ id, status });
    if (!validation.valid) return badRequest(validation.error!);

    if (status !== 'approved' && status !== 'rejected') {
      return badRequest('status must be either approved or rejected');
    }

    // 1. Fetch the existing CR request
    const { data: existingRequest, error: lookupError } = await supabase
      .from('cr_room_requests')
      .select(`
        *,
        students!cr_room_requests_student_user_id_fkey(full_name, roll_no, term, session)
      `)
      .eq('id', id)
      .single();

    if (lookupError || !existingRequest) {
      return badRequest('Room request not found');
    }

    // 2. Perform DB update
    const updatePayload: Record<string, unknown> = {
      status,
      admin_remarks: remarks || null,
      admin_user_id: auth.user.id,
      reviewed_at: new Date().toISOString(),
    };
    if (room_number) {
      updatePayload.room_number = room_number;
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('cr_room_requests')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    const resolvedRoom = (room_number as string | undefined) || (existingRequest.room_number as string);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const period = `${existingRequest.start_time as string}–${existingRequest.end_time as string}`;

    if (status === 'approved') {
      // 3. Sync to routine_slots
      try {
        const { data: courseRows } = await supabase
          .from('courses')
          .select('id')
          .eq('code', existingRequest.course_code)
          .limit(1);

        const course = courseRows?.[0] ?? null;

        if (course) {
          let offeringId: string | null = null;

          const { data: matchedOfferings } = await supabase
            .from('course_offerings')
            .select('id')
            .eq('course_id', course.id)
            .eq('teacher_user_id', existingRequest.teacher_user_id)
            .eq('term', existingRequest.term)
            .eq('session', existingRequest.session)
            .eq('is_active', true)
            .limit(1);

          if (matchedOfferings && matchedOfferings.length > 0) {
            offeringId = matchedOfferings[0].id;
          } else {
            const { data: newOffering, error: offeringErr } = await supabase
              .from('course_offerings')
              .insert({
                course_id: course.id,
                teacher_user_id: existingRequest.teacher_user_id,
                term: existingRequest.term,
                session: existingRequest.session,
                section: existingRequest.section || null,
                is_active: true,
              })
              .select('id')
              .single();

            if (offeringErr) {
              console.error('CR sync PATCH: failed to create offering:', offeringErr.message);
            }
            if (newOffering) offeringId = newOffering.id;
          }

          if (offeringId) {
            const { data: existingSlots } = await supabase
              .from('routine_slots')
              .select('id')
              .eq('offering_id', offeringId)
              .eq('day_of_week', existingRequest.day_of_week)
              .eq('start_time', existingRequest.start_time)
              .eq('end_time', existingRequest.end_time)
              .eq('valid_from', existingRequest.request_date)
              .eq('valid_until', existingRequest.request_date)
              .limit(1);

            if (existingSlots && existingSlots.length > 0) {
              await supabase
                .from('routine_slots')
                .update({ room_number: resolvedRoom, section: existingRequest.section || null })
                .eq('id', existingSlots[0].id);
            } else {
              await supabase
                .from('routine_slots')
                .insert({
                  offering_id: offeringId,
                  room_number: resolvedRoom,
                  day_of_week: existingRequest.day_of_week,
                  start_time: existingRequest.start_time,
                  end_time: existingRequest.end_time,
                  section: existingRequest.section || null,
                  valid_from: existingRequest.request_date,
                  valid_until: existingRequest.request_date,
                });
            }
          }
        }
      } catch (syncErr) {
        console.error('CR sync PATCH: routine_slots sync failed:', syncErr);
      }

      // 4. Publish allocated/approved notification to all students
      await notificationBroker.publish('cr_room_request.allocated', {
        createdBy: existingRequest.student_user_id,
        courseCode: existingRequest.course_code,
        roomNumber: resolvedRoom,
        dayName: dayNames[existingRequest.day_of_week] ?? `Day ${existingRequest.day_of_week}`,
        startTime: existingRequest.start_time,
        endTime: existingRequest.end_time,
        term: existingRequest.term,
        section: existingRequest.section || null,
      });
    } else {
      // status === 'rejected'
      // 5. Notify the requesting CR
      await notificationBroker.publish('cr_room_request.rejected', {
        studentUserId: existingRequest.student_user_id,
        courseCode: existingRequest.course_code,
        roomNumber: resolvedRoom,
        period,
        dayName: dayNames[existingRequest.day_of_week] ?? `Day ${existingRequest.day_of_week}`,
        reason: remarks ?? 'No remarks provided.',
        requestId: id,
      });
    }

    return ok(updatedRequest);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update room request';
    return internalError(message);
  }
});




// ── DELETE /api/cr-room-requests ───────────────────────

export async function DELETE(request: NextRequest) {
  // ── Auth guard ──
  const auth = requireServerSession(request);
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return badRequest('Request ID is required');

    // Fetch the request details before deleting (to clean up routine_slot sync)
    const { data: reqData } = await supabase
      .from('cr_room_requests')
      .select('course_code, day_of_week, start_time, end_time, request_date, room_number, status')
      .eq('id', id)
      .limit(1);

    const { error } = await supabase
      .from('cr_room_requests')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Clean up the date-scoped routine_slot that was synced when this CR request was approved
    const req = reqData?.[0];
    if (req && req.status === 'approved' && req.request_date && req.room_number) {
      try {
        await supabase
          .from('routine_slots')
          .delete()
          .eq('room_number', req.room_number)
          .eq('day_of_week', req.day_of_week)
          .eq('start_time', req.start_time)
          .eq('end_time', req.end_time)
          .eq('valid_from', req.request_date)
          .eq('valid_until', req.request_date);
      } catch (cleanupErr) {
        console.error('CR delete: failed to clean up routine_slot:', cleanupErr);
      }
    }
    return ok({ deleted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete room request';
    return internalError(message);
  }
}
