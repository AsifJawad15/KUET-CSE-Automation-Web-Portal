import { NextRequest, NextResponse } from 'next/server';

import { dispatchPendingPushNotifications } from '@/lib/pushDispatch';
import { getSessionFromRequest, isAdminLike } from '@/lib/serverAuth';

function isAuthorized(request: NextRequest): boolean {
  const session = getSessionFromRequest(request);
  if (session && isAdminLike(session.role)) return true;

  const key = process.env.NOTIFICATION_DISPATCH_KEY || process.env.NOTIFICATION_CRON_KEY || process.env.CRON_SECRET;
  if (!key) return false;

  const authorization = request.headers.get('authorization');
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
  const provided =
    request.headers.get('x-notification-dispatch-key') ||
    request.headers.get('x-notification-cron-key') ||
    bearerToken ||
    new URL(request.url).searchParams.get('key');
  return provided === key;
}

async function handleDispatch(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized push dispatch request' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedBatch = Number(searchParams.get('batch') || '40');
    const batchSize = Number.isFinite(requestedBatch) ? Math.min(Math.max(1, Math.floor(requestedBatch)), 200) : 40;

    const result = await dispatchPendingPushNotifications(batchSize);
    return NextResponse.json({ success: true, ...result, batch_size: batchSize });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Push dispatch failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleDispatch(request);
}

export async function POST(request: NextRequest) {
  return handleDispatch(request);
}
