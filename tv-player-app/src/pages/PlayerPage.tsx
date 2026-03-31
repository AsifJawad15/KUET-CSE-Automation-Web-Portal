// ==========================================
// TV Player Page — Fullscreen TV Display
// Adapted from the web /tv-display page to work
// inside the Electron desktop player app.
// Fetches from existing CMS tables, filtered by target.
// Subscribes to Supabase realtime for live updates.
// ==========================================

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar, ChevronLeft, ChevronRight, Clock,
  GraduationCap, MapPin, Monitor, Radio, User, Zap,
} from 'lucide-react';
import {
  supabase,
  fetchTvDisplayDataForTarget,
  type CmsTvAnnouncement,
  type CmsTvEvent,
  type CmsTvTicker,
  type TvTarget,
} from '../lib/supabase';

// Color palette (matches the web TV display)
const C = {
  navyDark: '#091428',
  navy: '#0c2340',
  navyLight: '#132e4f',
  teal: '#00796b',
  tealLight: '#26a69a',
  tealDark: '#004d40',
  gold: '#ffc107',
  white: '#ffffff',
  textMuted: 'rgba(255,255,255,0.55)',
  textDim: 'rgba(255,255,255,0.3)',
  border: 'rgba(255,255,255,0.08)',
} as const;

const POLL_MS = 30_000;

export default function PlayerPage() {
  const [searchParams] = useSearchParams();
  const target = (searchParams.get('target') || 'TV1') as TvTarget;

  // Data state
  const [announcements, setAnnouncements] = useState<CmsTvAnnouncement[]>([]);
  const [ticker, setTicker] = useState<CmsTvTicker[]>([]);
  const [events, setEvents] = useState<CmsTvEvent[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [now, setNow] = useState(new Date());
  const [eventPage, setEventPage] = useState(0);
  const [tickerIndex, setTickerIndex] = useState(0);
  const autoRotateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const headlinePrefix = settings.headline_prefix || 'HEADLINES';
  const eventRotationSec = parseInt(settings.event_rotation_sec || '8', 10);

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    try {
      const data = await fetchTvDisplayDataForTarget(target);
      setAnnouncements(data.announcements);
      setTicker(data.ticker);
      setEvents(data.events);
      setSettings(data.settings);
      setError(null);
    } catch (err) {
      console.error(`[${target}] Fetch error:`, err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [target]);

  // Initial fetch + polling + realtime
  useEffect(() => {
    fetchData();
    const pollInterval = setInterval(fetchData, POLL_MS);

    // Subscribe to realtime changes on all 3 content tables
    const channel = supabase
      .channel(`tv-display-${target}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_announcements' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_ticker' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_events' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_settings' }, () => fetchData())
      .subscribe((status) => {
        console.log(`[${target}] Realtime subscription:`, status);
      });

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [target, fetchData]);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
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
  }, [events.length, eventRotationSec]);

  // Ticker rotation
  useEffect(() => {
    if (ticker.length <= 1) return;
    const interval = setInterval(
      () => setTickerIndex((prev) => (prev + 1) % ticker.length),
      5000
    );
    return () => clearInterval(interval);
  }, [ticker.length]);

  // Clock formatting
  const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Event pagination
  const maxPage = Math.max(0, events.length - 1);
  const currentEvent = events[eventPage] ?? null;
  const prevEvents = () => setEventPage((p) => (p <= 0 ? maxPage : p - 1));
  const nextEvents = () => setEventPage((p) => (p >= maxPage ? 0 : p + 1));

  // ── Loading ──
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: C.navyDark }}>
        <div className="flex flex-col items-center gap-4">
          <Monitor className="w-16 h-16 animate-pulse" style={{ color: C.teal }} />
          <p className="text-lg" style={{ color: C.textMuted }}>Loading {target}…</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: C.navyDark }}>
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4" style={{ color: '#ef5350' }}>Connection Error</h2>
          <p className="text-lg mb-6" style={{ color: C.textMuted }}>{error}</p>
          <button
            onClick={fetchData}
            className="px-8 py-3 rounded-lg text-lg font-medium text-white"
            style={{ background: C.teal }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── No content fallback ──
  if (announcements.length === 0 && events.length === 0 && ticker.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: C.navyDark, color: C.white }}>
        <div className="text-center">
          <h2 className="text-5xl font-bold mb-6" style={{ color: 'rgba(255,255,255,0.2)' }}>{target}</h2>
          <p className="text-2xl" style={{ color: C.textDim }}>No content available. Send content from the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col select-none" style={{ background: C.navyDark, color: C.white }}>

      {/* =========== HEADER BAR =========== */}
      <header
        className="flex-shrink-0 px-6 py-2.5 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyLight} 100%)`, borderBottom: `2px solid ${C.teal}` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.teal }}>
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-wide uppercase">
            <span style={{ color: C.gold }}>KUET</span>
            <span className="mx-2" style={{ color: C.textDim }}>|</span>
            <span>{settings.department_name || 'DEPT. OF COMPUTER SCIENCE & ENGINEERING'}</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="px-3 py-1 rounded-lg text-xs font-bold tracking-widest" style={{ background: 'rgba(0,121,107,0.25)', color: C.tealLight, border: `1px solid rgba(0,121,107,0.4)` }}>
            {target}
          </span>
          <div className="text-right px-5 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}>
            <p className="text-2xl font-mono font-bold tracking-wider tabular-nums" style={{ color: C.gold }}>{timeStr}</p>
            <p className="text-xs tracking-wide mt-0.5" style={{ color: C.textMuted }}>{dateStr}</p>
          </div>
        </div>
      </header>

      {/* =========== MAIN CONTENT =========== */}
      <main className="flex-1 min-h-0 flex overflow-hidden">

        {/* Events panel */}
        <section className="flex-1 min-w-0 flex flex-col p-4 overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between mb-2">
            <h2 className="text-sm font-black tracking-[0.2em] uppercase" style={{ color: C.gold }}>
              Department News &amp; Events
            </h2>
            {events.length > 1 && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {events.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setEventPage(i)}
                      className="w-1.5 h-1.5 rounded-full transition-all"
                      style={{ background: i === eventPage ? C.gold : C.textDim }}
                    />
                  ))}
                </div>
                <button onClick={prevEvents} className="p-1 rounded" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <ChevronLeft className="w-4 h-4" style={{ color: C.textMuted }} />
                </button>
                <button onClick={nextEvents} className="p-1 rounded" style={{ background: 'rgba(255,255,255,0.07)' }}>
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
                  transition={{ duration: 0.4 }}
                  className="h-full"
                >
                  <EventCard event={currentEvent} />
                </motion.div>
              ) : (
                <div
                  className="h-full flex items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}` }}
                >
                  <p style={{ color: C.textDim }}>No events to display</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* =========== TICKER BAR =========== */}
      {ticker.length > 0 && (
        <div className="flex-shrink-0 flex items-stretch overflow-hidden" style={{ height: '36px' }}>
          <div className="flex-shrink-0 px-4 flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})` }}>
            <Zap className="w-3.5 h-3.5 text-white" />
            <span className="text-white font-black text-[11px] tracking-[0.2em] uppercase whitespace-nowrap">
              {ticker[tickerIndex]?.label || 'SPECIAL UPDATE'}
            </span>
          </div>
          <div className="flex-1 px-4 flex items-center overflow-hidden" style={{ background: C.navy, borderTop: `1px solid ${C.border}` }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={tickerIndex}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 whitespace-nowrap overflow-hidden"
              >
                {ticker[tickerIndex] && (
                  <>
                    <span
                      className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border"
                      style={{ background: 'rgba(0,121,107,0.2)', color: C.tealLight, borderColor: 'rgba(0,121,107,0.4)' }}
                    >
                      {ticker[tickerIndex].type.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                    <span className="text-white font-semibold text-sm truncate">{ticker[tickerIndex].text}</span>
                    {ticker[tickerIndex].course_code && (
                      <span className="text-xs flex-shrink-0" style={{ color: C.textMuted }}>{ticker[tickerIndex].course_code}</span>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
            <div className="flex-shrink-0 ml-auto flex items-center gap-1 pl-4">
              {ticker.map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === tickerIndex ? C.teal : C.textDim }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========== HEADLINES MARQUEE =========== */}
      {announcements.length > 0 && (
        <div className="flex-shrink-0 flex items-stretch overflow-hidden" style={{ height: '34px' }}>
          <div className="flex-shrink-0 px-4 flex items-center gap-2" style={{ background: C.gold }}>
            <Radio className="w-3 h-3 animate-pulse" style={{ color: C.navyDark }} />
            <span className="font-black text-[11px] tracking-[0.2em] uppercase whitespace-nowrap" style={{ color: C.navyDark }}>
              {headlinePrefix}
            </span>
          </div>
          <div className="flex-1 overflow-hidden" style={{ background: C.navyDark }}>
            <div className="flex h-full items-center animate-marquee whitespace-nowrap">
              {[...announcements, ...announcements].map((a, i) => (
                <span key={`${a.id}-${i}`} className="mx-8 inline-flex items-center gap-3 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: C.gold }} />
                  <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{a.title}</span>
                  <span style={{ color: C.textMuted }}>{a.content.slice(0, 80)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ==============================================
// EventCard Component
// ==============================================

function EventCard({ event }: { event: CmsTvEvent }) {
  const hasImage = Boolean(event.image_url);

  return (
    <div className="h-full relative overflow-hidden rounded-2xl">
      {hasImage ? (
        <img
          src={event.image_url!}
          alt={event.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(140deg, #002820 0%, #004d40 35%, #006654 55%, #0c2340 100%)' }}
        />
      )}

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: hasImage
            ? 'linear-gradient(to bottom, rgba(5,10,20,0.25) 0%, rgba(5,10,20,0.45) 45%, rgba(5,10,20,0.85) 100%)'
            : 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.35) 100%)',
        }}
      />

      {/* Top: Speaker + Badge */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between z-10 gap-3">
        {event.speaker_name ? (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: 'rgba(8,18,36,0.5)',
              backdropFilter: 'blur(18px) saturate(160%)',
              border: '1px solid rgba(255,255,255,0.14)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            {event.speaker_image_url ? (
              <div className="relative w-11 h-11 rounded-full overflow-hidden flex-shrink-0 border-2" style={{ borderColor: C.gold }}>
                <img src={event.speaker_image_url} alt={event.speaker_name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,193,7,0.2)', border: '2px solid rgba(255,193,7,0.5)' }}
              >
                <User className="w-5 h-5" style={{ color: C.gold }} />
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-white leading-none">{event.speaker_name}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Speaker</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>
              CSE &middot; KUET
            </span>
          </div>
        )}
        {event.badge_text && (
          <span
            className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest"
            style={{
              background: 'rgba(255,193,7,0.25)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,193,7,0.5)',
              color: C.gold,
              boxShadow: '0 4px 16px rgba(255,193,7,0.2)',
              textShadow: '0 1px 8px rgba(255,193,7,0.6)',
            }}
          >
            {event.badge_text}
          </span>
        )}
      </div>

      {/* Bottom: Title + Content */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
        <div
          className="rounded-2xl px-4 py-3"
          style={{
            background: 'rgba(6,14,28,0.55)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.13)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.2), 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {event.subtitle && (
            <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {event.subtitle}
            </p>
          )}
          <h3
            className="font-black leading-tight mb-1"
            style={{
              fontSize: '1.5rem',
              color: '#ffffff',
              textShadow: '0 2px 12px rgba(0,0,0,0.6), 0 0 40px rgba(0,200,160,0.15)',
              letterSpacing: '-0.01em',
            }}
          >
            {event.title}
          </h3>
          {event.description && (
            <p className="text-xs leading-relaxed line-clamp-2 mb-2" style={{ color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              {event.description}
            </p>
          )}
          <div className="flex items-center gap-4 pt-2 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {event.event_date && (
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.gold }} />
                {formatEventDate(event.event_date)}
              </span>
            )}
            {event.event_time && (
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.gold }} />
                {event.event_time}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.gold }} />
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
