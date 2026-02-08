import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { hashPassword, generateTeacherPassword } from '@/lib/passwordUtils';

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Supabase is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { full_name, email, phone, designation, password } = body;

    // Validate required fields
    if (!full_name || !email || !designation) {
      return NextResponse.json(
        { success: false, error: 'Required fields: full_name, email, designation' },
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
    const plainPassword = password || generateTeacherPassword();
    const passwordHash = await hashPassword(plainPassword);

    // 1. Create profile (auth only: email + password + role)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: tempUserId,
        role: 'TEACHER',
        email,
        password_hash: passwordHash,
        is_active: true,
      });

    if (profileError) {
      if (profileError.message.includes('unique') || profileError.message.includes('duplicate')) {
        return NextResponse.json(
          { success: false, error: 'A teacher with this email already exists' },
          { status: 409 }
        );
      }
      throw profileError;
    }

    // 2. Create teacher record (all teacher data: name, phone, designation, etc.)
    const { error: teacherError } = await supabase
      .from('teachers')
      .insert({
        user_id: tempUserId,
        full_name,
        phone,
        designation,
      });

    if (teacherError) throw teacherError;

    // 3. Fetch complete teacher data with auth info
    const { data: teacherData, error: fetchError } = await supabase
      .from('teachers')
      .select(`
        *,
        profile:profiles(user_id, role, email, is_active, created_at, updated_at)
      `)
      .eq('user_id', tempUserId)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({
      success: true,
      data: teacherData,
      generatedPassword: plainPassword,
    });
  } catch (error: any) {
    console.error('Error adding teacher:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add teacher' },
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
      .from('teachers')
      .select(`
        *,
        profile:profiles(user_id, role, email, is_active, created_at, updated_at)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error fetching teachers:', error);
    return NextResponse.json([], { status: 500 });
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
    console.error('Error deactivating teacher:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Supabase is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { userId, action, full_name, phone, designation } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Reset password: generate new 6-digit password and return it
    if (action === 'reset_password') {
      const newPassword = generateTeacherPassword();
      const passwordHash = await hashPassword(newPassword);

      const { error } = await supabase
        .from('profiles')
        .update({ password_hash: passwordHash })
        .eq('user_id', userId);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        newPassword,
      });
    }

    // Toggle leave status
    if (action === 'toggle_leave') {
      const { is_on_leave, leave_reason } = body;

      const updates: Record<string, any> = {
        is_on_leave: !!is_on_leave,
        leave_reason: is_on_leave ? (leave_reason || null) : null,
      };

      const { error } = await supabase
        .from('teachers')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    // Update profile: update teacher data
    if (action === 'update_profile') {
      const teacherUpdates: Record<string, string> = {};
      if (full_name) teacherUpdates.full_name = full_name;
      if (phone) teacherUpdates.phone = phone;
      if (designation) teacherUpdates.designation = designation;

      if (Object.keys(teacherUpdates).length > 0) {
        const { error } = await supabase
          .from('teachers')
          .update(teacherUpdates)
          .eq('user_id', userId);

        if (error) throw error;
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error updating teacher:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update teacher' },
      { status: 500 }
    );
  }
}
