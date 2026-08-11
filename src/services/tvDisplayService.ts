// ==========================================
// TV Display Service — CMS Supabase data layer
// Single Responsibility: Only handles TV display CRUD
// Uses the CMS Supabase client (separate from academic DB)
// ==========================================

import { cmsSupabase } from '@/services/cmsService';
import type {
  CmsTvAnnouncement,
  CmsTvDevice,
  CmsTvEvent,
  CmsTvSetting,
  CmsTvTicker,
  TvDisplayData,
  TvTarget,
} from '@/types/cms';
import {
  clampSetting,
  isTvSnapshotV2,
  type TvSnapshotSection,
  type TvSnapshotV2,
} from '../../shared/tv-display/domain';

// ── Fetch (used by both admin + public TV page) ────────

export async function fetchTvSnapshotForTarget(
  target: string,
  sections?: TvSnapshotSection[],
  signal?: AbortSignal,
): Promise<TvSnapshotV2> {
  const params = new URLSearchParams({ target });
  if (sections?.length) params.set('include', sections.join(','));
  const response = await fetch(`/api/tv-display/snapshot?${params.toString()}`, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`TV snapshot request failed (${response.status}).`);
  const snapshot: unknown = await response.json();
  if (!isTvSnapshotV2(snapshot) || snapshot.target !== target) {
    throw new Error('TV snapshot response is invalid.');
  }
  return snapshot;
}

/**
 * Fetch all TV display data in a single parallel batch.
 * Used by the public /tv-display page (polling) and admin page.
 */
export async function fetchTvDisplayData(): Promise<TvDisplayData> {
  const [announcementsRes, tickerRes, settingsRes, eventsRes] = await Promise.all([
    cmsSupabase
      .from('cms_tv_announcements')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false }),
    cmsSupabase
      .from('cms_tv_ticker')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    cmsSupabase
      .from('cms_tv_settings')
      .select('*'),
    cmsSupabase
      .from('cms_tv_events')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
  ]);

  if (announcementsRes.error || tickerRes.error || settingsRes.error || eventsRes.error) {
    throw new Error(
      announcementsRes.error?.message ||
      tickerRes.error?.message ||
      settingsRes.error?.message ||
      eventsRes.error?.message ||
      'Failed to fetch TV display data'
    );
  }

  // Convert settings array → key-value map
  const settings: Record<string, string> = {};
  (settingsRes.data as CmsTvSetting[] | null)?.forEach((row) => {
    settings[row.key] = row.value;
  });

  return {
    announcements: (announcementsRes.data as CmsTvAnnouncement[]) || [],
    ticker: (tickerRes.data as CmsTvTicker[]) || [],
    events: (eventsRes.data as CmsTvEvent[]) || [],
    settings,
  };
}

/**
 * Fetch TV display data filtered by target (for Electron desktop player).
 * Returns content where target matches the given value OR 'all'.
 */
export async function fetchTvDisplayDataForTarget(target: TvTarget): Promise<TvDisplayData> {
  const [announcementsRes, tickerRes, settingsRes, eventsRes] = await Promise.all([
    cmsSupabase
      .from('cms_tv_announcements')
      .select('*')
      .eq('is_active', true)
      .in('target', [target, 'all'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false }),
    cmsSupabase
      .from('cms_tv_ticker')
      .select('*')
      .eq('is_active', true)
      .in('target', [target, 'all'])
      .order('sort_order', { ascending: true }),
    cmsSupabase
      .from('cms_tv_settings')
      .select('*'),
    cmsSupabase
      .from('cms_tv_events')
      .select('*')
      .eq('is_active', true)
      .in('target', [target, 'all'])
      .order('display_order', { ascending: true }),
  ]);

  if (announcementsRes.error || tickerRes.error || settingsRes.error || eventsRes.error) {
    throw new Error(
      announcementsRes.error?.message ||
      tickerRes.error?.message ||
      settingsRes.error?.message ||
      eventsRes.error?.message ||
      'Failed to fetch TV display data'
    );
  }

  const settings: Record<string, string> = {};
  (settingsRes.data as CmsTvSetting[] | null)?.forEach((row) => {
    settings[row.key] = row.value;
  });

  return {
    announcements: (announcementsRes.data as CmsTvAnnouncement[]) || [],
    ticker: (tickerRes.data as CmsTvTicker[]) || [],
    events: (eventsRes.data as CmsTvEvent[]) || [],
    settings,
  };
}

/**
 * Fetch ALL announcements (active + inactive) for admin management.
 */
export async function fetchAllAnnouncements(): Promise<CmsTvAnnouncement[]> {
  const { data } = await cmsSupabase
    .from('cms_tv_announcements')
    .select('*')
    .order('created_at', { ascending: false });
  return (data as CmsTvAnnouncement[]) || [];
}

/**
 * Fetch ALL ticker items (active + inactive) for admin management.
 */
export async function fetchAllTicker(): Promise<CmsTvTicker[]> {
  const { data } = await cmsSupabase
    .from('cms_tv_ticker')
    .select('*')
    .order('sort_order', { ascending: true });
  return (data as CmsTvTicker[]) || [];
}

/**
 * Fetch all settings as key-value map.
 */
export async function fetchTvSettings(): Promise<Record<string, string>> {
  const { data } = await cmsSupabase.from('cms_tv_settings').select('*');
  const map: Record<string, string> = {};
  (data as CmsTvSetting[] | null)?.forEach((row) => {
    map[row.key] = row.value;
  });
  return map;
}

// ── Announcement CRUD ──────────────────────────────────

export async function createAnnouncement(
  input: Omit<CmsTvAnnouncement, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase.from('cms_tv_announcements').insert(input);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateAnnouncement(
  id: string,
  updates: Partial<CmsTvAnnouncement>
): Promise<{ success: boolean; error?: string }> {
  const cleaned = { ...updates };
  delete (cleaned as Record<string, unknown>).id;
  delete (cleaned as Record<string, unknown>).created_at;
  delete (cleaned as Record<string, unknown>).updated_at;

  const { error } = await cmsSupabase
    .from('cms_tv_announcements')
    .update(cleaned)
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteAnnouncement(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase.from('cms_tv_announcements').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function toggleAnnouncement(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase
    .from('cms_tv_announcements')
    .update({ is_active: !isActive })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Ticker CRUD ────────────────────────────────────────

export async function createTicker(
  input: Omit<CmsTvTicker, 'id' | 'created_at'>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase.from('cms_tv_ticker').insert(input);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateTicker(
  id: string,
  updates: Partial<CmsTvTicker>
): Promise<{ success: boolean; error?: string }> {
  const cleaned = { ...updates };
  delete (cleaned as Record<string, unknown>).id;
  delete (cleaned as Record<string, unknown>).created_at;

  const { error } = await cmsSupabase.from('cms_tv_ticker').update(cleaned).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteTicker(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase.from('cms_tv_ticker').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function toggleTicker(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase
    .from('cms_tv_ticker')
    .update({ is_active: !isActive })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Settings CRUD ──────────────────────────────────────

export async function updateSetting(
  key: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase
    .from('cms_tv_settings')
    .update({ value })
    .eq('key', key);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function upsertSetting(
  key: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase
    .from('cms_tv_settings')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Layout Settings for TV Stack Resize ────────────────

export interface LayoutSettings {
  events_flex: number;
  schedule_flex: number;
  current_flex: number;
  upcoming_flex: number;
  ticker_height: number;
  headlines_height: number;
  breaking_height: number;
}

export const DEFAULT_LAYOUT: LayoutSettings = {
  events_flex: 80,
  schedule_flex: 20,
  current_flex: 55,
  upcoming_flex: 45,
  ticker_height: 38,
  headlines_height: 36,
  breaking_height: 54,
};

/**
 * Fetch layout flex settings for a specific TV device.
 * Falls back to global settings, then to defaults if not set.
 */
export async function fetchLayoutSettings(target: string): Promise<LayoutSettings> {
  const settings = await fetchTvSettings();
  return {
    events_flex: clampSetting(settings[`events_flex_${target}`] || settings.events_flex_all, DEFAULT_LAYOUT.events_flex, 20, 90),
    schedule_flex: clampSetting(settings[`schedule_flex_${target}`] || settings.schedule_flex_all, DEFAULT_LAYOUT.schedule_flex, 10, 80),
    current_flex: clampSetting(settings[`current_flex_${target}`] || settings.current_flex_all, DEFAULT_LAYOUT.current_flex, 20, 80),
    upcoming_flex: clampSetting(settings[`upcoming_flex_${target}`] || settings.upcoming_flex_all, DEFAULT_LAYOUT.upcoming_flex, 20, 80),
    ticker_height: clampSetting(settings[`ticker_height_${target}`] || settings.ticker_height_all, DEFAULT_LAYOUT.ticker_height, 20, 80),
    headlines_height: clampSetting(settings[`headlines_height_${target}`] || settings.headlines_height_all, DEFAULT_LAYOUT.headlines_height, 20, 80),
    breaking_height: clampSetting(settings[`breaking_height_${target}`] || settings.breaking_height_all, DEFAULT_LAYOUT.breaking_height, 30, 120),
  };
}

/**
 * Batch-upsert all layout flex settings for a specific TV device (e.g. target = 'all' for global settings).
 */
export async function upsertLayoutSettings(
  target: string,
  layout: LayoutSettings
): Promise<{ success: boolean; error?: string }> {
  const safeLayout: LayoutSettings = {
    events_flex: clampSetting(layout.events_flex, DEFAULT_LAYOUT.events_flex, 20, 90),
    schedule_flex: clampSetting(layout.schedule_flex, DEFAULT_LAYOUT.schedule_flex, 10, 80),
    current_flex: clampSetting(layout.current_flex, DEFAULT_LAYOUT.current_flex, 20, 80),
    upcoming_flex: clampSetting(layout.upcoming_flex, DEFAULT_LAYOUT.upcoming_flex, 20, 80),
    ticker_height: clampSetting(layout.ticker_height, DEFAULT_LAYOUT.ticker_height, 20, 80),
    headlines_height: clampSetting(layout.headlines_height, DEFAULT_LAYOUT.headlines_height, 20, 80),
    breaking_height: clampSetting(layout.breaking_height, DEFAULT_LAYOUT.breaking_height, 30, 120),
  };
  const entries = [
    { key: `events_flex_${target}`, value: String(safeLayout.events_flex) },
    { key: `schedule_flex_${target}`, value: String(safeLayout.schedule_flex) },
    { key: `current_flex_${target}`, value: String(safeLayout.current_flex) },
    { key: `upcoming_flex_${target}`, value: String(safeLayout.upcoming_flex) },
    { key: `ticker_height_${target}`, value: String(safeLayout.ticker_height) },
    { key: `headlines_height_${target}`, value: String(safeLayout.headlines_height) },
    { key: `breaking_height_${target}`, value: String(safeLayout.breaking_height) },
  ];

  const { error } = await cmsSupabase
    .from('cms_tv_settings')
    .upsert(entries, { onConflict: 'key' });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Event CRUD ─────────────────────────────────────────

export async function fetchAllEvents(): Promise<CmsTvEvent[]> {
  const { data } = await cmsSupabase
    .from('cms_tv_events')
    .select('*')
    .order('display_order', { ascending: true });
  return (data as CmsTvEvent[]) || [];
}

export async function createEvent(
  input: Omit<CmsTvEvent, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase.from('cms_tv_events').insert(input);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateEvent(
  id: string,
  updates: Partial<CmsTvEvent>
): Promise<{ success: boolean; error?: string }> {
  const cleaned = { ...updates };
  delete (cleaned as Record<string, unknown>).id;
  delete (cleaned as Record<string, unknown>).created_at;
  delete (cleaned as Record<string, unknown>).updated_at;

  const { error } = await cmsSupabase
    .from('cms_tv_events')
    .update(cleaned)
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteEvent(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase.from('cms_tv_events').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function toggleEvent(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase
    .from('cms_tv_events')
    .update({ is_active: !isActive })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── TV Device CRUD ─────────────────────────────────────

export async function fetchAllDevices(): Promise<CmsTvDevice[]> {
  const { data } = await cmsSupabase
    .from('cms_tv_devices')
    .select('*')
    .order('name', { ascending: true });
  return (data as CmsTvDevice[]) || [];
}

export async function fetchActiveDevices(): Promise<CmsTvDevice[]> {
  const { data } = await cmsSupabase
    .from('cms_tv_devices')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });
  return (data as CmsTvDevice[]) || [];
}

export async function createDevice(
  input: { name: string; label?: string; location?: string }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase.from('cms_tv_devices').insert({
    name: input.name,
    label: input.label || null,
    location: input.location || null,
    is_active: true,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateDevice(
  id: string,
  updates: Partial<CmsTvDevice>
): Promise<{ success: boolean; error?: string }> {
  const cleaned = { ...updates };
  delete (cleaned as Record<string, unknown>).id;
  delete (cleaned as Record<string, unknown>).created_at;
  delete (cleaned as Record<string, unknown>).updated_at;

  const { error } = await cmsSupabase
    .from('cms_tv_devices')
    .update(cleaned)
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteDevice(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase.from('cms_tv_devices').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function toggleDevice(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase
    .from('cms_tv_devices')
    .update({ is_active: !isActive })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function toggleDeviceRoomSchedule(
  id: string,
  show: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await cmsSupabase
    .from('cms_tv_devices')
    .update({ show_room_schedule: show })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
