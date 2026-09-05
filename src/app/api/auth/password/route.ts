import { NextRequest } from 'next/server';
import { requireServerSession, clearSessionCookie } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { comparePassword, hashPassword, validatePassword } from '@/lib/passwordUtils';
import { badRequest, internalError, ok, unauthorized } from '@/lib/apiResponse';
import { authThrottle } from '@/lib/authThrottle';

export async function POST(request: NextRequest) {
  const auth = await requireServerSession(request);
  if (auth.response) return auth.response;
  const limited = authThrottle(`password:${auth.user.id}`);
  if (limited) return limited;
  try {
    const { current_password, new_password } = await request.json();
    if (typeof current_password !== 'string' || Buffer.byteLength(current_password) > 72) return badRequest('Invalid password');
    const db = getSupabaseAdmin();
    const { data, error } = await db.from('profiles').select('password_hash')
      .eq('user_id', auth.user.id).single();
    if (error || !data || !await comparePassword(current_password, data.password_hash)) return unauthorized('Password verification failed');
    if (new_password === undefined) return ok({ verified: true });
    if (typeof new_password !== 'string') return badRequest('Invalid new password');
    const validation = validatePassword(new_password);
    if (!validation.isValid) return badRequest(validation.error!);
    const { error: updateError } = await db.from('profiles')
      .update({ password_hash: await hashPassword(new_password) }).eq('user_id', auth.user.id);
    if (updateError) throw updateError;
    console.info('[auth] password changed', { userId: auth.user.id });
    const response = ok({ message: 'Password changed. Please sign in again.' });
    clearSessionCookie(response);
    return response;
  } catch { return internalError('Password service unavailable'); }
}
