import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';

export function databaseToken(userId: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is required for authenticated data access');
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    role: 'authenticated', sub: userId, aud: 'authenticated', iat: now, exp: now + 30,
  })}`;
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

export function getSupabaseUser(userId: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: async () => databaseToken(userId),
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
