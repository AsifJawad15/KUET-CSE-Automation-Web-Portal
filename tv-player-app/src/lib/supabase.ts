import { createClient } from '@supabase/supabase-js';

// Uses the same CMS Supabase project as the admin panel (reads from root .env.local)
const supabaseUrl = import.meta.env.NEXT_PUBLIC_CMS_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_CMS_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase not configured. Ensure NEXT_PUBLIC_CMS_SUPABASE_URL and NEXT_PUBLIC_CMS_SUPABASE_ANON_KEY are set in the root .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── CMS TV Display Types (matching the existing tables) ──

export type TvAnnouncementType = 'notice' | 'class-test' | 'assignment' | 'lab-test' | 'quiz' | 'event' | 'other';
export type TvAnnouncementPriority = 'low' | 'medium' | 'high';
export type TvTarget = string; // dynamic: 'all' | 'TV1' | 'TV2' | 'TV3' | ...

export interface CmsTvDevice {
  id: string;
  name: string;
  label: string | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CmsTvAnnouncement {
  id: string;
  title: string;
  content: string;
  type: TvAnnouncementType;
  course_code: string | null;
  priority: TvAnnouncementPriority;
  scheduled_date: string | null;
  target: TvTarget;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CmsTvTicker {
  id: string;
  label: string;
  text: string;
  type: TvAnnouncementType;
  course_code: string | null;
  announcement_id: string | null;
  target: TvTarget;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface CmsTvEvent {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  speaker_name: string | null;
  speaker_image_url: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  badge_text: string | null;
  target: TvTarget;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CmsTvSetting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface TvDisplayData {
  announcements: CmsTvAnnouncement[];
  ticker: CmsTvTicker[];
  events: CmsTvEvent[];
  settings: Record<string, string>;
}

/**
 * Fetch TV display data filtered by target.
 * Returns content where target matches the given value OR 'all'.
 */
export async function fetchTvDisplayDataForTarget(target: TvTarget): Promise<TvDisplayData> {
  const [announcementsRes, tickerRes, settingsRes, eventsRes] = await Promise.all([
    supabase
      .from('cms_tv_announcements')
      .select('*')
      .eq('is_active', true)
      .in('target', [target, 'all'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('cms_tv_ticker')
      .select('*')
      .eq('is_active', true)
      .in('target', [target, 'all'])
      .order('sort_order', { ascending: true }),
    supabase
      .from('cms_tv_settings')
      .select('*'),
    supabase
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
 * Fetch all TV display data (for control page overview).
 */
export async function fetchAllTvDisplayData(): Promise<TvDisplayData> {
  const [announcementsRes, tickerRes, settingsRes, eventsRes] = await Promise.all([
    supabase
      .from('cms_tv_announcements')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('cms_tv_ticker')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('cms_tv_settings')
      .select('*'),
    supabase
      .from('cms_tv_events')
      .select('*')
      .eq('is_active', true)
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
 * Fetch all active TV devices from the database.
 */
export async function fetchActiveDevices(): Promise<CmsTvDevice[]> {
  const { data } = await supabase
    .from('cms_tv_devices')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });
  return (data as CmsTvDevice[]) || [];
}
