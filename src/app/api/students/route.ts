import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { hashPassword, getStudentInitialPassword } from '@/lib/passwordUtils';

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Supabase is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { full_name, email, phone, roll_no, term, session } = body;

    // Validate required fields
    if (!full_name || !email || !roll_no || !term || !session) {
      return NextResponse.json(
        { success: false, error: 'Required fields: full_name, email, roll_no, term, session' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Generate UUID and password
    const tempUserId = crypto.randomUUID();
    const initialPassword = getStudentInitialPassword(roll_no);
    const passwordHash = await hashPassword(initialPassword);

    // 1. Create profile (auth only: email + password + role)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: tempUserId,
        role: 'STUDENT',
        email,
        password_hash: passwordHash,
        is_active: true,
      });

    if (profileError) {
      if (profileError.message.includes('unique') || profileError.message.includes('duplicate')) {
        return NextResponse.json(
          { success: false, error: 'A student with this email already exists' },
          { status: 409 }
        );
      }
      throw profileError;
    }

    // 2. Create student record (all student data: name, phone, roll, term, etc.)
    const { error: studentError } = await supabase
      .from('students')
      .insert({
        user_id: tempUserId,
        roll_no,
        full_name,
        phone,
        term,
        session,
      });

    if (studentError) {
      if (studentError.message.includes('unique') || studentError.message.includes('duplicate')) {
        return NextResponse.json(
          { success: false, error: 'A student with this roll number already exists' },
          { status: 409 }
        );
      }
      throw studentError;
    }

    // 3. Fetch complete student data with auth info
    const { data: studentData, error: fetchError } = await supabase
      .from('students')
      .select(`
        *,
        profile:profiles(user_id, role, email, is_active, created_at, updated_at)
      `)
      .eq('user_id', tempUserId)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({
      success: true,
      data: studentData,
      initialPassword,
    });
  } catch (error: any) {
    console.error('Error adding student:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add student' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json([], { status: 200 });
    }

    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        profile:profiles(user_id, role, email, is_active, created_at, updated_at)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error fetching students:', error);
    return NextResponse.json([], { status: 500 });
  }
}

// PATCH - Directly update student term (admin action — no pending workflow)
export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Supabase is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { user_id, term } = body;

    if (!user_id || !term) {
      return NextResponse.json(
        { success: false, error: 'user_id and term are required' },
        { status: 400 }
      );
    }

    const validTerms = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'];
    if (!validTerms.includes(term)) {
      return NextResponse.json(
        { success: false, error: `Invalid term "${term}". Must be one of: ${validTerms.join(', ')}` },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('students')
      .update({
        term,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id);

    if (error) {
      console.error('Error updating student term:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, user_id, term });
  } catch (error: any) {
    console.error('Error in PATCH /api/students:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update student term' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deactivating student:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
