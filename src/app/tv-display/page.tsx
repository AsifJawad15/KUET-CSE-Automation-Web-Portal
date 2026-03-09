'use client';

// ==========================================
// Public TV Display Page - /tv-display
// Left (68%): Liquid glass event cards, wider
// Right (32%): Time-aware live room schedule
//   - Current period - all rooms active NOW
//   - Next 2 upcoming periods, auto-slides every 20 s
// No auth required. Polls every 30 s.
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
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// - Color palette -
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

const POLL_MS = 30_000;

// - Routine helpers -

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

// A "period" = one time slot shared by multiple rooms
interface TimePeriod {
  start_time: string;
  end_time: string;
  slots: DBRoutineSlotWithDetails[];
}

function buildPeriods(slots: DBRoutineSlotWithDetails[]): TimePeriod[] {
  // The API already returns only slots valid for the requested date,
  // so no need to re-filter by day_of_week here
  const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const map = new Map<string, TimePeriod>();
  for (const s of sorted) {
    if (!map.has(s.start_time)) map.set(s.start_time, { start_time: s.start_time, end_time: s.end_time, slots: [] });
    map.get(s.start_time)!.slots.push(s);
  }
  return Array.from(map.values()).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

// - Main Component -

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
  const [upcomingIdx, setUpcomingIdx] = useState(0); // which upcoming period is shown (0 or 1)
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);

  const headlinePrefix = settings.headline_prefix || 'HEADLINES';
  const eventRotationSec = parseInt(settings.event_rotation_sec || '8', 10);

  // -- Fetch all data --
  const fetchData = useCallback(async () => {
    try {
      // Pass today's date so the API returns routine_slots valid today
      // (both permanent routines and date-scoped CR bookings)
      const todayStr = new Date().toISOString().split('T')[0];
      const [tvData, slots] = await Promise.all([
        fetchTvDisplayData(),
        getRoutineSlots(undefined, undefined, undefined, todayStr).catch(() => [] as DBRoutineSlotWithDetails[]),
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

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Clock tick every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-rotate event carousel
  useEffect(() => {
    if (events.length <= 1) return;
    if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    const maxPage = events.length - 1;
    autoRotateRef.current = setInterval(() => setEventPage(prev => (prev >= maxPage ? 0 : prev + 1)), eventRotationSec * 1000);
    return () => { if (autoRotateRef.current) clearInterval(autoRotateRef.current); };
  }, [events.length, eventRotationSec]);

  // Slide between upcoming periods every 20 s
  useEffect(() => {
    const t = setInterval(() => setUpcomingIdx(prev => (prev === 0 ? 1 : 0)), 20_000);
    return () => clearInterval(t);
  }, []);

  // Ticker rotation every 5 s
  useEffect(() => {
    if (ticker.length <= 1) return;
    const interval = setInterval(() => setTickerIndex(prev => (prev + 1) % ticker.length), 5000);
    return () => clearInterval(interval);
  }, [ticker.length]);

  // -- Schedule derived data ------------------------------
  const periods = useMemo(() => buildPeriods(routineSlots), [routineSlots]);
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const currentPeriod = useMemo(
    () => periods.find(p => nowMins >= timeToMins(p.start_time) && nowMins < timeToMins(p.end_time)) ?? null,
    [periods, nowMins],
  );
  const upcomingPeriods = useMemo(
    () => periods.filter(p => timeToMins(p.start_time) > nowMins).slice(0, 2),
    [periods, nowMins],
  );

  // -- Clock formatting --
  const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // -- Event pagination --
  const maxPage = Math.max(0, events.length - 1);
  const currentEvent = events[eventPage] ?? null;
  const prevEvents = () => setEventPage(p => (p <= 0 ? maxPage : p - 1));
  const nextEvents = () => setEventPage(p => (p >= maxPage ? 0 : p + 1));

  // -- Loading --
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: C.navyDark }}>
        <div className="flex flex-col items-center gap-4">
          <Monitor className="w-16 h-16 animate-pulse" style={{ color: C.teal }} />
          <p className="text-lg" style={{ color: C.textMuted }}>Loading TV Display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col select-none" style={{ background: C.navyDark, color: C.white }}>

      {/* =========== HEADER BAR =========== */}
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
            <span>DEPT. OF COMPUTER SCIENCE & ENGINEERING</span>
          </h1>
        </div>
        <div className="text-right px-5 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}>
          <p className="text-2xl font-mono font-bold tracking-wider tabular-nums" style={{ color: C.gold }}>{timeStr}</p>
          <p className="text-xs tracking-wide mt-0.5" style={{ color: C.textMuted }}>{dateStr}</p>
        </div>
      </header>

      {/* =========== MAIN CONTENT - 2 PANELS =========== */}
      <main className="flex-1 min-h-0 flex overflow-hidden">

        {/* ----- LEFT PANEL: News & Events (58%) ----- */}
        <section className="flex-[80] min-w-0 flex flex-col p-4 pr-2 overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between mb-2">
            <h2 className="text-sm font-black tracking-[0.2em] uppercase" style={{ color: C.gold }}>
              Department News &amp; Events
            </h2>
            {events.length > 1 && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {events.map((_, i) => (
                    <button key={i} onClick={() => setEventPage(i)}
                      className="w-1.5 h-1.5 rounded-full transition-all"
                      style={{ background: i === eventPage ? C.gold : C.textDim }} />
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
                <motion.div key={currentEvent.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.4 }}
                  className="h-full">
                  <EventCard event={currentEvent} />
                </motion.div>
              ) : (
                <div className="h-full flex items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}` }}>
                  <p style={{ color: C.textDim }}>No events to display</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* - RIGHT PANEL: Live Room Schedule (42%) - */}
        <section className="flex-[20] min-w-0 flex flex-col p-4 pl-2 overflow-hidden gap-2">
          <h2 className="flex-shrink-0 text-xs font-black tracking-[0.18em] uppercase" style={{ color: C.gold }}>
            Live Room Schedule
          </h2>

          {/* - CURRENT PERIOD (top ~55%) - */}
          <div className="flex-[55] min-h-0 rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: currentPeriod
                ? 'linear-gradient(135deg, #004d40 0%, #00695c 60%, #00796b 100%)'
                : `linear-gradient(135deg, ${C.navy} 0%, ${C.navyDark} 100%)`,
              border: `1px solid ${currentPeriod ? 'rgba(0,200,150,0.3)' : C.border}`,
            }}>
            {/* Header row */}
            <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {currentPeriod ? (
                <>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase"
                    style={{ background: 'rgba(255,193,7,0.2)', color: C.gold, border: '1px solid rgba(255,193,7,0.4)' }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.gold }} />
                    NOW
                  </span>
                  <span className="text-xs font-mono font-bold" style={{ color: C.white }}>
                    {formatTime12(currentPeriod.start_time)} - {formatTime12(currentPeriod.end_time)}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase"
                    style={{ background: 'rgba(255,255,255,0.07)', color: C.textMuted, border: `1px solid ${C.border}` }}>
                    <Clock className="w-3 h-3" />
                    BETWEEN CLASSES
                  </span>
                  {upcomingPeriods[0] && (
                    <span className="text-xs font-mono" style={{ color: C.textMuted }}>
                      Next: {formatTime12(upcomingPeriods[0].start_time)}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Slot rows */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2 gap-1.5">
              {currentPeriod ? (
                currentPeriod.slots.map(slot => (
                  <div key={slot.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-black tabular-nums"
                      style={{ background: C.gold, color: C.navyDark, minWidth: '2.5rem', textAlign: 'center' }}>
                      {slot.room_number}
                    </span>
                    <span className="font-bold text-white truncate text-sm">
                      {slot.course_offerings?.courses?.code || '-'}
                    </span>
                    <span className="flex-shrink-0 text-[11px] ml-auto text-right truncate"
                      style={{ color: 'rgba(255,255,255,0.7)', maxWidth: '7rem' }}>
                      {slot.course_offerings?.teachers?.full_name || ''}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center flex-col gap-2">
                  <Clock className="w-8 h-8" style={{ color: C.textDim }} />
                  <p className="text-xs" style={{ color: C.textDim }}>
                    {upcomingPeriods.length === 0 ? 'No more classes today' : 'Rooms vacant'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* -- UPCOMING PERIODS (bottom ~45%, slides every 20 s) -- */}
          <div className="flex-[45] min-h-0 rounded-2xl overflow-hidden flex flex-col"
            style={{ background: C.navyLight, border: `1px solid rgba(0,121,107,0.25)` }}>
            <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <span className="text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: C.tealLight }}>
                Upcoming
              </span>
              {upcomingPeriods.length > 1 && (
                <div className="flex gap-1">
                  {upcomingPeriods.map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full transition-all"
                      style={{ background: i === (upcomingIdx % upcomingPeriods.length) ? C.tealLight : C.textDim }} />
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <AnimatePresence mode="wait">
                {upcomingPeriods.length === 0 ? (
                  <div key="empty" className="h-full flex items-center justify-center">
                    <p className="text-sm" style={{ color: C.textDim }}>No upcoming classes</p>
                  </div>
                ) : (() => {
                  const period = upcomingPeriods[upcomingIdx % upcomingPeriods.length];
                  const num = (upcomingIdx % upcomingPeriods.length) + 1;
                  return (
                    <motion.div key={`${upcomingIdx}-${period.start_time}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.3 }}
                      className="h-full flex flex-col p-3 gap-2">
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <Clock className="w-3 h-3" style={{ color: C.tealLight }} />
                        <span className="text-xs font-mono font-bold" style={{ color: C.white }}>
                          {formatTime12(period.start_time)} - {formatTime12(period.end_time)}
                        </span>
                        <span className="ml-auto text-[10px] font-bold tracking-wider" style={{ color: C.textDim }}>
                          {num}/{upcomingPeriods.length}
                        </span>
                      </div>
                      {period.slots.map(slot => (
                        <div key={slot.id} className="flex items-center gap-2 px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <span className="flex-shrink-0 px-2 py-0.5 rounded text-[11px] font-black"
                            style={{ background: 'rgba(0,121,107,0.35)', color: C.tealLight, border: '1px solid rgba(0,121,107,0.5)', minWidth: '2.5rem', textAlign: 'center' }}>
                            {slot.room_number}
                          </span>
                          <span className="text-xs font-bold text-white truncate">
                            {slot.course_offerings?.courses?.code || '-'}
                          </span>
                          <span className="flex-shrink-0 text-[10px] ml-auto text-right truncate"
                            style={{ color: C.textMuted, maxWidth: '6rem' }}>
                            {slot.course_offerings?.teachers?.full_name || ''}
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
      </main>

      {/* =========== TICKER BAR =========== */}
      {ticker.length > 0 && (
        <div className="flex-shrink-0 flex items-stretch overflow-hidden" style={{ height: '36px' }}>
          <div className="flex-shrink-0 px-4 flex items-center gap-2"
            style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})` }}>
            <Zap className="w-3.5 h-3.5 text-white" />
            <span className="text-white font-black text-[11px] tracking-[0.2em] uppercase whitespace-nowrap">
              {ticker[tickerIndex]?.label || 'SPECIAL UPDATE'}
            </span>
          </div>
          <div className="flex-1 px-4 flex items-center overflow-hidden"
            style={{ background: C.navy, borderTop: `1px solid ${C.border}` }}>
            <AnimatePresence mode="wait">
              <motion.div key={tickerIndex}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 whitespace-nowrap overflow-hidden">
                {ticker[tickerIndex] && (
                  <>
                    <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border"
                      style={{ background: 'rgba(0,121,107,0.2)', color: C.tealLight, borderColor: 'rgba(0,121,107,0.4)' }}>
                      {ticker[tickerIndex].type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
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

      {/* =========== HEADLINES MARQUEE =========== */}
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


// ==============================================
// EventCard - Liquid Glass 3D Design
// - Full-card image fills entire background
// - Speaker info floats as glass panel at TOP
// - Title/content floats as glass panel at BOTTOM
// ==============================================

function EventCard({ event }: { event: CmsTvEvent }) {
  const hasImage = Boolean(event.image_url);

  return (
    <div className="h-full relative overflow-hidden rounded-2xl">

      {/* Full-card image OR gradient background */}
      {hasImage ? (
        <Image src={event.image_url!} alt={event.title} fill className="object-cover" unoptimized priority />
      ) : (
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(140deg, #002820 0%, #004d40 35%, #006654 55%, #0c2340 100%)' }} />
      )}

      {/* Base dark overlay for legibility */}
      <div className="absolute inset-0"
        style={{
          background: hasImage
            ? 'linear-gradient(to bottom, rgba(5,10,20,0.25) 0%, rgba(5,10,20,0.45) 45%, rgba(5,10,20,0.85) 100%)'
            : 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.35) 100%)',
        }} />

      {/* -- TOP GLASS PANEL: Speaker info + badge -- */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between z-10 gap-3">
        {event.speaker_name ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: 'rgba(8,18,36,0.5)',
              backdropFilter: 'blur(18px) saturate(160%)',
              WebkitBackdropFilter: 'blur(18px) saturate(160%)',
              border: '1px solid rgba(255,255,255,0.14)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}>
            {event.speaker_image_url ? (
              <div className="relative w-11 h-11 rounded-full overflow-hidden flex-shrink-0 border-2" style={{ borderColor: C.gold }}>
                <Image src={event.speaker_image_url} alt={event.speaker_name} fill className="object-cover" unoptimized />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,193,7,0.2)', border: '2px solid rgba(255,193,7,0.5)' }}>
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
          <span className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest"
            style={{
              background: 'rgba(255,193,7,0.25)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,193,7,0.5)',
              color: C.gold,
              boxShadow: '0 4px 16px rgba(255,193,7,0.2)',
              textShadow: '0 1px 8px rgba(255,193,7,0.6)',
            }}>
            {event.badge_text}
          </span>
        )}
      </div>

      {/* -- BOTTOM GLASS PANEL: Title + content + footer -- */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
        <div className="rounded-2xl px-4 py-3"
          style={{
            background: 'rgba(6,14,28,0.55)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.13)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.2), 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}>

          {event.subtitle && (
            <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {event.subtitle}
            </p>
          )}

          <h3 className="font-black leading-tight mb-1"
            style={{
              fontSize: '1.5rem',
              color: '#ffffff',
              textShadow: '0 2px 12px rgba(0,0,0,0.6), 0 0 40px rgba(0,200,160,0.15)',
              letterSpacing: '-0.01em',
            }}>
            {event.title}
          </h3>

          {event.description && (
            <p className="text-xs leading-relaxed line-clamp-2 mb-2"
              style={{ color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
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


// - Helpers -

function formatTime12(time: string | null | undefined): string {
  if (!time) return '-';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatEventDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

