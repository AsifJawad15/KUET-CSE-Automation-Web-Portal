import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';

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

type DeviceTokenRow = {
  id: string;
  token: string;
};

type CourseOfferingRecipientRow = {
  id?: string | null;
  term?: string | null;
  section?: string | null;
  teacher_user_id?: string | null;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-notification-dispatch-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is required`);
  return normalizeEnvValue(value);
}

function getPrivateKey(): string {
  return requireEnv('FCM_PRIVATE_KEY').replace(/\\n/g, '\n');
}

function base64UrlBytes(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function base64UrlJson(value: unknown): string {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function signJwt(unsignedJwt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(getPrivateKey()),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedJwt),
  );
  return base64UrlBytes(new Uint8Array(signature));
}

async function getFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) {
    return cachedToken.value;
  }

  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const claim = base64UrlJson({
    iss: requireEnv('FCM_CLIENT_EMAIL'),
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const unsignedJwt = `${header}.${claim}`;
  const assertion = `${unsignedJwt}.${await signJwt(unsignedJwt)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) {
    throw new Error(`FCM OAuth failed: ${response.status} ${JSON.stringify(json)}`);
  }

  cachedToken = {
    value: json.access_token,
    expiresAt: now + Number(json.expires_in || 3600),
  };
  return cachedToken.value;
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

function toFcmData(data: Record<string, unknown>): Record<string, string> {
  return Object.entries(data).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === null || value === undefined) return acc;
    acc[key] = typeof value === 'string' ? value : JSON.stringify(value);
    return acc;
  }, {});
}

function isPermanentFailure(status: string | undefined, body: string): boolean {
  return status === 'NOT_FOUND' || status === 'UNREGISTERED' || body.includes('UNREGISTERED');
}

async function resolveRecipients(db: ReturnType<typeof createClient>, notification: NotificationRow): Promise<string[]> {
  switch (notification.target_type) {
    case 'ALL': {
      const { data, error } = await db
        .from('profiles')
        .select('user_id')
        .eq('is_active', true)
        .in('role', ['STUDENT', 'TEACHER', 'ADMIN', 'HEAD']);
      if (error) throw error;
      return uniq((data || []).map((row) => row.user_id));
    }
    case 'ROLE': {
      if (!notification.target_value) return [];
      const { data, error } = await db
        .from('profiles')
        .select('user_id')
        .eq('is_active', true)
        .in('role', expandRole(notification.target_value));
      if (error) throw error;
      return uniq((data || []).map((row) => row.user_id));
    }
    case 'YEAR_TERM': {
      if (!notification.target_value) return [];
      const { data, error } = await db
        .from('students')
        .select('user_id')
        .eq('term', notification.target_value);
      if (error) throw error;
      return uniq((data || []).map((row) => row.user_id));
    }
    case 'SECTION': {
      if (!notification.target_value || !notification.target_year_term) return [];
      const { data, error } = await db
        .from('students')
        .select('user_id')
        .eq('term', notification.target_year_term)
        .eq('section', notification.target_value);
      if (error) throw error;
      return uniq((data || []).map((row) => row.user_id));
    }
    case 'COURSE': {
      if (!notification.target_value) return [];
      let query = db
        .from('course_offerings')
        .select('id, term, section, teacher_user_id, courses!inner(code)')
        .eq('courses.code', notification.target_value)
        .eq('is_active', true);
      if (notification.target_year_term) {
        query = query.eq('term', notification.target_year_term);
      }
      const { data: offerings, error } = await query;
      if (error) throw error;

      const recipients = new Set<string>();
      for (const offering of offerings || []) {
        if (offering.teacher_user_id) recipients.add(offering.teacher_user_id);
      }

      const offeringIds = uniq((offerings || [])
        .map((row: CourseOfferingRecipientRow) => row.id?.trim() || ''));
      if (offeringIds.length > 0) {
        const { data: enrollments, error: enrollmentError } = await db
          .from('enrollments')
          .select('student_user_id')
          .in('offering_id', offeringIds);
        if (enrollmentError) throw enrollmentError;
        for (const enrollment of enrollments || []) {
          if (enrollment.student_user_id) recipients.add(enrollment.student_user_id);
        }
      }

      const termSectionPairs = uniq((offerings || []).map((row: CourseOfferingRecipientRow) => {
        const term = row.term?.trim() || '';
        const section = row.section?.trim() || '';
        return term ? `${term}::${section}` : '';
      }));

      for (const pair of termSectionPairs) {
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
        for (const student of students || []) recipients.add(student.user_id);
      }
      return [...recipients];
    }
    case 'USER':
      return notification.target_value ? [notification.target_value] : [];
    default:
      return [];
  }
}

async function loadTokens(db: ReturnType<typeof createClient>, userIds: string[]): Promise<DeviceTokenRow[]> {
  if (userIds.length === 0) return [];
  const rows: DeviceTokenRow[] = [];
  for (let i = 0; i < userIds.length; i += 500) {
    const { data, error } = await db
      .from('device_push_tokens')
      .select('id, token')
      .in('user_id', userIds.slice(i, i + 500))
      .eq('provider', 'fcm')
      .eq('is_active', true);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

async function sendFcm(token: string, notification: NotificationRow): Promise<{ ok: boolean; permanent: boolean; error?: string }> {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${requireEnv('FCM_PROJECT_ID')}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await getFcmAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: notification.title,
            body: notification.body,
          },
          data: toFcmData({
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            target_screen: 'notification_inbox',
            notification_id: notification.id,
            type: notification.type,
            ...(notification.metadata || {}),
          }),
          android: {
            priority: 'high',
            notification: {
              channel_id: 'kuet_notifications',
              sound: 'default',
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
          },
        },
      }),
    },
  );

  if (response.ok) return { ok: true, permanent: false };

  const body = await response.text();
  let status: string | undefined;
  try {
    status = JSON.parse(body).error?.status;
  } catch {
    status = undefined;
  }
  return {
    ok: false,
    permanent: isPermanentFailure(status, body),
    error: `FCM ${response.status}: ${body}`,
  };
}

async function markOutbox(db: ReturnType<typeof createClient>, notificationId: string, status: string, error?: string) {
  const { error: outboxError } = await db
    .from('notification_push_outbox')
    .upsert(
      {
        notification_id: notificationId,
        status,
        last_error: error || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'notification_id' },
    );
  if (outboxError) {
    console.error('[send-push-notification] Failed to update outbox row:', outboxError.message);
  }
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'POST required' }, 405);
  }

  const rawDispatchSecret = Deno.env.get('NOTIFICATION_DISPATCH_KEY');
  const dispatchSecret = rawDispatchSecret ? normalizeEnvValue(rawDispatchSecret) : null;
  if (dispatchSecret) {
    const authHeader = request.headers.get('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const headerSecret = request.headers.get('x-notification-dispatch-key') || bearer;
    if (headerSecret !== dispatchSecret) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }
  }

  let notificationId: string | null = null;
  let stage = 'request';
  let db: ReturnType<typeof createClient> | null = null;

  try {
    const { notification_id } = await request.json();
    if (!notification_id || typeof notification_id !== 'string') {
      return jsonResponse({ success: false, error: 'notification_id is required' }, 400);
    }
    notificationId = notification_id;
    stage = 'database_client';

    db = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    stage = 'outbox_lookup';

    const { data: outboxRow } = await db
      .from('notification_push_outbox')
      .select('status')
      .eq('notification_id', notificationId)
      .maybeSingle();

    if (outboxRow?.status === 'sent') {
      return jsonResponse({
        success: true,
        notification_id: notificationId,
        already_sent: true,
      });
    }

    stage = 'outbox_mark_processing';
    await markOutbox(db, notificationId, 'processing');

    stage = 'notification_lookup';
    const { data: notification, error: notificationError } = await db
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single();
    if (notificationError) throw notificationError;

    stage = 'recipient_resolution';
    const recipients = await resolveRecipients(db, notification as NotificationRow);
    stage = 'token_load';
    const tokenRows = await loadTokens(db, recipients);
    const tokenMap = new Map<string, string>();
    for (const row of tokenRows) tokenMap.set(row.token, row.id);

    const results = [];
    stage = 'fcm_dispatch';
    for (const token of tokenMap.keys()) {
      results.push({ token, ...(await sendFcm(token, notification as NotificationRow)) });
    }

    const invalidIds = results
      .filter((result) => !result.ok && result.permanent)
      .map((result) => tokenMap.get(result.token))
      .filter((id): id is string => !!id);
    if (invalidIds.length > 0) {
      await db
        .from('device_push_tokens')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('id', invalidIds);
    }

    const successCount = results.filter((result) => result.ok).length;
    const failureCount = results.length - successCount;
    const transientFailure = results.find((result) => !result.ok && !result.permanent);
    await markOutbox(
      db,
      notificationId,
      transientFailure && successCount === 0 ? 'pending' : 'sent',
      transientFailure?.error,
    );

    return jsonResponse({
      success: true,
      notification_id: notificationId,
      recipients: recipients.length,
      tokens: results.length,
      success_count: successCount,
      failure_count: failureCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dispatch failed';
    console.error(`[send-push-notification] ${stage} failed:`, message);
    if (db && notificationId) {
      await markOutbox(db, notificationId, 'pending', `${stage}: ${message}`);
    }
    return jsonResponse({
      success: false,
      stage,
      notification_id: notificationId,
      error: message,
    }, 500);
  }
});
