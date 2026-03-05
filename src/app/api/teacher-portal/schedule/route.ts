// ==========================================
// API: /api/teacher-portal/schedule
// Returns schedule slots for a specific teacher
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── GET /api/teacher-portal/schedule ───────────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacher_id');

    if (!teacherId) return badRequest('Teacher ID is required');

    // Get course offerings for this teacher, then their routine slots
    const { data: offerings, error: offeringsError } = await supabase
      .from('course_offerings')
      .select(`
        id, term, session,
        courses (code, title),
        routine_slots (
          id, room_number, day_of_week, start_time, end_time, section
        )
      `)
      .eq('teacher_user_id', teacherId)
      .eq('is_active', true);

    if (offeringsError) throw offeringsError;

    // Flatten into schedule slots
    const slots = (offerings || []).flatMap((offering: Record<string, unknown>) => {
      const course = offering.courses as { code: string; title: string } | null;
      const routineSlots = (offering.routine_slots || []) as Array<{
        id: string;
        room_number: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
        section: string | null;
      }>;
      return routineSlots.map((slot) => ({
        id: slot.id,
        course_code: course?.code || '',
        course_title: course?.title || '',
        room_number: slot.room_number,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        section: slot.section,
        term: offering.term,
        session: offering.session,
      }));
    });

    return NextResponse.json(slots);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to fetch schedule'));
  }
}
