"use client";

import React from 'react';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { DBRoutineSlotWithDetails, isSupabaseConfigured } from '@/lib/supabase';
import { getRoutineSlots, addRoutineSlot, deleteRoutineSlot } from '@/services/routineService';
import { getAllTeachers } from '@/services/teacherService';
import type { TeacherWithAuth } from '@/types/database';
import { motion } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Plus, Printer, Trash2, Upload, X } from 'lucide-react';
import AddRoutineSlot from './AddRoutineSlot';
import RoutineFilters from './RoutineFilters';
import RoutineGrid from './RoutineGrid';
import RoutineStats from './RoutineStats';
import { FileUploadModal, createRoutineUploadConfig } from '@/components/upload';
import { TERMS } from './constants';
import { groupSlotsForDisplay } from './helpers';
import ClassRoutinePrintView, { RoutineCoordinator, RoutinePrintInfo } from './ClassRoutinePrintView';


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
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [teachers, setTeachers] = useState<TeacherWithAuth[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [printInfo, setPrintInfo] = useState<RoutinePrintInfo>({
    revision: '',
    classStartingDate: '',
    roomNote: '',
    coordinators: [],
  });

  // Group combined slots for display
  const displaySlots = useMemo(() => {
    return groupSlotsForDisplay(rawSlots);
  }, [rawSlots]);

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

  useEffect(() => {
    if (!showPrintModal || teachers.length > 0) return;

    setTeachersLoading(true);
    getAllTeachers()
      .then((data) => {
        setTeachers(data);
      })
      .catch(() => {
        setTeachers([]);
      })
      .finally(() => {
        setTeachersLoading(false);
      });
  }, [showPrintModal, teachers.length]);

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

  const handlePrintRoutine = (info: RoutinePrintInfo) => {
    setPrintInfo(info);
    setShowPrintModal(false);
    window.setTimeout(() => {
      const cleanupPrintClass = () => {
        document.body.classList.remove('printing-routine');
        window.removeEventListener('afterprint', cleanupPrintClass);
      };

      document.body.classList.add('printing-routine');
      window.addEventListener('afterprint', cleanupPrintClass);
      window.print();
    }, 100);
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 dark:text-[#b1a7a6]">Supabase not configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-700 dark:text-white">Class Routine</h1>
          <p className="text-gray-400 dark:text-[#b1a7a6] mt-1">Manage weekly class schedules for all semesters</p>
        </div>
        <div className="flex gap-2 self-start">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowPrintModal(true)}
            disabled={loading || displaySlots.length === 0}
            className="px-4 py-2 border border-gray-200 dark:border-[#3d4951] text-gray-700 dark:text-[#b1a7a6] rounded-lg transition-all flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-[#3d4951]/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-5 h-5" />
            Print
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 border border-gray-200 dark:border-[#3d4951] text-gray-700 dark:text-[#b1a7a6] rounded-lg transition-all flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-[#3d4951]/30"
          >
            <Upload className="w-5 h-5" />
            Upload Routine
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-[#D9A299]/25 dark:shadow-red-600/25"
          >
            <Plus className="w-5 h-5" />
            Add Slot
          </motion.button>
        </div>
      </div>

      {/* Filters: Term, Session, Section */}
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
      <SpotlightCard className="rounded-xl p-4 border border-gray-200 dark:border-[#3d4951] text-center" spotlightColor="rgba(217, 162, 153, 0.2)">
        <h2 className="text-lg font-bold text-gray-700 dark:text-white">
          Class Routine – {TERMS.find(t => t.value === selectedTerm)?.label}
        </h2>
        <p className="text-sm text-gray-400 dark:text-[#b1a7a6] mt-1">
          Session: {selectedSession} &nbsp;•&nbsp; Section: {selectedSection}
        </p>
      </SpotlightCard>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 dark:text-red-600" />
        </div>
      ) : (
        <RoutineGrid displaySlots={displaySlots} onDeleteSlot={handleDeleteSlot} />
      )}

      {/* Empty state */}
      {!loading && displaySlots.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 dark:text-[#b1a7a6]">No routine slots found for this selection.</p>
          <p className="text-sm text-gray-400 dark:text-[#b1a7a6]/70 mt-1">Click &quot;Add Slot&quot; to create the first entry.</p>
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

      {/* Upload Routine Modal */}
      <FileUploadModal
        show={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onImportComplete={() => {
          setShowUploadModal(false);
          loadRoutine(); // Refresh DB slots
        }}
        config={createRoutineUploadConfig(selectedTerm, selectedSession, selectedSection)}
      />

      <PrintRoutineModal
        show={showPrintModal}
        initialInfo={printInfo}
        teachers={teachers}
        teachersLoading={teachersLoading}
        onClose={() => setShowPrintModal(false)}
        onPrint={handlePrintRoutine}
      />

      <ClassRoutinePrintView
        displaySlots={displaySlots}
        selectedTerm={selectedTerm}
        selectedSession={selectedSession}
        selectedSection={selectedSection}
        printInfo={printInfo}
      />
    </div>
  );
}

function PrintRoutineModal({
  show,
  initialInfo,
  teachers,
  teachersLoading,
  onClose,
  onPrint,
}: {
  show: boolean;
  initialInfo: RoutinePrintInfo;
  teachers: TeacherWithAuth[];
  teachersLoading: boolean;
  onClose: () => void;
  onPrint: (info: RoutinePrintInfo) => void;
}) {
  const [form, setForm] = useState<RoutinePrintInfo>(initialInfo);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  useEffect(() => {
    if (show) {
      setForm(initialInfo);
      setSelectedTeacherId('');
    }
  }, [show, initialInfo]);

  if (!show) return null;

  const updateField = (field: keyof RoutinePrintInfo, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const formatDesignation = (designation: string) =>
    designation
      .split('_')
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ');

  const addCoordinator = () => {
    const teacher = teachers.find((item) => item.user_id === selectedTeacherId);
    if (!teacher) return;

    const coordinator: RoutineCoordinator = {
      user_id: teacher.user_id,
      full_name: teacher.full_name,
      designation: formatDesignation(teacher.designation),
    };

    setForm((current) => ({
      ...current,
      coordinators: current.coordinators.some((item) => item.user_id === coordinator.user_id)
        ? current.coordinators
        : [...current.coordinators, coordinator],
    }));
    setSelectedTeacherId('');
  };

  const removeCoordinator = (userId: string) => {
    setForm((current) => ({
      ...current,
      coordinators: current.coordinators.filter((coordinator) => coordinator.user_id !== userId),
    }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onPrint({
      revision: form.revision.trim(),
      classStartingDate: form.classStartingDate.trim(),
      roomNote: form.roomNote.trim(),
      coordinators: form.coordinators,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#3d4951] dark:bg-[#161a1d]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-[#3d4951]">
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Print Class Routine</h2>
            <p className="text-sm text-gray-400 dark:text-[#b1a7a6]">Add coordinator and routine header details.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700 dark:text-[#d3d3d3]">Revision text</span>
            <input
              value={form.revision}
              onChange={(event) => updateField('revision', event.target.value)}
              placeholder="2nd Revision, 09/12/2025"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#D9A299] focus:ring-2 focus:ring-[#D9A299]/30 dark:border-[#3d4951] dark:bg-[#0b090a] dark:text-white"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gray-700 dark:text-[#d3d3d3]">Class starting date</span>
            <input
              value={form.classStartingDate}
              onChange={(event) => updateField('classStartingDate', event.target.value)}
              placeholder="09-12-2025"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#D9A299] focus:ring-2 focus:ring-[#D9A299]/30 dark:border-[#3d4951] dark:bg-[#0b090a] dark:text-white"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gray-700 dark:text-[#d3d3d3]">Room note</span>
            <input
              value={form.roomNote}
              onChange={(event) => updateField('roomNote', event.target.value)}
              placeholder="Theory: 306, Lab: CSE-201 (3212), CSE-306 (3230)"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#D9A299] focus:ring-2 focus:ring-[#D9A299]/30 dark:border-[#3d4951] dark:bg-[#0b090a] dark:text-white"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gray-700 dark:text-[#d3d3d3]">Course coordinator/s</span>
            <div className="mt-1 flex gap-2">
              <select
                value={selectedTeacherId}
                onChange={(event) => setSelectedTeacherId(event.target.value)}
                disabled={teachersLoading}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#D9A299] focus:ring-2 focus:ring-[#D9A299]/30 disabled:opacity-60 dark:border-[#3d4951] dark:bg-[#0b090a] dark:text-white"
              >
                <option value="">
                  {teachersLoading
                    ? 'Loading teachers...'
                    : teachers.length === 0
                      ? 'No teachers found'
                      : 'Select coordinator'}
                </option>
                {teachers.map((teacher) => (
                  <option key={teacher.user_id} value={teacher.user_id}>
                    {teacher.full_name} - {formatDesignation(teacher.designation)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addCoordinator}
                disabled={!selectedTeacherId}
                className="rounded-lg border border-[#D9A299]/60 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-[#FFF7ED] disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-400/30 dark:text-[#d3d3d3] dark:hover:bg-red-500/10"
              >
                Add
              </button>
            </div>

            {form.coordinators.length > 0 && (
              <div className="mt-3 space-y-2">
                {form.coordinators.map((coordinator) => (
                  <div
                    key={coordinator.user_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-[#3d4951] dark:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-700 dark:text-white">{coordinator.full_name}</p>
                      <p className="text-xs text-gray-400 dark:text-[#b1a7a6]">{coordinator.designation}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCoordinator(coordinator.user_id)}
                      className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      title="Remove coordinator"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-[#3d4951]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-[#3d4951] dark:text-[#d3d3d3] dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] px-5 py-2 text-sm font-medium text-white shadow-lg shadow-[#D9A299]/25 dark:from-[#ba181b] dark:to-[#e5383b]"
          >
            <Printer className="h-4 w-4" />
            Print Routine
          </button>
        </div>
      </form>
    </div>
  );
}
