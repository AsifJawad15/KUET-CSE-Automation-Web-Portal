// ==========================================
// API: /api/notifications
// Handles fetching, creating, and marking notifications as read
// ==========================================

import { badRequest, created, guardSupabase, internalError, noContent } from '@/lib/apiResponse';
import { createNotification } from '@/lib/notifications';
import { requireServerSession } from '@/lib/serverAuth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { requireFields } from '@/lib/validators';
import { NextRequest, NextResponse } from 'next/server';
import { withAdminRateLimit } from '@/lib/withRateLimit';

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
  | 'course_assigned'
  | 'room_request_submitted'
  | 'cr_room_request_submitted'
  | 'attendance_marking_reminder'
  | 'course_anomaly_alert';

// ── Shared visibility checking helper ──────────────────────────────────────────

export async function getVisibleNotifications(
  user_id: string,
  limit: number,
  offset: number,
  unread_only: boolean
) {
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

  return {
    notifications: paginated,
    unread_count: annotated.filter((n) => !n.is_read).length,
  };
}

// ── GET /api/notifications ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = requireServerSession(request);
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const user_id = auth.user.id;
    const unread_only = searchParams.get('unread_only') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!user_id) return badRequest('user_id is required');

    const result = await getVisibleNotifications(user_id, limit, offset, unread_only);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch notifications';
    return internalError(msg);
  }
}

// ── POST /api/notifications — Create a notification ───────────────────────────

export const POST = withAdminRateLimit(async function POST(request: NextRequest) {
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();

    const { type, title, body: notifBody, target_type } = body;
    const validation = requireFields({ type, title, body: notifBody, target_type });
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

    const notificationId = await createNotification({
      type,
      title,
      body: notifBody,
      target_type,
      target_value: body.target_value ?? null,
      target_year_term: body.target_year_term ?? null,
      created_by: auth.user.id,
      created_by_role: 'ADMIN',
      metadata: body.metadata ?? {},
      expires_at: body.expires_at ?? null,
      dedupeKey: body.dedupe_key,
    });

    if (!notificationId) {
      throw new Error('Notification could not be created');
    }

    return created({ id: notificationId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create notification';
    return internalError(msg);
  }
});

// ── PATCH /api/notifications — Mark notifications as read ─────────────────────

export async function PATCH(request: NextRequest) {
  const auth = requireServerSession(request);
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { notification_ids, mark_all } = body;
    const user_id = auth.user.id;

    if (!mark_all && (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0)) {
      return badRequest('Either mark_all:true or notification_ids[] is required');
    }

    if (mark_all) {
      const visibleData = await getVisibleNotifications(user_id, 500, 0, false);
      const unreadIds = visibleData.notifications
        .filter((n: any) => !n.is_read)
        .map((n: any) => n.id as string);

      if (unreadIds.length > 0) {
        const rows = unreadIds.map((id: string) => ({ notification_id: id, user_id }));
        await supabase.from('notification_reads').upsert(rows, { onConflict: 'notification_id,user_id' });
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
