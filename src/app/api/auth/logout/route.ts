import { NextRequest, NextResponse } from 'next/server';

import { clearSessionCookie, requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  const auth = await requireServerSession(request);
  if (auth.response) { clearSessionCookie(auth.response); return auth.response; }
  const { error } = await getSupabaseAdmin().rpc('revoke_user_sessions', { p_user_id: auth.user.id });
  const response = NextResponse.json(error ? { success: false, error: 'Session revocation unavailable' } : { success: true }, { status: error ? 503 : 200 });
  clearSessionCookie(response);
  return response;
}
