import { canNotify } from '@/lib/notificationAudience';
import { forbidden } from '@/lib/apiResponse';
import { getSupabaseUser } from '@/lib/supabaseUser';
// ==========================================
// API: /api/notifications
// Handles fetching, creating, and marking notifications as read
// ==========================================

import { badRequest, created, guardSupabase, internalError, noContent } from '@/lib/apiResponse';
import { createNotification } from '@/lib/notifications';
import { requireServerSession } from '@/lib/serverAuth';
import { isSupabaseConfigured } from '@/lib/supabaseServer';
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
  const db = getSupabaseUser(user_id);
  const { data: readData, error: readError } = await db.from('notification_reads').select('notification_id').eq('user_id', user_id);
  if (readError) throw readError;
  const readIds = new Set((readData ?? []).map(r => r.notification_id));
  let query = db.from('notifications').select('*').order('created_at', { ascending: false });
  if (unread_only && readIds.size) query = query.not('id', 'in', `(${[...readIds].join(',')})`);
  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  const { data: unreadCount, error: countError } = await db.rpc('notification_unread_count');
  if (countError) throw countError;
  return { notifications: (data ?? []).map(n => ({ ...n, is_read: readIds.has(n.id) })),
    unread_count: Number(unreadCount ?? 0) };
}

export async function GET(request: NextRequest) {
  const auth = await requireServerSession(request);
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const user_id = auth.user.id;
    const unread_only = searchParams.get('unread_only') === 'true';
    const limit = Math.min(Math.max(Math.floor(Number(searchParams.get('limit'))) || 50, 1), 100);
    const offset = Math.max(Math.floor(Number(searchParams.get('offset'))) || 0, 0);

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
  const auth = await requireServerSession(request);
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();

    const { type, title, body: notifBody, target_type } = body;
    const validation = requireFields({ type, title, body: notifBody, target_type });
    if (!validation.valid) return badRequest(validation.error!);

    if (typeof title !== 'string' || title.length > 200 || typeof notifBody !== 'string' || notifBody.length > 5000 || typeof type !== 'string') return badRequest('Invalid notification content');
    if (!await canNotify(auth.user, body)) return forbidden('This audience is outside your assigned scope');

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
      created_by_role: auth.user.role === 'student' ? 'STUDENT_CR' : auth.user.role === 'teacher' ? 'TEACHER' : 'ADMIN',
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
  const auth = await requireServerSession(request);
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const supabase = getSupabaseUser(auth.user.id);
    const body = await request.json();
    const { notification_ids, mark_all } = body;
    const user_id = auth.user.id;

    if (!mark_all && (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0)) {
      return badRequest('Either mark_all:true or notification_ids[] is required');
    }

    if (mark_all) {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;
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
