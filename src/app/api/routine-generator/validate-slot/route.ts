import { NextRequest, NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { badRequest, ok, notFound, internalError } from '@/lib/apiResponse';
import { buildSolverInput } from '@/lib/routine-generator/buildSolverInput';
import { validateSlot } from '@/lib/routine-generator/conflictValidator';

export async function POST(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const { draftId, candidateSlot } = body;

    if (!draftId || !candidateSlot) {
      return badRequest('draftId and candidateSlot are required.');
    }

    const { activityId, dayOfWeek, startPeriod, endPeriod, roomNumber } = candidateSlot;

    if (activityId === undefined || dayOfWeek === undefined || startPeriod === undefined || endPeriod === undefined || !roomNumber) {
      return badRequest('activityId, dayOfWeek, startPeriod, endPeriod, and roomNumber are required fields in candidateSlot.');
    }

    const supabase = getSupabaseAdmin();

    // 1. Load Draft details and its parent Job to get batch info
    const { data: draft, error: draftErr } = await supabase
      .from('routine_drafts')
      .select('*, routine_generation_jobs(*)')
      .eq('id', draftId)
      .maybeSingle();

    if (draftErr) throw draftErr;
    if (!draft) return notFound('Draft not found');

    const job = draft.routine_generation_jobs;
    if (!job) return notFound('Parent routine generation job not found');

    // 2. Fetch all other draft slots for this draft
    const { data: draftSlots, error: slotsErr } = await supabase
      .from('routine_draft_slots')
      .select('*')
      .eq('draft_id', draftId);

    if (slotsErr) throw slotsErr;

    // 3. Build Solver Input (context of locked slots, teacher availability, etc.)
    const solverInput = await buildSolverInput(
      supabase,
      job.session,
      job.year,
      job.term,
      job.section,
      {
        includeExistingSelectedSlots: false,
        respectTeacherAvailability: true,
        respectRoomCapacity: true,
        allowSaturday: true,
      }
    );

    // 4. Map draft slots to ScheduleAssignments (excluding the one being rescheduled)
    // Wait! Since there can be multiple rows for combined classes (one per teacher offering)
    // in `routine_draft_slots`, they share the same activity (matching course_id + day_of_week + start_period + group_name).
    // Let's identify slots by activityId.
    // In our system, the draft slots are saved. How do we map draft slots back to solver's activityId?
    // In `generate/route.ts` we saved draft slots using:
    // activityId = `${offeringId}-lab-${group}-${index}` or `${offeringId}-theory-${index}`
    // Let's map slot course_id and type to solver activityId!
    // Since solverInput.activities lists all activities, we can match draft slots to activities.
    // To match:
    // For a draft slot: find the activity in solverInput.activities that has:
    // - same courseId
    // - same groupName (if it's a lab group, e.g. A1)
    // - same activity index (if there are multiple weekly slots).
    // Let's group draft slots by course_id, group_name, day_of_week, start_period, room_number
    // to map them to single Assignments (with multiple teachers)!
    const assignmentsMap = new Map<string, { activityId: string; dayOfWeek: number; startPeriod: number; endPeriod: number; roomNumber: string }>();

    // For each unique combination of course, group, day, period, room, find the corresponding activity ID
    // We want to reconstruct the current state of assignments in the draft.
    const groupedDraftSlots = new Map<string, any[]>();
    for (const slot of draftSlots || []) {
      const key = `${slot.course_id}|${slot.group_name || 'whole'}|${slot.day_of_week}|${slot.start_period}|${slot.room_number}`;
      const list = groupedDraftSlots.get(key) || [];
      list.push(slot);
      groupedDraftSlots.set(key, list);
    }

    // Now, associate each group with a solver activity
    // To do this, we need to match them:
    // Let's iterate through all solver activities and find a matching group in groupedDraftSlots.
    const remainingGroups = Array.from(groupedDraftSlots.entries());
    const assignments: { activityId: string; dayOfWeek: number; startPeriod: number; endPeriod: number; roomNumber: string }[] = [];

    // Let's do a simple mapping:
    // For each solver activity, look up a slot in draft_slots that matches:
    // - same courseId
    // - same groupName
    // We must match them one-to-one. Let's keep track of matched draft slot groups.
    const matchedSlotIds = new Set<string>();

    for (const act of solverInput.activities) {
      // Find a draft slot that matches this activity and hasn't been matched yet.
      // A draft slot matches if:
      // - course_id matches
      // - group_name matches
      // Let's find one:
      const match = draftSlots?.find(
        (s) =>
          s.course_id === act.courseId &&
          s.group_name === act.groupName &&
          !matchedSlotIds.has(s.id)
      );

      if (match) {
        // Find all draft slots in the same block (for combined class teachers)
        const peerSlots = draftSlots?.filter(
          (s) =>
            s.course_id === match.course_id &&
            s.group_name === match.group_name &&
            s.day_of_week === match.day_of_week &&
            s.start_period === match.start_period &&
            s.room_number === match.room_number
        ) || [];

        peerSlots.forEach((s) => matchedSlotIds.add(s.id));

        assignments.push({
          activityId: act.id,
          dayOfWeek: match.day_of_week,
          startPeriod: match.start_period,
          endPeriod: match.end_period,
          roomNumber: match.room_number || '',
        });
      }
    }

    // 5. Exclude candidate activity from the list of existing assignments
    const otherAssignments = assignments.filter((a) => a.activityId !== activityId);

    // 6. Run validation on the candidate assignment
    const candidateAssignment = {
      activityId,
      dayOfWeek: Number(dayOfWeek),
      startPeriod: Number(startPeriod),
      endPeriod: Number(endPeriod),
      roomNumber,
    };

    const validation = validateSlot(candidateAssignment, otherAssignments, solverInput);

    return ok({
      isValid: validation.isValid,
      hardConflicts: validation.hardConflicts,
      softWarnings: validation.softWarnings,
    });
  } catch (error: any) {
    console.error('Validation failed:', error);
    return internalError(error.message || 'Validation failed');
  }
}
