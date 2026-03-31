// ==========================================
// TV Display Service — CMS Supabase data layer
// Single Responsibility: Only handles TV display CRUD
// Uses the CMS Supabase client (separate from academic DB)
// ==========================================

import { cmsSupabase } from '@/services/cmsService';
import type {
  CmsTvAnnouncement,
  CmsTvEvent,
  CmsTvSetting,
  CmsTvTicker,
  TvDisplayData,
  TvTarget,
} from '@/types/cms';

// ── Fetch (used by both admin + public TV page) ────────

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
