// ==========================================
// Shared API Response Helpers
// Single Responsibility: Standardized HTTP responses
// All API routes use these instead of scattered NextResponse.json() calls
// ==========================================

import { NextResponse } from 'next/server';

// ── Response Types ─────────────────────────────────

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ── Success Responses ──────────────────────────────

/** 200 OK with JSON body */
export function ok<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true as const, data }, { status: 200 });
}

/** 201 Created with JSON body */
export function created<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true as const, data }, { status: 201 });
}

/** 204 No Content (for DELETE) */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ── Client Error Responses ─────────────────────────

/** 400 Bad Request */
export function badRequest(error: string): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ success: false as const, error }, { status: 400 });
}

/** 401 Unauthorized */
export function unauthorized(error = 'Authentication required'): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ success: false as const, error }, { status: 401 });
}

/** 403 Forbidden */
export function forbidden(error = 'Insufficient permissions'): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ success: false as const, error }, { status: 403 });
}

/** 404 Not Found */
export function notFound(error = 'Resource not found'): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ success: false as const, error }, { status: 404 });
}

/** 409 Conflict (duplicate) */
export function conflict(error: string): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ success: false as const, error }, { status: 409 });
}

// ── Server Error Responses ─────────────────────────

/** 500 Internal Server Error */
export function internalError(error = 'Internal server error'): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ success: false as const, error }, { status: 500 });
}

/** 503 Service Unavailable */
export function serviceUnavailable(error = 'Service unavailable'): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ success: false as const, error }, { status: 503 });
}

// ── Guards ──────────────────────────────────────────

/**
 * Returns a 503 response if Supabase is not configured, otherwise null.
 * Use at the top of every API handler:
 *   const guard = guardSupabase(isSupabaseConfigured());
 *   if (guard) return guard;
 */
export function guardSupabase(configured: boolean): NextResponse<ApiErrorResponse> | null {
  if (!configured) {
    return serviceUnavailable('Database not configured. Please set up Supabase environment variables.');
  }
  return null;
}
