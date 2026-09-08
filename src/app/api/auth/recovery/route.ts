import { createHash, randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { hashPassword, validatePassword } from '@/lib/passwordUtils';
import { authThrottle } from '@/lib/authThrottle';
import { badRequest, internalError, ok, unauthorized } from '@/lib/apiResponse';

// Admin issues a one-use recovery proof after verifying identity outside the app.
// It is returned only to that administrator; this endpoint does not send messages.
export async function PUT(request: NextRequest) {
  const auth = await requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const limited = authThrottle(`issue-recovery:${auth.user.id}`);
  if (limited) return limited;
  try {
    const { user_id } = await request.json();
    if (typeof user_id !== 'string') return badRequest('User ID required');
    const token = randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + 15 * 60_000).toISOString();
    const { error } = await getSupabaseAdmin().from('password_recovery_tokens').insert({
      user_id, token_hash: createHash('sha256').update(token).digest('hex'), expires_at: expires,
    });
    if (error) throw error;
    console.info('[auth] recovery issued', { actor: auth.user.id, userId: user_id });
    return ok({ recovery_token: token, expires_at: expires });
  } catch { return internalError('Recovery service unavailable'); }
}

export async function POST(request: NextRequest) {
  const limited = authThrottle(`recovery:${request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'}`);
  if (limited) return limited;
  try {
    const { email, recovery_token, new_password } = await request.json();
    if (typeof email !== 'string' || typeof recovery_token !== 'string' ||
        recovery_token.length !== 43 || typeof new_password !== 'string' ||
        !validatePassword(new_password).isValid) return unauthorized('Recovery verification failed');
    const { data, error } = await getSupabaseAdmin().rpc('consume_password_recovery', {
      p_email: email.trim().toLowerCase(),
      p_token_hash: createHash('sha256').update(recovery_token).digest('hex'),
      p_password_hash: await hashPassword(new_password),
    });
    if (error) throw error;
    if (!data) return unauthorized('Recovery verification failed');
    console.info('[auth] recovery completed');
    return ok({ message: 'Password reset. Please sign in.' });
  } catch { return internalError('Recovery service unavailable'); }
}
