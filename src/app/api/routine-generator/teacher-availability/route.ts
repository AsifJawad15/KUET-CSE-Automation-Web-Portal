import { NextRequest, NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { badRequest, ok, internalError } from '@/lib/apiResponse';

export async function GET(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const teacherUserId = searchParams.get('teacher_user_id');

    if (!teacherUserId) {
      return badRequest('teacher_user_id is required.');
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('teacher_availability')
      .select('*')
      .eq('teacher_user_id', teacherUserId);

    if (error) throw error;

    return ok(data || []);
  } catch (error: any) {
    return internalError(error.message || 'Failed to fetch teacher availability');
  }
}

export async function POST(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const { teacherUserId, availabilities } = body;

    if (!teacherUserId || !Array.isArray(availabilities)) {
      return badRequest('teacherUserId and availabilities array are required.');
    }

    const supabase = getSupabaseAdmin();

    // 1. Delete old availability rows for this teacher
    const { error: deleteErr } = await supabase
      .from('teacher_availability')
      .delete()
      .eq('teacher_user_id', teacherUserId);

    if (deleteErr) throw deleteErr;

    // 2. Insert new rows (only if they aren't 'available' because available is the default)
    const filteredToInsert = availabilities
      .filter((a: any) => a.availabilityType !== 'available')
      .map((a: any) => ({
        teacher_user_id: teacherUserId,
        day_of_week: Number(a.dayOfWeek),
        start_period: Number(a.startPeriod),
        end_period: Number(a.endPeriod),
        availability_type: a.availabilityType,
        priority: Number(a.priority || 1),
        note: a.note || null,
      }));

    if (filteredToInsert.length > 0) {
      const { data, error: insertErr } = await supabase
        .from('teacher_availability')
        .insert(filteredToInsert)
        .select();

      if (insertErr) throw insertErr;
      return ok(data);
    }

    return ok([]);
  } catch (error: any) {
    return internalError(error.message || 'Failed to save teacher availability');
  }
}
