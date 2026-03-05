// ==========================================
// API: /api/teacher-portal/announcements
// Handles teacher announcements CRUD
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError, noContent, ok } from '@/lib/apiResponse';
import { requireFields, runValidations } from '@/lib/validators';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── POST /api/teacher-portal/announcements ─────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { title, content, type, course_code, priority, scheduled_date, created_by } = body;

    const validation = runValidations(
      requireFields({ title, content, type }),
    );
    if (validation) return badRequest(validation);

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title,
        content,
        type: type || 'notice',
        course_code: course_code || null,
        priority: priority || 'medium',
        scheduled_date: scheduled_date || null,
        created_by: created_by || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to create announcement'));
  }
}

// ── GET /api/teacher-portal/announcements ──────────────

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacher_id');

    let query = supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (teacherId) {
      query = query.eq('created_by', teacherId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to fetch announcements'));
  }
}

// ── DELETE /api/teacher-portal/announcements ───────────

export async function DELETE(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return badRequest('Announcement ID is required');

    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return noContent();
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to delete announcement'));
  }
}
