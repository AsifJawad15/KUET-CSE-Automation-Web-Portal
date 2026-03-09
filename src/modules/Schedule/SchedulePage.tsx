"use client";

import { DBRoutineSlotWithDetails } from '@/lib/supabase';
import { getRoutineSlots, deleteRoutineSlot } from '@/services/routineService';
import { groupSlotsForDisplay } from '@/modules/ClassRoutine/helpers';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ScheduleTableView from './ScheduleTableView';
import ScheduleGridView from './ScheduleGridView';

const JS_DAY_TO_NAME: Record<number, string> = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday' };
function getTodayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Calendar helpers ────────────────────────────────────
const CAL_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const TERMS = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'];

/** Derive term from course code, e.g. "CSE 3201" → "3-2" */
function getTermFromCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  return digits.length >= 2 ? `${digits[0]}-${digits[1]}` : '';
}

export default function SchedulePage() {
  const [rawSlots, setRawSlots] = useState<DBRoutineSlotWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [term, setTerm] = useState('all');
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Calendar month navigation state
  const selParts = selectedDate.split('-').map(Number);
  const [calYear, setCalYear] = useState(selParts[0]);
  const [calMonth, setCalMonth] = useState(selParts[1] - 1); // 0-indexed
  const calDays = useMemo(() => getCalendarDays(calYear, calMonth), [calYear, calMonth]);
  const todayStr = getTodayDateStr();

  // Group combined slots
  const displaySlots = useMemo(() => groupSlotsForDisplay(rawSlots), [rawSlots]);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const data = await getRoutineSlots(undefined, undefined, undefined, selectedDate);
    setRawSlots(data);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // Sync calendar view when selectedDate changes
  useEffect(() => {
    const p = selectedDate.split('-').map(Number);
    setCalYear(p[0]);
    setCalMonth(p[1] - 1);
  }, [selectedDate]);

  /**
   * Delete all slot IDs in a combined group.
   */
  const handleDelete = async (slotIds: string[]) => {
    if (!confirm('Delete this schedule entry?')) return;
    setDeleting(slotIds[0]);
    for (const id of slotIds) {
      const res = await deleteRoutineSlot(id);
      if (!res.success) {
        alert(res.error || 'Failed to delete');
        setDeleting(null);
        return;
      }
    }
    setRawSlots(prev => prev.filter(s => !slotIds.includes(s.id)));
    setDeleting(null);
  };

  // Apply term filter client-side (day already filtered by API via date)
  const filteredSlots = useMemo(() => {
    let result = displaySlots;
    if (term !== 'all') {
      result = result.filter(s => getTermFromCode(s.course_code) === term);
    }
    return result;
  }, [displaySlots, term]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white">Class Schedule</h1>
          <p className="text-[#8B7355] dark:text-[#b1a7a6] mt-1">Select a date to view that day&apos;s schedule</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={term}
            onChange={e => setTerm(e.target.value)}
            className="px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent text-sm"
          >
            <option value="all" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">All Terms</option>
            {TERMS.map(t => (
              <option key={t} value={t} className="bg-[#FAF7F3] dark:bg-[#161a1d]">Term {t}</option>
            ))}
          </select>
          <div className="flex bg-[#F0E4D3] dark:bg-[#0b090a] border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#D9A299] dark:bg-[#ba181b] text-white'
                  : 'text-[#5D4E37] dark:text-[#b1a7a6] hover:text-[#D9A299] dark:hover:text-white'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#D9A299] dark:bg-[#ba181b] text-white'
                  : 'text-[#5D4E37] dark:text-[#b1a7a6] hover:text-[#D9A299] dark:hover:text-white'
              }`}
            >
              Grid
            </button>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchSlots}
            className="p-2 bg-[#F0E4D3] dark:bg-[#0b090a] border border-[#DCC5B2] dark:border-[#3d4951] text-[#5D4E37] dark:text-white rounded-lg hover:bg-[#E5D5C3] dark:hover:bg-[#3d4951]/30 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Main layout: Calendar sidebar + Schedule content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Calendar ── */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="border border-[#DCC5B2] dark:border-[#3d4951] rounded-xl bg-[#FAF7F3] dark:bg-[#0b090a] p-4 lg:sticky lg:top-4">
            {/* Month/Year header with nav arrows */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => {
                  if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
                  else setCalMonth(m => m - 1);
                }}
                className="p-1.5 rounded-lg hover:bg-[#E5D5C3] dark:hover:bg-[#3d4951]/40 text-[#5D4E37] dark:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-[#5D4E37] dark:text-white tracking-wide">
                {MONTH_NAMES[calMonth]} {calYear}
              </span>
              <button
                onClick={() => {
                  if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
                  else setCalMonth(m => m + 1);
                }}
                className="p-1.5 rounded-lg hover:bg-[#E5D5C3] dark:hover:bg-[#3d4951]/40 text-[#5D4E37] dark:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {CAL_DAY_LABELS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-[#8B7355] dark:text-[#b1a7a6] py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {calDays.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} />;
                const dateStr = toDateStr(calYear, calMonth, day);
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;
                const jsDay = new Date(calYear, calMonth, day).getDay();
                const isWorkday = jsDay >= 0 && jsDay <= 4; // Sun-Thu
                const isFriSat = jsDay === 5 || jsDay === 6;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`
                      relative w-full aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all
                      ${isSelected
                        ? 'bg-[#D9A299] dark:bg-[#ba181b] text-white shadow-md scale-105'
                        : isToday
                          ? 'bg-[#D9A299]/20 dark:bg-[#ba181b]/20 text-[#D9A299] dark:text-[#ff6b6b] font-bold ring-1 ring-[#D9A299] dark:ring-[#ba181b]'
                          : isFriSat
                            ? 'text-[#c4a882] dark:text-[#555] hover:bg-[#E5D5C3]/50 dark:hover:bg-[#3d4951]/20'
                            : 'text-[#5D4E37] dark:text-white/80 hover:bg-[#E5D5C3] dark:hover:bg-[#3d4951]/40'
                      }
                    `}
                  >
                    {day}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#D9A299] dark:bg-[#ba181b]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected date display */}
            <div className="mt-3 pt-3 border-t border-[#DCC5B2] dark:border-[#3d4951] text-center">
              <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">
                Selected: <span className="font-bold text-[#5D4E37] dark:text-white">
                  {JS_DAY_TO_NAME[new Date(selectedDate + 'T00:00:00').getUTCDay()] ?? 'Weekend'},{' '}
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Schedule content ── */}
        <div className="flex-1 min-w-0">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#D9A299] dark:text-[#ba181b]" />
            </div>
          )}

          {/* Empty State */}
          {!loading && displaySlots.length === 0 && (
            <div className="text-center py-16 text-[#8B7355] dark:text-white/40">
              <p className="text-lg">No schedule entries found{term !== 'all' ? ` for Term ${term}` : ''}</p>
              <p className="text-sm mt-2">Add classes via the Class Routine page first.</p>
            </div>
          )}

          {/* Table View */}
          {!loading && displaySlots.length > 0 && viewMode === 'table' && (
            <ScheduleTableView slots={filteredSlots} deleting={deleting} onDelete={handleDelete} />
          )}

          {/* Grid View */}
          {!loading && displaySlots.length > 0 && viewMode === 'grid' && (
            <ScheduleGridView slots={filteredSlots} />
          )}
        </div>
      </div>
    </div>
  );
}
