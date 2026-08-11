import { NextRequest, NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { badRequest, ok, notFound, conflict, internalError } from '@/lib/apiResponse';
import { buildStudentAudience, createNotification, notifyTeacherScheduleChanged } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  const user = auth.user;
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { draftId, replaceExistingForSelection = true } = body;

    if (!draftId) {
      return badRequest('draftId is required.');
    }

    // 1. Fetch Draft and parent Job
    const { data: draft, error: draftErr } = await supabase
      .from('routine_drafts')
      .select('*, routine_generation_jobs(*)')
      .eq('id', draftId)
      .maybeSingle();

    if (draftErr) throw draftErr;
    if (!draft) return notFound('Draft not found');

    const job = draft.routine_generation_jobs;
    if (!job) return notFound('Parent routine generation job not found');

    if (draft.hard_conflict_count > 0) {
      return conflict(`Cannot publish draft with ${draft.hard_conflict_count} hard conflicts.`);
    }

    // 2. Fetch Draft Slots
    const { data: draftSlots, error: slotsErr } = await supabase
      .from('routine_draft_slots')
      .select('*')
      .eq('draft_id', draftId);

    if (slotsErr) throw slotsErr;
    if (!draftSlots || draftSlots.length === 0) {
      return badRequest('Draft contains no slots to publish.');
    }

    const session = job.session;
    const year = job.year;
    const term = job.term;
    const section = job.section;
    const termStr = `${year}-${term}`;

    // 3. Create Routine Version Record (Audit Trail)
    const { data: version, error: versionErr } = await supabase
      .from('routine_versions')
      .insert({
        session,
        year,
        term,
        section,
        source_draft_id: draftId,
        published_by: user.id,
        change_summary: {
          slot_count: draftSlots.length,
          score: draft.score,
          draft_name: draft.draft_name,
        },
      })
      .select()
      .single();

    if (versionErr) throw versionErr;

    // 4. Delete existing slots of the target sections in this session (if replacing)
    if (replaceExistingForSelection) {
      const sectionsToPublish = Array.from(new Set(draftSlots.map((s) => s.section).filter(Boolean)));

      if (sectionsToPublish.length > 0) {
        const { data: slotsToDelete } = await supabase
          .from('routine_slots')
          .select('id, course_offerings!inner(session, term)')
          .eq('course_offerings.session', session)
          .eq('course_offerings.term', termStr)
          .in('section', sectionsToPublish);

        if (slotsToDelete && slotsToDelete.length > 0) {
          const slotIds = slotsToDelete.map((s) => s.id);

          const { error: deleteErr } = await supabase
            .from('routine_slots')
            .delete()
            .in('id', slotIds);

          if (deleteErr) throw deleteErr;
        }
      }
    }

    // 5. Insert Draft Slots into Main Routine Slots Table
    const slotsToInsert = draftSlots.map((ds) => ({
      offering_id: ds.course_offering_id,
      room_number: ds.room_number,
      day_of_week: ds.day_of_week,
      start_time: ds.start_time,
      end_time: ds.end_time,
      section: ds.section,
    }));

    const { error: insertErr } = await supabase
      .from('routine_slots')
      .insert(slotsToInsert);

    if (insertErr) throw insertErr;

    // 6. Trigger Notification Pipeline
    try {
      // A. Notify target section students
      const audience = buildStudentAudience({
        courseCode: '', // Batch announcement
        term: termStr,
        section: section,
      });

      await createNotification({
        type: 'new_schedule',
        title: 'Routine Updated',
        body: `Class routine for ${year} Year ${term} Term Section ${section} has been updated.`,
        targetType: audience.targetType,
        targetValue: audience.targetValue,
        targetYearTerm: audience.targetYearTerm,
        createdByRole: 'ADMIN',
        metadata: {
          session,
          year,
          term: termStr,
          section,
          version_id: version.id,
        },
      });

      // B. Notify teachers
      const uniqueTeacherIds = Array.from(new Set(draftSlots.map((s) => s.teacher_user_id).filter(Boolean)));
      for (const tId of uniqueTeacherIds) {
        await notifyTeacherScheduleChanged({
          teacherUserId: tId,
          courseCode: 'Routine Update',
          courseTitle: 'Routine Update',
          changeType: 'new_schedule',
          dayLabel: 'the updated routine schedule',
          scheduleDate: undefined,
        });
      }
    } catch (notifErr) {
      console.error('Failed to send routine updates notifications:', notifErr);
    }

    // 7. Mark draft as selected
    await supabase
      .from('routine_drafts')
      .update({ is_selected: true })
      .eq('id', draftId);

    return ok({
      success: true,
      versionId: version.id,
      publishedSlotsCount: slotsToInsert.length,
    });
  } catch (error: any) {
    console.error('Publish failed:', error);
    return internalError(error.message || 'Routine publish failed');
  }
}
