import { NextRequest, NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { badRequest, ok, internalError } from '@/lib/apiResponse';

export async function GET(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const session = searchParams.get('session');
    const year = Number(searchParams.get('year'));
    const term = Number(searchParams.get('term'));
    const section = searchParams.get('section');

    if (!session || isNaN(year) || isNaN(term)) {
      return badRequest('session, year, and term are required query parameters.');
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('course_schedule_requirements')
      .select('*')
      .eq('session', session)
      .eq('year', year)
      .eq('term', term);

    if (section) {
      query = query.eq('section', section);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ok(data || []);
  } catch (error: any) {
    return internalError(error.message || 'Failed to fetch requirements');
  }
}

export async function POST(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const { requirements } = body; // Array of requirements to upsert

    if (!Array.isArray(requirements)) {
      return badRequest('requirements list is required in request body.');
    }

    const supabase = getSupabaseAdmin();
    const upsertRows = requirements.map((req: any) => ({
      id: req.id || undefined, // gen_random_uuid() if empty
      session: req.session,
      year: Number(req.year),
      term: Number(req.term),
      section: req.section || null,
      course_id: req.course_id,
      course_offering_id: req.course_offering_id || null,
      course_type: req.course_type,
      required_theory_slots: Number(req.required_theory_slots || 0),
      required_lab_slots: Number(req.required_lab_slots || 0),
      lab_duration_periods: Number(req.lab_duration_periods || 3),
      theory_duration_periods: Number(req.theory_duration_periods || 1),
      needs_combined_section: !!req.needs_combined_section,
      lab_groups: req.lab_groups || [],
      preferred_room_type: req.preferred_room_type || null,
      preferred_room_numbers: req.preferred_room_numbers || [],
      priority: Number(req.priority || 1),
    }));

    const { data, error } = await supabase
      .from('course_schedule_requirements')
      .upsert(upsertRows, { onConflict: 'id' })
      .select();

    if (error) throw error;

    return ok(data);
  } catch (error: any) {
    return internalError(error.message || 'Failed to upsert requirements');
  }
}
