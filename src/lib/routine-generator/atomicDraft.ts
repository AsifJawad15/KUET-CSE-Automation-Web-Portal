import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServerSessionUser } from '@/lib/serverAuth';
import { buildSolverInput } from './buildSolverInput';
import { prepareDraftState, type DraftMove, type DraftSlot } from './draftState';
import type { SolverInput } from './types';

export async function commitDraftOperation(db: SupabaseClient, actor: ServerSessionUser, draftId: string,
  options: { move?: DraftMove; publish?: boolean; replace?: boolean } = {}) {
  const { data: revision, error: revisionError } = await db.rpc('get_routine_revision');
  if (revisionError) throw revisionError;
  const { data: draft, error } = await db.from('routine_drafts')
    .select('*, routine_generation_jobs(*)').eq('id', draftId).maybeSingle();
  if (error) throw error;
  if (!draft) throw new Error('Draft not found.');
  const job = draft.routine_generation_jobs;
  const saved = job?.solver_input as SolverInput;
  if (!saved?.options) throw new Error('This draft requires regeneration with saved solver options.');
  const { data: slots, error: slotsError } = await db.from('routine_draft_slots').select('*').eq('draft_id', draftId);
  if (slotsError) throw slotsError;
  const current = await buildSolverInput(db, job.session, job.year, job.term, job.section,
    { ...saved.options, includeExistingSelectedSlots: options.publish ? options.replace === false : saved.options.includeExistingSelectedSlots,
      respectTeacherAvailability: options.publish ? true : saved.options.respectTeacherAvailability });
  const prepared = prepareDraftState(draftId, slots as DraftSlot[], saved, current, options.move);
  if (options.move && prepared.validation.hardConflicts.some(c => c.type === 'invalid_period' || c.type === 'break_lunch_violation')) {
    throw new Error('The move violates the original calendar or activity duration.');
  }
  if (options.publish && !prepared.validation.isValid) {
    throw new Error(`Cannot publish: ${prepared.validation.hardConflicts.map(c => c.reason).join(' ')}`);
  }
  const { data: result, error: commitError } = await db.rpc('commit_routine_draft', {
    p_revision: String(revision), p_actor: actor.id, p_session_version: actor.sessionVersion,
    p_draft: draftId, p_rows: prepared.rows, p_metrics: prepared.metrics,
    p_publish: options.publish === true, p_replace: options.replace !== false,
  });
  if (commitError) throw commitError;
  return result;
}
