"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { DBRoutineSlotWithDetails } from '@/lib/supabase';
import { getRoutineSlots, deleteRoutineSlot } from '@/services/routineService';
import { groupSlotsForDisplay, formatCombinedTeacherNames, formatCombinedTeacherInitials } from '@/modules/ClassRoutine/helpers';
import { DisplaySlot } from '@/modules/ClassRoutine/types';
import { motion } from 'framer-motion';
import { Loader2, Trash2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const DAY_MAP: Record<number, string> = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday' };
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

const TERMS = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'];
const SESSIONS = ['2020-21', '2021-22', '2022-23', '2023-24', '2024-25'];

function formatTime(t: string) {
  return t.slice(0, 5); // "08:00:00" -> "08:00"
}

export default function SchedulePage() {
  const [rawSlots, setRawSlots] = useState<DBRoutineSlotWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [term, setTerm] = useState('3-2');
  const [session, setSession] = useState('2024-25');
  const [deleting, setDeleting] = useState<string | null>(null);

  // Group combined slots
  const displaySlots = useMemo(() => groupSlotsForDisplay(rawSlots), [rawSlots]);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const data = await getRoutineSlots(term, session);
    setRawSlots(data);
    setLoading(false);
  }, [term, session]);

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

  const filteredSlots = filterDay === 'all'
    ? displaySlots
    : displaySlots.filter(s => DAY_MAP[s.day_of_week] === filterDay);

  const getScheduleForSlot = (dayName: string, time: string): DisplaySlot[] => {
    const dayIndex = Object.entries(DAY_MAP).find(([, v]) => v === dayName)?.[0];
    if (dayIndex === undefined) return [];
    return displaySlots.filter(s => s.day_of_week === Number(dayIndex) && formatTime(s.start_time) === time);
  };

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
          {TERMS.map(t => (
            <option key={t} value={t} className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Term {t}</option>
          ))}
        </select>
        <select
          value={session}
          onChange={e => setSession(e.target.value)}
          className="px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-white/5 text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent"
        >
          {SESSIONS.map(s => (
            <option key={s} value={s} className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">{s}</option>
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
          <p className="text-lg">No schedule entries found for Term {term}, Session {session}</p>
          <p className="text-sm mt-2">Add classes via the Class Routine page first.</p>
        </div>
      )}

      {/* Table View */}
      {!loading && displaySlots.length > 0 && viewMode === 'table' && (
        <SpotlightCard className="rounded-xl border border-[#DCC5B2] dark:border-[#392e4e] overflow-hidden bg-[#FAF7F3] dark:bg-transparent" spotlightColor="rgba(217, 162, 153, 0.2)">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F0E4D3] dark:bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Day</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Time</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Course</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Teacher(s)</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Room</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Section</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCC5B2] dark:divide-[#392e4e]">
                {filteredSlots
                  .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
                  .map(slot => (
                  <tr key={slot.id} className="hover:bg-[#F0E4D3] dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-[#5D4E37] dark:text-white">
                        {DAY_MAP[slot.day_of_week] || `Day ${slot.day_of_week}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#8B7355] dark:text-white/60">
                      {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-medium text-[#5D4E37] dark:text-white">
                          {slot.course_code}
                        </span>
                        <p className="text-sm text-[#8B7355] dark:text-white/50">
                          {slot.course_title}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[#5D4E37] dark:text-white/70">
                        {formatCombinedTeacherNames(slot.teachers)}
                      </div>
                      {slot.isCombined && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Combined</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-[#8B7355] dark:text-white/60">
                      {slot.room_number}
                    </td>
                    <td className="px-6 py-4">
                      {slot.section && (
                        <span className="px-2 py-1 bg-[#D9A299]/30 text-[#5D4E37] border border-[#D9A299]/50 dark:bg-[#00e5ff]/20 dark:text-[#00e5ff] dark:border-[#00e5ff]/30 rounded text-sm">
                          {slot.section}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDelete(slot.slotIds)}
                        disabled={deleting === slot.id}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === slot.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SpotlightCard>
      )}

      {/* Grid View */}
      {!loading && displaySlots.length > 0 && viewMode === 'grid' && (
        <SpotlightCard className="rounded-xl border border-[#DCC5B2] dark:border-[#392e4e] overflow-hidden bg-[#FAF7F3] dark:bg-transparent" spotlightColor="rgba(217, 162, 153, 0.2)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-[#F0E4D3] dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase w-20">Time</th>
                  {DAY_NAMES.map(day => (
                    <th key={day} className="px-4 py-3 text-center text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCC5B2] dark:divide-[#392e4e]">
                {TIME_SLOTS.map(time => (
                  <tr key={time}>
                    <td className="px-4 py-2 text-sm font-medium text-[#8B7355] dark:text-white/60 border-r border-[#DCC5B2] dark:border-[#392e4e]">
                      {time}
                    </td>
                    {DAY_NAMES.map(day => {
                      const slotSchedules = getScheduleForSlot(day, time);
                      return (
                        <td key={`${day}-${time}`} className="px-2 py-2 border-r border-[#DCC5B2] dark:border-[#392e4e] min-h-[60px]">
                          {slotSchedules.map(s => (
                            <div
                              key={s.id}
                              className="bg-[#D9A299]/20 dark:bg-[#8400ff]/20 text-[#5D4E37] dark:text-white rounded p-2 text-xs mb-1 border border-[#D9A299]/30 dark:border-[#8400ff]/30"
                            >
                              <p className="font-semibold">{s.course_code}</p>
                              <p className="text-[10px] text-[#8B7355] dark:text-white/50">
                                ({formatCombinedTeacherInitials(s.teachers)})
                              </p>
                              <p className="text-[#D9A299] dark:text-[#00e5ff]">{s.room_number}</p>
                              {s.section && <p className="text-[#8B7355] dark:text-white/50">Sec {s.section}</p>}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SpotlightCard>
      )}
    </div>
  );
}
