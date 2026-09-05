import { NextRequest } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { badRequest, ok } from '@/lib/apiResponse';

export async function POST(request: NextRequest) {
  const auth = await requireServerSession(request, { roles: ['teacher', 'head'] });
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    if (!body.attendance || typeof body.attendance !== 'object' || Array.isArray(body.attendance) ||
        Object.keys(body.attendance).length > 500 || !Number.isFinite(Date.parse(body.starts_at))) return badRequest('Invalid attendance batch');
    const { data, error } = await getSupabaseAdmin().rpc('record_teacher_attendance', {
      p_teacher: auth.user.id, p_offering: body.offering_id, p_starts: body.starts_at,
      p_room: body.room_number ?? null, p_entries: body.attendance,
    });
    if (error) return badRequest('Attendance could not be saved. Check the assigned offering, enrolments, status and room.');
    return ok({ session_id: data });
  } catch { return badRequest('Invalid attendance request'); }
}
