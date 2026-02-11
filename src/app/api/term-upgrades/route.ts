import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch term upgrade requests (optionally filter by studentUserId or status)
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const studentUserId = searchParams.get('studentUserId');
    const status = searchParams.get('status');

    let query = supabase
      .from('term_upgrade_requests')
      .select(`
        *,
        students!inner (
          full_name,
          roll_no,
          term,
          session,
          batch,
          section,
          cgpa
        )
      `)
      .order('requested_at', { ascending: false });

    if (studentUserId) {
      query = query.eq('student_user_id', studentUserId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching term upgrade requests:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Submit a new term upgrade request (student)
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { student_user_id, current_term, requested_term, reason } = body;

    if (!student_user_id || !current_term || !requested_term) {
      return NextResponse.json(
        { error: 'student_user_id, current_term, and requested_term are required' },
        { status: 400 }
      );
    }

    // Check if student already has a pending request
    const { data: existing } = await supabase
      .from('term_upgrade_requests')
      .select('id')
      .eq('student_user_id', student_user_id)
      .eq('status', 'pending')
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'You already have a pending term upgrade request' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('term_upgrade_requests')
      .insert({
        student_user_id,
        current_term,
        requested_term,
        reason: reason || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating term upgrade request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Approve or reject a term upgrade request (admin)
export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { id, status, admin_user_id, admin_remarks } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'id and status are required' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    // Validate admin_user_id is a valid UUID, otherwise set to null
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validAdminId = admin_user_id && uuidRegex.test(admin_user_id) ? admin_user_id : null;

    // Fetch the request first
    const { data: upgradeRequest, error: fetchError } = await supabase
      .from('term_upgrade_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !upgradeRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (upgradeRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'This request has already been reviewed' },
        { status: 400 }
      );
    }

    // Update the request status
    const { error: updateError } = await supabase
      .from('term_upgrade_requests')
      .update({
        status,
        admin_user_id: validAdminId,
        admin_remarks: admin_remarks || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating term upgrade request:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If approved, update the student's term
    if (status === 'approved') {
      const { error: studentUpdateError } = await supabase
        .from('students')
        .update({
          term: upgradeRequest.requested_term,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', upgradeRequest.student_user_id);

      if (studentUpdateError) {
        console.error('Error updating student term:', studentUpdateError);
        // Rollback the request status
        await supabase
          .from('term_upgrade_requests')
          .update({ status: 'pending', admin_user_id: null, admin_remarks: null, reviewed_at: null })
          .eq('id', id);

        return NextResponse.json(
          { error: 'Failed to update student term: ' + studentUpdateError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete a term upgrade request (only pending ones)
export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('term_upgrade_requests')
      .delete()
      .eq('id', id)
      .eq('status', 'pending'); // Only allow deleting pending requests

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
