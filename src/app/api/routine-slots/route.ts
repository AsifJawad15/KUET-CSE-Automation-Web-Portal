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
import { createNotification } from '@/lib/notifications';

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
    const forDate = searchParams.get('date'); // optional: filter slots valid on this date

    let query = supabase
      .from('routine_slots')
      .select(ROUTINE_SLOT_WITH_DETAILS)
      .order('day_of_week')
      .order('start_time');

    if (section) query = query.eq('section', section);

    const { data, error } = await query;
    if (error) throw error;

    let filtered = data || [];

    if (forDate) {
      const checkDate = new Date(forDate + 'T00:00:00Z');
      const dow = checkDate.getUTCDay();

      // Keep slots that are valid on this date:
      // - Permanent slots (no valid_from): match by day_of_week
      // - Date-scoped slots (valid_from set): match by date range (ignore day_of_week)
      filtered = filtered.filter((slot: Record<string, unknown>) => {
        const vFrom = slot.valid_from ? new Date(slot.valid_from + 'T00:00:00Z') : null;
        const vUntil = slot.valid_until ? new Date(slot.valid_until + 'T00:00:00Z') : null;

        if (!vFrom && !vUntil) {
          return slot.day_of_week === dow;
        }
        return (!vFrom || checkDate >= vFrom) && (!vUntil || checkDate <= vUntil);
      });

      // Normalize day_of_week for date-scoped slots to match the actual date
      filtered = filtered.map((slot: Record<string, unknown>) =>
        slot.valid_from ? { ...slot, day_of_week: dow } : slot
      );

      // ── Merge approved CR room requests for this date ──
      // This ensures CR bookings appear on Schedule/TV even if routine_slot sync failed
      try {
        const { data: crRequests } = await supabase
          .from('cr_room_requests')
          .select(`
            id, course_code, room_number, day_of_week,
            start_time, end_time, term, session, section, request_date,
            teachers!cr_room_requests_teacher_user_id_fkey(full_name, teacher_uid)
          `)
          .eq('request_date', forDate)
          .eq('status', 'approved')
          .not('room_number', 'is', null);

        if (crRequests && crRequests.length > 0) {
          const codes = [...new Set(crRequests.map((r: Record<string, unknown>) => r.course_code as string))];
          const { data: courseRows } = await supabase
            .from('courses')
            .select('code, title, credit, course_type')
            .in('code', codes);
          const courseMap = new Map((courseRows || []).map((c: Record<string, unknown>) => [c.code, c]));

          for (const cr of crRequests) {
            // Skip if already represented by a synced routine_slot
            const alreadySynced = filtered.some((s: Record<string, unknown>) =>
              s.room_number === cr.room_number &&
              s.start_time === cr.start_time &&
              s.end_time === cr.end_time &&
              s.valid_from != null
            );
            if (alreadySynced) continue;

            const course = courseMap.get(cr.course_code as string) as Record<string, unknown> | undefined;
            const teachers = cr.teachers as unknown as { full_name: string; teacher_uid: string };
            filtered.push({
              id: `cr-${cr.id}`,
              offering_id: '',
              room_number: cr.room_number,
              day_of_week: dow,
              start_time: cr.start_time,
              end_time: cr.end_time,
              section: cr.section || null,
              valid_from: cr.request_date,
              valid_until: cr.request_date,
              created_at: cr.request_date,
              rrule: null,
              course_offerings: {
                id: '',
                term: cr.term,
                session: cr.session,
                batch: null,
                courses: course
                  ? { code: course.code, title: course.title, credit: course.credit, course_type: course.course_type }
                  : { code: cr.course_code, title: cr.course_code, credit: 0, course_type: 'Theory' },
                teachers,
              },
              rooms: { room_type: null, room_number: cr.room_number },
            });
          }
        }
      } catch (mergeErr) {
        console.error('Merge CR bookings into schedule failed:', mergeErr);
      }

      // ── Merge approved teacher room booking requests for this date ──
      try {
        const { data: teacherBookings } = await supabase
          .from('room_booking_requests')
          .select(`
            id, offering_id, room_number, day_of_week,
            start_time, end_time, section, booking_date,
            course_offerings!rbr_offering_fkey(
              id, term, session, batch,
              courses(code, title, credit, course_type),
              teachers!course_offerings_teacher_user_id_fkey(full_name, teacher_uid)
            ),
            rooms!rbr_room_fkey(room_type, room_number)
          `)
          .eq('booking_date', forDate)
          .eq('status', 'approved');

        if (teacherBookings && teacherBookings.length > 0) {
          for (const tb of teacherBookings) {
            const alreadySynced = filtered.some((s: Record<string, unknown>) =>
              s.room_number === tb.room_number &&
              s.start_time === tb.start_time &&
              s.end_time === tb.end_time &&
              s.valid_from != null
            );
            if (alreadySynced) continue;

            if (tb.course_offerings) {
              filtered.push({
                id: `tb-${tb.id}`,
                offering_id: tb.offering_id,
                room_number: tb.room_number,
                day_of_week: dow,
                start_time: tb.start_time,
                end_time: tb.end_time,
                section: tb.section || null,
                valid_from: tb.booking_date,
                valid_until: tb.booking_date,
                created_at: tb.booking_date,
                rrule: null,
                course_offerings: tb.course_offerings,
                rooms: tb.rooms || { room_type: null, room_number: tb.room_number },
              });
            }
          }
        }
      } catch (mergeErr) {
        console.error('Merge teacher bookings into schedule failed:', mergeErr);
      }
    } else {
      // No date given: return only permanent slots (exclude date-scoped bookings)
      filtered = filtered.filter((slot: Record<string, unknown>) => !slot.valid_from);
    }

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
    const { offering_id, room_number, day_of_week, start_time, end_time, section, valid_from, valid_until } = body;

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
      .insert({
        offering_id, room_number, day_of_week, start_time, end_time, section,
        valid_from: valid_from || null,
        valid_until: valid_until || null,
      })
      .select(ROUTINE_SLOT_WITH_DETAILS)
      .single();

    if (error) throw error;

    // Notify students about the new/makeup class slot
    const newOffering = (data as Record<string, unknown>).course_offerings as Record<string, unknown>;
    const newCode = (newOffering?.courses as Record<string, unknown>)?.code as string ?? '';
    const newTerm = newOffering?.term as string ?? '';
    const newSection = (data as Record<string, unknown>).section as string | null;
    const newDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const newDayName = newDayNames[day_of_week as number] ?? `Day ${day_of_week}`;
    const isDateScoped = !!valid_from;
    if (newCode && newTerm) {
      await createNotification({
        type: isDateScoped ? 'makeup_class' : 'class_rescheduled',
        title: isDateScoped ? `Makeup Class — ${newCode}` : `Class Scheduled — ${newCode}`,
        body: isDateScoped
          ? `Makeup class for ${newCode} on ${valid_from} (${start_time}–${end_time}, Room ${room_number}).`
          : `${newCode}: new class on ${newDayName} ${start_time}–${end_time} in Room ${room_number}.`,
        target_type: newSection ? 'SECTION' : 'YEAR_TERM',
        target_value: newSection ?? newTerm,
        target_year_term: newSection ? newTerm : undefined,
        created_by: null,
        created_by_role: 'ADMIN',
        metadata: { course_code: newCode, room_number: room_number, day: newDayName },
      });
    }
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

    // Notify students when schedule-relevant fields changed
    if (updates.room_number || updates.start_time || updates.end_time || updates.day_of_week !== undefined) {
      const pSlot = data as Record<string, unknown>;
      const pOffering = (pSlot?.course_offerings ?? {}) as Record<string, unknown>;
      const pCode = (pOffering?.courses as Record<string, unknown>)?.code as string ?? '';
      const pTerm = pOffering?.term as string ?? '';
      const pSection = pSlot?.section as string | null;
      const pDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const pDayName = pDayNames[pSlot?.day_of_week as number] ?? `Day ${pSlot?.day_of_week}`;
      const pStart = pSlot?.start_time as string;
      const pEnd = pSlot?.end_time as string;
      const pRoom = pSlot?.room_number as string;
      if (pCode && pTerm) {
        await createNotification({
          type: 'class_rescheduled',
          title: `Schedule Updated — ${pCode}`,
          body: `${pCode} class has been updated: ${pDayName} ${pStart}–${pEnd}, Room ${pRoom}.`,
          target_type: pSection ? 'SECTION' : 'YEAR_TERM',
          target_value: pSection ?? pTerm,
          target_year_term: pSection ? pTerm : undefined,
          created_by: null,
          created_by_role: 'ADMIN',
          metadata: { course_code: pCode, room_number: pRoom, day: pDayName },
        });
      }
    }
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

    // Fetch slot details before deletion so we can notify students
    const { data: slotToDelete } = await supabase
      .from('routine_slots')
      .select(ROUTINE_SLOT_WITH_DETAILS)
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase.from('routine_slots').delete().eq('id', id);
    if (error) throw error;

    // Notify students about the cancelled class
    if (slotToDelete) {
      const dSlot = slotToDelete as Record<string, unknown>;
      const dOffering = (dSlot?.course_offerings ?? {}) as Record<string, unknown>;
      const dCode = (dOffering?.courses as Record<string, unknown>)?.code as string ?? '';
      const dTerm = dOffering?.term as string ?? '';
      const dSection = dSlot?.section as string | null;
      const dDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dDayName = dDayNames[dSlot?.day_of_week as number] ?? `Day ${dSlot?.day_of_week}`;
      const dStart = dSlot?.start_time as string;
      const dEnd = dSlot?.end_time as string;
      if (dCode && dTerm) {
        await createNotification({
          type: 'class_cancelled',
          title: `Class Cancelled — ${dCode}`,
          body: `The ${dDayName} ${dStart}–${dEnd} class for ${dCode} has been removed from the schedule.`,
          target_type: dSection ? 'SECTION' : 'YEAR_TERM',
          target_value: dSection ?? dTerm,
          target_year_term: dSection ? dTerm : undefined,
          created_by: null,
          created_by_role: 'ADMIN',
          metadata: { course_code: dCode, day: dDayName, start_time: dStart, end_time: dEnd },
        });
      }
    }
    return noContent();
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to delete routine slot'));
  }
}
