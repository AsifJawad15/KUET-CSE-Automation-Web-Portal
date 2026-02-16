"use client";

import React from 'react';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { DBRoutineSlotWithDetails, isSupabaseConfigured } from '@/lib/supabase';
import { getRoutineSlots, addRoutineSlot, deleteRoutineSlot } from '@/services/routineService';
import { motion } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react';
import AddRoutineSlot from './AddRoutineSlot';
import RoutineFilters from './RoutineFilters';
import RoutineGrid from './RoutineGrid';
import RoutineStats from './RoutineStats';
import { TERMS } from './constants';
import { groupSlotsForDisplay } from './helpers';

// ==========================================
// Constants
// ==========================================

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
  if (courseType === 'Lab') return 'bg-[#ba181b]/15 border-[#ba181b]/30 text-[#e5383b]';
  return 'bg-[#d3d3d3]/15 border-[#d3d3d3]/30 text-[#d3d3d3]';
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
// Orchestrator Component
// ==========================================
export default function ClassRoutinePage() {
  const [selectedTerm, setSelectedTerm] = useState('3-2');
  const [selectedSession, setSelectedSession] = useState('2023-2024');
  const [selectedSection, setSelectedSection] = useState('A');
  const [rawSlots, setRawSlots] = useState<DBRoutineSlotWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Group combined slots for display
  const displaySlots = useMemo(() => groupSlotsForDisplay(rawSlots), [rawSlots]);

  const loadRoutine = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await getRoutineSlots(selectedTerm, selectedSession, selectedSection);
    setRawSlots(data);
    setLoading(false);
  }, [selectedTerm, selectedSession, selectedSection]);

  useEffect(() => {
    loadRoutine();
  }, [loadRoutine]);

  const handleAddSlot = async (data: any) => {
    const result = await addRoutineSlot(data);
    if (result.success) {
      setShowAddModal(false);
      await loadRoutine();
    } else {
      throw new Error(result.error || 'Failed to add slot');
    }
  };

  /**
   * Delete all slot IDs in a combined group.
   * For a normal slot this is just 1 ID; for combined it deletes both.
   */
  const handleDeleteSlot = async (slotIds: string[]) => {
    if (!confirm('Remove this slot?')) return;
    let hasError = false;
    for (const id of slotIds) {
      const result = await deleteRoutineSlot(id);
      if (!result.success) {
        setError(result.error || 'Failed to delete');
        hasError = true;
        break;
      }
    }
    if (!hasError) await loadRoutine();
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#8B7355] dark:text-[#b1a7a6]">Supabase not configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white">Class Routine</h1>
          <p className="text-[#8B7355] dark:text-[#b1a7a6] mt-1">Manage weekly class schedules for all semesters</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-[#D9A299]/25 dark:shadow-[#ba181b]/25 self-start"
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
            className="appearance-none pl-4 pr-10 py-2.5 border border-[#DCC5B2] dark:border-[#3d4951] rounded-xl bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent font-medium text-sm cursor-pointer"
          >
            {TERMS.map(t => (
              <option key={t.value} value={t.value} className="bg-[#FAF7F3] dark:bg-[#161a1d]">
                {t.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7355] dark:text-[#b1a7a6]/70 pointer-events-none" />
        </div>

        {/* Session */}
        <div className="relative">
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 border border-[#DCC5B2] dark:border-[#3d4951] rounded-xl bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent font-medium text-sm cursor-pointer"
          >
            {['2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026'].map(s => (
              <option key={s} value={s} className="bg-[#FAF7F3] dark:bg-[#161a1d]">{s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7355] dark:text-[#b1a7a6]/70 pointer-events-none" />
        </div>

        {/* Section Toggle */}
        <div className="flex rounded-xl overflow-hidden border border-[#DCC5B2] dark:border-[#3d4951]">
          {SECTIONS.map(sec => (
            <button
              key={sec}
              onClick={() => setSelectedSection(sec)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                selectedSection === sec
                  ? 'bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white'
                  : 'bg-[#FAF7F3] dark:bg-[#0b090a] text-[#8B7355] dark:text-[#b1a7a6] hover:bg-[#F0E4D3] dark:hover:bg-[#3d4951]/30'
              }`}
            >
              SEC - {sec}
            </button>
          ))}
        </div>
      </div>
      {/* Filters */}
      <RoutineFilters
        selectedTerm={selectedTerm}
        selectedSession={selectedSession}
        selectedSection={selectedSection}
        onTermChange={setSelectedTerm}
        onSessionChange={setSelectedSession}
        onSectionChange={setSelectedSection}
      />

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">×</button>
        </div>
      )}

      {/* Routine Title Banner */}
      <SpotlightCard className="rounded-xl p-4 border border-[#DCC5B2] dark:border-[#3d4951] text-center" spotlightColor="rgba(217, 162, 153, 0.2)">
        <h2 className="text-lg font-bold text-[#5D4E37] dark:text-white">
          Class Routine – {TERMS.find(t => t.value === selectedTerm)?.label}
        </h2>
        <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6] mt-1">
          Session: {selectedSession} &nbsp;•&nbsp; Section: {selectedSection}
        </p>
      </SpotlightCard>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-[#D9A299] dark:text-[#ba181b]" />
        </div>
      ) : (
        <RoutineGrid displaySlots={displaySlots} onDeleteSlot={handleDeleteSlot} />
      )}

      {/* Empty state */}
      {!loading && displaySlots.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[#8B7355] dark:text-[#b1a7a6]">No routine slots found for this selection.</p>
          <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6]/70 mt-1">Click &quot;Add Slot&quot; to create the first entry.</p>
        </div>
      )}

      {/* Stats */}
      {!loading && displaySlots.length > 0 && <RoutineStats displaySlots={displaySlots} />}

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
