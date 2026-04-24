import { createSign } from 'crypto';

interface CachedAccessToken {
  value: string;
  expiresAt: number;
}

export interface FcmSendResult {
  token: string;
  success: boolean;
  error?: string;
  permanentFailure?: boolean;
}

let cachedAccessToken: CachedAccessToken | null = null;

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
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for FCM push dispatch`);
  return normalizeEnvValue(value);
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function getPrivateKey(): string {
  return requireEnv('FCM_PRIVATE_KEY').replace(/\\n/g, '\n');
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60 > now) {
    return cachedAccessToken.value;
  }

  const clientEmail = requireEnv('FCM_CLIENT_EMAIL');
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const claim = base64UrlJson({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const unsignedJwt = `${header}.${claim}`;
  const signature = createSign('RSA-SHA256')
    .update(unsignedJwt)
    .sign(getPrivateKey(), 'base64url');
  const assertion = `${unsignedJwt}.${signature}`;

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
    throw new Error(`Failed to get FCM access token: ${response.status} ${JSON.stringify(json)}`);
  }

  cachedAccessToken = {
    value: json.access_token as string,
    expiresAt: now + Number(json.expires_in || 3600),
  };
  return cachedAccessToken.value;
}

function toFcmData(data: Record<string, unknown>): Record<string, string> {
  return Object.entries(data).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    acc[key] = typeof value === 'string' ? value : JSON.stringify(value);
    return acc;
  }, {});
}

function isPermanentFailure(status: string | undefined, body: string): boolean {
  return (
    status === 'NOT_FOUND' ||
    status === 'UNREGISTERED' ||
    body.includes('UNREGISTERED') ||
    body.includes('registration token is not a valid')
  );
}

async function sendOneFcmMessage(input: {
  token: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}): Promise<FcmSendResult> {
  const projectId = requireEnv('FCM_PROJECT_ID');
  const accessToken = await getAccessToken();

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: input.token,
          notification: {
            title: input.title,
            body: input.body,
          },
          data: toFcmData({
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            target_screen: 'notification_inbox',
            ...input.data,
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

  if (response.ok) {
    return { token: input.token, success: true };
  }

  const text = await response.text();
  let status: string | undefined;
  try {
    status = (JSON.parse(text).error?.status as string | undefined) || undefined;
  } catch {
    status = undefined;
  }

  return {
    token: input.token,
    success: false,
    error: `FCM ${response.status}: ${text}`,
    permanentFailure: isPermanentFailure(status, text),
  };
}

export async function sendFcmMessages(input: {
  tokens: string[];
  title: string;
  body: string;
  data: Record<string, unknown>;
  concurrency?: number;
}): Promise<FcmSendResult[]> {
  const tokens = [...new Set(input.tokens.map((token) => token.trim()).filter(Boolean))];
  const concurrency = Math.max(1, Math.min(input.concurrency || 20, 50));
  const results: FcmSendResult[] = [];

  for (let index = 0; index < tokens.length; index += concurrency) {
    const chunk = tokens.slice(index, index + concurrency);
    const chunkResults = await Promise.all(
      chunk.map((token) =>
        sendOneFcmMessage({
          token,
          title: input.title,
          body: input.body,
          data: input.data,
        }),
      ),
    );
    results.push(...chunkResults);
  }

  return results;
}
