import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ==========================================
// GET /api/courses — List all courses
// ==========================================
export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json([], { status: 200 });
    }

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('code', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error fetching courses:', error);
    return NextResponse.json([], { status: 500 });
  }
}

// ==========================================
// POST /api/courses — Add a new course
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
    const { code, title, credit, course_type, description } = body;

    // Validate required fields
    if (!code || !title || credit == null) {
      return NextResponse.json(
        { success: false, error: 'Required fields: code, title, credit' },
        { status: 400 }
      );
    }

    // Validate code is uppercase
    if (code !== code.toUpperCase()) {
      return NextResponse.json(
        { success: false, error: 'Course code must be uppercase (e.g., CSE 3201)' },
        { status: 400 }
      );
    }

    // Validate credit > 0
    if (Number(credit) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Credit must be greater than 0' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('courses')
      .insert({
        code: code.trim(),
        title: title.trim(),
        credit: Number(credit),
        course_type: course_type || 'Theory',
        description: description?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return NextResponse.json(
          { success: false, error: `Course with code "${code}" already exists` },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error adding course:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add course' },
      { status: 500 }
    );
  }
}

// ==========================================
// PATCH /api/courses — Update an existing course
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
    const { id, code, title, credit, course_type, description } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    if (code !== undefined) {
      if (code !== code.toUpperCase()) {
        return NextResponse.json(
          { success: false, error: 'Course code must be uppercase' },
          { status: 400 }
        );
      }
      updates.code = code.trim();
    }
    if (title !== undefined) updates.title = title.trim();
    if (credit !== undefined) {
      if (Number(credit) <= 0) {
        return NextResponse.json(
          { success: false, error: 'Credit must be greater than 0' },
          { status: 400 }
        );
      }
      updates.credit = Number(credit);
    }
    if (course_type !== undefined) updates.course_type = course_type;
    if (description !== undefined) updates.description = description?.trim() || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return NextResponse.json(
          { success: false, error: `Course code "${code}" already exists` },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error updating course:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update course' },
      { status: 500 }
    );
  }
}

// ==========================================
// DELETE /api/courses?id=<uuid> — Delete a course
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
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting course:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete course' },
      { status: 500 }
    );
  }
}
