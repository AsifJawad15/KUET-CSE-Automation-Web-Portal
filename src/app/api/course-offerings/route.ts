import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ==========================================
// GET /api/course-offerings — List offerings with teacher + course info
// ==========================================
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json([], { status: 200 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('course_id');

    let query = supabase
      .from('course_offerings')
      .select(`
        *,
        courses (id, code, title, credit, course_type, description),
        teachers!course_offerings_teacher_user_id_fkey (
          user_id,
          department,
          designation,
          specialization,
          profiles!teachers_user_id_fkey (full_name, email, phone)
        )
      `)
      .order('created_at', { ascending: false });

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error fetching course offerings:', error);
    return NextResponse.json([], { status: 500 });
  }
}

// ==========================================
// POST /api/course-offerings — Assign a teacher to a course
// ==========================================
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Supabase is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { course_id, teacher_user_id, section } = body;

    if (!course_id || !teacher_user_id) {
      return NextResponse.json(
        { success: false, error: 'Required fields: course_id, teacher_user_id' },
        { status: 400 }
      );
    }

    // Check for duplicate assignment
    const { data: existing } = await supabase
      .from('course_offerings')
      .select('id')
      .eq('course_id', course_id)
      .eq('teacher_user_id', teacher_user_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'This teacher is already assigned to this course' },
        { status: 409 }
      );
    }

    const insertData: Record<string, any> = {
      course_id,
      teacher_user_id,
    };
    if (section) insertData.section = section;

    const { data, error } = await supabase
      .from('course_offerings')
      .insert(insertData)
      .select(`
        *,
        courses (id, code, title, credit, course_type, description),
        teachers!course_offerings_teacher_user_id_fkey (
          user_id,
          department,
          designation,
          specialization,
          profiles!teachers_user_id_fkey (full_name, email, phone)
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error assigning teacher:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to assign teacher' },
      { status: 500 }
    );
  }
}

// ==========================================
// DELETE /api/course-offerings?id=<uuid> — Remove teacher assignment
// ==========================================
export async function DELETE(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Supabase is not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Offering ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('course_offerings')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing assignment:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove assignment' },
      { status: 500 }
    );
  }
}

// ==========================================
// PATCH /api/course-offerings — Update an offering (e.g., change section)
// ==========================================
export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Supabase is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { id, teacher_user_id, section } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Offering ID is required' },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    if (teacher_user_id !== undefined) updates.teacher_user_id = teacher_user_id;
    if (section !== undefined) updates.section = section;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('course_offerings')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        courses (id, code, title, credit, course_type, description),
        teachers!course_offerings_teacher_user_id_fkey (
          user_id,
          department,
          designation,
          specialization,
          profiles!teachers_user_id_fkey (full_name, email, phone)
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error updating offering:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update offering' },
      { status: 500 }
    );
  }
}
