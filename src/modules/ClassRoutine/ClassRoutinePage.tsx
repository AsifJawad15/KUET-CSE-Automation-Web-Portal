"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { DBRoutineSlotWithDetails, isSupabaseConfigured } from '@/lib/supabase';
import { getRoutineSlots, addRoutineSlot, deleteRoutineSlot } from '@/services/routineService';
import { motion } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Plus } from 'lucide-react';
import AddRoutineSlot from './AddRoutineSlot';
import RoutineFilters from './RoutineFilters';
import RoutineGrid from './RoutineGrid';
import RoutineStats from './RoutineStats';
import { TERMS } from './constants';
import { groupSlotsForDisplay } from './helpers';

// ==========================================
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
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#8400ff] dark:to-[#a855f7] text-white rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-[#D9A299]/25 dark:shadow-[#8400ff]/25 self-start"
        >
          <Plus className="w-5 h-5" />
          Add Slot
        </motion.button>
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
        <RoutineGrid displaySlots={displaySlots} onDeleteSlot={handleDeleteSlot} />
      )}

      {/* Empty state */}
      {!loading && displaySlots.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[#8B7355] dark:text-white/50">No routine slots found for this selection.</p>
          <p className="text-sm text-[#8B7355] dark:text-white/40 mt-1">Click &quot;Add Slot&quot; to create the first entry.</p>
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
