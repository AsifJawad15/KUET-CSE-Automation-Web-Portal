"use client";

import { DBRoutineSlotWithDetails } from '@/lib/supabase';
import { getRoutineSlots, deleteRoutineSlot } from '@/services/routineService';
import { groupSlotsForDisplay } from '@/modules/ClassRoutine/helpers';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ScheduleTableView from './ScheduleTableView';
import ScheduleGridView from './ScheduleGridView';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const DAY_MAP: Record<number, string> = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday' };
// JS getDay(): 0=Sun,1=Mon,...,6=Sat → map to our day names; default to Sunday for Fri/Sat
const JS_DAY_TO_NAME: Record<number, string> = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday' };
function getTodayDayName(): string {
  return JS_DAY_TO_NAME[new Date().getDay()] ?? 'Sunday';
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
  const [filterDay, setFilterDay] = useState<string>(getTodayDayName);
  const [term, setTerm] = useState('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  // Group combined slots
  const displaySlots = useMemo(() => groupSlotsForDisplay(rawSlots), [rawSlots]);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const data = await getRoutineSlots();
    setRawSlots(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

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

  // Apply term + day filters client-side
  const filteredSlots = useMemo(() => {
    let result = displaySlots;
    if (term !== 'all') {
      result = result.filter(s => getTermFromCode(s.course_code) === term);
    }
    if (filterDay !== 'all') {
      result = result.filter(s => DAY_MAP[s.day_of_week] === filterDay);
    }
    return result;
  }, [displaySlots, term, filterDay]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white">Class Schedule</h1>
          <p className="text-[#8B7355] dark:text-white/60 mt-1">View scheduled classes from routine data</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#F0E4D3] dark:bg-white/5 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#D9A299] dark:bg-[#8400ff] text-white'
                  : 'text-[#5D4E37] dark:text-white/60 hover:text-[#D9A299] dark:hover:text-white'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#D9A299] dark:bg-[#8400ff] text-white'
                  : 'text-[#5D4E37] dark:text-white/60 hover:text-[#D9A299] dark:hover:text-white'
              }`}
            >
              Grid
            </button>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchSlots}
            className="p-2 bg-[#F0E4D3] dark:bg-white/5 border border-[#DCC5B2] dark:border-[#392e4e] text-[#5D4E37] dark:text-white rounded-lg hover:bg-[#E5D5C3] dark:hover:bg-white/10 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={term}
          onChange={e => setTerm(e.target.value)}
          className="px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-white/5 text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent"
        >
          <option value="all" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">All Terms</option>
          {TERMS.map(t => (
            <option key={t} value={t} className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Term {t}</option>
          ))}
        </select>
        <select
          value={filterDay}
          onChange={e => setFilterDay(e.target.value)}
          className="px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-white/5 text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent"
        >
          <option value="all" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">All Days</option>
          {DAY_NAMES.map(day => (
            <option key={day} value={day} className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">{day}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#D9A299] dark:text-[#8400ff]" />
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
  );
}
