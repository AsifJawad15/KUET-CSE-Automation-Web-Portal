"use client";

// ==========================================
// TV Viewer — Admin preview of what each TV displays
// Renders the same layout as /tv-display but filtered by target
// Admin can switch between TVs to preview their content
// ==========================================

import { cmsSupabase } from '@/services/cmsService';
import {
  fetchActiveDevices,
  fetchTvSnapshotForTarget,
} from '@/services/tvDisplayService';
import { routineDisplaySlotToDb } from '@/lib/tvRoutineAdapter';
import {
  loadTvSnapshotFromWebCache,
  prefetchTvSnapshotMedia,
  saveTvSnapshotToWebCache,
} from '@/lib/tvSnapshotCache';
import { cacheTvDisplayData, getCachedTvDisplayData, getCachedTvDisplayEntry, useNetworkStatus } from '@/lib/tvDisplayCache';
import {
  TV_DISPLAY_TIME_ZONE,
  clampSetting,
  getZonedDateKey,
  getZonedMinutes,
  mergeTvSnapshots,
} from '../../../shared/tv-display/domain';
import type { CmsTvAnnouncement, CmsTvDevice, CmsTvEvent, CmsTvTicker } from '@/types/cms';
import type { DBRoutineSlotWithDetails } from '@/types/database';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Expand,
  GraduationCap,
  MapPin,
  Minimize2,
  Monitor,
  Radio,
  RefreshCw,
  ShieldCheck,
  Tv,
  User,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Color palette (same as /tv-display)
const C = {
  navyDark: '#091428',
  navy:     '#0c2340',
  navyLight:'#132e4f',
  teal:     '#00796b',
  tealLight:'#26a69a',
  tealDark: '#004d40',
  gold:     '#ffc107',
  white:    '#ffffff',
  textMuted:'rgba(255,255,255,0.55)',
  textDim:  'rgba(255,255,255,0.3)',
  border:   'rgba(255,255,255,0.08)',
} as const;

const POLL_MS = 60_000;

// Routine helpers
function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

interface TimePeriod {
  start_time: string;
  end_time: string;
  slots: DBRoutineSlotWithDetails[];
}

function buildPeriods(slots: DBRoutineSlotWithDetails[]): TimePeriod[] {
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

function formatEventDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Main Component ──

export default function TVViewerPage({ onMenuChange }: { onMenuChange?: (id: string) => void }) {
  const [devices, setDevices] = useState<CmsTvDevice[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    try {
      const devs = await fetchActiveDevices();
      setDevices(devs);
      setSelectedTarget((current) =>
        current && devs.some((device) => device.name === current)
          ? current
          : devs[0]?.name ?? null,
      );
      setDeviceError(null);
    } catch (error) {
      console.error('Failed to load TV devices:', error);
      setDeviceError('Active TV devices could not be loaded. Check the CMS connection and try again.');
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  if (loadingDevices) {
    return (
      <div className="flex min-h-[560px] items-center justify-center p-8">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-[#3d4951] dark:bg-[#111418]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0f2947] text-white">
            <Monitor className="h-7 w-7 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Preparing screen preview</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-[#b1a7a6]">Loading active TVs and display content.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-8">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-[#3d4951] dark:bg-[#111418]">
          <div className="h-1 bg-[#d7a928]" />
          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div className="flex min-w-0 items-center gap-3.5">
            <motion.button
              whileHover={{ x: -1 }}
              whileTap={{ x: 0 }}
              onClick={() => onMenuChange?.('tv-display')}
              aria-label="Back to TV Display management"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-[#0b7f72]/10 dark:border-[#3d4951] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">TV Viewer</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Preview ready
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-[#b1a7a6]">
                Complete 16:9 preview of the content shown on each registered screen.
              </p>
            </div>
          </div>

            <div className="flex items-center gap-2 self-stretch lg:self-auto">
              <label className="min-w-0 flex-1 lg:hidden">
                <span className="sr-only">Select TV screen</span>
                <select
                  value={selectedTarget ?? ''}
                  onChange={(event) => setSelectedTarget(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#0b7f72] focus:ring-4 focus:ring-[#0b7f72]/10 dark:border-[#3d4951] dark:bg-[#0b0d10] dark:text-white"
                >
                  {devices.map((device) => (
                    <option key={device.id} value={device.name}>
                      {device.name}{device.label ? ` — ${device.label}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div role="tablist" aria-label="TV screens" className="hidden max-w-[900px] items-center gap-2 overflow-x-auto lg:flex">
                {devices.map((device) => {
                  const selected = selectedTarget === device.name;
                  return (
                    <motion.button
                      key={device.id}
                      role="tab"
                      aria-selected={selected}
                      whileHover={{ y: -1 }}
                      whileTap={{ y: 0 }}
                      onClick={() => setSelectedTarget(device.name)}
                      className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-[#0b7f72]/10 ${
                        selected
                          ? 'bg-[#0f2947] text-white shadow-sm'
                          : 'border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-[#3d4951] dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                      }`}
                    >
                      <Tv className={`h-4 w-4 ${selected ? 'text-[#85d5cc]' : ''}`} />
                      <span>{device.name}</span>
                      {device.label && (
                        <span className={`max-w-36 truncate text-xs ${selected ? 'text-white/65' : 'text-slate-400'}`}>
                          {device.label}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadDevices();
                  setPreviewRevision((value) => value + 1);
                }}
                aria-label="Refresh TV preview"
                className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-[#0b7f72]/10 dark:border-[#3d4951] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {deviceError && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            <WifiOff className="mt-0.5 h-5 w-5 flex-none" />
            <p className="flex-1 text-sm font-medium">{deviceError}</p>
            <button type="button" onClick={() => void loadDevices()} className="rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-red-100 dark:hover:bg-white/10">
              Try again
            </button>
          </div>
        )}

        {selectedTarget ? (
          <TVPreviewStage
            target={selectedTarget}
            label={devices.find((device) => device.name === selectedTarget)?.label ?? null}
          >
            <TVPreview
              key={`${selectedTarget}-${previewRevision}`}
              target={selectedTarget}
              showRoomSchedule={devices.find((device) => device.name === selectedTarget)?.show_room_schedule ?? true}
            />
          </TVPreviewStage>
        ) : (
          <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/60 px-6 dark:border-[#3d4951] dark:bg-white/[0.02]">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-300">
                <Tv className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">No active TV screens</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-[#b1a7a6]">
                Add or activate a device from TV Display Management, then return here to preview it.
              </p>
              <button
                type="button"
                onClick={() => onMenuChange?.('tv-display')}
                className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0f2947] px-4 text-sm font-bold text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Manage TV devices
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ══════════════════════════════════════
// Preview Stage — maintains a complete 16:9 canvas at every viewport size
// ══════════════════════════════════════

const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 720;

function TVPreviewStage({
  target,
  label,
  children,
}: {
  target: string;
  label: string | null;
  children: ReactNode;
}) {
  const stageRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const measure = () => {
      const bounds = node.getBoundingClientRect();
      setViewport({
        width: Math.max(0, bounds.width - 32),
        height: Math.max(0, bounds.height - 32),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const scale = viewport.width && viewport.height
    ? Math.min(viewport.width / PREVIEW_WIDTH, viewport.height / PREVIEW_HEIGHT)
    : 0;
  const fittedWidth = Math.round(PREVIEW_WIDTH * scale);
  const fittedHeight = Math.round(PREVIEW_HEIGHT * scale);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await stageRef.current?.requestFullscreen();
      }
    } catch (error) {
      console.error('Unable to change preview fullscreen state:', error);
    }
  };

  return (
    <section
      ref={stageRef}
      className={`flex w-full flex-col overflow-hidden border bg-[#07111f] shadow-[0_24px_60px_-30px_rgba(9,20,40,0.85)] ${
        isFullscreen
          ? 'h-screen rounded-none border-0'
          : 'rounded-3xl border-slate-300 dark:border-[#3d4951]'
      }`}
      style={isFullscreen ? undefined : { height: 'clamp(520px, calc(100dvh - 220px), 960px)' }}
    >
      <div className="flex min-h-14 flex-none items-center justify-between gap-3 border-b border-white/10 bg-[#0f2947] px-4 text-white sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#0b7f72]">
            <Tv className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-bold">{target}</h2>
              <span className="hidden rounded-md border border-[#d7a928]/40 bg-[#d7a928]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#f4d775] sm:inline">
                HD 16:9 preview
              </span>
            </div>
            <p className="truncate text-[11px] text-slate-400">{label || 'Department TV screen'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold text-emerald-100 sm:inline-flex">
            <ShieldCheck className="h-3 w-3" />
            Fit to viewport
          </span>
          <span className="hidden font-mono text-[10px] tabular-nums text-slate-400 md:inline">
            {fittedWidth || '—'} × {fittedHeight || '—'}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen preview' : 'Open fullscreen preview'}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-bold text-white transition-colors hover:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-[#85d5cc]"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      <div ref={viewportRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#050b13] p-4">
        {scale > 0 && (
          <div
            className="relative flex-none overflow-hidden rounded-lg bg-[#091428] ring-1 ring-white/10"
            style={{ width: `${fittedWidth}px`, height: `${fittedHeight}px` }}
          >
            <div
              style={{
                width: `${PREVIEW_WIDTH}px`,
                height: `${PREVIEW_HEIGHT}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              {children}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}


// ══════════════════════════════════════
// TVPreview — Renders the same layout as /tv-display
// filtered by a specific target
// ══════════════════════════════════════

function TVPreview({ target, showRoomSchedule }: { target: string; showRoomSchedule: boolean }) {
  const [announcements, setAnnouncements] = useState<CmsTvAnnouncement[]>([]);
  const [ticker, setTicker] = useState<CmsTvTicker[]>([]);
  const [events, setEvents] = useState<CmsTvEvent[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [routineSlots, setRoutineSlots] = useState<DBRoutineSlotWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline] = useNetworkStatus();
  const [wasOffline, setWasOffline] = useState(false);

  const [now, setNow] = useState(new Date());
  const [eventPage, setEventPage] = useState(0);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [upcomingIdx, setUpcomingIdx] = useState(0);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);

  const headlinePrefix = settings.headline_prefix || 'HEADLINES';
  const eventRotationSec = clampSetting(settings.event_rotation_sec, 8, 3, 120);

  // Layout flex ratios and heights from settings (falling back to global then defaults)
  const eventsFlex = parseInt(settings[`events_flex_${target}`] || settings.events_flex_all || '80', 10);
  const scheduleFlex = parseInt(settings[`schedule_flex_${target}`] || settings.schedule_flex_all || '20', 10);
  const currentFlex = parseInt(settings[`current_flex_${target}`] || settings.current_flex_all || '55', 10);
  const upcomingFlex = parseInt(settings[`upcoming_flex_${target}`] || settings.upcoming_flex_all || '45', 10);

  const tickerHeightRaw = parseInt(settings[`ticker_height_${target}`] || settings.ticker_height_all || '38', 10);
  const headlinesHeightRaw = parseInt(settings[`headlines_height_${target}`] || settings.headlines_height_all || '36', 10);
  const breakingHeightRaw = parseInt(settings[`breaking_height_${target}`] || settings.breaking_height_all || '54', 10);

  // Scaled down sizes for preview view (using 0.75 scaling factor)
  const tickerHeight = Math.round(tickerHeightRaw * 0.75);
  const headlinesHeight = Math.round(headlinesHeightRaw * 0.75);
  const breakingHeight = Math.round(breakingHeightRaw * 0.75);

  // Fetch data filtered by target — always fetch everything independently of showRoomSchedule
  const fetchData = useCallback(async () => {
    try {
      const todayStr = getZonedDateKey(new Date(), TV_DISPLAY_TIME_ZONE);
      const freshSnapshot = await fetchTvSnapshotForTarget(target);
      const previous = freshSnapshot.errors
        ? await loadTvSnapshotFromWebCache(target).catch(() => null)
        : null;
      const snapshot = mergeTvSnapshots(previous?.snapshot ?? null, freshSnapshot);
      const content = snapshot.content;
      const tvData = {
        announcements: (content?.announcements ?? []) as CmsTvAnnouncement[],
        ticker: (content?.ticker ?? []) as CmsTvTicker[],
        events: (content?.events ?? []) as CmsTvEvent[],
        settings: content?.settings ?? {},
      };
      setAnnouncements(tvData.announcements);
      setTicker(tvData.ticker);
      setEvents(tvData.events);
      setSettings(tvData.settings);
      setRoutineSlots(
        (snapshot.schedule?.days[todayStr] ?? []).map(routineDisplaySlotToDb),
      );
      
      // Cache the fetched data
      cacheTvDisplayData(target, tvData);
      void saveTvSnapshotToWebCache(snapshot);
      void prefetchTvSnapshotMedia(snapshot);
      
      setWasOffline(false);
    } catch (err) {
      console.error('TV Viewer fetch error:', err);
      const cachedSnapshot = await loadTvSnapshotFromWebCache(target).catch(() => null);
      if (cachedSnapshot) {
        const content = cachedSnapshot.snapshot.content;
        const todayStr = getZonedDateKey(new Date(), TV_DISPLAY_TIME_ZONE);
        setAnnouncements((content?.announcements ?? []) as CmsTvAnnouncement[]);
        setTicker((content?.ticker ?? []) as CmsTvTicker[]);
        setEvents((content?.events ?? []) as CmsTvEvent[]);
        setSettings(content?.settings ?? {});
        setRoutineSlots(
          (cachedSnapshot.snapshot.schedule?.days[todayStr] ?? []).map(routineDisplaySlotToDb),
        );
        setWasOffline(true);
        return;
      }

      // Try to load from cache on error
      const cachedData = getCachedTvDisplayData(target);
      if (cachedData) {
        console.log('Loading from cache due to fetch error');
        setAnnouncements(cachedData.announcements);
        setTicker(cachedData.ticker);
        setEvents(cachedData.events);
        setSettings(cachedData.settings);
        setWasOffline(true);
      }
      // Keep the previous routine slot state while offline.
    } finally {
      setLoading(false);
    }
  }, [target]);

  // Initial fetch + polling
  useEffect(() => {
    setLoading(true);
    setEventPage(0);
    setTickerIndex(0);
    fetchData();
    const interval = setInterval(fetchData, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle online/offline transitions
  useEffect(() => {
    if (isOnline && wasOffline) {
      console.log('Internet connection restored, attempting fresh fetch...');
      setWasOffline(false);
      fetchData();
    } else if (!isOnline && !wasOffline) {
      console.log('Internet connection lost');
      setWasOffline(true);
    }
  }, [isOnline, wasOffline, fetchData]);

  // Realtime subscription for content tables
  useEffect(() => {
    const channel = cmsSupabase
      .channel(`tv-viewer-${target}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_announcements' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_ticker' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_events' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_settings' }, () => fetchData())
      .subscribe();

    return () => { cmsSupabase.removeChannel(channel); };
  }, [target, fetchData]);

  // Minute-aligned clock; the display does not render seconds.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (eventPage >= events.length) setEventPage(0);
  }, [eventPage, events.length]);

  useEffect(() => {
    if (tickerIndex >= ticker.length) setTickerIndex(0);
  }, [tickerIndex, ticker.length]);

  // Auto-rotate events
  useEffect(() => {
    if (events.length <= 1) return;
    if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    const maxPage = events.length - 1;
    autoRotateRef.current = setInterval(() => setEventPage(prev => (prev >= maxPage ? 0 : prev + 1)), eventRotationSec * 1000);
    return () => { if (autoRotateRef.current) clearInterval(autoRotateRef.current); };
  }, [events.length, eventRotationSec]);

  // Slide upcoming periods
  useEffect(() => {
    const t = setInterval(() => setUpcomingIdx(prev => (prev === 0 ? 1 : 0)), 20_000);
    return () => clearInterval(t);
  }, []);

  // Ticker rotation
  useEffect(() => {
    if (ticker.length <= 1) return;
    const interval = setInterval(() => setTickerIndex(prev => (prev + 1) % ticker.length), 5000);
    return () => clearInterval(interval);
  }, [ticker.length]);

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
  const prevEvents = () => setEventPage(p => (p <= 0 ? maxPage : p - 1));
  const nextEvents = () => setEventPage(p => (p >= maxPage ? 0 : p + 1));

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

  const isTargetSectionEnabled = (section: 'events' | 'ticker' | 'headlines') => {
    const value = settings[`tv_show_${section}_${target}`];
    if (!value) return true;
    return value !== 'false' && value !== '0';
  };

  const showEventsPanel = isTargetSectionEnabled('events');
  const showTickerBar = isTargetSectionEnabled('ticker');
  const showHeadlinesBar = isTargetSectionEnabled('headlines');
  const showBreakingBar = breakingNewsActive && showTickerBar;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: C.navyDark }}>
        <div className="flex flex-col items-center gap-4">
          <Monitor className="w-12 h-12 animate-pulse" style={{ color: C.teal }} />
          <p className="text-sm" style={{ color: C.textMuted }}>Loading {target} content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col select-none" style={{ background: C.navyDark, color: C.white }}>
      {/* HEADER BAR */}
      <header
        className="flex-shrink-0 px-4 py-2 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyLight} 100%)`, borderBottom: `2px solid ${C.teal}` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.teal }}>
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-sm font-bold tracking-wide uppercase">
            <span style={{ color: C.gold }}>KUET</span>
            <span className="mx-2" style={{ color: C.textDim }}>|</span>
            <span>CSE</span>
            <span className="mx-2" style={{ color: C.textDim }}>|</span>
            <span className="px-2 py-0.5 rounded text-xs font-black" style={{ background: 'rgba(255,193,7,0.2)', color: C.gold, border: '1px solid rgba(255,193,7,0.4)' }}>
              {target}
            </span>
          </h1>
        </div>
        <div className="text-right px-3 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}>
          <p className="text-lg font-mono font-bold tracking-wider tabular-nums" style={{ color: C.gold }}>{timeStr}</p>
          <p className="text-[10px] tracking-wide mt-0.5" style={{ color: C.textMuted }}>{dateStr}</p>
        </div>
      </header>

      {/* OFFLINE STATUS WARNING BAR */}
      {wasOffline && (
        <div 
          className="flex-shrink-0 px-4 py-1.5 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white text-[11px] font-bold tracking-wide transition-all z-20 border-b border-amber-800"
        >
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>OFFLINE MODE &mdash; Displaying cached screen as of {
            (() => {
              const entry = getCachedTvDisplayEntry(target);
              return entry ? new Date(entry.timestamp).toLocaleString() : 'recently';
            })()
          }</span>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 min-h-0 flex overflow-hidden">
        {/* LEFT: Events */}
        {showEventsPanel && (
         <section
          className="min-w-0 flex flex-col p-3 overflow-hidden"
          style={{
            flex: showRoomSchedule ? eventsFlex : 1,
            paddingRight: showRoomSchedule ? '6px' : '12px'
          }}
        >
          <div className="flex-shrink-0 flex items-center justify-between mb-1.5">
            <h2 className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: C.gold }}>
              News &amp; Events
            </h2>
            {events.length > 1 && (
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {events.map((_, i) => (
                    <button key={i} onClick={() => setEventPage(i)}
                      className="w-1 h-1 rounded-full transition-all"
                      style={{ background: i === eventPage ? C.gold : C.textDim }} />
                  ))}
                </div>
                <button onClick={prevEvents} className="p-0.5 rounded" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <ChevronLeft className="w-3 h-3" style={{ color: C.textMuted }} />
                </button>
                <button onClick={nextEvents} className="p-0.5 rounded" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <ChevronRight className="w-3 h-3" style={{ color: C.textMuted }} />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait">
              {currentEvent ? (
                <motion.div key={currentEvent.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.4 }}
                  className="h-full">
                  <EventCard event={currentEvent} />
                </motion.div>
              ) : (
                <div className="h-full flex items-center justify-center rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}>
                  <div className="text-center">
                    <Monitor className="w-10 h-10 mx-auto mb-2" style={{ color: C.textMuted }} />
                    <p className="text-sm font-medium" style={{ color: C.textMuted }}>No events for {target}</p>
                    <p className="text-[10px] mt-1" style={{ color: C.textDim }}>Add events from the Events tab</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>
        )}

        {/* RIGHT: Schedule */}
        {showRoomSchedule && (
         <section
          className="min-w-0 flex flex-col p-3 overflow-hidden gap-1.5"
          style={{
            flex: showEventsPanel ? scheduleFlex : 1,
            paddingLeft: showEventsPanel ? '6px' : '12px'
          }}
        >
          <h2 className="flex-shrink-0 text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: C.gold }}>
            Live Room Schedule
          </h2>

          {/* CURRENT PERIOD */}
           <div className="min-h-0 rounded-xl overflow-hidden flex flex-col"
            style={{
              flex: currentFlex,
              background: currentPeriod
                ? 'linear-gradient(135deg, #004d40 0%, #00695c 60%, #00796b 100%)'
                : `linear-gradient(135deg, ${C.navy} 0%, ${C.navyDark} 100%)`,
              border: `1px solid ${currentPeriod ? 'rgba(0,200,150,0.3)' : C.border}`,
            }}>
            <div className="flex-shrink-0 px-2 py-1.5 flex items-center gap-1.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {currentPeriod ? (
                <>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase"
                    style={{ background: 'rgba(255,193,7,0.2)', color: C.gold, border: '1px solid rgba(255,193,7,0.4)' }}>
                    <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: C.gold }} />
                    NOW
                  </span>
                  <span className="text-[10px] font-mono font-bold" style={{ color: C.white }}>
                    {formatTime12(currentPeriod.start_time)} - {formatTime12(currentPeriod.end_time)}
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase"
                  style={{ background: 'rgba(255,255,255,0.07)', color: C.textMuted, border: `1px solid ${C.border}` }}>
                  <Clock className="w-2.5 h-2.5" />
                  BETWEEN CLASSES
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-1.5 gap-1">
              {currentPeriod ? (
                currentPeriod.slots.map(slot => (
                  <div key={slot.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded-md"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black tabular-nums"
                      style={{ background: C.gold, color: C.navyDark, minWidth: '2rem', textAlign: 'center' }}>
                      {slot.room_number}
                    </span>
                    <span className="font-bold text-white truncate text-xs">
                      {slot.course_offerings?.courses?.code || '-'}
                    </span>
                    <span className="flex-shrink-0 text-[9px] ml-auto text-right truncate"
                      style={{ color: 'rgba(255,255,255,0.7)', maxWidth: '5rem' }}>
                      {slot.course_offerings?.teachers?.full_name || ''}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center flex-col gap-1">
                  <Clock className="w-6 h-6" style={{ color: C.textDim }} />
                  <p className="text-[10px]" style={{ color: C.textDim }}>
                    {upcomingPeriods.length === 0 ? 'No more classes today' : 'Rooms vacant'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* UPCOMING */}
           <div className="min-h-0 rounded-xl overflow-hidden flex flex-col"
            style={{
              flex: upcomingFlex,
              background: C.navyLight,
              border: `1px solid rgba(0,121,107,0.25)`
            }}>
            <div className="flex-shrink-0 px-2 py-1.5 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <span className="text-[9px] font-black tracking-[0.18em] uppercase" style={{ color: C.tealLight }}>
                Upcoming
              </span>
              {upcomingPeriods.length > 1 && (
                <div className="flex gap-0.5">
                  {upcomingPeriods.map((_, i) => (
                    <div key={i} className="w-1 h-1 rounded-full transition-all"
                      style={{ background: i === (upcomingIdx % upcomingPeriods.length) ? C.tealLight : C.textDim }} />
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <AnimatePresence mode="wait">
                {upcomingPeriods.length === 0 ? (
                  <div key="empty" className="h-full flex items-center justify-center">
                    <p className="text-xs" style={{ color: C.textDim }}>No upcoming classes</p>
                  </div>
                ) : (() => {
                  const period = upcomingPeriods[upcomingIdx % upcomingPeriods.length];
                  return (
                    <motion.div key={`${upcomingIdx}-${period.start_time}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.3 }}
                      className="h-full flex flex-col p-2 gap-1">
                      <div className="flex-shrink-0 flex items-center gap-1.5">
                        <Clock className="w-2.5 h-2.5" style={{ color: C.tealLight }} />
                        <span className="text-[10px] font-mono font-bold" style={{ color: C.white }}>
                          {formatTime12(period.start_time)} - {formatTime12(period.end_time)}
                        </span>
                      </div>
                      {period.slots.map(slot => (
                        <div key={slot.id} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black"
                            style={{ background: 'rgba(0,121,107,0.35)', color: C.tealLight, border: '1px solid rgba(0,121,107,0.5)', minWidth: '2rem', textAlign: 'center' }}>
                            {slot.room_number}
                          </span>
                          <span className="text-[10px] font-bold text-white truncate">
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
          <section className="flex-1 min-w-0 p-3 flex items-center justify-center">
            <div className="text-center rounded-xl px-4 py-6"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}>
              <Monitor className="w-10 h-10 mx-auto mb-2" style={{ color: C.textMuted }} />
              <p className="text-sm font-medium" style={{ color: C.textMuted }}>No main panel enabled for {target}</p>
              <p className="text-[10px] mt-1" style={{ color: C.textDim }}>Enable Events or Room Schedule from TV Devices settings</p>
            </div>
          </section>
        )}
      </main>

      {/* BREAKING NEWS or TICKER + HEADLINES */}
      {showBreakingBar ? (
        <div className="flex-shrink-0 flex items-stretch overflow-hidden" style={{ height: `${breakingHeight}px` }}>
          <div className="flex-shrink-0 px-4 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #b71c1c 0%, #d32f2f 100%)' }}>
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white font-black text-xs tracking-[0.25em] uppercase whitespace-nowrap">
              BREAKING
            </span>
          </div>
          <div className="flex-1 flex items-center overflow-hidden px-4"
            style={{ background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)' }}>
            <div className="flex h-full items-center animate-marquee whitespace-nowrap">
              {[breakingNewsText, breakingNewsText].map((text, i) => (
                <span key={i} className="mx-8 inline-flex items-center gap-3 text-sm font-bold text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0" />
                  {text}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* TICKER BAR */}
          {showTickerBar && ticker.length > 0 && (
        <div className="flex-shrink-0 flex items-stretch overflow-hidden" style={{ height: `${tickerHeight}px` }}>
          <div className="flex-shrink-0 px-3 flex items-center gap-1.5"
            style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})` }}>
            <Zap className="w-3 h-3 text-white" />
            <span className="text-white font-black text-[10px] tracking-[0.2em] uppercase whitespace-nowrap">
              {ticker[tickerIndex]?.label || 'UPDATE'}
            </span>
          </div>
          <div className="flex-1 px-3 flex items-center overflow-hidden"
            style={{ background: C.navy, borderTop: `1px solid ${C.border}` }}>
            <AnimatePresence mode="wait">
              <motion.div key={tickerIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
                {ticker[tickerIndex] && (
                  <>
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold border"
                      style={{ background: 'rgba(0,121,107,0.2)', color: C.tealLight, borderColor: 'rgba(0,121,107,0.4)' }}>
                      {ticker[tickerIndex].type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                    <span className="text-white font-semibold text-xs truncate">{ticker[tickerIndex].text}</span>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* HEADLINES MARQUEE */}
      {showHeadlinesBar && announcements.length > 0 && (
        <div className="flex-shrink-0 flex items-stretch overflow-hidden" style={{ height: `${headlinesHeight}px` }}>
          <div className="flex-shrink-0 px-3 flex items-center gap-1.5" style={{ background: C.gold }}>
            <Radio className="w-2.5 h-2.5 animate-pulse" style={{ color: C.navyDark }} />
            <span className="font-black text-[10px] tracking-[0.2em] uppercase whitespace-nowrap" style={{ color: C.navyDark }}>
              {headlinePrefix}
            </span>
          </div>
          <div className="flex-1 overflow-hidden" style={{ background: C.navyDark }}>
            <div className="flex h-full items-center animate-marquee whitespace-nowrap">
              {[...announcements, ...announcements].map((a, i) => (
                <span key={`${a.id}-${i}`} className="mx-6 inline-flex items-center gap-2 text-xs">
                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: C.gold }} />
                  <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{a.title}</span>
                  <span style={{ color: C.textMuted }}>{a.content.slice(0, 60)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
        </>
      )}

      <style jsx>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { animation: marquee 35s linear infinite; }
      `}</style>
    </div>
  );
}


// ══════════════════════════════════════
// EventCard (same as /tv-display)
// ══════════════════════════════════════

function EventCard({ event }: { event: CmsTvEvent }) {
  const hasImage = Boolean(event.image_url);

  return (
    <div className="h-full relative overflow-hidden rounded-xl">
      {hasImage ? (
        <Image src={event.image_url!} alt={event.title} fill className="object-cover" unoptimized priority />
      ) : (
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(140deg, #002820 0%, #004d40 35%, #006654 55%, #0c2340 100%)' }} />
      )}

      <div className="absolute inset-0"
        style={{
          background: hasImage
            ? 'linear-gradient(to bottom, rgba(5,10,20,0.25) 0%, rgba(5,10,20,0.45) 45%, rgba(5,10,20,0.85) 100%)'
            : 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.35) 100%)',
        }} />

      {/* TOP: Speaker + badge */}
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between z-10 gap-2">
        {event.speaker_name ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: 'rgba(8,18,36,0.5)',
              backdropFilter: 'blur(18px) saturate(160%)',
              WebkitBackdropFilter: 'blur(18px) saturate(160%)',
              border: '1px solid rgba(255,255,255,0.14)',
            }}>
            {event.speaker_image_url ? (
              <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border-2" style={{ borderColor: C.gold }}>
                <Image src={event.speaker_image_url} alt={event.speaker_name} fill className="object-cover" unoptimized />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,193,7,0.2)', border: '2px solid rgba(255,193,7,0.5)' }}>
                <User className="w-4 h-4" style={{ color: C.gold }} />
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-white leading-none">{event.speaker_name}</p>
              <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Speaker</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <GraduationCap className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.35)' }} />
            <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>
              CSE &middot; KUET
            </span>
          </div>
        )}
        {event.badge_text && (
          <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest"
            style={{
              background: 'rgba(255,193,7,0.25)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,193,7,0.5)',
              color: C.gold,
            }}>
            {event.badge_text}
          </span>
        )}
      </div>

      {/* BOTTOM: Title + details */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-2">
        <div className="rounded-xl px-3 py-2"
          style={{
            background: 'rgba(6,14,28,0.55)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.13)',
          }}>
          {event.subtitle && (
            <p className="text-[10px] font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {event.subtitle}
            </p>
          )}
          <h3 className="font-black leading-tight mb-1"
            style={{ fontSize: '1.1rem', color: '#ffffff', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
            {event.title}
          </h3>
          {event.description && (
            <p className="text-[10px] leading-relaxed line-clamp-2 mb-1.5"
              style={{ color: 'rgba(255,255,255,0.6)' }}>
              {event.description}
            </p>
          )}
          <div className="flex items-center gap-3 pt-1.5 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {event.event_date && (
              <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: C.gold }} />
                {formatEventDate(event.event_date)}
              </span>
            )}
            {event.event_time && (
              <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <Clock className="w-3 h-3 flex-shrink-0" style={{ color: C.gold }} />
                {event.event_time}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: C.gold }} />
                {event.location}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
