import { NextRequest, NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { badRequest, ok, notFound, internalError } from '@/lib/apiResponse';
import { buildSolverInput } from '@/lib/routine-generator/buildSolverInput';
import { validateSlot, validateDraft } from '@/lib/routine-generator/conflictValidator';
import { scoreDraft } from '@/lib/routine-generator/scoring';
import { periodRangeToTime } from '@/lib/routine-generator/periods';

export async function PATCH(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const { draftId, slotIds, dayOfWeek, startPeriod, endPeriod, roomNumber } = body;

    if (!draftId || !Array.isArray(slotIds) || slotIds.length === 0) {
      return badRequest('draftId and slotIds (array) are required.');
    }

    if (dayOfWeek === undefined || startPeriod === undefined || endPeriod === undefined || !roomNumber) {
      return badRequest('dayOfWeek, startPeriod, endPeriod, and roomNumber are required fields.');
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch the Draft and its parent Job
    const { data: draft, error: draftErr } = await supabase
      .from('routine_drafts')
      .select('*, routine_generation_jobs(*)')
      .eq('id', draftId)
      .maybeSingle();

    if (draftErr) throw draftErr;
    if (!draft) return notFound('Draft not found');

    const job = draft.routine_generation_jobs;
    if (!job) return notFound('Parent routine generation job not found');

    // 2. Fetch all slots for this draft
    const { data: draftSlots, error: slotsErr } = await supabase
      .from('routine_draft_slots')
      .select('*')
      .eq('draft_id', draftId);

    if (slotsErr) throw slotsErr;

    // 3. Build Solver Input context (locked slots, teacher availabilities, etc.)
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

    // 4. Map draft slots to ScheduleAssignments.
    // Identify which activity corresponds to the slotIds being updated.
    const targetSlot = draftSlots?.find((s) => slotIds.includes(s.id));
    if (!targetSlot) return notFound('Target slot not found in draft');

    // Map all draft slots to solver activities. We need to construct the new state.
    const assignments: { activityId: string; dayOfWeek: number; startPeriod: number; endPeriod: number; roomNumber: string }[] = [];
    const matchedSlotIds = new Set<string>();

    for (const act of solverInput.activities) {
      // Find a slot in draft_slots for this activity
      const match = draftSlots?.find(
        (s) =>
          s.course_id === act.courseId &&
          s.group_name === act.groupName &&
          !matchedSlotIds.has(s.id)
      );

      if (match) {
        // Mark match and peers (same block) as matched
        const peerSlots = draftSlots?.filter(
          (s) =>
            s.course_id === match.course_id &&
            s.group_name === match.group_name &&
            s.day_of_week === match.day_of_week &&
            s.start_period === match.start_period &&
            s.room_number === match.room_number
        ) || [];

        peerSlots.forEach((s) => matchedSlotIds.add(s.id));

        const isUpdatingThisActivity = peerSlots.some((s) => slotIds.includes(s.id));

        assignments.push({
          activityId: act.id,
          dayOfWeek: isUpdatingThisActivity ? Number(dayOfWeek) : match.day_of_week,
          startPeriod: isUpdatingThisActivity ? Number(startPeriod) : match.start_period,
          endPeriod: isUpdatingThisActivity ? Number(endPeriod) : match.end_period,
          roomNumber: isUpdatingThisActivity ? roomNumber : (match.room_number || ''),
        });
      }
    }

    // 5. Run Draft-level validation and scoring
    const validation = validateDraft(assignments, solverInput);
    const { score, warnings } = scoreDraft(assignments, solverInput);

    // 6. Check what conflict details apply to the slotIds being updated
    // Look up in validation.hardConflicts and validation.softWarnings
    // Find activityId of updated assignment
    const updatedAssignment = assignments.find((a) => {
      // Find solver activity containing these slotIds
      const act = solverInput.activities.find((ac) => ac.id === a.activityId);
      return act?.teachers.some((t) => slotIds.includes(t.courseOfferingId)) || false; // wait, let's simplify.
    });

    const candidateActivity = solverInput.activities.find((act) => {
      // Since slotIds belongs to course offerings, we can check if act's teachers have these courseOfferings
      return act.teachers.some((t) => slotIds.includes(t.courseOfferingId));
    });

    const actId = candidateActivity?.id;
    const slotConflicts = validation.hardConflicts.filter((c) => c.activityId === actId);
    const slotWarnings = warnings.filter((w) => w.activityId === actId);

    const slotConflictStatus = slotConflicts.length > 0 ? 'conflict' : (slotWarnings.length > 0 ? 'warning' : 'valid');
    const slotConflictReasons = [...slotConflicts, ...slotWarnings].map((c) => c.reason);

    // 7. Update the slots in the database
    const timeRange = periodRangeToTime(Number(startPeriod), Number(endPeriod));
    const { error: updateError } = await supabase
      .from('routine_draft_slots')
      .update({
        day_of_week: Number(dayOfWeek),
        start_period: Number(startPeriod),
        end_period: Number(endPeriod),
        room_number: roomNumber,
        start_time: timeRange ? `${timeRange.start}:00` : null,
        end_time: timeRange ? `${timeRange.end}:00` : null,
        conflict_status: slotConflictStatus,
        conflict_reasons: slotConflictReasons as any,
      })
      .in('id', slotIds);

    if (updateError) throw updateError;

    // 8. Recalculate other slots' conflict statuses (since moving a slot could resolve/create conflicts for other slots)
    // For each other slot, run validateSlot to see if it is in conflict now
    for (const slot of draftSlots || []) {
      if (slotIds.includes(slot.id)) continue; // Already updated above

      // Find solver activity for this slot
      const act = solverInput.activities.find(
        (a) => a.courseId === slot.course_id && a.groupName === slot.group_name
      );
      if (!act) continue;

      const actAsn = assignments.find((a) => a.activityId === act.id);
      if (!actAsn) continue;

      const rest = assignments.filter((a) => a.activityId !== act.id);
      const slotVal = validateSlot(actAsn, rest, solverInput);
      const slotWrn = warnings.filter((w) => w.activityId === act.id);

      const status = slotVal.hardConflicts.length > 0 ? 'conflict' : (slotWrn.length > 0 ? 'warning' : 'valid');
      const reasons = [...slotVal.hardConflicts, ...slotWrn].map((r) => r.reason);

      await supabase
        .from('routine_draft_slots')
        .update({
          conflict_status: status,
          conflict_reasons: reasons as any,
        })
        .eq('id', slot.id);
    }

    // 9. Update the Draft overall score and summary
    const advantages: string[] = [];
    const disadvantages: string[] = [];

    if (score >= 85) advantages.push('Excellent overall schedule structure.');
    else if (score >= 70) advantages.push('Good balance of classes.');

    const studentGapWarningCount = warnings.filter((w) => w.type === 'student_gap').length;
    const teacherGapWarningCount = warnings.filter((w) => w.type === 'teacher_gap').length;

    if (studentGapWarningCount === 0) advantages.push('No student class gaps found.');
    else disadvantages.push(`${studentGapWarningCount} student gap warnings.`);

    if (teacherGapWarningCount === 0) advantages.push('No teacher gaps found.');
    else disadvantages.push(`${teacherGapWarningCount} teacher gap warnings.`);

    const balanceWarning = warnings.find((w) => w.type === 'day_balance');
    if (!balanceWarning) advantages.push('Perfectly balanced daily class load.');
    else disadvantages.push('Slightly unbalanced class distribution.');

    const summaryText = advantages.slice(0, 2).join(', ') + 
      (disadvantages.length > 0 ? `. Note: ${disadvantages.slice(0, 1).join('')}` : '.');

    await supabase
      .from('routine_drafts')
      .update({
        score,
        hard_conflict_count: validation.hardConflicts.length,
        soft_warning_count: warnings.length,
        summary: {
          reason: summaryText,
          advantages,
          disadvantages,
        },
      })
      .eq('id', draftId);

    return ok({
      success: true,
      score,
      hardConflictCount: validation.hardConflicts.length,
      softWarningCount: warnings.length,
    });
  } catch (error: any) {
    console.error('Update draft slot failed:', error);
    return internalError(error.message || 'Update failed');
  }
}
