import { adminRouteAllowed } from './serverAdminPermissions';
import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { forbidden, serviceUnavailable, unauthorized } from './apiResponse';
import { getSupabaseAdmin } from './supabaseAdmin';

export type ServerUserRole = 'admin' | 'teacher' | 'student' | 'head' | 'staff';

export interface ServerSessionUser {
  id: string;
  email: string;
  name: string;
  role: ServerUserRole;
  sessionVersion?: number;
  permissions?: {
    all?: boolean;
    menus?: string[];
    source?: string;
  } | null;
}

interface SessionPayload extends ServerSessionUser {
  iat: number;
  exp: number;
}

export const SESSION_COOKIE_NAME = 'kuet_session';

const SESSION_TTL_SECONDS = 60 * 60 * 10;

function getSessionSecret(): string | null {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;

  return null;
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(encoded: string): SessionPayload | null {
  try {
    return JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as SessionPayload;
  } catch {
    return null;
  }
}

function signaturesMatch(actual: string, expected: string): boolean {
  try {
    const actualBuffer = Buffer.from(actual, 'base64url');
    const expectedBuffer = Buffer.from(expected, 'base64url');
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  } catch {
    return false;
  }
}

export function createSessionToken(user: ServerSessionUser): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET is required');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = encodePayload({
    ...user,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  });
  const signature = signPayload(payload, secret);

  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string | undefined): ServerSessionUser | null {
  const secret = getSessionSecret();
  if (!secret || !token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const expected = signPayload(payload, secret);
  if (!signaturesMatch(signature, expected)) return null;

  const decoded = decodePayload(payload);
  const now = Math.floor(Date.now() / 1000);
  if (!decoded || !Number.isSafeInteger(decoded.exp) || !Number.isSafeInteger(decoded.iat) ||
      decoded.exp <= now || decoded.iat > now || decoded.exp <= decoded.iat ||
      typeof decoded.id !== 'string' || !decoded.id ||
      typeof decoded.email !== 'string' || typeof decoded.name !== 'string' ||
      !['admin', 'teacher', 'student', 'head', 'staff'].includes(decoded.role)) return null;

  return {
    id: decoded.id,
    email: decoded.email,
    name: decoded.name,
    role: decoded.role,
    sessionVersion: decoded.sessionVersion,
    permissions: decoded.permissions ?? null,
  };
}

export function getSessionFromRequest(request: NextRequest): ServerSessionUser | null {
  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authorization = request.headers.get('authorization');
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : undefined;

  return verifySessionToken(cookieToken || bearerToken);
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export function isAdminLike(role: ServerUserRole | null | undefined): boolean {
  return role === 'admin' || role === 'head';
}

export async function requireServerSession(
  request: NextRequest,
  options: { adminLike?: boolean; roles?: ServerUserRole[] } = {},
): Promise<{ user: ServerSessionUser; response?: never } | { user?: never; response: NextResponse }> {
  if (!getSessionSecret()) {
    return {
      response: serviceUnavailable(
        'AUTH_SESSION_SECRET is required before protected API routes can be used.',
      ),
    };
  }

  const user = getSessionFromRequest(request);
  if (!user) {
    return { response: unauthorized('Authentication required') };
  }

  // Check current account state on every protected request. A password change,
  // logout or role change invalidates already issued tokens.
  try {
    const { data: profile, error } = await getSupabaseAdmin().from('profiles')
      .select('is_active, role, session_version').eq('user_id', user.id).maybeSingle();
    if (error) return { response: serviceUnavailable('Account verification unavailable') };
    if (!profile?.is_active || profile.role.toLowerCase() !== user.role ||
        !Number.isSafeInteger(user.sessionVersion) || profile.session_version !== user.sessionVersion) {
      return { response: unauthorized('Session expired. Please sign in again.') };
    }
  } catch {
    return { response: serviceUnavailable('Account verification unavailable') };
  }

  if (user.role === 'admin') {
    try {
      const { data, error } = await getSupabaseAdmin().from('admins').select('permissions').eq('user_id', user.id).maybeSingle();
      if (error) return { response: serviceUnavailable('Permission verification unavailable') };
      user.permissions = data?.permissions ?? null;
      if (user.permissions && !user.permissions.all && !adminRouteAllowed(request.nextUrl.pathname, request.method, user.permissions.menus ?? [])) {
        return { response: forbidden('This administrative module is not assigned to your account') };
      }
    } catch { return { response: serviceUnavailable('Permission verification unavailable') }; }
  }

  if (options.adminLike && !isAdminLike(user.role)) {
    return { response: forbidden('Admin or Head access required') };
  }

  if (options.roles && !options.roles.includes(user.role)) {
    return { response: forbidden('Insufficient permissions') };
  }

  return { user };
}
