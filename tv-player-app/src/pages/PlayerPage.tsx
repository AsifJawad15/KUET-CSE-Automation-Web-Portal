// ==========================================
// TV Player Page — Fullscreen TV Display
// Adapted from the web /tv-display page to work
// inside the Electron desktop player app.
// Fetches from existing CMS tables, filtered by target.
// Subscribes to Supabase realtime for live updates.
// ==========================================

import { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar, ChevronLeft, ChevronRight, Clock,
  GraduationCap, MapPin, Monitor, Radio, User, Zap, WifiOff,
} from 'lucide-react';
import {
  supabase,
  fetchTvDisplayDataForTarget,
  fetchDeviceByName,
  fetchTodayRoutineSlots,
  fetchTvSnapshotForTarget,
  isTvSnapshotApiConfigured,
  type CmsTvAnnouncement,
  type CmsTvEvent,
  type CmsTvTicker,
  type TvTarget,
  type RoutineSlotWithDetails,
} from '../lib/supabase';
import { cacheTvDisplayData, getCachedTvDisplayData, getCachedTvDisplayEntry } from '../lib/tvDisplayCache';
import {
  TV_DISPLAY_TIME_ZONE,
  clampSetting,
  getZonedDateKey,
  getZonedMinutes,
  mergeTvSnapshots,
  type RoutineDisplaySlot,
  type TvSnapshotSection,
  type TvSnapshotV2,
} from '../../../shared/tv-display/domain';
import TvStartupCurtain from '../components/TvStartupCurtain';

// Color palette (matches the web TV display)
const C = {
  navyDarkest: '#060e1c',
  navyDark: '#091428',
  navy: '#0c2340',
  navyLight: '#132e4f',
  teal: '#00796b',
  tealLight: '#26a69a',
  tealDark: '#004d40',
  gold: '#ffc107',
  goldDim: 'rgba(255,193,7,0.25)',
  white: '#ffffff',
  textMuted: 'rgba(255,255,255,0.55)',
  textDim: 'rgba(255,255,255,0.3)',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.12)',
  glassBg: 'rgba(255,255,255,0.03)',
} as const;

// ── Layout defaults ──
const DEFAULT_EVENTS_FLEX = 80;
const DEFAULT_SCHEDULE_FLEX = 20;
const DEFAULT_CURRENT_FLEX = 55;
const DEFAULT_UPCOMING_FLEX = 45;
const DEFAULT_TICKER_HEIGHT = 38;
const DEFAULT_HEADLINES_HEIGHT = 36;
const DEFAULT_BREAKING_HEIGHT = 54;

// ── Routine helpers ──

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

interface TimePeriod {
  start_time: string;
  end_time: string;
  slots: RoutineSlotWithDetails[];
}

function buildPeriods(slots: RoutineSlotWithDetails[]): TimePeriod[] {
  const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const map = new Map<string, TimePeriod>();
  for (const s of sorted) {
    if (!map.has(s.start_time)) map.set(s.start_time, { start_time: s.start_time, end_time: s.end_time, slots: [] });
    map.get(s.start_time)!.slots.push(s);
  }
  return Array.from(map.values()).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

function formatTime12(time: string | null | undefined): string {
  if (!time) return '-';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

function snapshotSlotToRoutine(slot: RoutineDisplaySlot): RoutineSlotWithDetails {
  return {
    id: slot.id,
    offering_id: '',
    room_number: slot.roomNumber,
    day_of_week: 0,
    start_time: slot.startTime,
    end_time: slot.endTime,
    section: slot.section,
    valid_from: slot.date,
    valid_until: slot.date,
    created_at: slot.date,
    course_offerings: {
      id: '',
      term: slot.term || '',
      session: slot.session || '',
      batch: null,
      courses: {
        code: slot.courseCode,
        title: slot.courseTitle,
        credit: 0,
        course_type: slot.bookingType || 'Theory',
      },
      teachers: {
        full_name: slot.teacherName || '',
        teacher_uid: '',
      },
    },
    rooms: { room_number: slot.roomNumber, room_type: null },
  };
}

export default function PlayerPage() {
  const target = useMemo(() => {
    const query = window.location.hash.split('?')[1] || '';
    return (new URLSearchParams(query).get('target') || 'TV1') as TvTarget;
  }, []);

  // Data state
  const [announcements, setAnnouncements] = useState<CmsTvAnnouncement[]>([]);
  const [ticker, setTicker] = useState<CmsTvTicker[]>([]);
  const [events, setEvents] = useState<CmsTvEvent[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [routineSlots, setRoutineSlots] = useState<RoutineSlotWithDetails[]>([]);
  const [showRoomSchedule, setShowRoomSchedule] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wasOffline, setWasOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  // UI state
  const [now, setNow] = useState(new Date());
  const [eventPage, setEventPage] = useState(0);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [upcomingIdx, setUpcomingIdx] = useState(0);
  const autoRotateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotRef = useRef<TvSnapshotV2 | null>(null);
  const requestGeneration = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRealtimeSections = useRef(new Set<TvSnapshotSection>());

  const headlinePrefix = settings.headline_prefix || 'HEADLINES';
  const eventRotationSec = clampSetting(settings.event_rotation_sec, 8, 3, 120);

  // ── Layout flex ratios and heights from settings (falling back to global then defaults) ──
  const eventsFlex = clampSetting(settings[`events_flex_${target}`] || settings.events_flex_all, DEFAULT_EVENTS_FLEX, 20, 90);
  const scheduleFlex = clampSetting(settings[`schedule_flex_${target}`] || settings.schedule_flex_all, DEFAULT_SCHEDULE_FLEX, 10, 80);
  const currentFlex = clampSetting(settings[`current_flex_${target}`] || settings.current_flex_all, DEFAULT_CURRENT_FLEX, 20, 80);
  const upcomingFlex = clampSetting(settings[`upcoming_flex_${target}`] || settings.upcoming_flex_all, DEFAULT_UPCOMING_FLEX, 20, 80);
  const tickerHeight = clampSetting(settings[`ticker_height_${target}`] || settings.ticker_height_all, DEFAULT_TICKER_HEIGHT, 20, 80);
  const headlinesHeight = clampSetting(settings[`headlines_height_${target}`] || settings.headlines_height_all, DEFAULT_HEADLINES_HEIGHT, 20, 80);
  const breakingHeight = clampSetting(settings[`breaking_height_${target}`] || settings.breaking_height_all, DEFAULT_BREAKING_HEIGHT, 30, 120);

  const isTargetSectionEnabled = (section: 'events' | 'ticker' | 'headlines') => {
    const value = settings[`tv_show_${section}_${target}`];
    if (!value) return true;
    return value !== 'false' && value !== '0';
  };

  const showEventsPanel = isTargetSectionEnabled('events');
  const showTickerBar = isTargetSectionEnabled('ticker');
  const showHeadlinesBar = isTargetSectionEnabled('headlines');

  // ── Fetch data ──
  const applySnapshot = useCallback((snapshot: TvSnapshotV2, cached: boolean) => {
    const content = snapshot.content;
    if (content?.announcements) setAnnouncements(content.announcements as CmsTvAnnouncement[]);
    if (content?.ticker) setTicker(content.ticker as CmsTvTicker[]);
    if (content?.events) setEvents(content.events as CmsTvEvent[]);
    if (content?.settings) setSettings(content.settings);
    if (snapshot.device !== undefined) {
      setShowRoomSchedule(snapshot.device?.showRoomSchedule ?? true);
    }
    if (snapshot.schedule) {
      const dateKey = getZonedDateKey(new Date(), TV_DISPLAY_TIME_ZONE);
      setRoutineSlots((snapshot.schedule.days[dateKey] ?? []).map(snapshotSlotToRoutine));
    }
    setCachedAt(cached ? snapshot.generatedAt : null);
    setLoading(false);
  }, []);

  const fetchData = useCallback(async (sections?: TvSnapshotSection[]) => {
    const generation = ++requestGeneration.current;
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    try {
      if (isTvSnapshotApiConfigured) {
        const patch = await fetchTvSnapshotForTarget(target, sections, controller.signal);
        if (generation !== requestGeneration.current) return;
        const merged = mergeTvSnapshots(snapshotRef.current, patch);
        snapshotRef.current = merged;
        applySnapshot(merged, false);
        setError(null);
        const degraded = Boolean(patch.errors && Object.keys(patch.errors).length > 0);
        setWasOffline(degraded);
        if (degraded) setCachedAt(snapshotRef.current?.generatedAt ?? null);
        await window.electronAPI?.saveTvSnapshot(target, merged);
        const mediaUrls = (merged.content?.events ?? [])
          .flatMap((event) => {
            const row = event as CmsTvEvent;
            return [row.image_url, row.speaker_image_url];
          })
          .filter((url): url is string => Boolean(url));
        void window.electronAPI?.syncMediaCache(mediaUrls);
        return;
      }

      const data = await fetchTvDisplayDataForTarget(target);
      if (generation !== requestGeneration.current) return;
      setAnnouncements(data.announcements);
      setTicker(data.ticker);
      setEvents(data.events);
      setSettings(data.settings);
      setError(null);

      // Cache the fetched data
      cacheTvDisplayData(target, data);

      // If we were offline, mark that we're online now
      setWasOffline(false);
    } catch (err) {
      console.error(`[${target}] Content fetch error:`, err);

      // Try to load from cache on error
      if (controller.signal.aborted) return;
      const diskSnapshot = await window.electronAPI?.loadTvSnapshot(target);
      if (
        diskSnapshot &&
        typeof diskSnapshot === 'object' &&
        (diskSnapshot as TvSnapshotV2).schemaVersion === 2
      ) {
        const snapshot = diskSnapshot as TvSnapshotV2;
        snapshotRef.current = snapshot;
        applySnapshot(snapshot, true);
        setWasOffline(true);
        setError(null);
        return;
      }
      const cachedData = getCachedTvDisplayData(target);
      if (cachedData) {
        console.log(`[${target}] Loading from cache due to fetch error`);
        setAnnouncements(cachedData.announcements);
        setTicker(cachedData.ticker);
        setEvents(cachedData.events);
        setSettings(cachedData.settings);
        setWasOffline(true);
        const entry = getCachedTvDisplayEntry(target);
        setCachedAt(entry ? new Date(entry.timestamp).toISOString() : null);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    if (isTvSnapshotApiConfigured) {
      setLoading(false);
      return;
    }

    try {
      const device = await fetchDeviceByName(target);
      setShowRoomSchedule(device?.show_room_schedule ?? true);
    } catch (err) {
      console.error(`[${target}] Device fetch error:`, err);
      // Preserve previous device visibility state while offline.
    }

    // Fetch routine slots independently — failure should not hide events
    try {
      const slots = await fetchTodayRoutineSlots();
      setRoutineSlots(slots);
    } catch (err) {
      console.error(`[${target}] Routine slots fetch error:`, err);
      // Preserve previously fetched routine data while offline.
    }

    setLoading(false);
  }, [applySnapshot, target]);

  const scheduleSectionRefresh = useCallback((section: TvSnapshotSection) => {
    pendingRealtimeSections.current.add(section);
    if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
    realtimeTimer.current = setTimeout(() => {
      const sections = [...pendingRealtimeSections.current];
      pendingRealtimeSections.current.clear();
      realtimeTimer.current = null;
      void fetchData(sections);
    }, 350);
  }, [fetchData]);

  // Initial fetch + polling + realtime
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const diskSnapshot = await window.electronAPI?.loadTvSnapshot(target);
      if (!disposed && diskSnapshot && typeof diskSnapshot === 'object') {
        const snapshot = diskSnapshot as TvSnapshotV2;
        if (snapshot.schemaVersion === 2 && snapshot.target === target) {
          snapshotRef.current = snapshot;
          applySnapshot(snapshot, true);
          setWasOffline(true);
        }
      }
      if (!disposed) void fetchData();
    })();
    const pollInterval = setInterval(() => void fetchData(), 60_000 + Math.round(Math.random() * 5_000));

    // Subscribe to realtime changes on all content tables + device settings
    const channel = supabase
      .channel(`tv-display-${target}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_announcements' }, () => scheduleSectionRefresh('announcements'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_ticker' }, () => scheduleSectionRefresh('ticker'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_events' }, () => scheduleSectionRefresh('events'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_settings' }, () => scheduleSectionRefresh('settings'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_devices' }, () => scheduleSectionRefresh('device'))
      .subscribe((status) => {
        console.log(`[${target}] Realtime subscription:`, status);
      });

    return () => {
      disposed = true;
      clearInterval(pollInterval);
      requestAbort.current?.abort();
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      pendingRealtimeSections.current.clear();
      supabase.removeChannel(channel);
    };
  }, [applySnapshot, target, fetchData, scheduleSectionRefresh]);

  // Handle online/offline transitions
  useEffect(() => {
    const handleOnline = () => {
      console.log('Internet connection restored');
      void fetchData();
    };

    const handleOffline = () => {
      console.log('Internet connection lost');
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData]);

  useEffect(() => {
    if (eventPage >= events.length) setEventPage(0);
  }, [eventPage, events.length]);

  useEffect(() => {
    if (tickerIndex >= ticker.length) setTickerIndex(0);
  }, [tickerIndex, ticker.length]);

  // Minute-aligned clock tick: the UI only renders minute precision.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const delay = 60_000 - (Date.now() % 60_000);
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  // Auto-rotate event carousel
  useEffect(() => {
    if (events.length <= 1) return;
    if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    const maxPage = events.length - 1;
    autoRotateRef.current = setInterval(
      () => setEventPage((prev) => (prev >= maxPage ? 0 : prev + 1)),
      eventRotationSec * 1000
    );
    return () => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    };
  }, [events.map((event) => `${event.id}:${event.updated_at}`).join('|'), eventRotationSec]);

  // Ticker rotation
  useEffect(() => {
    if (ticker.length <= 1) return;
    const interval = setInterval(
      () => setTickerIndex((prev) => (prev + 1) % ticker.length),
      5000
    );
    return () => clearInterval(interval);
  }, [ticker.map((item) => `${item.id}:${item.text}`).join('|')]);

  // Slide upcoming periods every 20s
  useEffect(() => {
    const t = setInterval(() => setUpcomingIdx(prev => (prev === 0 ? 1 : 0)), 20_000);
    return () => clearInterval(t);
  }, []);

  // Schedule data
  const periods = useMemo(() => buildPeriods(routineSlots), [routineSlots]);
  const nowMins = getZonedMinutes(now, TV_DISPLAY_TIME_ZONE);
  const currentPeriod = useMemo(
    () => periods.find(p => nowMins >= timeToMins(p.start_time) && nowMins < timeToMins(p.end_time)) ?? null,
    [periods, nowMins],
  );
  const upcomingPeriods = useMemo(
    () => periods.filter(p => timeToMins(p.start_time) > nowMins).slice(0, 2),
    [periods, nowMins],
  );

  // Clock formatting
  const timeStr = now.toLocaleTimeString('en-US', { timeZone: TV_DISPLAY_TIME_ZONE, hour12: true, hour: 'numeric', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { timeZone: TV_DISPLAY_TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' });

  // Event pagination
  const maxPage = Math.max(0, events.length - 1);
  const currentEvent = events[eventPage] ?? null;
  const prevEvents = () => setEventPage((p) => (p <= 0 ? maxPage : p - 1));
  const nextEvents = () => setEventPage((p) => (p >= maxPage ? 0 : p + 1));

  // Editorial breaking news remains separate from connectivity status.
  const breakingNewsActive = (() => {
    const deviceExpires = settings[`breaking_news_expires_at_${target}`];
    if (deviceExpires && new Date(deviceExpires).getTime() > Date.now()) return true;
    const allExpires = settings.breaking_news_expires_at_all;
    if (allExpires && new Date(allExpires).getTime() > Date.now()) return true;
    return false;
  })();

  const breakingNewsText = (() => {
    const deviceExpires = settings[`breaking_news_expires_at_${target}`];
    if (deviceExpires && new Date(deviceExpires).getTime() > Date.now()) {
      return settings[`breaking_news_text_${target}`] || '';
    }
    return settings.breaking_news_text_all || '';
  })();

  const showBreakingBar = breakingNewsActive;

  // ── Loading ──
  if (loading) {
    return (
      <>
        <div className="h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.navyDarkest} 0%, ${C.navyDark} 50%, ${C.navyDarkest} 100%)` }}>
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl animate-ping" style={{ background: 'rgba(0,121,107,0.15)' }} />
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`, boxShadow: '0 8px 32px rgba(0,121,107,0.3)' }}>
                <Monitor className="w-10 h-10 text-white" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold" style={{ color: C.white }}>Loading {target}</p>
              <p className="text-sm mt-1" style={{ color: C.textDim }}>Connecting to display system…</p>
            </div>
          </div>
        </div>
        <TvStartupCurtain ready={false} target={target} />
      </>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <>
        <div className="h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.navyDarkest} 0%, ${C.navyDark} 50%, ${C.navyDarkest} 100%)` }}>
          <div className="text-center p-8 rounded-2xl" style={{ background: C.glassBg, border: `1px solid ${C.border}`, backdropFilter: 'blur(16px)', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,83,80,0.15)', border: '1px solid rgba(239,83,80,0.3)' }}>
              <Monitor className="w-8 h-8" style={{ color: '#ef5350' }} />
            </div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: '#ef5350' }}>Connection Error</h2>
            <p className="text-base mb-6 max-w-md" style={{ color: C.textMuted }}>{error}</p>
            <button
              onClick={() => void fetchData()}
              className="px-8 py-3 rounded-xl text-base font-semibold text-white transition-all duration-300 hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`, boxShadow: '0 4px 20px rgba(0,121,107,0.3)' }}
            >
              Retry Connection
            </button>
          </div>
        </div>
        <TvStartupCurtain ready target={target} />
      </>
    );
  }

  return (
    <>
      <div className="h-screen overflow-hidden flex flex-col select-none" style={{ background: C.navyDarkest, color: C.white }}>

      {/* =========== HEADER BAR =========== */}
      <header
        className="flex-shrink-0 px-6 py-2.5 flex items-center justify-between relative"
        style={{
          background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyLight} 50%, ${C.navy} 100%)`,
          boxShadow: `0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}
      >
        {/* Animated gradient border at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, ${C.teal}, ${C.gold}, ${C.tealLight}, ${C.teal})`,
            backgroundSize: '300% 100%',
            animation: 'gradient-shift 8s ease infinite',
          }}
        />
        
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center relative"
            style={{
              background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`,
              boxShadow: '0 4px 16px rgba(0,121,107,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            <GraduationCap className="w-6 h-6 text-white relative z-10" />
          </div>
          <h1 className="text-lg font-bold tracking-wide uppercase">
            <span style={{ color: C.gold, textShadow: '0 0 20px rgba(255,193,7,0.3)' }}>KUET</span>
            <span className="mx-2" style={{ color: C.textDim }}>|</span>
            <span style={{ letterSpacing: '0.03em' }}>{settings.department_name || 'DEPT. OF COMPUTER SCIENCE & ENGINEERING'}</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="px-3 py-1 rounded-lg text-xs font-bold tracking-widest relative overflow-hidden"
            style={{
              background: 'rgba(0,121,107,0.2)',
              color: C.tealLight,
              border: '1px solid rgba(0,121,107,0.35)',
              boxShadow: '0 0 12px rgba(0,121,107,0.15)',
            }}
          >
            <span className="relative z-10">{target}</span>
          </span>
          <div
            className="text-right px-5 py-1.5 rounded-xl relative"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${C.border}`,
              backdropFilter: 'blur(8px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <p
              className="text-2xl font-bold tracking-wider tabular-nums"
              style={{
                color: C.gold,
                fontFamily: "'JetBrains Mono', monospace",
                textShadow: '0 0 24px rgba(255,193,7,0.25)',
              }}
            >
              {timeStr}
            </p>
            <p className="text-xs tracking-wide mt-0.5 font-medium" style={{ color: C.textMuted }}>
              {dateStr}
            </p>
          </div>
        </div>
      </header>

      {/* =========== OFFLINE STATUS WARNING BAR =========== */}
      {wasOffline && (
        <div 
          className="flex-shrink-0 px-6 py-2 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white text-xs font-bold tracking-wide transition-all z-20 border-b border-amber-800"
        >
          <WifiOff className="w-4 h-4 animate-pulse" />
          <span>OFFLINE MODE &mdash; Displaying cached screen as of {
            (() => {
              return cachedAt ? new Date(cachedAt).toLocaleString() : 'recently';
            })()
          }</span>
        </div>
      )}

      {/* =========== MAIN CONTENT =========== */}
      <main className="flex-1 min-h-0 flex overflow-hidden">

        {/* Events panel */}
        {showEventsPanel && (
        <section
          className={`min-w-0 flex flex-col p-4 ${showRoomSchedule ? 'pr-2' : ''} overflow-hidden`}
          style={{ flex: showRoomSchedule ? eventsFlex : 1 }}
        >
          <div className="flex-shrink-0 flex items-center justify-between mb-2">
            <h2
              className="text-sm font-black tracking-[0.2em] uppercase flex items-center gap-2"
              style={{ color: C.gold, textShadow: '0 0 16px rgba(255,193,7,0.2)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: C.gold, boxShadow: '0 0 8px rgba(255,193,7,0.5)' }}
              />
              Department News &amp; Events
            </h2>
            {events.length > 1 && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  {events.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setEventPage(i)}
                      className="w-2 h-2 rounded-full transition-all duration-300"
                      style={{
                        background: i === eventPage ? C.gold : C.textDim,
                        boxShadow: i === eventPage ? '0 0 8px rgba(255,193,7,0.5)' : 'none',
                        transform: i === eventPage ? 'scale(1.3)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={prevEvents}
                  className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}` }}
                >
                  <ChevronLeft className="w-4 h-4" style={{ color: C.textMuted }} />
                </button>
                <button
                  onClick={nextEvents}
                  className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}` }}
                >
                  <ChevronRight className="w-4 h-4" style={{ color: C.textMuted }} />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait">
              {currentEvent ? (
                <motion.div
                  key={currentEvent.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                  className="h-full"
                >
                  <EventCard event={currentEvent} />
                </motion.div>
              ) : (
                <div
                  className="h-full flex items-center justify-center rounded-2xl"
                  style={{
                    background: `linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.04))`,
                    border: `1px solid ${C.border}`,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                  }}
                >
                  <div className="text-center">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: 'rgba(255,255,255,0.04)', border: `1px dashed ${C.borderLight}` }}
                    >
                      <Monitor className="w-8 h-8" style={{ color: C.textDim }} />
                    </div>
                    <p className="text-lg font-semibold" style={{ color: C.textMuted }}>No events to display</p>
                    <p className="text-sm mt-1" style={{ color: C.textDim }}>Send content from the admin panel</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>
        )}

        {/* RIGHT: Room Schedule (conditional) */}
        {showRoomSchedule && (
        <section
          className={`${showEventsPanel ? 'pl-2' : 'pl-4'} min-w-0 flex flex-col p-4 overflow-hidden gap-2`}
          style={{ flex: showEventsPanel ? scheduleFlex : 1 }}
        >
          <h2
            className="flex-shrink-0 text-xs font-black tracking-[0.18em] uppercase flex items-center gap-2"
            style={{ color: C.gold, textShadow: '0 0 16px rgba(255,193,7,0.2)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: C.gold, boxShadow: '0 0 8px rgba(255,193,7,0.5)' }}
            />
            Live Room Schedule
          </h2>

          {/* CURRENT PERIOD */}
          <div
            className="min-h-0 rounded-xl overflow-hidden flex flex-col"
            style={{
              flex: currentFlex,
              background: currentPeriod
                ? 'linear-gradient(135deg, #003d33 0%, #005546 40%, #00695c 100%)'
                : `linear-gradient(135deg, ${C.navy} 0%, ${C.navyDark} 100%)`,
              border: `1px solid ${currentPeriod ? 'rgba(0,200,150,0.25)' : C.border}`,
              boxShadow: currentPeriod
                ? '0 4px 24px rgba(0,121,107,0.15), inset 0 1px 0 rgba(255,255,255,0.06)'
                : 'inset 0 1px 0 rgba(255,255,255,0.03)',
              animation: currentPeriod ? 'border-glow-teal 4s ease-in-out infinite' : 'none',
            }}
          >
            <div
              className="flex-shrink-0 px-3 py-2 flex items-center gap-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              {currentPeriod ? (
                <>
                  <span
                    className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase"
                    style={{
                      background: 'rgba(255,193,7,0.15)',
                      color: C.gold,
                      border: '1px solid rgba(255,193,7,0.35)',
                      boxShadow: '0 0 12px rgba(255,193,7,0.15)',
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ background: C.gold, boxShadow: '0 0 6px rgba(255,193,7,0.6)' }}
                    />
                    NOW
                  </span>
                  <span className="text-xs font-bold" style={{ color: C.white, fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatTime12(currentPeriod.start_time)} - {formatTime12(currentPeriod.end_time)}
                  </span>
                </>
              ) : (
                <span
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase"
                  style={{ background: 'rgba(255,255,255,0.05)', color: C.textMuted, border: `1px solid ${C.border}` }}
                >
                  <Clock className="w-3 h-3" />
                  BETWEEN CLASSES
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2 gap-1.5">
              {currentPeriod ? (
                currentPeriod.slots.map(slot => (
                  <div
                    key={slot.id}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    }}
                  >
                    <span
                      className="flex-shrink-0 px-2.5 py-0.5 rounded-md text-xs font-black tabular-nums"
                      style={{
                        background: `linear-gradient(135deg, ${C.gold}, #ffb300)`,
                        color: C.navyDarkest,
                        minWidth: '2.5rem',
                        textAlign: 'center',
                        boxShadow: '0 2px 8px rgba(255,193,7,0.25)',
                      }}
                    >
                      {slot.room_number}
                    </span>
                    <span className="font-bold text-white truncate text-sm">
                      {slot.course_offerings?.courses?.code || '-'}
                    </span>
                    <span
                      className="flex-shrink-0 text-[10px] ml-auto text-right truncate"
                      style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '6rem' }}
                    >
                      {slot.course_offerings?.teachers?.full_name || ''}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center flex-col gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px dashed ${C.borderLight}` }}
                  >
                    <Clock className="w-6 h-6" style={{ color: C.textDim }} />
                  </div>
                  <p className="text-xs font-medium" style={{ color: C.textDim }}>
                    {upcomingPeriods.length === 0 ? 'No more classes today' : 'Rooms vacant'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* UPCOMING */}
          <div
            className="min-h-0 rounded-xl overflow-hidden flex flex-col"
            style={{
              flex: upcomingFlex,
              background: `linear-gradient(135deg, ${C.navyLight} 0%, ${C.navy} 100%)`,
              border: `1px solid rgba(0,121,107,0.2)`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div
              className="flex-shrink-0 px-3 py-2 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              <span
                className="text-[10px] font-black tracking-[0.18em] uppercase flex items-center gap-1.5"
                style={{ color: C.tealLight }}
              >
                <Clock className="w-3 h-3" style={{ color: C.tealLight }} />
                Upcoming
              </span>
              {upcomingPeriods.length > 1 && (
                <div className="flex gap-1.5">
                  {upcomingPeriods.map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                      style={{
                        background: i === (upcomingIdx % upcomingPeriods.length) ? C.tealLight : C.textDim,
                        boxShadow: i === (upcomingIdx % upcomingPeriods.length) ? '0 0 6px rgba(38,166,154,0.5)' : 'none',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <AnimatePresence mode="wait">
                {upcomingPeriods.length === 0 ? (
                  <div key="empty" className="h-full flex items-center justify-center">
                    <p className="text-xs font-medium" style={{ color: C.textDim }}>No upcoming classes</p>
                  </div>
                ) : (() => {
                  const period = upcomingPeriods[upcomingIdx % upcomingPeriods.length];
                  return (
                    <motion.div key={`${upcomingIdx}-${period.start_time}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      className="h-full flex flex-col p-2 gap-1.5">
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <Clock className="w-3 h-3" style={{ color: C.tealLight }} />
                        <span className="text-xs font-bold" style={{ color: C.white, fontFamily: "'JetBrains Mono', monospace" }}>
                          {formatTime12(period.start_time)} - {formatTime12(period.end_time)}
                        </span>
                      </div>
                      {period.slots.map(slot => (
                        <div
                          key={slot.id}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <span
                            className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-black"
                            style={{
                              background: 'rgba(0,121,107,0.25)',
                              color: C.tealLight,
                              border: '1px solid rgba(0,121,107,0.4)',
                              minWidth: '2.5rem',
                              textAlign: 'center',
                            }}
                          >
                            {slot.room_number}
                          </span>
                          <span className="text-xs font-bold text-white truncate">
                            {slot.course_offerings?.courses?.code || '-'}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>
          </div>
        </section>
        )}

        {!showEventsPanel && !showRoomSchedule && (
          <section className="flex-1 min-w-0 p-4 flex items-center justify-center">
            <div
              className="text-center rounded-2xl px-8 py-10"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${C.border}`,
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px dashed ${C.borderLight}` }}
              >
                <Monitor className="w-8 h-8" style={{ color: C.textMuted }} />
              </div>
              <p className="text-lg font-semibold" style={{ color: C.textMuted }}>No main panel enabled for {target}</p>
              <p className="text-sm mt-1" style={{ color: C.textDim }}>Enable Events or Room Schedule from TV Devices settings</p>
            </div>
          </section>
        )}
      </main>

      {/* =========== BREAKING NEWS or TICKER BAR =========== */}
      {showBreakingBar ? (
        <div
          className="flex-shrink-0 flex items-stretch overflow-hidden animate-breaking-pulse"
          style={{ height: `${breakingHeight}px` }}
        >
          <div
            className="flex-shrink-0 px-4 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #b71c1c 0%, #c62828 50%, #d32f2f 100%)' }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"
              style={{ boxShadow: '0 0 8px rgba(255,255,255,0.5)' }}
            />
            <span className="text-white font-black text-[11px] tracking-[0.25em] uppercase whitespace-nowrap">
              BREAKING
            </span>
          </div>
          <div
            className="flex-1 flex items-center overflow-hidden px-4"
            style={{ background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)' }}
          >
            <MeasuredMarquee>
              {[breakingNewsText, breakingNewsText].map((text, i) => (
                <span key={i} className="mx-8 inline-flex items-center gap-3 text-sm font-bold text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0" />
                  {text}
                </span>
              ))}
            </MeasuredMarquee>
          </div>
        </div>
      ) : (
        <>
          {/* =========== TICKER BAR =========== */}
          {showTickerBar && ticker.length > 0 && (
        <div className="flex-shrink-0 flex items-stretch overflow-hidden" style={{ height: `${tickerHeight}px` }}>
          <div
            className="flex-shrink-0 px-4 flex items-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`,
              boxShadow: '4px 0 16px rgba(0,121,107,0.2)',
            }}
          >
            <Zap className="w-3.5 h-3.5 text-white" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.4))' }} />
            <span className="text-white font-black text-[11px] tracking-[0.2em] uppercase whitespace-nowrap">
              {ticker[tickerIndex]?.label || 'SPECIAL UPDATE'}
            </span>
          </div>
          <div
            className="flex-1 px-4 flex items-center overflow-hidden"
            style={{ background: `linear-gradient(90deg, ${C.navy} 0%, ${C.navyDark} 100%)`, borderTop: `1px solid ${C.border}` }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={tickerIndex}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex items-center gap-3 whitespace-nowrap overflow-hidden"
              >
                {ticker[tickerIndex] && (
                  <>
                    <span
                      className="flex-shrink-0 px-2.5 py-0.5 rounded-md text-[10px] font-bold border"
                      style={{
                        background: 'rgba(0,121,107,0.15)',
                        color: C.tealLight,
                        borderColor: 'rgba(0,121,107,0.35)',
                      }}
                    >
                      {ticker[tickerIndex].type.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                    <span className="text-white font-semibold text-sm truncate">{ticker[tickerIndex].text}</span>
                    {ticker[tickerIndex].course_code && (
                      <span className="text-xs flex-shrink-0 font-medium" style={{ color: C.textMuted }}>{ticker[tickerIndex].course_code}</span>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
            <div className="flex-shrink-0 ml-auto flex items-center gap-1.5 pl-4">
              {ticker.map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    background: i === tickerIndex ? C.teal : C.textDim,
                    boxShadow: i === tickerIndex ? '0 0 6px rgba(0,121,107,0.5)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
          )}
        </>
      )}

      {/* =========== HEADLINES MARQUEE =========== */}
      {!showBreakingBar && showHeadlinesBar && announcements.length > 0 && (
        <div className="flex-shrink-0 flex items-stretch overflow-hidden" style={{ height: `${headlinesHeight}px` }}>
          <div
            className="flex-shrink-0 px-4 flex items-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${C.gold}, #ffb300)`,
              boxShadow: '4px 0 16px rgba(255,193,7,0.2)',
            }}
          >
            <Radio className="w-3 h-3 animate-pulse" style={{ color: C.navyDarkest, filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.3))' }} />
            <span
              className="font-black text-[11px] tracking-[0.2em] uppercase whitespace-nowrap"
              style={{ color: C.navyDarkest }}
            >
              {headlinePrefix}
            </span>
          </div>
          <div className="flex-1 overflow-hidden" style={{ background: C.navyDark, borderTop: `1px solid ${C.border}` }}>
            <MeasuredMarquee>
              {[...announcements, ...announcements].map((a, i) => (
                <span key={`${a.id}-${i}`} className="mx-8 inline-flex items-center gap-3 text-sm">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: C.gold, boxShadow: '0 0 6px rgba(255,193,7,0.4)' }}
                  />
                  <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>{a.title}</span>
                  <span style={{ color: C.textMuted }}>{a.content.slice(0, 80)}</span>
                </span>
              ))}
            </MeasuredMarquee>
          </div>
        </div>
      )}
      </div>
      <TvStartupCurtain ready target={target} />
    </>
  );
}

function MeasuredMarquee({ children }: { children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [durationSeconds, setDurationSeconds] = useState(40);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const updateDuration = () => {
      const repeatedContentWidth = Math.max(1, track.scrollWidth / 2);
      setDurationSeconds(Math.max(15, repeatedContentWidth / 70));
    };
    updateDuration();
    const observer = new ResizeObserver(updateDuration);
    observer.observe(track);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div
      ref={trackRef}
      className="flex h-full items-center animate-marquee whitespace-nowrap"
      style={{ animationDuration: `${durationSeconds}s` }}
    >
      {children}
    </div>
  );
}


// ==============================================
// EventCard Component
// ==============================================

function EventCard({ event }: { event: CmsTvEvent }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [speakerImageFailed, setSpeakerImageFailed] = useState(false);
  const imageUrl = event.image_url
    ? window.electronAPI?.resolveMediaUrl(event.image_url) ?? event.image_url
    : null;
  const speakerImageUrl = event.speaker_image_url
    ? window.electronAPI?.resolveMediaUrl(event.speaker_image_url) ?? event.speaker_image_url
    : null;
  const hasImage = Boolean(imageUrl && !imageFailed);

  useEffect(() => {
    setImageFailed(false);
    setSpeakerImageFailed(false);
  }, [event.id, event.image_url, event.speaker_image_url]);

  return (
    <div className="h-full relative overflow-hidden rounded-2xl" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
      {hasImage ? (
        <img
          src={imageUrl!}
          alt={event.title}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(140deg, #002820 0%, #004d40 30%, #006654 55%, #0c2340 100%)' }}
        >
          {/* Ambient decorative elements for text-only events */}
          <div
            className="absolute top-[10%] right-[10%] w-64 h-64 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(0,121,107,0.4) 0%, transparent 70%)' }}
          />
          <div
            className="absolute bottom-[20%] left-[5%] w-48 h-48 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, rgba(255,193,7,0.3) 0%, transparent 70%)' }}
          />
        </div>
      )}

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: hasImage
            ? 'linear-gradient(to bottom, rgba(5,10,20,0.2) 0%, rgba(5,10,20,0.35) 40%, rgba(5,10,20,0.85) 100%)'
            : 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.3) 100%)',
        }}
      />

      {/* Top: Speaker + Badge */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between z-10 gap-3">
        {event.speaker_name ? (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: 'rgba(8,18,36,0.5)',
              backdropFilter: 'blur(20px) saturate(160%)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            {speakerImageUrl && !speakerImageFailed ? (
              <div
                className="relative w-11 h-11 rounded-full overflow-hidden flex-shrink-0"
                style={{
                  border: `2px solid ${C.gold}`,
                  boxShadow: '0 0 12px rgba(255,193,7,0.25)',
                }}
              >
                <img
                  src={speakerImageUrl}
                  alt={event.speaker_name}
                  className="w-full h-full object-cover"
                  onError={() => setSpeakerImageFailed(true)}
                />
              </div>
            ) : (
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(255,193,7,0.15)',
                  border: '2px solid rgba(255,193,7,0.4)',
                  boxShadow: '0 0 12px rgba(255,193,7,0.15)',
                }}
              >
                <User className="w-5 h-5" style={{ color: C.gold }} />
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-white leading-none">{event.speaker_name}</p>
              <p className="text-[11px] mt-0.5 font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Speaker</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
              CSE &middot; KUET
            </span>
          </div>
        )}
        {event.badge_text && (
          <span
            className="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest"
            style={{
              background: 'rgba(255,193,7,0.2)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,193,7,0.45)',
              color: C.gold,
              boxShadow: '0 4px 20px rgba(255,193,7,0.2)',
              textShadow: '0 1px 8px rgba(255,193,7,0.5)',
            }}
          >
            {event.badge_text}
          </span>
        )}
      </div>

      {/* Bottom: Title + Content */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
        <div
          className="rounded-2xl px-5 py-4"
          style={{
            background: 'rgba(6,14,28,0.5)',
            backdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.2), 0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {event.subtitle && (
            <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.55)', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {event.subtitle}
            </p>
          )}
          <h3
            className="font-black leading-tight mb-1"
            style={{
              fontSize: '1.5rem',
              color: '#ffffff',
              textShadow: '0 2px 12px rgba(0,0,0,0.6), 0 0 40px rgba(0,200,160,0.12)',
              letterSpacing: '-0.01em',
            }}
          >
            {event.title}
          </h3>
          {event.description && (
            <p className="text-xs leading-relaxed line-clamp-2 mb-2" style={{ color: 'rgba(255,255,255,0.55)', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              {event.description}
            </p>
          )}
          <div className="flex items-center gap-4 pt-2.5 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {event.event_date && (
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.gold, filter: 'drop-shadow(0 0 4px rgba(255,193,7,0.4))' }} />
                {formatEventDate(event.event_date)}
              </span>
            )}
            {event.event_time && (
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.gold, filter: 'drop-shadow(0 0 4px rgba(255,193,7,0.4))' }} />
                {event.event_time}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.gold, filter: 'drop-shadow(0 0 4px rgba(255,193,7,0.4))' }} />
                {event.location}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatEventDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
