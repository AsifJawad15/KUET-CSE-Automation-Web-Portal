import { getSupabaseAdmin } from './supabaseAdmin';
import { sendFcmMessages } from './fcm';

type TargetType = 'ALL' | 'ROLE' | 'YEAR_TERM' | 'SECTION' | 'COURSE' | 'USER';

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  target_type: TargetType;
  target_value: string | null;
  target_year_term: string | null;
  metadata: Record<string, unknown> | null;
};

type OutboxRow = {
  id: string;
  notification_id: string;
  attempts: number;
  notifications: NotificationRow | NotificationRow[] | null;
};

type DeviceTokenRow = {
  id: string;
  user_id: string;
  token: string;
};

type CourseOfferingRecipientRow = {
  id?: string | null;
  term?: string | null;
  section?: string | null;
  teacher_user_id?: string | null;
};

function normalizeNotification(row: OutboxRow): NotificationRow | null {
  const value = row.notifications;
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function uniq(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function expandRole(role: string): string[] {
  const normalized = role.trim().toUpperCase();
  if (normalized === 'ADMIN') return ['ADMIN', 'HEAD'];
  if (normalized === 'TEACHER') return ['TEACHER', 'HEAD'];
  return [normalized];
}

async function resolveRecipients(target: NotificationRow): Promise<string[]> {
  const db = getSupabaseAdmin();

  switch (target.target_type) {
    case 'ALL': {
      const { data, error } = await db
        .from('profiles')
        .select('user_id')
        .eq('is_active', true)
        .in('role', ['STUDENT', 'TEACHER', 'ADMIN', 'HEAD']);
      if (error) throw error;
      return uniq((data ?? []).map((row: { user_id: string }) => row.user_id));
    }
    case 'ROLE': {
      if (!target.target_value) return [];
      const { data, error } = await db
        .from('profiles')
        .select('user_id')
        .in('role', expandRole(target.target_value))
        .eq('is_active', true);
      if (error) throw error;
      return uniq((data ?? []).map((row: { user_id: string }) => row.user_id));
    }
    case 'YEAR_TERM': {
      if (!target.target_value) return [];
      const { data, error } = await db
        .from('students')
        .select('user_id')
        .eq('term', target.target_value);
      if (error) throw error;
      return uniq((data ?? []).map((row: { user_id: string }) => row.user_id));
    }
    case 'SECTION': {
      if (!target.target_value || !target.target_year_term) return [];
      const { data, error } = await db
        .from('students')
        .select('user_id')
        .eq('term', target.target_year_term)
        .eq('section', target.target_value);
      if (error) throw error;
      return uniq((data ?? []).map((row: { user_id: string }) => row.user_id));
    }
    case 'COURSE': {
      if (!target.target_value) return [];

      let offeringQuery = db
        .from('course_offerings')
        .select('id, term, section, teacher_user_id, courses!inner(code)')
        .eq('courses.code', target.target_value)
        .eq('is_active', true);

      if (target.target_year_term) {
        offeringQuery = offeringQuery.eq('term', target.target_year_term);
      }

      const { data: offerings, error: offeringError } = await offeringQuery;
      if (offeringError) throw offeringError;

      const teacherIds = (offerings ?? [])
        .map((row: { teacher_user_id?: string | null }) => row.teacher_user_id?.trim())
        .filter((id): id is string => !!id);
      const recipients = new Set<string>(teacherIds);

      const offeringIds = uniq((offerings ?? [])
        .map((row: CourseOfferingRecipientRow) => row.id?.trim() || ''));
      if (offeringIds.length > 0) {
        const { data: enrollments, error: enrollmentError } = await db
          .from('enrollments')
          .select('student_user_id')
          .in('offering_id', offeringIds);
        if (enrollmentError) throw enrollmentError;

        for (const row of enrollments ?? []) {
          const userId = row.student_user_id?.trim();
          if (userId) recipients.add(userId);
        }
      }

      const pairs = uniq((offerings ?? []).map((row: { term?: string | null; section?: string | null }) => {
        const term = row.term?.trim() || '';
        const section = row.section?.trim() || '';
        return term ? `${term}::${section}` : '';
      }));

      for (const pair of pairs) {
        const [term, section] = pair.split('::');
        let studentQuery = db
          .from('students')
          .select('user_id')
          .eq('term', term);
        if (section) {
          studentQuery = studentQuery.eq('section', section);
        }
        const { data: students, error: studentError } = await studentQuery;
        if (studentError) throw studentError;
        for (const row of students ?? []) {
          if (row.user_id?.trim()) recipients.add(row.user_id);
        }
      }
      return [...recipients];
    }
    case 'USER': {
      return target.target_value ? [target.target_value] : [];
    }
    default:
      return [];
  }
}

async function loadActiveFcmTokens(userIds: string[]): Promise<DeviceTokenRow[]> {
  if (userIds.length === 0) return [];

  const db = getSupabaseAdmin();
  const rows: DeviceTokenRow[] = [];
  const chunkSize = 500;

  for (let index = 0; index < userIds.length; index += chunkSize) {
    const chunk = userIds.slice(index, index + chunkSize);
    const { data, error } = await db
      .from('device_push_tokens')
      .select('id, user_id, token')
      .in('user_id', chunk)
      .eq('provider', 'fcm')
      .eq('is_active', true);

    if (error) throw error;
    rows.push(...((data ?? []) as DeviceTokenRow[]));
  }

  return rows;
}

async function deactivateTokens(tokenIds: string[]) {
  if (tokenIds.length === 0) return;

  await getSupabaseAdmin()
    .from('device_push_tokens')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .in('id', tokenIds);
}

async function markOutboxSent(outboxId: string) {
  await getSupabaseAdmin()
    .from('notification_push_outbox')
    .update({
      status: 'sent',
      attempts: 0,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', outboxId);
}

async function markOutboxFailed(outboxId: string, attempts: number, message: string) {
  const nextDelayMinutes = Math.min(60, Math.pow(2, Math.max(0, attempts - 1)));
  const nextAttemptAt = new Date(Date.now() + nextDelayMinutes * 60_000).toISOString();

  await getSupabaseAdmin()
    .from('notification_push_outbox')
    .update({
      status: attempts >= 8 ? 'failed' : 'pending',
      attempts,
      last_error: message.slice(0, 1200),
      next_attempt_at: nextAttemptAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', outboxId);
}

export async function dispatchPendingPushNotifications(
  batchSize = 40,
): Promise<{ processed: number; sent: number; failed: number; tokens: number }> {
  const db = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await db
    .from('notification_push_outbox')
    .update({ status: 'pending', updated_at: nowIso })
    .eq('status', 'processing')
    .lt('updated_at', staleThreshold);

  const { data, error } = await db
    .from('notification_push_outbox')
    .select(`
      id,
      notification_id,
      attempts,
      notifications!inner(
        id,
        type,
        title,
        body,
        target_type,
        target_value,
        target_year_term,
        metadata
      )
    `)
    .eq('status', 'pending')
    .lte('next_attempt_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (error) throw error;

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let tokens = 0;

  for (const outboxRow of (data ?? []) as OutboxRow[]) {
    processed += 1;

    const { data: claimResult } = await db
      .from('notification_push_outbox')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', outboxRow.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (!claimResult) continue;

    try {
      const notification = normalizeNotification(outboxRow);
      if (!notification) {
        await markOutboxSent(outboxRow.id);
        sent += 1;
        continue;
      }

      const recipients = await resolveRecipients(notification);
      const tokenRows = await loadActiveFcmTokens(recipients);
      const uniqueTokenRows = new Map<string, DeviceTokenRow>();
      for (const row of tokenRows) {
        uniqueTokenRows.set(row.token, row);
      }

      if (uniqueTokenRows.size === 0) {
        await markOutboxSent(outboxRow.id);
        sent += 1;
        continue;
      }

      const results = await sendFcmMessages({
        tokens: [...uniqueTokenRows.keys()],
        title: notification.title,
        body: notification.body,
        data: {
          notification_id: notification.id,
          type: notification.type,
          ...(notification.metadata ?? {}),
        },
      });

      tokens += results.length;

      const invalidTokenIds = results
        .filter((result) => !result.success && result.permanentFailure)
        .map((result) => uniqueTokenRows.get(result.token)?.id)
        .filter((id): id is string => !!id);
      await deactivateTokens(invalidTokenIds);

      const successCount = results.filter((result) => result.success).length;
      if (successCount > 0 || results.every((result) => result.permanentFailure)) {
        await markOutboxSent(outboxRow.id);
        sent += 1;
      } else {
        const firstError = results.find((result) => !result.success)?.error || 'FCM dispatch failed';
        throw new Error(firstError);
      }
    } catch (err) {
      failed += 1;
      const attempts = (outboxRow.attempts || 0) + 1;
      const message = err instanceof Error ? err.message : 'Unknown push dispatch error';
      await markOutboxFailed(outboxRow.id, attempts, message);
    }
  }

  return { processed, sent, failed, tokens };
}
