import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

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
          full_name,
          phone,
          department,
          designation,
          is_on_leave,
          profiles!teachers_user_id_fkey (email)
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
    const { course_id, teacher_user_id, section, term, session } = body;

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

    // Derive term from curriculum table if not provided
    let resolvedTerm = term;
    if (!resolvedTerm) {
      const { data: curriculumEntry } = await supabase
        .from('curriculum')
        .select('term')
        .eq('course_id', course_id)
        .limit(1)
        .maybeSingle();
      resolvedTerm = curriculumEntry?.term || null;
    }

    // If still no term, try to get it from the course code pattern (e.g., CSE 3200 → year 3, term 2 → '3-2')
    if (!resolvedTerm) {
      const { data: courseData } = await supabase
        .from('courses')
        .select('code')
        .eq('id', course_id)
        .single();
      if (courseData?.code) {
        const match = courseData.code.match(/\d/);
        if (match) {
          const year = Math.min(Math.ceil(parseInt(match[0]) / 1), 4);
          // Default to term x-1, can be overridden
          resolvedTerm = `${year}-1`;
        }
      }
    }

    if (!resolvedTerm) {
      resolvedTerm = '1-1'; // Ultimate fallback
    }

    // Derive session: use provided value or current academic year
    const currentYear = new Date().getFullYear();
    const resolvedSession = session || `${currentYear - 1}-${currentYear}`;

    const insertData: Record<string, any> = {
      course_id,
      teacher_user_id,
      term: resolvedTerm,
      session: resolvedSession,
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
          full_name,
          phone,
          department,
          designation,
          is_on_leave,
          profiles!teachers_user_id_fkey (email)
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
          full_name,
          phone,
          department,
          designation,
          is_on_leave,
          profiles!teachers_user_id_fkey (email)
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
