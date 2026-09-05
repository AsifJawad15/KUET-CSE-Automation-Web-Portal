import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';

const tables = new Set(['profiles', 'students', 'teachers', 'courses', 'curriculum', 'course_offerings',
  'enrollments', 'rooms', 'routine_slots', 'class_sessions', 'attendance_records', 'attendance',
  'exams', 'exam_scores', 'exam_marks', 'notifications', 'notification_reads', 'device_push_tokens',
  'notices', 'room_booking_requests', 'cr_room_requests', 'optional_course_assignments',
  'geo_attendance_rooms', 'geo_attendance_logs', 'geo_attendance_codes', 'term_upgrade_requests',
  'cms_tv_announcements', 'admin_direct_bookings']);

async function handle(request: NextRequest, context: { params: Promise<{ table: string }> }) {
  const auth = await requireServerSession(request);
  if (auth.response) return auth.response;
  const { table } = await context.params;
  if (!tables.has(table)) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 });
  const secret = process.env.SUPABASE_JWT_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret || !url || !key) return NextResponse.json({ error: 'Authenticated data service is not configured' }, { status: 503 });
  // The signed database principal remains on the server. PostgreSQL policies,
  // including nested selects, enforce row and column privileges for this role.
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    role: 'authenticated', sub: auth.user.id, deptflow_role: auth.user.role,
    aud: 'authenticated', iat: now, exp: now + 30,
  })}`;
  const token = `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
  const headers = new Headers({ apikey: key, authorization: `Bearer ${token}` });
  for (const name of ['content-type', 'accept', 'prefer', 'range', 'range-unit']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
    if (body && body.byteLength > 1_048_576) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    const upstream = await fetch(`${url}/rest/v1/${table}${request.nextUrl.search}`, {
      method: request.method, headers, body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
    for (const name of ['content-type', 'content-range', 'range-unit', 'preference-applied']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch { return NextResponse.json({ error: 'Data service unavailable' }, { status: 503 }); }
}
export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
