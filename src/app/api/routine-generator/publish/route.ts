import { NextRequest } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { badRequest, conflict, internalError, ok } from '@/lib/apiResponse';
import { commitDraftOperation } from '@/lib/routine-generator/atomicDraft';
import { dispatchPendingPushNotifications } from '@/lib/pushDispatch';

export async function POST(request: NextRequest) {
  const auth = await requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  try {
    const { draftId, replaceExistingForSelection = true } = await request.json();
    if (typeof draftId !== 'string' || !draftId || typeof replaceExistingForSelection !== 'boolean') {
      return badRequest('draftId and a boolean replacement option are required.');
    }
    const result = await commitDraftOperation(getSupabaseAdmin(), auth.user, draftId,
      { publish: true, replace: replaceExistingForSelection });
    if (process.env.FCM_PROJECT_ID && process.env.FCM_CLIENT_EMAIL && process.env.FCM_PRIVATE_KEY) {
      try { await dispatchPendingPushNotifications(); }
      catch { console.error('Routine committed; push delivery remains queued for retry.'); }
    }
    return ok(result);
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    if (e.code === '40001') return conflict('Scheduling data changed. Reload the draft and retry.');
    if ((error instanceof Error && !e.code) || e.code === '22023' || e.code === '42501') return conflict(e.message || 'Publication rejected.');
    console.error('Atomic routine publication failed', e.code);
    return internalError('Routine publication could not be committed.');
  }
}
