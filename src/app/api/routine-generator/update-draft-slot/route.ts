import { NextRequest } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { badRequest, conflict, internalError, ok } from '@/lib/apiResponse';
import { commitDraftOperation } from '@/lib/routine-generator/atomicDraft';

export async function PATCH(request: NextRequest) {
  const auth = await requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  try {
    const { draftId, slotIds, dayOfWeek, startPeriod, endPeriod, roomNumber } = await request.json();
    if (typeof draftId !== 'string' || !draftId || !Array.isArray(slotIds) ||
      ![dayOfWeek,startPeriod,endPeriod].every(Number.isInteger) || typeof roomNumber !== 'string' || !roomNumber) {
      return badRequest('A draft, unique slot IDs, integer periods/day and room are required.');
    }
    return ok(await commitDraftOperation(getSupabaseAdmin(), auth.user, draftId,
      { move: { slotIds, dayOfWeek, startPeriod, endPeriod, roomNumber } }));
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    if (e.code === '40001') return conflict('Scheduling data changed. Reload the draft and retry.');
    if ((error instanceof Error && !e.code) || e.code === '22023' || e.code === '42501') return badRequest(e.message || 'Draft update rejected.');
    console.error('Atomic draft update failed', e.code);
    return internalError('Draft update could not be committed.');
  }
}
