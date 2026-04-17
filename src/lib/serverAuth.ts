import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { forbidden, serviceUnavailable, unauthorized } from './apiResponse';

export type ServerUserRole = 'admin' | 'teacher' | 'student' | 'head' | 'staff';

export interface ServerSessionUser {
  id: string;
  email: string;
  name: string;
  role: ServerUserRole;
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

  if (process.env.NODE_ENV !== 'production') {
    return 'kuet-dev-session-secret-change-before-production';
  }

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
    throw new Error('AUTH_SESSION_SECRET is required in production');
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

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = signPayload(payload, secret);
  if (!signaturesMatch(signature, expected)) return null;

  const decoded = decodePayload(payload);
  if (!decoded || decoded.exp <= Math.floor(Date.now() / 1000)) return null;

  return {
    id: decoded.id,
    email: decoded.email,
    name: decoded.name,
    role: decoded.role,
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

export function requireServerSession(
  request: NextRequest,
  options: { adminLike?: boolean; roles?: ServerUserRole[] } = {},
): { user: ServerSessionUser; response?: never } | { user?: never; response: NextResponse } {
  if (!getSessionSecret()) {
    return {
      response: serviceUnavailable(
        'AUTH_SESSION_SECRET is required before protected API routes can be used.',
      ),
    };
  }

  const user = getSessionFromRequest(request);
  if (!user) return { response: unauthorized('Authentication required') };

  if (options.adminLike && !isAdminLike(user.role)) {
    return { response: forbidden('Admin or Head access required') };
  }

  if (options.roles && !options.roles.includes(user.role)) {
    return { response: forbidden('Insufficient permissions') };
  }

  return { user };
}
