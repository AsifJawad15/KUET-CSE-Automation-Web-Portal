import { NextResponse } from 'next/server';
const attempts = new Map<string, { count: number; expires: number }>();
// Per-instance abuse bound; use a shared rate limiter at the ingress for replicas.
export function authThrottle(key: string): NextResponse | null {
  const now = Date.now();
  for (const [id, value] of attempts) if (value.expires <= now) attempts.delete(id);
  if (attempts.size >= 10000 && !attempts.has(key)) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  const value = attempts.get(key) ?? { count: 0, expires: now + 60_000 };
  value.count++;
  attempts.set(key, value);
  if (value.count <= 5 && attempts.size <= 10000) return null;
  return NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' },
    { status: 429, headers: { 'Retry-After': '60' } });
}
