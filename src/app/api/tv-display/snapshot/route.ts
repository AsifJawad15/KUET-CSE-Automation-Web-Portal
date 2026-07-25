import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import {
  TV_DISPLAY_TIME_ZONE,
  TV_SNAPSHOT_SCHEMA_VERSION,
  getZonedDateKey,
  isSafeTvTarget,
  parseSnapshotSections,
  type TvSnapshotSection,
  type TvSnapshotV2,
} from '../../../../../shared/tv-display/domain';
import { cmsSupabase } from '@/services/cmsService';
import { resolveTvScheduleRange } from '@/services/tvScheduleResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, If-None-Match',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function revision(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unavailable';
}

function responseHeaders(etag: string): HeadersInit {
  return {
    ETag: etag,
    'Cache-Control': 'private, no-cache, must-revalidate',
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  };
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('target')?.trim() ?? '';
  if (!target || !isSafeTvTarget(target)) {
    return NextResponse.json(
      { error: 'A valid target is required.' },
      { status: 400 },
    );
  }

  const rawInclude = request.nextUrl.searchParams.get('include');
  const sections = parseSnapshotSections(rawInclude);
  const requestedSections = rawInclude
    ? rawInclude.split(',').map((value) => value.trim()).filter(Boolean)
    : [];
  if (
    rawInclude &&
    (sections.size === 0 || requestedSections.some((value) => !sections.has(value as TvSnapshotSection)))
  ) {
    return NextResponse.json({ error: 'One or more snapshot sections are unsupported.' }, { status: 400 });
  }

  const snapshot: TvSnapshotV2 = {
    schemaVersion: TV_SNAPSHOT_SCHEMA_VERSION,
    target,
    generatedAt: new Date().toISOString(),
    timezone: TV_DISPLAY_TIME_ZONE,
    revisions: {},
  };
  const errors: Partial<Record<TvSnapshotSection, string>> = {};
  const content: NonNullable<TvSnapshotV2['content']> = {};

  const tasks: Array<Promise<void>> = [];

  if (sections.has('announcements')) {
    tasks.push((async () => {
      const query = cmsSupabase
        .from('cms_tv_announcements')
        .select('*')
        .eq('is_active', true)
        .in('target', target === 'all' ? ['all'] : [target, 'all'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      content.announcements = data ?? [];
      snapshot.revisions.announcements = revision(content.announcements);
    })().catch((error) => { errors.announcements = errorMessage(error); }));
  }

  if (sections.has('ticker')) {
    tasks.push((async () => {
      const { data, error } = await cmsSupabase
        .from('cms_tv_ticker')
        .select('*')
        .eq('is_active', true)
        .in('target', target === 'all' ? ['all'] : [target, 'all'])
        .order('sort_order', { ascending: true });
      if (error) throw error;
      content.ticker = data ?? [];
      snapshot.revisions.ticker = revision(content.ticker);
    })().catch((error) => { errors.ticker = errorMessage(error); }));
  }

  if (sections.has('events')) {
    tasks.push((async () => {
      const { data, error } = await cmsSupabase
        .from('cms_tv_events')
        .select('*')
        .eq('is_active', true)
        .in('target', target === 'all' ? ['all'] : [target, 'all'])
        .order('display_order', { ascending: true });
      if (error) throw error;
      content.events = data ?? [];
      snapshot.revisions.events = revision(content.events);
    })().catch((error) => { errors.events = errorMessage(error); }));
  }

  if (sections.has('settings')) {
    tasks.push((async () => {
      const { data, error } = await cmsSupabase.from('cms_tv_settings').select('key,value');
      if (error) throw error;
      content.settings = Object.fromEntries(
        (data ?? []).map((row) => [String(row.key), String(row.value)]),
      );
      snapshot.revisions.settings = revision(content.settings);
    })().catch((error) => { errors.settings = errorMessage(error); }));
  }

  if (sections.has('device')) {
    tasks.push((async () => {
      if (target === 'all') {
        snapshot.device = null;
      } else {
        const { data, error } = await cmsSupabase
          .from('cms_tv_devices')
          .select('name,label,location,show_room_schedule')
          .eq('name', target)
          .eq('is_active', true)
          .maybeSingle();
        if (error) throw error;
        snapshot.device = data
          ? {
              name: String(data.name),
              label: data.label ? String(data.label) : null,
              location: data.location ? String(data.location) : null,
              showRoomSchedule: data.show_room_schedule !== false,
            }
          : null;
      }
      snapshot.revisions.device = revision(snapshot.device);
    })().catch((error) => { errors.device = errorMessage(error); }));
  }

  if (sections.has('schedule')) {
    tasks.push((async () => {
      snapshot.schedule = await resolveTvScheduleRange(
        getZonedDateKey(new Date(), TV_DISPLAY_TIME_ZONE),
        14,
      );
      snapshot.revisions.schedule = revision(snapshot.schedule);
    })().catch((error) => { errors.schedule = errorMessage(error); }));
  }

  await Promise.all(tasks);

  if (Object.keys(content).length > 0) snapshot.content = content;
  if (Object.keys(errors).length > 0) snapshot.errors = errors;

  const etag = `"${revision({
    target: snapshot.target,
    revisions: snapshot.revisions,
    errors: snapshot.errors,
  })}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: responseHeaders(etag) });
  }

  return new NextResponse(JSON.stringify(snapshot), {
    status: 200,
    headers: responseHeaders(etag),
  });
}
