// ==========================================
// API: /api/notifications
// Handles fetching, creating, and marking notifications as read
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { badRequest, created, guardSupabase, internalError, noContent, ok } from '@/lib/apiResponse';
import { requireFields } from '@/lib/validators';

// ── Types ──────────────────────────────────────────────────────────────────────

export type NotificationTargetType = 'ALL' | 'ROLE' | 'YEAR_TERM' | 'SECTION' | 'COURSE' | 'USER';

export type NotificationType =
  | 'room_allocated'
  | 'room_request_approved'
  | 'room_request_rejected'
  | 'notice_posted'
  | 'exam_scheduled'
  | 'exam_result_published'
  | 'exam_room_assigned'
  | 'exam_reminder'
  | 'class_cancelled'
  | 'class_rescheduled'
  | 'assignment_due'
  | 'attendance_absent'
  | 'attendance_low'
  | 'announcement'
  | 'term_upgrade'
  | 'makeup_class'
  | 'geo_attendance_open'
  | 'optional_course'
  | 'cr_room_request_submitted'
  | 'attendance_marking_reminder'
  | 'course_anomaly_alert';

// ── GET /api/notifications ─────────────────────────────────────────────────────
// Query params:
//   ?user_id=  (required) — fetch all visible notifications for this user
//   ?unread_only=true     — only unread ones
//   ?limit=50             — pagination limit (default 50)
//   ?offset=0             — pagination offset

export async function GET(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const unread_only = searchParams.get('unread_only') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!user_id) return badRequest('user_id is required');

    // Fetch user context (role, term, section)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user_id)
      .maybeSingle();

    const { data: student } = await supabase
      .from('students')
      .select('term, section')
      .eq('user_id', user_id)
      .maybeSingle();

    const userRole = profile?.role ?? null;   // 'STUDENT' | 'TEACHER'
    const userTerm = student?.term ?? null;   // e.g. '3-2'
    const userSection = student?.section ?? null; // e.g. 'A'

    // Fetch enrollments (for COURSE-targeted notifications)
    const { data: enrolledCourses } = await supabase
      .from('course_offerings')
      .select('courses!inner(code)')
      .eq('term', userTerm || '')
      .eq('section', userSection || '');

    const enrolledCodes: string[] = (enrolledCourses ?? [])
      .map((e: Record<string, unknown>) => {
        const courses = e.courses as { code?: string } | null;
        return courses?.code;
      })
      .filter(Boolean) as string[];

    // Fetch read receipt IDs for this user
    const { data: readData } = await supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', user_id);

    const readIds = new Set((readData ?? []).map((r: { notification_id: string }) => r.notification_id));

    // Fetch all non-expired notifications and filter visibility in JS
    // (simpler and more reliable than complex Supabase OR string building)
    const now = new Date().toISOString();
    const { data: allNotifs, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1 + 100); // over-fetch, then filter

    if (error) throw error;

    // Apply visibility rules (mirrors RLS policy)
    const visible = (allNotifs ?? []).filter((n: Record<string, unknown>) => {
      const tt = n.target_type as string;
      const tv = n.target_value as string | null;
      const tyt = n.target_year_term as string | null;

      if (tt === 'ALL') return true;
      if (tt === 'ROLE') return tv === userRole;
      if (tt === 'YEAR_TERM') return tv === userTerm;
      if (tt === 'SECTION') return tv === userSection && tyt === userTerm;
      if (tt === 'COURSE') return tv !== null && enrolledCodes.includes(tv);
      if (tt === 'USER') return tv === user_id;
      return false;
    });

    // Annotate with is_read
    const annotated = visible.map((n: Record<string, unknown>) => ({
      ...n,
      is_read: readIds.has(n.id as string),
    }));

    const result = unread_only ? annotated.filter((n) => !n.is_read) : annotated;
    const paginated = result.slice(0, limit);

    return NextResponse.json({
      notifications: paginated,
      unread_count: annotated.filter((n) => !n.is_read).length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch notifications';
    return internalError(msg);
  }
}

// ── POST /api/notifications — Create a notification ───────────────────────────
// Body:
//   type, title, body, target_type, target_value?, target_year_term?,
//   created_by, created_by_role, metadata?, expires_at?

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();

    const { type, title, body: notifBody, target_type, created_by, created_by_role } = body;
    const validation = requireFields({ type, title, body: notifBody, target_type, created_by, created_by_role });
    if (!validation.valid) return badRequest(validation.error!);

    // Validate target_type
    const validTargetTypes: NotificationTargetType[] = ['ALL', 'ROLE', 'YEAR_TERM', 'SECTION', 'COURSE', 'USER'];
    if (!validTargetTypes.includes(target_type)) {
      return badRequest(`Invalid target_type. Must be one of: ${validTargetTypes.join(', ')}`);
    }

    // Validate that non-ALL types have target_value
    if (target_type !== 'ALL' && !body.target_value) {
      return badRequest('target_value is required when target_type is not ALL');
    }

    if (target_type === 'SECTION' && !body.target_year_term) {
      return badRequest('target_year_term is required when target_type is SECTION');
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        type,
        title,
        body: notifBody,
        target_type,
        target_value: body.target_value ?? null,
        target_year_term: body.target_year_term ?? null,
        created_by,
        created_by_role,
        metadata: body.metadata ?? {},
        expires_at: body.expires_at ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return created(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create notification';
    return internalError(msg);
  }
}

// ── PATCH /api/notifications — Mark notifications as read ─────────────────────
// Body: { user_id, notification_ids: string[] }  OR  { user_id, mark_all: true }

export async function PATCH(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { user_id, notification_ids, mark_all } = body;

    if (!user_id) return badRequest('user_id is required');
    if (!mark_all && (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0)) {
      return badRequest('Either mark_all:true or notification_ids[] is required');
    }

    if (mark_all) {
      // Fetch all visible notification IDs for user then mark all as read
      // We call the GET logic inline — simpler: just upsert for all IDs from a sub-select
      // Since RLS handles visibility, we can do a bulk delete-then-insert
      // Easier: get IDs from the GET handler first, or use a stored procedure
      // For simplicity, fetch ids first:
      const visibleRes = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/notifications?user_id=${user_id}&limit=500`,
        { method: 'GET' }
      );
      if (visibleRes.ok) {
        const visibleData = await visibleRes.json() as { notifications: { id: string; is_read: boolean }[] };
        const unreadIds = visibleData.notifications
          .filter((n) => !n.is_read)
          .map((n) => n.id);

        if (unreadIds.length > 0) {
          const rows = unreadIds.map((id: string) => ({ notification_id: id, user_id }));
          await supabase.from('notification_reads').upsert(rows, { onConflict: 'notification_id,user_id' });
        }
      }
      return noContent();
    }

    const rows = (notification_ids as string[]).map((id) => ({ notification_id: id, user_id }));
    const { error } = await supabase
      .from('notification_reads')
      .upsert(rows, { onConflict: 'notification_id,user_id' });

    if (error) throw error;
    return noContent();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to mark notifications as read';
    return internalError(msg);
  }
}
