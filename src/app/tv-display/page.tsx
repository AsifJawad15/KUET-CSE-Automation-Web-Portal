'use client';

// ==========================================
// Public TV Display Page — /tv-display
// Fullscreen display optimized for 1920×1080 TV via HDMI
// No authentication required — public page
// Auto-refreshes via polling every 30 seconds
// ==========================================

import { getRoutineSlots } from '@/services/routineService';
import { fetchTvDisplayData } from '@/services/tvDisplayService';
import type { CmsTvAnnouncement, CmsTvTicker } from '@/types/cms';
import type { DBRoutineSlotWithDetails } from '@/types/database';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Bell, BookOpen, Calendar, Clock, GraduationCap,
    LayoutDashboard, Monitor, Radio, Users, Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ── Constants ──────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const TABS = [
  { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { id: 'announcements', label: 'ANNOUNCEMENTS', icon: Bell },
  { id: 'routine', label: 'ROUTINE', icon: Clock },
  { id: 'rooms', label: 'ROOMS', icon: Monitor },
  { id: 'exams', label: 'EXAMS', icon: BookOpen },
] as const;

const DAY_MAP: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday',
};
const JS_DAY_TO_ROUTINE: Record<number, number> = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, // Sun-Thu → 0-4
};

function getTodayDayOfWeek(): number {
  const jsDay = new Date().getDay();
  return JS_DAY_TO_ROUTINE[jsDay] ?? 0;
}

// ── Priority helpers ──────────────────────────────────

function priorityColor(p: string) {
  if (p === 'high') return 'border-l-red-500 bg-red-500/5';
  if (p === 'medium') return 'border-l-amber-500 bg-amber-500/5';
  return 'border-l-emerald-500 bg-emerald-500/5';
}

function typeBadgeClass(type: string) {
  const map: Record<string, string> = {
    'class-test': 'bg-red-500/20 text-red-300 border-red-500/30',
    'lab-test': 'bg-gray-300/20 text-gray-300 border-gray-400/30',
    'assignment': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'quiz': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'event': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    'notice': 'bg-white/10 text-white/70 border-white/20',
    'other': 'bg-white/10 text-white/70 border-white/20',
  };
  return map[type] ?? map.notice;
}

function formatType(type: string) {
  return type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ── Main Component ──────────────────────────────────────

export default function TvDisplayPublicPage() {
  // Data state
  const [announcements, setAnnouncements] = useState<CmsTvAnnouncement[]>([]);
  const [ticker, setTicker] = useState<CmsTvTicker[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [routineSlots, setRoutineSlots] = useState<DBRoutineSlotWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState('announcements');
  const [now, setNow] = useState(new Date());
  const [tickerIndex, setTickerIndex] = useState(0);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);

  // ── Settings helpers ──
  const semesterLabel = settings.semester_label || 'SPRING 2026';
  const deptShort = settings.department_short || 'CSE | KUET';
  const headlinePrefix = settings.headline_prefix || 'HEADLINES';
  const rotationSec = parseInt(settings.rotation_interval_sec || '15', 10);

  // ── Fetch all data ──
  const fetchData = useCallback(async () => {
    try {
      const [tvData, slots] = await Promise.all([
        fetchTvDisplayData(),
        getRoutineSlots().catch(() => [] as DBRoutineSlotWithDetails[]),
      ]);
      setAnnouncements(tvData.announcements);
      setTicker(tvData.ticker);
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

  // Auto-rotate tabs
  useEffect(() => {
    if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    autoRotateRef.current = setInterval(() => {
      setActiveTab(prev => {
        const idx = TABS.findIndex(t => t.id === prev);
        return TABS[(idx + 1) % TABS.length].id;
      });
    }, rotationSec * 1000);
    return () => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    };
  }, [rotationSec]);

  // Ticker rotation every 5 seconds
  useEffect(() => {
    if (ticker.length <= 1) return;
    const interval = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % ticker.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [ticker.length]);

  // ── Today's routine ──
  const todaySlots = useMemo(() => {
    const today = getTodayDayOfWeek();
    return routineSlots
      .filter(s => s.day_of_week === today)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [routineSlots]);

  // ── Clock formatting ──
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b090a] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Monitor className="w-16 h-16 text-red-500 animate-pulse" />
          <p className="text-white/60 text-lg">Loading TV Display...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b090a] text-white overflow-hidden flex flex-col select-none">
      {/* ═══════════ HEADER BAR ═══════════ */}
      <header className="flex-shrink-0 bg-gradient-to-r from-[#161a1d] via-[#1a1e22] to-[#161a1d] border-b border-red-900/30 px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Logo + Live */}
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wide">
                  <span className="text-red-500">CSE</span>
                  <span className="text-white/40 mx-1">|</span>
                  <span className="text-white">KUET</span>
                </h1>
                <p className="text-[10px] text-white/40 tracking-widest uppercase">
                  Department of Computer Science & Engineering
                </p>
              </div>
            </div>

            {/* Live badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-500/30">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-red-400 font-bold text-xs tracking-widest">LIVE</span>
            </div>

            {/* Announcements badge */}
            <button
              onClick={() => setActiveTab('announcements')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 hover:border-red-500/30 transition-colors"
            >
              <Bell className="w-4 h-4 text-red-400" />
              <span className="text-white/70 text-xs font-medium tracking-wide">ANNOUNCEMENTS</span>
            </button>
          </div>

          {/* Right: Clock */}
          <div className="text-right border border-white/10 rounded-lg px-5 py-2 bg-white/[0.02]">
            <p className="text-3xl font-mono font-bold text-white tracking-wider tabular-nums">
              {timeStr}
            </p>
            <p className="text-xs text-white/40 tracking-wide">{dateStr}</p>
          </div>
        </div>
      </header>

      {/* ═══════════ TAB NAVIGATION ═══════════ */}
      <nav className="flex-shrink-0 bg-[#161a1d]/80 border-b border-white/5 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold tracking-wider transition-all relative ${
                    isActive
                      ? 'text-white'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="tvTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          {/* Semester badge */}
          <div className="px-4 py-1.5 rounded-lg border border-red-500/30 bg-red-500/5">
            <span className="text-red-400 font-bold text-xs tracking-wider">{semesterLabel}</span>
          </div>
        </div>
      </nav>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="h-full overflow-y-auto p-6"
          >
            {activeTab === 'dashboard' && (
              <DashboardTab
                announcements={announcements}
                todaySlots={todaySlots}
              />
            )}
            {activeTab === 'announcements' && (
              <AnnouncementsTab announcements={announcements} />
            )}
            {activeTab === 'routine' && (
              <RoutineTab todaySlots={todaySlots} />
            )}
            {activeTab === 'rooms' && (
              <StatsTab
                announcements={announcements}
                routineSlots={routineSlots}
              />
            )}
            {activeTab === 'exams' && (
              <ExamsTab announcements={announcements} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ═══════════ TICKER BAR (Special Update) ═══════════ */}
      {ticker.length > 0 && (
        <div className="flex-shrink-0 relative overflow-hidden">
          {/* Ticker slider */}
          <div className="flex items-stretch">
            {/* Label */}
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2.5 flex items-center gap-2 z-10 shadow-lg shadow-blue-900/30">
              <Zap className="w-4 h-4 text-white" />
              <span className="text-white font-black text-xs tracking-[0.2em] uppercase">
                {ticker[tickerIndex]?.label || 'SPECIAL UPDATE'}
              </span>
            </div>
            {/* Content */}
            <div className="flex-1 bg-gradient-to-r from-[#1a1e22] to-[#161a1d] border-t border-white/5 px-5 py-2.5 flex items-center gap-4 overflow-hidden">
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
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${typeBadgeClass(ticker[tickerIndex].type)}`}>
                        {formatType(ticker[tickerIndex].type)}
                      </span>
                      <span className="text-white font-semibold text-sm">
                        {ticker[tickerIndex].text}
                      </span>
                      {ticker[tickerIndex].course_code && (
                        <span className="text-white/40 text-xs">
                          {ticker[tickerIndex].course_code}
                        </span>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
              {/* Dots indicator */}
              <div className="flex-shrink-0 ml-auto flex items-center gap-1.5">
                {ticker.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${i === tickerIndex ? 'bg-blue-400' : 'bg-white/20'}`}
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
          <div className="flex-shrink-0 bg-red-600 px-5 py-2 flex items-center gap-2 z-10">
            <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
            <span className="text-white font-black text-xs tracking-[0.2em] uppercase">
              {headlinePrefix}
            </span>
          </div>
          {/* Scrolling marquee */}
          <div className="flex-1 bg-gradient-to-r from-red-900/30 to-[#0b090a] py-2 overflow-hidden">
            <div className="flex animate-marquee whitespace-nowrap">
              {[...announcements, ...announcements].map((a, i) => (
                <span key={`${a.id}-${i}`} className="mx-8 flex items-center gap-2 text-sm">
                  <span className="text-red-400 font-bold">●</span>
                  <span className="text-white/80 font-semibold">{a.title}</span>
                  <span className="text-white/40">{a.content.slice(0, 60)}...</span>
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
// TAB: Dashboard Overview
// ══════════════════════════════════════════════

function DashboardTab({
  announcements,
  todaySlots,
}: {
  announcements: CmsTvAnnouncement[];
  todaySlots: DBRoutineSlotWithDetails[];
}) {
  const highPriority = announcements.filter(a => a.priority === 'high');
  const todayDay = DAY_MAP[getTodayDayOfWeek()] || 'Sunday';

  return (
    <div className="grid grid-cols-3 gap-6 h-full">
      {/* Left column: Stats */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white/80 flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-red-400" />
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Announcements" value={announcements.length} color="red" />
          <StatCard label="High Priority" value={highPriority.length} color="amber" />
          <StatCard label="Today Classes" value={todaySlots.length} color="blue" />
          <StatCard label="Today" value={todayDay} color="emerald" isText />
        </div>

        {/* Quick announcements */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wider">Recent</h3>
          <div className="space-y-2">
            {announcements.slice(0, 3).map(a => (
              <div key={a.id} className={`p-3 rounded-lg border-l-4 ${priorityColor(a.priority)} border border-white/5`}>
                <p className="text-sm font-semibold text-white truncate">{a.title}</p>
                <p className="text-xs text-white/40 mt-1 truncate">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Middle column: Today's Schedule */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white/80 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          Today&apos;s Schedule — {todayDay}
        </h2>
        {todaySlots.length === 0 ? (
          <div className="flex items-center justify-center h-48 border border-white/5 rounded-xl bg-white/[0.02]">
            <p className="text-white/30 text-sm">No classes scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {todaySlots.map(slot => (
              <div key={slot.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                <div className="text-center flex-shrink-0 w-16">
                  <p className="text-xs text-red-400 font-mono font-bold">{slot.start_time?.slice(0, 5)}</p>
                  <p className="text-[10px] text-white/30">{slot.end_time?.slice(0, 5)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {slot.course_offerings?.courses?.code} — {slot.course_offerings?.courses?.title}
                  </p>
                  <p className="text-xs text-white/40 truncate">
                    {slot.course_offerings?.teachers?.full_name} • {slot.room_number}
                  </p>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  slot.course_offerings?.courses?.course_type === 'lab' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {slot.course_offerings?.courses?.course_type?.toUpperCase() || 'THEORY'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right column: High priority alerts */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white/80 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Priority Alerts
        </h2>
        {highPriority.length === 0 ? (
          <div className="flex items-center justify-center h-48 border border-white/5 rounded-xl bg-white/[0.02]">
            <p className="text-white/30 text-sm">No high priority alerts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {highPriority.map(a => (
              <div key={a.id} className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${typeBadgeClass(a.type)}`}>
                    {formatType(a.type)}
                  </span>
                  {a.course_code && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                      {a.course_code}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-white">{a.title}</p>
                <p className="text-xs text-white/40 mt-1 line-clamp-2">{a.content}</p>
                {a.scheduled_date && (
                  <p className="text-xs text-red-400/70 mt-2 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(a.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// TAB: Announcements List
// ══════════════════════════════════════════════

function AnnouncementsTab({ announcements }: { announcements: CmsTvAnnouncement[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Bell className="w-6 h-6 text-red-400" />
        <h2 className="text-2xl font-bold text-white">Announcements</h2>
        <span className="text-sm text-white/30 ml-2">{announcements.length} active</span>
      </div>

      {announcements.length === 0 ? (
        <div className="flex items-center justify-center h-64 border border-white/5 rounded-xl bg-white/[0.02]">
          <p className="text-white/30">No active announcements</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {announcements.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-xl border-l-4 ${priorityColor(a.priority)} border border-white/5 overflow-hidden hover:border-white/10 transition-all`}
            >
              <div className="p-5">
                {/* Title row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-lg font-bold text-white">{a.title}</h3>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase border ${typeBadgeClass(a.type)}`}>
                      {formatType(a.type)}
                    </span>
                    {a.course_code && (
                      <span className="px-2.5 py-1 rounded text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                        {a.course_code}
                      </span>
                    )}
                  </div>
                </div>
                {/* Content */}
                <p className="text-sm text-white/60 leading-relaxed">{a.content}</p>
                {/* Footer */}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5 text-xs text-white/30">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  {a.scheduled_date && (
                    <span className="flex items-center gap-1 text-red-400/70">
                      <Clock className="w-3.5 h-3.5" />
                      Due: {new Date(a.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  <span className="ml-auto text-white/20 capitalize">{a.priority} priority</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// TAB: Routine (Today's Schedule)
// ══════════════════════════════════════════════

function RoutineTab({ todaySlots }: { todaySlots: DBRoutineSlotWithDetails[] }) {
  const todayDay = DAY_MAP[getTodayDayOfWeek()] || 'Sunday';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Clock className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold text-white">Today&apos;s Class Routine</h2>
        <span className="text-sm text-white/30 ml-2">{todayDay} — {todaySlots.length} classes</span>
      </div>

      {todaySlots.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border border-white/5 rounded-xl bg-white/[0.02]">
          <Clock className="w-12 h-12 text-white/10 mb-3" />
          <p className="text-white/30">No classes scheduled for today</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="px-5 py-3 text-left text-xs font-bold text-white/40 uppercase tracking-wider">Time</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-white/40 uppercase tracking-wider">Course</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-white/40 uppercase tracking-wider">Teacher</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-white/40 uppercase tracking-wider">Room</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-white/40 uppercase tracking-wider">Type</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-white/40 uppercase tracking-wider">Section</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {todaySlots.map((slot, i) => (
                <motion.tr
                  key={slot.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-4">
                    <span className="font-mono text-red-400 font-semibold">{slot.start_time?.slice(0, 5)}</span>
                    <span className="text-white/20 mx-1">–</span>
                    <span className="font-mono text-white/40">{slot.end_time?.slice(0, 5)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-white">{slot.course_offerings?.courses?.code}</p>
                    <p className="text-xs text-white/40">{slot.course_offerings?.courses?.title}</p>
                  </td>
                  <td className="px-5 py-4 text-white/60">{slot.course_offerings?.teachers?.full_name || '—'}</td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-white/60 text-xs font-medium">
                      {slot.room_number || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      slot.course_offerings?.courses?.course_type === 'lab' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {slot.course_offerings?.courses?.course_type || 'Theory'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-white/40">{slot.section || '—'}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// TAB: Stats / Department Overview
// ══════════════════════════════════════════════

function StatsTab({
  announcements,
  routineSlots,
}: {
  announcements: CmsTvAnnouncement[];
  routineSlots: DBRoutineSlotWithDetails[];
}) {
  // Derive stats from available data
  const uniqueCourses = new Set(routineSlots.map(s => s.course_offerings?.courses?.code).filter(Boolean));
  const uniqueTeachers = new Set(routineSlots.map(s => s.course_offerings?.teachers?.full_name).filter(Boolean));
  const uniqueRooms = new Set(routineSlots.map(s => s.room_number).filter(Boolean));

  const stats = [
    { label: 'Active Courses', value: uniqueCourses.size || '—', icon: BookOpen, color: 'blue' },
    { label: 'Faculty Members', value: uniqueTeachers.size || '—', icon: Users, color: 'emerald' },
    { label: 'Available Rooms', value: uniqueRooms.size || '—', icon: Monitor, color: 'purple' },
    { label: 'Announcements', value: announcements.length, icon: Bell, color: 'red' },
    { label: 'Weekly Classes', value: routineSlots.length, icon: Calendar, color: 'amber' },
    { label: 'High Priority', value: announcements.filter(a => a.priority === 'high').length, icon: Zap, color: 'rose' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Users className="w-6 h-6 text-emerald-400" />
        <h2 className="text-2xl font-bold text-white">Department Statistics</h2>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const colorMap: Record<string, string> = {
            blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-400',
            emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
            purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-400',
            red: 'from-red-500/10 to-red-500/5 border-red-500/20 text-red-400',
            amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400',
            rose: 'from-rose-500/10 to-rose-500/5 border-rose-500/20 text-rose-400',
          };
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-xl border bg-gradient-to-br ${colorMap[stat.color]} p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <Icon className="w-8 h-8 opacity-80" />
                <span className="text-4xl font-bold text-white">{stat.value}</span>
              </div>
              <p className="text-sm text-white/50 font-medium">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// TAB: Exams (filtered from announcements)
// ══════════════════════════════════════════════

function ExamsTab({ announcements }: { announcements: CmsTvAnnouncement[] }) {
  const examTypes = ['class-test', 'lab-test', 'quiz'];
  const exams = announcements.filter(a => examTypes.includes(a.type));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="w-6 h-6 text-purple-400" />
        <h2 className="text-2xl font-bold text-white">Upcoming Exams & Tests</h2>
        <span className="text-sm text-white/30 ml-2">{exams.length} scheduled</span>
      </div>

      {exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border border-white/5 rounded-xl bg-white/[0.02]">
          <BookOpen className="w-12 h-12 text-white/10 mb-3" />
          <p className="text-white/30">No upcoming exams or tests</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {exams.map((exam, i) => (
            <motion.div
              key={exam.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase border ${typeBadgeClass(exam.type)}`}>
                  {formatType(exam.type)}
                </span>
                {exam.course_code && (
                  <span className="px-2.5 py-1 rounded text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                    {exam.course_code}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{exam.title}</h3>
              <p className="text-sm text-white/50 line-clamp-3">{exam.content}</p>
              {exam.scheduled_date && (
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400 font-semibold">
                    {new Date(exam.scheduled_date).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// Shared: Stat Card
// ══════════════════════════════════════════════

function StatCard({
  label,
  value,
  color,
  isText = false,
}: {
  label: string;
  value: number | string;
  color: string;
  isText?: boolean;
}) {
  const colorMap: Record<string, string> = {
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className={`${isText ? 'text-xl' : 'text-3xl'} font-bold text-white`}>{value}</p>
      <p className="text-xs text-white/40 mt-1">{label}</p>
    </div>
  );
}
