import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// ==========================================
// GET /api/routine-slots?term=3-2&session=2023-2024&section=A
// ==========================================
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json([], { status: 200 });
    }

    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');
    const session = searchParams.get('session');
    const section = searchParams.get('section');

    let query = supabase
      .from('routine_slots')
      .select(`
        *,
        course_offerings!inner (
          id, term, session, batch,
          courses (code, title, credit, course_type),
          teachers!course_offerings_teacher_user_id_fkey (full_name, teacher_uid)
        ),
        rooms (room_number, room_type)
      `)
      .order('day_of_week')
      .order('start_time');

    // Filter by section on routine_slots table
    if (section) query = query.eq('section', section);

    const { data, error } = await query;
    if (error) throw error;

    // Filter by term derived from course code (e.g. CSE 3201 → "3-2")
    let filtered = data || [];
    if (term) {
      filtered = filtered.filter((slot: any) => {
        const code = slot.course_offerings?.courses?.code || '';
        const digits = code.replace(/\D/g, '');
        if (digits.length < 2) return false;
        return `${digits[0]}-${digits[1]}` === term;
      });
    }

    return NextResponse.json(filtered);
  } catch (error: any) {
    console.error('Error fetching routine slots:', error);
    return NextResponse.json([], { status: 500 });
  }
}

// ==========================================
// POST /api/routine-slots — Add a new routine slot
// ==========================================
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { offering_id, room_number, day_of_week, start_time, end_time, section } = body;

    if (!offering_id || !room_number || day_of_week === undefined || !start_time || !end_time) {
      return NextResponse.json(
        { success: false, error: 'Required: offering_id, room_number, day_of_week, start_time, end_time' },
        { status: 400 }
      );
    }

    // Check for time conflicts in the same room
    // But allow combined slots: if the conflicting slot is for the same course, it's OK
    const { data: incomingOffering } = await supabase
      .from('course_offerings')
      .select('course_id')
      .eq('id', offering_id)
      .single();

    const { data: conflicts } = await supabase
      .from('routine_slots')
      .select('id, offering_id, course_offerings!inner(course_id)')
      .eq('room_number', room_number)
      .eq('day_of_week', day_of_week)
      .lt('start_time', end_time)
      .gt('end_time', start_time);

    // Filter out conflicts that belong to the same course (combined slots are allowed)
    const realConflicts = (conflicts || []).filter((c: any) => {
      return c.course_offerings?.course_id !== incomingOffering?.course_id;
    });

    if (realConflicts.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Room is already booked for this time slot' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('routine_slots')
      .insert({ offering_id, room_number, day_of_week, start_time, end_time, section })
      .select(`
        *,
        course_offerings!inner (
          id, term, session, batch,
          courses (code, title, credit, course_type),
          teachers!course_offerings_teacher_user_id_fkey (full_name, teacher_uid)
        ),
        rooms (room_number, room_type)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error adding routine slot:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ==========================================
// PATCH /api/routine-slots — Update an existing slot
// ==========================================
export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    // If changing room or time, check conflicts
    if (updates.room_number || updates.start_time || updates.end_time || updates.day_of_week !== undefined) {
      // Get existing slot for defaults
      const { data: existing } = await supabase.from('routine_slots').select('*').eq('id', id).single();
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Slot not found' }, { status: 404 });
      }

      const room = updates.room_number || existing.room_number;
      const day = updates.day_of_week ?? existing.day_of_week;
      const start = updates.start_time || existing.start_time;
      const end = updates.end_time || existing.end_time;

      const { data: conflicts } = await supabase
        .from('routine_slots')
        .select('id')
        .eq('room_number', room)
        .eq('day_of_week', day)
        .lt('start_time', end)
        .gt('end_time', start)
        .neq('id', id);

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json({ success: false, error: 'Room conflict at this time' }, { status: 409 });
      }
    }

    const { data, error } = await supabase
      .from('routine_slots')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        course_offerings!inner (
          id, term, session, batch,
          courses (code, title, credit, course_type),
          teachers!course_offerings_teacher_user_id_fkey (full_name, teacher_uid)
        ),
        rooms (room_number, room_type)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error updating routine slot:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ==========================================
// DELETE /api/routine-slots?id=xxx
// ==========================================
export async function DELETE(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase.from('routine_slots').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting routine slot:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
