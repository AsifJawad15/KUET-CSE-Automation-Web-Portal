// ==========================================
// withAdminRateLimit — Higher-Order Function
// Wraps Next.js route handlers with the admin rate limiter.
// Applies ONLY to admin-facing routes, not public/home routes.
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { acquireSlot, getClientKey, getClientStats } from './rateLimiter';

type RouteHandler = (request: NextRequest, context?: unknown) => Promise<NextResponse> | NextResponse;

/**
 * Wrap any admin API route handler with the rate limiter.
 *
 * Usage:
 *   export const GET = withAdminRateLimit(async (request) => { ... });
 *   export const POST = withAdminRateLimit(async (request) => { ... });
 *
 * Behaviour:
 *   - If fewer than 15 concurrent requests: executes immediately.
 *   - If 15 slots are busy: waits in queue (up to 60 s).
 *   - If queue times out: returns 429 with Retry-After header.
 *   - All responses include X-RateLimit-* headers for transparency.
 */
export function withAdminRateLimit(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: unknown): Promise<NextResponse> => {
    const clientKey = getClientKey(request);
    const statsBefore = getClientStats(clientKey);

    // If already at limit, inform the client about queue position before waiting
    const isQueued = statsBefore.active >= statsBefore.limit;
    const queuePosition = isQueued ? statsBefore.queued + 1 : 0;

    const result = await acquireSlot(clientKey);

    if (!result.allowed) {
      // Queue timed out — return 429
      return NextResponse.json(
        {
          success: false,
          error: result.retryMessage ?? 'Too many requests. Please try again shortly.',
          rateLimited: true,
          queuePosition,
          estimatedWaitMs: result.estimatedWaitMs,
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': String(statsBefore.limit),
            'X-RateLimit-Queued': String(queuePosition),
          },
        },
      );
    }

    // If the request was queued (waited), send queue info back to client as headers
    // so client-side can decide to stop showing the loading state
    const wasQueued = isQueued;

    try {
      const response = await handler(request, context);

      // Clone response and inject rate-limit headers
      const statsAfter = getClientStats(clientKey);
      const headers = new Headers(response.headers);
      headers.set('X-RateLimit-Limit', String(statsBefore.limit));
      headers.set('X-RateLimit-Active', String(statsAfter.active));
      headers.set('X-RateLimit-Queued', String(statsAfter.queued));
      if (wasQueued) headers.set('X-RateLimit-Was-Queued', 'true');

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } finally {
      result.release?.();
    }
  };
}

/**
 * Returns a 429 response with queue metadata (for immediate rejection without waiting).
 * Used when the queue itself is full (optional hard cap on queue length).
 */
export function tooManyRequests(queuePosition: number, queuedCount: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Server is busy. Your request is queued.',
      rateLimited: true,
      queued: true,
      queuePosition,
      queuedCount,
      estimatedWaitMs: queuePosition * 2000,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((queuePosition * 2000) / 1000)),
        'Content-Type': 'application/json',
      },
    },
  );
}
