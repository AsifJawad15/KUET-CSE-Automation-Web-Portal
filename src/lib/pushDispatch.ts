import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalizeNotification(row: OutboxRow): NotificationRow | null {
  const value = row.notifications;
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function uniq(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

async function resolveRecipients(target: NotificationRow): Promise<string[]> {
  switch (target.target_type) {
    case 'ALL': {
      const { data, error } = await db
        .from('profiles')
        .select('user_id')
        .eq('is_active', true);
      if (error) throw error;
      return uniq((data ?? []).map((row: { user_id: string }) => row.user_id));
    }
    case 'ROLE': {
      if (!target.target_value) return [];
      const { data, error } = await db
        .from('profiles')
        .select('user_id')
        .eq('role', target.target_value)
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
        .select('term, section, teacher_user_id, courses!inner(code)')
        .eq('courses.code', target.target_value)
        .eq('is_active', true);

      if (target.target_year_term) {
        offeringQuery = offeringQuery.eq('term', target.target_year_term);
      }

      const { data: offerings, error: offeringError } = await offeringQuery;
      if (offeringError) throw offeringError;

      // Collect teacher user IDs from course offerings
      const teacherIds = (offerings ?? [])
        .map((row: { teacher_user_id?: string | null }) => row.teacher_user_id?.trim())
        .filter((id): id is string => !!id);

      const pairs = uniq((offerings ?? []).map((row: { term?: string | null; section?: string | null }) => {
        const term = row.term?.trim() || '';
        const section = row.section?.trim() || '';
        return term && section ? `${term}::${section}` : '';
      }));

      const recipients: string[] = [...teacherIds];
      for (const pair of pairs) {
        const [term, section] = pair.split('::');
        const { data: students, error: studentError } = await db
          .from('students')
          .select('user_id')
          .eq('term', term)
          .eq('section', section);
        if (studentError) throw studentError;
        recipients.push(...(students ?? []).map((row: { user_id: string }) => row.user_id));
      }
      return uniq(recipients);
    }
    case 'USER': {
      return target.target_value ? [target.target_value] : [];
    }
    default:
      return [];
  }
}

async function sendOneSignalPush(opts: {
  userIds: string[];
  title: string;
  body: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    throw new Error('Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY');
  }

  const chunkSize = 2000;
  for (let i = 0; i < opts.userIds.length; i += chunkSize) {
    const chunk = opts.userIds.slice(i, i + chunkSize);

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: 'push',
        include_aliases: {
          external_id: chunk,
        },
        headings: { en: opts.title },
        contents: { en: opts.body },
        data: opts.data,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`OneSignal push failed: ${response.status} ${responseText}`);
    }
  }
}

async function markOutboxSent(outboxId: string) {
  await db
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

  await db
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

export async function dispatchPendingPushNotifications(batchSize = 40): Promise<{ processed: number; sent: number; failed: number }> {
  const nowIso = new Date().toISOString();

  // Reset rows stuck in 'processing' for more than 5 minutes (server crash recovery)
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
      if (recipients.length === 0) {
        await markOutboxSent(outboxRow.id);
        sent += 1;
        continue;
      }

      await sendOneSignalPush({
        userIds: recipients,
        title: notification.title,
        body: notification.body,
        data: {
          notification_id: notification.id,
          type: notification.type,
          ...(notification.metadata ?? {}),
        },
      });

      await markOutboxSent(outboxRow.id);
      sent += 1;
    } catch (err) {
      failed += 1;
      const attempts = (outboxRow.attempts || 0) + 1;
      const message = err instanceof Error ? err.message : 'Unknown push dispatch error';
      await markOutboxFailed(outboxRow.id, attempts, message);
    }
  }

  return { processed, sent, failed };
}
