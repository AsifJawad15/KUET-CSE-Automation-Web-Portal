"use client";

import { DBRoutineSlotWithDetails } from '@/lib/supabase';
import { getRoutineSlots, deleteRoutineSlot } from '@/services/routineService';
import { groupSlotsForDisplay } from '@/modules/ClassRoutine/helpers';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ScheduleTableView from './ScheduleTableView';
import ScheduleGridView from './ScheduleGridView';
import ScheduleRoomModal from './ScheduleRoomModal';

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
  const [showBookingModal, setShowBookingModal] = useState(false);

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
          <h1 className="text-2xl font-bold text-gray-700 dark:text-white">Class Schedule</h1>
          <p className="text-gray-400 dark:text-[#b1a7a6] mt-1">Select a date to view that day&apos;s schedule</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={term}
            onChange={e => setTerm(e.target.value)}
            className="px-4 py-2 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent text-sm"
          >
            <option value="all" className="bg-white dark:bg-gray-50">All Terms</option>
            {TERMS.map(t => (
              <option key={t} value={t} className="bg-white dark:bg-[#161a1d]">Term {t}</option>
            ))}
          </select>
          <div className="flex bg-gray-100 border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Grid
            </button>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowBookingModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-red-600 dark:to-red-700 text-white rounded-lg font-medium text-sm hover:opacity-90 transition-all shadow-sm"
            title="Schedule a room booking"
          >
            <Plus className="w-4 h-4" />
            Schedule Room
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchSlots}
            className="p-2 bg-gray-100 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
          <div className="border border-gray-200 dark:border-[#3d4951] rounded-xl bg-white dark:bg-[#0b090a] p-4 lg:sticky lg:top-4">
            {/* Month/Year header with nav arrows */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => {
                  if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
                  else setCalMonth(m => m - 1);
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-gray-700 dark:text-white tracking-wide">
                {MONTH_NAMES[calMonth]} {calYear}
              </span>
              <button
                onClick={() => {
                  if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
                  else setCalMonth(m => m + 1);
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {CAL_DAY_LABELS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#b1a7a6] py-1">
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
                        ? 'bg-indigo-600 text-white shadow-md scale-105'
                        : isToday
                          ? 'bg-indigo-50 text-indigo-600 font-bold ring-1 ring-indigo-300'
                          : isFriSat
                            ? 'text-gray-400 hover:bg-gray-100'
                            : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    {day}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-600" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected date display */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#3d4951] text-center">
              <p className="text-xs text-gray-400 dark:text-[#b1a7a6]">
                Selected: <span className="font-bold text-gray-700 dark:text-white">
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
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 dark:text-red-600" />
            </div>
          )}

          {/* Empty State */}
          {!loading && displaySlots.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-white/40">
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

      {/* ── Room Booking Modal ── */}
      <ScheduleRoomModal
        show={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        selectedDate={selectedDate}
        onSuccess={fetchSlots}
      />
    </div>
  );
}
