import { NextRequest, NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { badRequest, ok, notFound, internalError, noContent } from '@/lib/apiResponse';

export async function GET(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('job_id');
    const draftId = searchParams.get('draft_id');
    const session = searchParams.get('session');
    const year = searchParams.get('year');
    const term = searchParams.get('term');
    const section = searchParams.get('section');

    const supabase = getSupabaseAdmin();

    // 1. Fetch a single draft with all its slots
    if (draftId) {
      const { data: draft, error: draftErr } = await supabase
        .from('routine_drafts')
        .select('*')
        .eq('id', draftId)
        .maybeSingle();

      if (draftErr) throw draftErr;
      if (!draft) return notFound('Draft not found');

      // Fetch slots
      const { data: slots, error: slotsErr } = await supabase
        .from('routine_draft_slots')
        .select(`
          *,
          course_offerings (
            id, term, session, batch,
            courses (code, title, credit, course_type),
            teachers (full_name, teacher_uid)
          )
        `)
        .eq('draft_id', draftId)
        .order('day_of_week')
        .order('start_period');

      if (slotsErr) throw slotsErr;

      return ok({
        ...draft,
        slots: slots || [],
      });
    }

    // 2. Fetch list of drafts by job ID
    if (jobId) {
      const { data: drafts, error: draftsErr } = await supabase
        .from('routine_drafts')
        .select('*')
        .eq('job_id', jobId)
        .order('score', { ascending: false });

      if (draftsErr) throw draftsErr;
      return ok(drafts || []);
    }

    // 3. Fetch list of drafts by filters (session, year, term, section)
    if (session && year && term) {
      // Find jobs matching target batch
      const { data: jobs, error: jobsErr } = await supabase
        .from('routine_generation_jobs')
        .select('id')
        .eq('session', session)
        .eq('year', Number(year))
        .eq('term', Number(term));

      if (jobsErr) throw jobsErr;

      if (!jobs || jobs.length === 0) {
        return ok([]);
      }

      const jobIds = jobs.map((j) => j.id);

      // Find drafts belonging to these jobs
      const { data: drafts, error: draftsErr } = await supabase
        .from('routine_drafts')
        .select('*, routine_generation_jobs(session, year, term, section, created_at)')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false })
        .order('score', { ascending: false });

      if (draftsErr) throw draftsErr;
      return ok(drafts || []);
    }

    return badRequest('Specify job_id, draft_id, or session/year/term/section filters.');
  } catch (error: any) {
    return internalError(error.message || 'Failed to fetch drafts');
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('id');
    const jobId = searchParams.get('job_id');

    const supabase = getSupabaseAdmin();

    if (draftId) {
      const { error } = await supabase
        .from('routine_drafts')
        .delete()
        .eq('id', draftId);

      if (error) throw error;
      return noContent();
    }

    if (jobId) {
      const { error } = await supabase
        .from('routine_generation_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;
      return noContent();
    }

    return badRequest('Specify draft id or job_id to delete.');
  } catch (error: any) {
    return internalError(error.message || 'Failed to delete draft/job');
  }
}
