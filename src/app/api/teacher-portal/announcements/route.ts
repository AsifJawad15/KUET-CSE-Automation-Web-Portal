// ==========================================
// API: /api/teacher-portal/announcements
// Handles teacher announcements CRUD
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError, noContent, ok } from '@/lib/apiResponse';
import { requireFields, runValidations } from '@/lib/validators';
import { notifyAnnouncement } from '@/lib/notifications';

function extractError(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const message = 'message' in error ? error.message : undefined;
    const details = 'details' in error ? error.details : undefined;
    const hint = 'hint' in error ? error.hint : undefined;
    const pieces = [message, details, hint].filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    );
    if (pieces.length > 0) {
      return pieces.join(' | ');
    }
  }
  return fallback;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

const ANNOUNCEMENTS_TABLE = 'cms_tv_announcements';

// ── POST /api/teacher-portal/announcements ─────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const title = cleanText(body.title);
    const content = cleanText(body.content);
    const type = cleanText(body.type) ?? 'notice';
    const courseCode = cleanText(body.course_code);
    const priority = cleanText(body.priority) ?? 'medium';
    const scheduledDate = cleanText(body.scheduled_date);
    const createdBy = cleanText(body.created_by);

    const validation = runValidations(
      requireFields({ title, content, type }),
    );
    if (validation) return badRequest(validation);
    const safeTitle = title as string;
    const safeContent = content as string;

    const insertPayload: Record<string, unknown> = {
      title: safeTitle,
      content: safeContent,
      type,
      priority,
      is_active: true,
    };
    if (courseCode) insertPayload.course_code = courseCode;
    if (scheduledDate) insertPayload.scheduled_date = scheduledDate;
    if (createdBy) insertPayload.created_by = createdBy;

    const { data, error } = await supabase
      .from(ANNOUNCEMENTS_TABLE)
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;

    // Notification failure should not block announcement creation.
    try {
      await notifyAnnouncement({
        createdBy: createdBy || '',
        createdByRole: 'TEACHER',
        title: safeTitle,
        bodyText: safeContent,
        courseCode: courseCode || undefined,
      });
    } catch (notificationError) {
      console.error(
        '[TeacherAnnouncements] Announcement created but notification failed:',
        extractError(notificationError, 'Unknown notification error'),
      );
    }

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
      .from(ANNOUNCEMENTS_TABLE)
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
      .from(ANNOUNCEMENTS_TABLE)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return noContent();
  } catch (error: unknown) {
    return internalError(extractError(error, 'Failed to delete announcement'));
  }
}
