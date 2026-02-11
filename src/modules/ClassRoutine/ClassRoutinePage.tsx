"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { DBRoutineSlotWithDetails, isSupabaseConfigured } from '@/lib/supabase';
import { getRoutineSlots, addRoutineSlot, deleteRoutineSlot } from '@/services/routineService';
import { motion } from 'framer-motion';
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, ChevronDown } from 'lucide-react';
import AddRoutineSlot from './AddRoutineSlot';

// ==========================================
// Constants
// ==========================================
const TERMS = [
  { value: '1-1', label: '1st Year 1st Term' },
  { value: '1-2', label: '1st Year 2nd Term' },
  { value: '2-1', label: '2nd Year 1st Term' },
  { value: '2-2', label: '2nd Year 2nd Term' },
  { value: '3-1', label: '3rd Year 1st Term' },
  { value: '3-2', label: '3rd Year 2nd Term' },
  { value: '4-1', label: '4th Year 1st Term' },
  { value: '4-2', label: '4th Year 2nd Term' },
];

const DAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
];

const PERIODS = [
  { id: 1, start: '08:00', end: '08:50', label: '08:00-08:50' },
  { id: 2, start: '08:50', end: '09:40', label: '08:50-09:40' },
  { id: 3, start: '09:40', end: '10:30', label: '09:40-10:30' },
  { id: 4, start: '10:40', end: '11:30', label: '10:40-11:30' },
  { id: 5, start: '11:30', end: '12:20', label: '11:30-12:20' },
  { id: 6, start: '12:20', end: '13:10', label: '12:20-01:10' },
  { id: 7, start: '14:30', end: '15:20', label: '02:30-03:20' },
  { id: 8, start: '15:20', end: '16:10', label: '03:20-04:10' },
  { id: 9, start: '16:10', end: '17:00', label: '04:10-05:00' },
];

const SECTIONS = ['A', 'B'];

// Break markers
const BREAK_AFTER_PERIOD = [3, 6]; // Break after period 3 and 6

// ==========================================
// Helper: Get initials from teacher name
// ==========================================
function getTeacherInitials(fullName: string): string {
  return fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3);
}

// ==========================================
// Helper: Color based on course type
// ==========================================
function getSlotColor(courseType: string | null): string {
  if (courseType === 'Lab') return 'bg-[#8400ff]/15 border-[#8400ff]/30 text-[#a855f7]';
  return 'bg-[#00e5ff]/15 border-[#00e5ff]/30 text-[#00e5ff]';
}

function getSlotColorLight(courseType: string | null): string {
  if (courseType === 'Lab') return 'bg-purple-50 border-purple-200 text-purple-700';
  return 'bg-sky-50 border-sky-200 text-sky-700';
}

// ==========================================
// Helper: Match slot to period
// ==========================================
function slotMatchesPeriod(slot: DBRoutineSlotWithDetails, period: typeof PERIODS[0]): boolean {
  const slotStart = slot.start_time.slice(0, 5); // HH:MM
  return slotStart === period.start;
}

// ==========================================
// Helper: How many consecutive periods this slot spans
// ==========================================
function getSlotSpan(slot: DBRoutineSlotWithDetails): number {
  const startMinutes = timeToMinutes(slot.start_time);
  const endMinutes = timeToMinutes(slot.end_time);
  const duration = endMinutes - startMinutes;
  return Math.max(1, Math.round(duration / 50));
}

function timeToMinutes(t: string): number {
  const parts = t.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

// ==========================================
// Main Component
// ==========================================
export default function ClassRoutinePage() {
  const [selectedTerm, setSelectedTerm] = useState('3-2');
  const [selectedSession, setSelectedSession] = useState('2023-2024');
  const [selectedSection, setSelectedSection] = useState('A');
  const [slots, setSlots] = useState<DBRoutineSlotWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadRoutine = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await getRoutineSlots(selectedTerm, selectedSession, selectedSection);
    setSlots(data);
    setLoading(false);
  }, [selectedTerm, selectedSession, selectedSection]);

  useEffect(() => {
    loadRoutine();
  }, [loadRoutine]);

  const openAddModal = () => setShowAddModal(true);

  const handleAddSlot = async (data: any) => {
    const result = await addRoutineSlot(data);
    if (result.success) {
      setShowAddModal(false);
      await loadRoutine();
    } else {
      throw new Error(result.error || 'Failed to add slot');
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (!confirm('Remove this slot?')) return;
    const result = await deleteRoutineSlot(id);
    if (result.success) await loadRoutine();
    else setError(result.error || 'Failed to delete');
  };

  // Build grid: for each day & period, find the matching slot
  const getSlotForCell = (dayValue: number, period: typeof PERIODS[0]): DBRoutineSlotWithDetails | null => {
    return slots.find(s => s.day_of_week === dayValue && slotMatchesPeriod(s, period)) || null;
  };

  // Check if a cell is "covered" by a multi-span slot that started earlier
  const isCellCovered = (dayValue: number, periodIndex: number): boolean => {
    for (let i = periodIndex - 1; i >= 0; i--) {
      const slot = getSlotForCell(dayValue, PERIODS[i]);
      if (slot) {
        const span = getSlotSpan(slot);
        if (i + span > periodIndex) return true;
        break; // Found a non-spanning slot before this
      }
    }
    return false;
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#8B7355] dark:text-white/60">Supabase not configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white">Class Routine</h1>
          <p className="text-[#8B7355] dark:text-white/60 mt-1">Manage weekly class schedules for all semesters</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={openAddModal}
          className="px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#8400ff] dark:to-[#a855f7] text-white rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-[#D9A299]/25 dark:shadow-[#8400ff]/25 self-start"
        >
          <Plus className="w-5 h-5" />
          Add Slot
        </motion.button>
      </div>

      {/* Filters: Term, Session, Section */}
      <div className="flex flex-wrap gap-3">
        {/* Term Selector */}
        <div className="relative">
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 border border-[#DCC5B2] dark:border-[#392e4e] rounded-xl bg-[#FAF7F3] dark:bg-white/5 text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent font-medium text-sm cursor-pointer"
          >
            {TERMS.map(t => (
              <option key={t.value} value={t.value} className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">
                {t.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7355] dark:text-white/40 pointer-events-none" />
        </div>

        {/* Session */}
        <div className="relative">
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 border border-[#DCC5B2] dark:border-[#392e4e] rounded-xl bg-[#FAF7F3] dark:bg-white/5 text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent font-medium text-sm cursor-pointer"
          >
            {['2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026'].map(s => (
              <option key={s} value={s} className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">{s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7355] dark:text-white/40 pointer-events-none" />
        </div>

        {/* Section Toggle */}
        <div className="flex rounded-xl overflow-hidden border border-[#DCC5B2] dark:border-[#392e4e]">
          {SECTIONS.map(sec => (
            <button
              key={sec}
              onClick={() => setSelectedSection(sec)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                selectedSection === sec
                  ? 'bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#8400ff] dark:to-[#a855f7] text-white'
                  : 'bg-[#FAF7F3] dark:bg-white/5 text-[#8B7355] dark:text-white/60 hover:bg-[#F0E4D3] dark:hover:bg-white/10'
              }`}
            >
              SEC - {sec}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">×</button>
        </div>
      )}

      {/* Routine Title Banner */}
      <SpotlightCard className="rounded-xl p-4 border border-[#DCC5B2] dark:border-[#392e4e] text-center" spotlightColor="rgba(217, 162, 153, 0.2)">
        <h2 className="text-lg font-bold text-[#5D4E37] dark:text-white">
          Class Routine – {TERMS.find(t => t.value === selectedTerm)?.label}
        </h2>
        <p className="text-sm text-[#8B7355] dark:text-white/50 mt-1">
          Session: {selectedSession} &nbsp;•&nbsp; Section: {selectedSection}
        </p>
      </SpotlightCard>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-[#D9A299] dark:text-[#8400ff]" />
        </div>
      ) : (
        /* Timetable Grid */
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[900px]">
            {/* Header: Period numbers */}
            <thead>
              <tr>
                <th className="p-2 border border-[#DCC5B2] dark:border-[#392e4e] bg-[#F0E4D3] dark:bg-white/5 text-[#5D4E37] dark:text-white/70 text-xs font-semibold w-24 sticky left-0 z-10">
                  Day / Period
                </th>
                {PERIODS.map((p, i) => (
                  <React.Fragment key={`period-header-${p.id}`}>
                    <th
                      className="p-2 border border-[#DCC5B2] dark:border-[#392e4e] bg-[#F0E4D3] dark:bg-white/5 text-[#5D4E37] dark:text-white/70 text-xs font-semibold min-w-[110px]"
                    >
                      <div>{p.id}</div>
                      <div className="text-[10px] font-normal text-[#8B7355] dark:text-white/40 mt-0.5">{p.label}</div>
                    </th>
                    {/* Break column */}
                    {BREAK_AFTER_PERIOD.includes(p.id) && (
                      <th
                        className="p-1 border border-[#DCC5B2] dark:border-[#392e4e] bg-amber-50 dark:bg-amber-500/5 text-amber-600 dark:text-amber-400 text-[10px] font-medium w-8 writing-mode-vertical"
                      >
                        <div className="rotate-0 whitespace-nowrap">B<br/>R<br/>E<br/>A<br/>K</div>
                      </th>
                    )}
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {DAYS.map(day => (
                <tr key={day.value}>
                  {/* Day name */}
                  <td className="p-2 border border-[#DCC5B2] dark:border-[#392e4e] bg-[#F0E4D3] dark:bg-white/5 text-[#5D4E37] dark:text-white font-semibold text-sm text-center sticky left-0 z-10">
                    {day.label}
                  </td>

                  {/* Period cells */}
                  {PERIODS.map((period, periodIndex) => {
                    // If this cell is covered by a multi-span slot, skip rendering
                    if (isCellCovered(day.value, periodIndex)) {
                      return (
                        <React.Fragment key={`covered-${day.value}-${period.id}`}>
                          {/* still need break column placeholder */}
                          {BREAK_AFTER_PERIOD.includes(period.id) && (
                            <td className="border border-[#DCC5B2] dark:border-[#392e4e] bg-amber-50 dark:bg-amber-500/5" />
                          )}
                        </React.Fragment>
                      );
                    }

                    const slot = getSlotForCell(day.value, period);
                    const span = slot ? getSlotSpan(slot) : 1;

                    return (
                      <React.Fragment key={`cell-${day.value}-${period.id}`}>
                        <td
                          colSpan={span}
                          className={`border border-[#DCC5B2] dark:border-[#392e4e] p-1 text-center align-top ${
                            slot
                              ? ''
                              : 'bg-[#FAF7F3] dark:bg-transparent hover:bg-[#F0E4D3] dark:hover:bg-white/5'
                          }`}
                        >
                          {slot ? (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className={`relative group rounded-lg p-2 border text-xs h-full ${getSlotColor(slot.course_offerings.courses.course_type)} dark:${getSlotColor(slot.course_offerings.courses.course_type)} ${getSlotColorLight(slot.course_offerings.courses.course_type)} dark:bg-transparent`}
                            >
                              <div className="font-bold text-[11px] text-[#5D4E37] dark:text-white">
                                {slot.course_offerings.courses.code}
                              </div>
                              <div className="text-[10px] text-[#8B7355] dark:text-white/50 mt-0.5">
                                ({getTeacherInitials(slot.course_offerings.teachers.full_name)})
                              </div>
                              <div className="text-[9px] text-[#8B7355] dark:text-white/40 mt-0.5">
                                {slot.rooms?.room_number}
                              </div>
                              {/* Delete button on hover */}
                              <button
                                onClick={() => handleDeleteSlot(slot.id)}
                                className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </motion.div>
                          ) : null}
                        </td>
                        {/* Break column */}
                        {BREAK_AFTER_PERIOD.includes(period.id) && (
                          <td className="border border-[#DCC5B2] dark:border-[#392e4e] bg-amber-50 dark:bg-amber-500/5" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && slots.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[#8B7355] dark:text-white/50">No routine slots found for this selection.</p>
          <p className="text-sm text-[#8B7355] dark:text-white/40 mt-1">Click &quot;Add Slot&quot; to create the first entry.</p>
        </div>
      )}

      {/* Stats */}
      {!loading && slots.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SpotlightCard className="rounded-xl p-4 border border-[#DCC5B2] dark:border-[#392e4e]" spotlightColor="rgba(217, 162, 153, 0.2)">
            <p className="text-sm text-[#8B7355] dark:text-white/50">Total Slots</p>
            <p className="text-2xl font-bold text-[#5D4E37] dark:text-white">{slots.length}</p>
          </SpotlightCard>
          <SpotlightCard className="rounded-xl p-4 border border-[#DCC5B2] dark:border-[#392e4e]" spotlightColor="rgba(217, 162, 153, 0.2)">
            <p className="text-sm text-[#8B7355] dark:text-white/50">Courses</p>
            <p className="text-2xl font-bold text-[#D9A299] dark:text-[#00e5ff]">
              {new Set(slots.map(s => s.course_offerings.courses.code)).size}
            </p>
          </SpotlightCard>
          <SpotlightCard className="rounded-xl p-4 border border-[#DCC5B2] dark:border-[#392e4e]" spotlightColor="rgba(217, 162, 153, 0.2)">
            <p className="text-sm text-[#8B7355] dark:text-white/50">Rooms Used</p>
            <p className="text-2xl font-bold text-[#D9A299] dark:text-[#8400ff]">
              {new Set(slots.map(s => s.room_number)).size}
            </p>
          </SpotlightCard>
          <SpotlightCard className="rounded-xl p-4 border border-[#DCC5B2] dark:border-[#392e4e]" spotlightColor="rgba(217, 162, 153, 0.2)">
            <p className="text-sm text-[#8B7355] dark:text-white/50">Teachers</p>
            <p className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">
              {new Set(slots.map(s => s.course_offerings.teachers.full_name)).size}
            </p>
          </SpotlightCard>
        </div>
      )}

      {/* Add Slot Modal */}
      <AddRoutineSlot
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddSlot}
        term={selectedTerm}
        session={selectedSession}
        section={selectedSection}
      />
    </div>
  );
}
