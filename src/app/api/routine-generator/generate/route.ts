import { NextRequest, NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { badRequest, ok, internalError, serviceUnavailable } from '@/lib/apiResponse';
import { buildSolverInput } from '@/lib/routine-generator/buildSolverInput';
import { generateRoutineRecommendations } from '@/lib/routine-generator/solver';
import { periodRangeToTime } from '@/lib/routine-generator/periods';

export async function POST(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  const user = auth.user;
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { session, year, term, section, draftCount = 5, options = {} } = body;

    if (!session || !year || !term || !section) {
      return badRequest('session, year, term, and section are required parameters.');
    }

    const solverOptions = {
      includeExistingSelectedSlots: !!options.includeExistingSelectedSlots,
      respectTeacherAvailability: options.respectTeacherAvailability !== false,
      respectRoomCapacity: options.respectRoomCapacity !== false,
      allowSaturday: !!options.allowSaturday,
      theoryRooms: options.theoryRooms || [],
      labRooms: options.labRooms || [],
    };

    // 1. Build solver input from DB
    const solverInput = await buildSolverInput(
      supabase,
      session,
      Number(year),
      Number(term),
      section,
      solverOptions
    );

    // 2. Create routine generation job entry
    const { data: job, error: jobError } = await supabase
      .from('routine_generation_jobs')
      .insert({
        session,
        year: Number(year),
        term: Number(term),
        section,
        status: 'running',
        requested_by: user.id,
        constraints: JSON.stringify(solverInput.constraints) as any,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // 3. Execute solver
    const drafts = generateRoutineRecommendations(solverInput, draftCount, 20000);

    if (drafts.length === 0) {
      // Update job to failed
      await supabase
        .from('routine_generation_jobs')
        .update({
          status: 'failed',
          message: 'No feasible routine found. Try relaxing soft preferences, adding available rooms, or checking teacher availability.',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return ok({
        success: false,
        message: 'No feasible routine found. Try relaxing soft preferences, adding available rooms, or checking teacher availability.',
      });
    }

    // 4. Save drafts to database
    for (const draft of drafts) {
      const { data: dbDraft, error: draftErr } = await supabase
        .from('routine_drafts')
        .insert({
          job_id: job.id,
          draft_name: draft.name,
          score: draft.score,
          hard_conflict_count: draft.hardConflictCount,
          soft_warning_count: draft.softWarningCount,
          summary: draft.summary,
        })
        .select()
        .single();

      if (draftErr) throw draftErr;

      // Unpack assignments to draft_slots
      const draftSlotsToInsert: any[] = [];
      for (const asn of draft.assignments) {
        const act = solverInput.activities.find((a) => a.id === asn.activityId);
        if (!act) continue;

        const timeRange = periodRangeToTime(asn.startPeriod, asn.endPeriod);

        // For combined classes, write a slot row for each teacher offering
        for (const t of act.teachers) {
          draftSlotsToInsert.push({
            draft_id: dbDraft.id,
            course_offering_id: t.courseOfferingId || null,
            course_id: act.courseId,
            teacher_user_id: t.teacherUserId,
            room_number: asn.roomNumber,
            day_of_week: asn.dayOfWeek,
            start_period: asn.startPeriod,
            end_period: asn.endPeriod,
            start_time: timeRange ? `${timeRange.start}:00` : null,
            end_time: timeRange ? `${timeRange.end}:00` : null,
            year: Number(year),
            term: Number(term),
            section: t.section || section,
            group_name: act.groupName,
            course_type: act.courseType,
            is_lab: act.courseType === 'Lab' || act.courseType === 'Sessional',
            is_combined: act.isCombined,
            is_locked: false,
            conflict_status: 'valid',
            conflict_reasons: [] as any,
          });
        }
      }

      if (draftSlotsToInsert.length > 0) {
        const { error: slotsErr } = await supabase
          .from('routine_draft_slots')
          .insert(draftSlotsToInsert);

        if (slotsErr) throw slotsErr;
      }
    }

    // 5. Mark job complete
    const bestScore = drafts[0]?.score || 0;
    const { data: finalJob } = await supabase
      .from('routine_generation_jobs')
      .update({
        status: 'completed',
        best_score: bestScore,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .select()
      .single();

    return ok({
      success: true,
      job: finalJob,
      draftCount: drafts.length,
    });
  } catch (error: any) {
    console.error('Generation failed:', error);
    return internalError(error.message || 'Routine generation failed');
  }
}
