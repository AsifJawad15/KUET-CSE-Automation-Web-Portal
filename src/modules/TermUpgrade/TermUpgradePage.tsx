"use client";

import { useAuth } from '@/contexts/AuthContext';
import {
  TERMS,
  TERM_ORDER,
  TERM_MAP,
  groupStudentsByTerm,
  createInitialExpandedState,
  createInitialSelectedState,
} from './constants';
import { TermGroup, TermId, TermStudent, TermChangeDirection, ExpandedTerms, SelectedStudents, TermChangeModalState } from './types';
import TermAccordionItem from './TermAccordionItem';
import TermUpgradeStats from './TermUpgradeStats';
import UpgradeConfirmModal from './UpgradeConfirmModal';
import { bulkDirectTermChange } from '@/services/termUpgradeService';
import { motion } from 'framer-motion';
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  Expand,
  Minimize2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function TermUpgradePage() {
  const { user } = useAuth();

  // Data state
  const [allStudents, setAllStudents] = useState<TermStudent[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [expandedTerms, setExpandedTerms] = useState<ExpandedTerms>(createInitialExpandedState);
  const [selectedStudents, setSelectedStudents] = useState<SelectedStudents>(createInitialSelectedState);

  // Modal state
  const [modalState, setModalState] = useState<TermChangeModalState | null>(null);
  const [processingTerm, setProcessingTerm] = useState<TermId | null>(null);
  const [totalChanged, setTotalChanged] = useState(0);

  // ----- Data Fetching -----

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/students');
      const studentsData = await res.json();
      const students: TermStudent[] = (studentsData || []).map((s: any) => ({
        user_id: s.user_id,
        roll_no: s.roll_no,
        full_name: s.full_name,
        session: s.session,
        section: s.section,
        batch: s.batch,
        cgpa: s.cgpa,
        term: s.term,
      }));

      setAllStudents(students);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ----- Derived Data -----

  const termGroups: TermGroup[] = useMemo(
    () => groupStudentsByTerm(allStudents),
    [allStudents]
  );

  // ----- Accordion Controls -----

  const toggleTerm = (termId: TermId) => {
    setExpandedTerms((prev) => ({ ...prev, [termId]: !prev[termId] }));
  };

  const expandAll = () => {
    setExpandedTerms(
      Object.fromEntries(TERM_ORDER.map((t) => [t, true])) as ExpandedTerms
    );
  };

  const collapseAll = () => {
    setExpandedTerms(createInitialExpandedState());
  };

  const allExpanded = TERM_ORDER.every((t) => expandedTerms[t]);

  // ----- Selection Controls -----

  const toggleStudent = (termId: TermId, userId: string) => {
    setSelectedStudents((prev) => {
      const newSet = new Set(prev[termId]);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return { ...prev, [termId]: newSet };
    });
  };

  const selectAllInTerm = (termId: TermId) => {
    const group = termGroups.find((g) => g.termInfo.id === termId);
    if (!group) return;
    setSelectedStudents((prev) => ({
      ...prev,
      [termId]: new Set(group.students.map((s) => s.user_id)),
    }));
  };

  const deselectAllInTerm = (termId: TermId) => {
    setSelectedStudents((prev) => ({
      ...prev,
      [termId]: new Set<string>(),
    }));
  };

  // ----- Move (Upgrade/Downgrade) Handler -----

  const openMoveModal = (fromTermId: TermId, targetTermId: TermId) => {
    const selected = selectedStudents[fromTermId];
    if (selected.size === 0) return;

    const fromIdx = TERM_ORDER.indexOf(fromTermId);
    const toIdx = TERM_ORDER.indexOf(targetTermId);
    const direction: TermChangeDirection = toIdx > fromIdx ? 'upgrade' : 'downgrade';

    setModalState({ fromTermId, targetTermId, direction });
  };

  const handleConfirmChange = async () => {
    if (!modalState) return;

    const { fromTermId, targetTermId } = modalState;
    const studentIds = Array.from(selectedStudents[fromTermId]);
    setProcessingTerm(fromTermId);

    const result = await bulkDirectTermChange(studentIds, targetTermId);

    setTotalChanged((prev) => prev + result.successCount);

    // Clear selection for this term
    deselectAllInTerm(fromTermId);
    setModalState(null);
    setProcessingTerm(null);

    // Show result summary if there were errors
    if (result.failedCount > 0) {
      alert(
        `Done: ${result.successCount} succeeded, ${result.failedCount} failed.\n\nErrors:\n${result.errors
          .map((e) => e.error)
          .join('\n')}`
      );
    }

    // Refresh data to reflect changes
    fetchData();
  };

  // Modal data
  const modalFromTerm = modalState ? TERM_MAP[modalState.fromTermId] : null;
  const modalToTerm = modalState ? TERM_MAP[modalState.targetTermId] : null;
  const modalStudents = modalState
    ? allStudents.filter((s) => selectedStudents[modalState.fromTermId]?.has(s.user_id))
    : [];

  // ----- Render -----

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-[#D9A299] dark:text-[#8400ff]" />
            Term Management
          </h1>
          <p className="text-[#8B7355] dark:text-white/50 text-sm mt-1">
            Directly upgrade or downgrade students across 8 academic terms
          </p>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={allExpanded ? collapseAll : expandAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F0E4D3] dark:bg-white/5 border border-[#DCC5B2] dark:border-white/10 text-[#8B7355] dark:text-white/60 text-sm hover:bg-[#D9A299]/20 transition-colors"
            title={allExpanded ? 'Collapse All' : 'Expand All'}
          >
            {allExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Expand className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{allExpanded ? 'Collapse' : 'Expand'} All</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchData}
            className="p-2 rounded-xl bg-[#F0E4D3] dark:bg-white/5 border border-[#DCC5B2] dark:border-white/10 text-[#8B7355] dark:text-white/60 hover:bg-[#D9A299]/20 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </div>

      {/* Stats */}
      <TermUpgradeStats
        termGroups={termGroups}
        totalStudents={allStudents.length}
        totalChanged={totalChanged}
      />

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#D9A299] dark:text-[#8400ff] animate-spin" />
        </div>
      ) : (
        /* Term Accordions */
        <div className="space-y-3">
          {termGroups.map((group, index) => (
            <motion.div
              key={group.termInfo.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <TermAccordionItem
                group={group}
                isExpanded={expandedTerms[group.termInfo.id]}
                selectedIds={selectedStudents[group.termInfo.id]}
                onToggleExpand={() => toggleTerm(group.termInfo.id)}
                onToggleStudent={(userId) => toggleStudent(group.termInfo.id, userId)}
                onSelectAll={() => selectAllInTerm(group.termInfo.id)}
                onDeselectAll={() => deselectAllInTerm(group.termInfo.id)}
                onMoveSelected={(targetTermId) => openMoveModal(group.termInfo.id, targetTermId)}
                processingTerm={processingTerm}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {modalFromTerm && modalToTerm && modalState && (
        <UpgradeConfirmModal
          isOpen={!!modalState}
          students={modalStudents}
          fromTerm={modalFromTerm}
          toTerm={modalToTerm}
          direction={modalState.direction}
          isProcessing={!!processingTerm}
          onConfirm={handleConfirmChange}
          onClose={() => !processingTerm && setModalState(null)}
        />
      )}
    </div>
  );
}
