'use client';

// ==========================================
// Public TV Display Page — /tv-display
// Info Board Layout: Left events carousel + Right room schedule
// Fullscreen display optimized for 1920×1080 TV via HDMI
// No authentication required — public page
// Auto-refreshes via polling every 30 seconds
// ==========================================

import { getRoutineSlots } from '@/services/routineService';
import { fetchTvDisplayData } from '@/services/tvDisplayService';
import type { CmsTvAnnouncement, CmsTvEvent, CmsTvTicker } from '@/types/cms';
import type { DBRoutineSlotWithDetails } from '@/types/database';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Calendar, ChevronLeft, ChevronRight, Clock,
    GraduationCap, MapPin, Monitor, Radio, User, Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ── Color Palette ──────────────────────────────────────
// Deep navy base, teal accents, gold highlights
const C = {
  navyDark: '#091428',
  navy: '#0c2340',
  navyLight: '#132e4f',
  teal: '#00796b',
  tealLight: '#26a69a',
  tealDark: '#004d40',
  gold: '#ffc107',
  goldDark: '#c79100',
  white: '#ffffff',
  textMuted: 'rgba(255,255,255,0.55)',
  textDim: 'rgba(255,255,255,0.3)',
  border: 'rgba(255,255,255,0.08)',
} as const;

const POLL_INTERVAL_MS = 30_000;

const DAY_MAP: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday',
};
const JS_DAY_TO_ROUTINE: Record<number, number> = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4,
};

function getTodayDayOfWeek(): number {
  const jsDay = new Date().getDay();
  return JS_DAY_TO_ROUTINE[jsDay] ?? 0;
}

// ── Main Component ──────────────────────────────────────

export default function TvDisplayPublicPage() {
  // Data state
  const [announcements, setAnnouncements] = useState<CmsTvAnnouncement[]>([]);
  const [ticker, setTicker] = useState<CmsTvTicker[]>([]);
  const [events, setEvents] = useState<CmsTvEvent[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [routineSlots, setRoutineSlots] = useState<DBRoutineSlotWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [now, setNow] = useState(new Date());
  const [eventPage, setEventPage] = useState(0);
  const [tickerIndex, setTickerIndex] = useState(0);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);

  // ── Settings helpers ──
  const headlinePrefix = settings.headline_prefix || 'HEADLINES';
  const roomNumber = settings.tv_room_number || 'ROOM 301';
  const classLabel = settings.tv_class_label || 'CLASS 4B';
  const eventRotationSec = parseInt(settings.event_rotation_sec || '8', 10);

  // ── Fetch all data ──
  const fetchData = useCallback(async () => {
    try {
      const [tvData, slots] = await Promise.all([
        fetchTvDisplayData(),
        getRoutineSlots().catch(() => [] as DBRoutineSlotWithDetails[]),
      ]);
      setAnnouncements(tvData.announcements);
      setTicker(tvData.ticker);
      setEvents(tvData.events);
      setSettings(tvData.settings);
      setRoutineSlots(slots);
    } catch (err) {
      console.error('TV Display fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Clock tick every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-rotate event carousel
  useEffect(() => {
    if (events.length <= 2) return;
    if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    const maxPage = Math.ceil(events.length / 2) - 1;
    autoRotateRef.current = setInterval(() => {
      setEventPage(prev => (prev >= maxPage ? 0 : prev + 1));
    }, eventRotationSec * 1000);
    return () => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    };
  }, [events.length, eventRotationSec]);

  // Ticker rotation every 5 seconds
  useEffect(() => {
    if (ticker.length <= 1) return;
    const interval = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % ticker.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [ticker.length]);

  // ── URL param override for room ──
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setSettings(prev => ({ ...prev, tv_room_number: `ROOM ${roomParam}` }));
      }
    }
  }, []);

  // ── Today's routine filtered by room ──
  const roomSchedule = useMemo(() => {
    const today = getTodayDayOfWeek();
    const roomNum = roomNumber.replace(/^ROOM\s*/i, '').trim();
    return routineSlots
      .filter(s => s.day_of_week === today && s.room_number === roomNum)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [routineSlots, roomNumber]);

  // All today's slots (fallback if room filter returns nothing)
  const allTodaySlots = useMemo(() => {
    const today = getTodayDayOfWeek();
    return routineSlots
      .filter(s => s.day_of_week === today)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [routineSlots]);

  const displaySchedule = roomSchedule.length > 0 ? roomSchedule : allTodaySlots;

  // ── Clock formatting ──
  const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // ── Event pagination ──
  const maxPage = Math.max(0, Math.ceil(events.length / 2) - 1);
  const visibleEvents = events.slice(eventPage * 2, eventPage * 2 + 2);

  const prevEvents = () => setEventPage(p => (p <= 0 ? maxPage : p - 1));
  const nextEvents = () => setEventPage(p => (p >= maxPage ? 0 : p + 1));

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.navyDark }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Monitor className="w-16 h-16 animate-pulse" style={{ color: C.teal }} />
          <p className="text-lg" style={{ color: C.textMuted }}>Loading TV Display...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen overflow-hidden flex flex-col select-none"
      style={{ background: C.navyDark, color: C.white }}
    >
      {/* ═══════════ HEADER BAR ═══════════ */}
      <header
        className="flex-shrink-0 px-8 py-3"
        style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyLight} 100%)`, borderBottom: `2px solid ${C.teal}` }}
      >
        <div className="flex items-center justify-between">
          {/* Left: University name */}
          <div className="flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: C.teal }}
            >
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide uppercase">
                <span style={{ color: C.gold }}>KUET</span>
                <span className="mx-2" style={{ color: C.textDim }}>|</span>
                <span className="text-white">DEPT. OF COMPUTER SCIENCE & ENGINEERING</span>
              </h1>
            </div>
          </div>

          {/* Right: Clock */}
          <div
            className="text-right px-6 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}
          >
            <p className="text-3xl font-mono font-bold tracking-wider tabular-nums" style={{ color: C.gold }}>
              {timeStr}
            </p>
            <p className="text-xs tracking-wide" style={{ color: C.textMuted }}>
              {dateStr}
            </p>
          </div>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT — 2 PANELS ═══════════ */}
      <main className="flex-1 flex overflow-hidden">
        {/* ───── LEFT PANEL: News & Events (~55%) ───── */}
        <section className="flex-[55] flex flex-col p-6 pr-3 overflow-hidden">
          {/* Section title */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold tracking-widest uppercase" style={{ color: C.gold }}>
              Department News & Events
            </h2>
            {events.length > 2 && (
              <div className="flex items-center gap-3">
                {/* Dots */}
                <div className="flex gap-1.5">
                  {Array.from({ length: maxPage + 1 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full transition-all"
                      style={{ background: i === eventPage ? C.gold : C.textDim }}
                    />
                  ))}
                </div>
                {/* Nav arrows */}
                <button onClick={prevEvents} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <ChevronLeft className="w-5 h-5" style={{ color: C.textMuted }} />
                </button>
                <button onClick={nextEvents} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <ChevronRight className="w-5 h-5" style={{ color: C.textMuted }} />
                </button>
              </div>
            )}
          </div>

          {/* Event Cards */}
          <div className="flex-1 flex gap-5 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={eventPage}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.4 }}
                className="flex gap-5 w-full h-full"
              >
                {visibleEvents.length > 0 ? (
                  visibleEvents.map((event, idx) => (
                    <EventCard key={event.id} event={event} index={idx} />
                  ))
                ) : (
                  <div className="flex-1 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}` }}>
                    <p style={{ color: C.textDim }}>No events to display</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* ───── RIGHT PANEL: Room & Class Schedule (~45%) ───── */}
        <section className="flex-[45] flex flex-col p-6 pl-3 overflow-hidden">
          {/* Section title */}
          <h2 className="text-lg font-bold tracking-widest uppercase mb-2" style={{ color: C.gold }}>
            Room & Class Schedule
          </h2>
          {/* Room / Class badge */}
          <div className="mb-4">
            <span className="text-2xl font-black tracking-wide" style={{ color: C.tealLight }}>
              {roomNumber}
            </span>
            <span className="mx-3 text-xl" style={{ color: C.textDim }}>|</span>
            <span className="text-2xl font-black tracking-wide" style={{ color: C.tealLight }}>
              {classLabel}
            </span>
          </div>

          {/* Schedule Table */}
          <div
            className="flex-1 rounded-2xl overflow-hidden flex flex-col"
            style={{ background: C.navyLight, border: `1px solid rgba(0,121,107,0.3)` }}
          >
            {/* Table header */}
            <div
              className="grid grid-cols-[140px_1fr_180px] gap-0 flex-shrink-0"
              style={{ background: C.gold }}
            >
              <div className="px-5 py-3.5">
                <span className="text-sm font-black tracking-wider uppercase" style={{ color: C.navyDark }}>Time</span>
              </div>
              <div className="px-5 py-3.5">
                <span className="text-sm font-black tracking-wider uppercase" style={{ color: C.navyDark }}>Subject</span>
              </div>
              <div className="px-5 py-3.5">
                <span className="text-sm font-black tracking-wider uppercase" style={{ color: C.navyDark }}>Faculty</span>
              </div>
            </div>

            {/* Table rows */}
            <div className="flex-1 overflow-y-auto">
              {displaySchedule.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Clock className="w-10 h-10 mx-auto mb-3" style={{ color: C.textDim }} />
                    <p style={{ color: C.textDim }}>No classes scheduled for today</p>
                  </div>
                </div>
              ) : (
                displaySchedule.map((slot, i) => (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="grid grid-cols-[140px_1fr_180px] gap-0"
                    style={{
                      borderBottom: `1px solid ${C.border}`,
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    {/* Time */}
                    <div className="px-5 py-4 flex flex-col justify-center">
                      <span className="text-base font-mono font-bold" style={{ color: C.gold }}>
                        {formatTime12(slot.start_time)}
                      </span>
                      <span className="text-xs font-mono" style={{ color: C.textDim }}>
                        {formatTime12(slot.end_time)}
                      </span>
                    </div>
                    {/* Subject */}
                    <div className="px-5 py-4 flex flex-col justify-center">
                      <p className="text-base font-semibold text-white">
                        {slot.course_offerings?.courses?.title || slot.course_offerings?.courses?.code || '—'}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: C.textMuted }}>
                        {slot.course_offerings?.courses?.code || ''}
                        {slot.course_offerings?.courses?.course_type === 'lab' && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(0,121,107,0.25)', color: C.tealLight }}>
                            LAB
                          </span>
                        )}
                      </p>
                    </div>
                    {/* Faculty */}
                    <div className="px-5 py-4 flex items-center">
                      <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
                        {slot.course_offerings?.teachers?.full_name || '—'}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ═══════════ TICKER BAR (Special Update) ═══════════ */}
      {ticker.length > 0 && (
        <div className="flex-shrink-0 relative overflow-hidden">
          <div className="flex items-stretch">
            {/* Label */}
            <div
              className="flex-shrink-0 px-5 py-2.5 flex items-center gap-2 z-10 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${C.teal} 0%, ${C.tealDark} 100%)` }}
            >
              <Zap className="w-4 h-4 text-white" />
              <span className="text-white font-black text-xs tracking-[0.2em] uppercase">
                {ticker[tickerIndex]?.label || 'SPECIAL UPDATE'}
              </span>
            </div>
            {/* Content */}
            <div
              className="flex-1 px-5 py-2.5 flex items-center gap-4 overflow-hidden"
              style={{ background: C.navy, borderTop: `1px solid ${C.border}` }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={tickerIndex}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center gap-3 whitespace-nowrap"
                >
                  {ticker[tickerIndex] && (
                    <>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border"
                        style={{ background: 'rgba(0,121,107,0.2)', color: C.tealLight, borderColor: 'rgba(0,121,107,0.4)' }}
                      >
                        {ticker[tickerIndex].type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </span>
                      <span className="text-white font-semibold text-sm">
                        {ticker[tickerIndex].text}
                      </span>
                      {ticker[tickerIndex].course_code && (
                        <span className="text-xs" style={{ color: C.textMuted }}>
                          {ticker[tickerIndex].course_code}
                        </span>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
              {/* Dots */}
              <div className="flex-shrink-0 ml-auto flex items-center gap-1.5">
                {ticker.map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full transition-colors"
                    style={{ background: i === tickerIndex ? C.teal : C.textDim }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ HEADLINES MARQUEE ═══════════ */}
      {announcements.length > 0 && (
        <div className="flex-shrink-0 flex items-stretch overflow-hidden">
          {/* Label */}
          <div
            className="flex-shrink-0 px-5 py-2 flex items-center gap-2 z-10"
            style={{ background: C.gold }}
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" style={{ color: C.navyDark }} />
            <span className="font-black text-xs tracking-[0.2em] uppercase" style={{ color: C.navyDark }}>
              {headlinePrefix}
            </span>
          </div>
          {/* Scrolling marquee */}
          <div
            className="flex-1 py-2 overflow-hidden"
            style={{ background: `linear-gradient(90deg, ${C.goldDark}33 0%, ${C.navyDark} 20%)` }}
          >
            <div className="flex animate-marquee whitespace-nowrap">
              {[...announcements, ...announcements].map((a, i) => (
                <span key={`${a.id}-${i}`} className="mx-8 flex items-center gap-2 text-sm">
                  <span className="font-bold" style={{ color: C.gold }}>●</span>
                  <span className="font-semibold text-white/80">{a.title}</span>
                  <span style={{ color: C.textMuted }}>{a.content.slice(0, 60)}...</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Marquee CSS keyframes */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}


// ══════════════════════════════════════════════
// Event Card Component
// ══════════════════════════════════════════════

function EventCard({ event, index }: { event: CmsTvEvent; index: number }) {
  // Alternating gradient backgrounds for cards
  const gradients = [
    `linear-gradient(135deg, #004d40 0%, #00695c 40%, #00796b 100%)`,
    `linear-gradient(135deg, #0c2340 0%, #1a3a5c 40%, #264a6e 100%)`,
  ];

  return (
    <div
      className="flex-1 rounded-2xl overflow-hidden flex flex-col relative"
      style={{
        background: gradients[index % 2],
        border: `1px solid rgba(255,255,255,0.1)`,
        minWidth: 0,
      }}
    >
      {/* Decorative pattern overlay */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }} />

      <div className="relative flex-1 p-6 flex flex-col justify-between">
        {/* Top: University badge */}
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
          <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.6)' }}>
            CSE KUET
          </span>
        </div>

        {/* Middle: Content */}
        <div className="flex-1 flex flex-col justify-center">
          {event.subtitle && (
            <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {event.subtitle}
            </p>
          )}
          <h3 className="text-3xl font-black text-white leading-tight mb-3">
            {event.title}
          </h3>
          {event.description && (
            <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {event.description}
            </p>
          )}

          {/* Speaker badge */}
          {event.speaker_name && (
            <div className="mt-4 inline-flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,193,7,0.25)', border: '2px solid rgba(255,193,7,0.5)' }}
              >
                <User className="w-4 h-4" style={{ color: '#ffc107' }} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">{event.speaker_name}</p>
                {event.badge_text && (
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{ background: 'rgba(255,193,7,0.25)', color: '#ffc107' }}
                  >
                    {event.badge_text}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Non-speaker badge */}
          {!event.speaker_name && event.badge_text && (
            <div className="mt-4">
              <span
                className="inline-block px-3 py-1 rounded-lg text-xs font-bold"
                style={{ background: 'rgba(255,193,7,0.2)', color: '#ffc107', border: '1px solid rgba(255,193,7,0.3)' }}
              >
                {event.badge_text}
              </span>
            </div>
          )}
        </div>

        {/* Bottom: Date / Time / Location */}
        <div className="flex items-center gap-5 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {event.event_date && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" style={{ color: '#ffc107' }} />
              <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {formatEventDate(event.event_date)}
              </span>
            </div>
          )}
          {event.event_time && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" style={{ color: '#ffc107' }} />
              <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {event.event_time}
              </span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" style={{ color: '#ffc107' }} />
              <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {event.location}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════

function formatTime12(time: string | null | undefined): string {
  if (!time) return '—';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
