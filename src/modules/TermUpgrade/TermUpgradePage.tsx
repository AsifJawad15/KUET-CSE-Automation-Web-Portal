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
            <TrendingUp className="w-7 h-7 text-[#D9A299] dark:text-[#ba181b]" />
            Term Upgrade
          </h1>
          <p className="text-[#8B7355] dark:text-[#b1a7a6] text-sm mt-1">
            Manage student term upgrade requests
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
            onClick={fetchRequests}
            className="p-2 rounded-xl bg-[#F0E4D3] dark:bg-[#0b090a] border border-[#DCC5B2] dark:border-[#3d4951]/50 text-[#8B7355] dark:text-[#b1a7a6] hover:bg-[#D9A299]/20 transition-colors"
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

          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSubmitForm(!showSubmitForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D9A299] dark:bg-[#ba181b] text-white font-medium hover:opacity-90 transition-opacity"
            >
              <UserPlus className="w-4 h-4" />
              Submit Request
            </motion.button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SpotlightCard className="p-4" spotlightColor="rgba(217, 162, 153, 0.15)">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#5D4E37] dark:text-white">{pendingCount}</p>
              <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">Pending Requests</p>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4" spotlightColor="rgba(16, 185, 129, 0.15)">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#5D4E37] dark:text-white">{approvedCount}</p>
              <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">Approved</p>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4" spotlightColor="rgba(239, 68, 68, 0.15)">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#5D4E37] dark:text-white">{rejectedCount}</p>
              <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">Rejected</p>
            </div>
          </div>
        </SpotlightCard>
      </div>

      {/* Submit Request Form */}
      <AnimatePresence>
        {showSubmitForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <SpotlightCard className="p-6" spotlightColor="rgba(132, 0, 255, 0.1)">
              <h3 className="text-lg font-semibold text-[#5D4E37] dark:text-white mb-4 flex items-center gap-2">
                <Send className="w-5 h-5 text-[#D9A299] dark:text-[#ba181b]" />
                Submit Upgrade Request
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Student Select */}
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-1">
                    Select Student
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => handleStudentSelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#3d4951]/50 bg-white dark:bg-[#161a1d] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] outline-none"
                  >
                    <option value="" className="bg-white dark:bg-[#161a1d] text-[#5D4E37] dark:text-white">
                      -- Select a student --
                    </option>
                    {students.map((s) => (
                      <option
                        key={s.user_id}
                        value={s.user_id}
                        className="bg-white dark:bg-[#161a1d] text-[#5D4E37] dark:text-white"
                      >
                        {s.roll_no} - {s.full_name} (Term {s.term})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Current Term (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-1">
                    Current Term
                  </label>
                  <input
                    type="text"
                    value={selectedStudentTerm ? `Term ${selectedStudentTerm}` : ''}
                    readOnly
                    className="w-full px-3 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#3d4951]/50 bg-[#F0E4D3]/50 dark:bg-[#0b090a] text-[#5D4E37] dark:text-[#b1a7a6] cursor-not-allowed"
                    placeholder="Auto-filled from student"
                  />
                </div>

                {/* Requested Term */}
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-1">
                    Upgrade To
                  </label>
                  <select
                    value={requestedTerm}
                    onChange={(e) => setRequestedTerm(e.target.value)}
                    disabled={!selectedStudentTerm}
                    className="w-full px-3 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#3d4951]/50 bg-white dark:bg-[#161a1d] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] outline-none disabled:opacity-50"
                  >
                    <option value="" className="bg-white dark:bg-[#161a1d] text-[#5D4E37] dark:text-white">
                      -- Select target term --
                    </option>
                    {getAllTerms()
                      .filter(t => selectedStudentTerm && isValidUpgrade(selectedStudentTerm, t))
                      .map(t => (
                        <option
                          key={t}
                          value={t}
                          className="bg-white dark:bg-[#161a1d] text-[#5D4E37] dark:text-white"
                        >
                          Term {t}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-1">
                    Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Completed all requirements"
                    className="w-full px-3 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#3d4951]/50 bg-white dark:bg-[#161a1d] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] outline-none"
                  />
                </div>
              </div>

              {/* Term Upgrade Visual */}
              {selectedStudentTerm && requestedTerm && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center justify-center gap-4"
                >
                  <div className="px-4 py-2 rounded-xl bg-[#F0E4D3] dark:bg-[#3d4951]/30 border border-[#DCC5B2] dark:border-[#3d4951]/50 text-[#5D4E37] dark:text-white font-semibold">
                    Term {selectedStudentTerm}
                  </div>
                  <ArrowUpCircle className="w-6 h-6 text-[#D9A299] dark:text-[#ba181b] animate-bounce" />
                  <div className="px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold">
                    Term {requestedTerm}
                  </div>
                </motion.div>
              )}

              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowSubmitForm(false)}
                  className="px-4 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#3d4951]/50 text-[#8B7355] dark:text-[#b1a7a6] hover:bg-[#F0E4D3] dark:hover:bg-[#0b090a] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitRequest}
                  disabled={!selectedStudentId || !requestedTerm || submitting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D9A299] dark:bg-[#ba181b] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Submit Request
                </button>
              </div>
            </SpotlightCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Filters */}
      <div className="flex gap-2 border-b border-[#DCC5B2] dark:border-[#3d4951]/50 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTabFilter(tab.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tabFilter === tab.key
                ? 'text-[#5D4E37] dark:text-white'
                : 'text-[#8B7355] dark:text-[#b1a7a6]/70 hover:text-[#5D4E37] dark:hover:text-white/70'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  tabFilter === tab.key
                    ? 'bg-[#D9A299]/30 dark:bg-[#ba181b]/30 text-[#5D4E37] dark:text-white'
                    : 'bg-[#F0E4D3] dark:bg-[#0b090a] text-[#8B7355] dark:text-[#b1a7a6]/70'
                }`}>
                  {tab.count}
                </span>
              )}
            </span>
            {tabFilter === tab.key && (
              <motion.div
                layoutId="termUpgradeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D9A299] dark:bg-[#ba181b]"
              />
            )}
          </button>
        ))}
      </div>
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
          <Loader2 className="w-8 h-8 text-[#D9A299] dark:text-[#ba181b] animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <ChevronUp className="w-12 h-12 mx-auto text-[#DCC5B2] dark:text-white/20 mb-3" />
          <p className="text-[#8B7355] dark:text-[#b1a7a6]/70 font-medium">No {tabFilter !== 'all' ? tabFilter : ''} requests found</p>
          <p className="text-sm text-[#8B7355]/70 dark:text-white/25 mt-1">
            {tabFilter === 'pending' ? 'All caught up!' : 'Term upgrade requests will appear here.'}
          </p>
        </div>
      ) : (
        /* Term Accordions */
        <div className="space-y-3">
          <AnimatePresence>
            {requests.map((req, index) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <SpotlightCard
                  className="p-4"
                  spotlightColor={
                    req.status === 'pending'
                      ? 'rgba(245, 158, 11, 0.1)'
                      : req.status === 'approved'
                      ? 'rgba(16, 185, 129, 0.1)'
                      : 'rgba(239, 68, 68, 0.1)'
                  }
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Student Info */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#D9A299]/20 dark:bg-[#ba181b]/20 flex items-center justify-center text-[#5D4E37] dark:text-white font-semibold text-sm flex-shrink-0">
                        {req.students.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-[#5D4E37] dark:text-white">
                          {req.students.full_name}
                        </p>
                        <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6]">
                          Roll: {req.students.roll_no} | Session: {req.students.session}
                          {req.students.section && ` | Sec: ${req.students.section}`}
                          {req.students.cgpa > 0 && ` | CGPA: ${req.students.cgpa}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs px-2 py-0.5 rounded bg-[#F0E4D3] dark:bg-[#3d4951]/30 text-[#5D4E37] dark:text-[#d3d3d3] font-medium">
                            Term {req.current_term}
                          </span>
                          <ArrowUpCircle className="w-4 h-4 text-[#D9A299] dark:text-[#ba181b]" />
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium">
                            Term {req.requested_term}
                          </span>
                        </div>
                        {req.reason && (
                          <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]/70 mt-1 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {req.reason}
                          </p>
                        )}
                        {req.admin_remarks && req.status !== 'pending' && (
                          <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]/70 mt-1 italic">
                            Admin: {req.admin_remarks}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right side: Status + Actions */}
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      {statusBadge(req.status)}
                      <span className="text-xs text-[#8B7355] dark:text-[#b1a7a6]/50">
                        {new Date(req.requested_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>

                      {req.status === 'pending' && isAdmin && (
                        <div className="flex gap-2 mt-1">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setReviewingRequest(req);
                              setAdminRemarks('');
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Review
                          </motion.button>
                        </div>
                      )}

                      {req.status !== 'pending' && req.reviewed_at && (
                        <span className="text-xs text-[#8B7355] dark:text-white/25">
                          Reviewed: {new Date(req.reviewed_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Review Modal */}
      <AnimatePresence>
        {reviewingRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => !reviewing && setReviewingRequest(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md mx-4 bg-white dark:bg-[#161a1d] rounded-2xl border border-[#DCC5B2] dark:border-[#3d4951]/50 shadow-2xl p-6"
            >
              <h3 className="text-lg font-bold text-[#5D4E37] dark:text-white mb-4">
                Review Upgrade Request
              </h3>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-sm text-[#8B7355] dark:text-[#b1a7a6]">Student</span>
                  <span className="text-sm font-medium text-[#5D4E37] dark:text-white">
                    {reviewingRequest.students.full_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[#8B7355] dark:text-[#b1a7a6]">Roll No</span>
                  <span className="text-sm font-medium text-[#5D4E37] dark:text-white">
                    {reviewingRequest.students.roll_no}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#8B7355] dark:text-[#b1a7a6]">Upgrade</span>
                  <span className="flex items-center gap-2 text-sm font-medium text-[#5D4E37] dark:text-white">
                    Term {reviewingRequest.current_term}
                    <ArrowUpCircle className="w-4 h-4 text-[#D9A299] dark:text-[#ba181b]" />
                    Term {reviewingRequest.requested_term}
                  </span>
                </div>
                {reviewingRequest.students.cgpa > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-[#8B7355] dark:text-[#b1a7a6]">CGPA</span>
                    <span className="text-sm font-medium text-[#5D4E37] dark:text-white">
                      {reviewingRequest.students.cgpa}
                    </span>
                  </div>
                )}
                {reviewingRequest.reason && (
                  <div>
                    <span className="text-sm text-[#8B7355] dark:text-[#b1a7a6]">Reason</span>
                    <p className="text-sm text-[#5D4E37] dark:text-[#f5f3f4] mt-0.5">
                      {reviewingRequest.reason}
                    </p>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-1">
                  Admin Remarks (Optional)
                </label>
                <textarea
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  rows={2}
                  placeholder="Add any remarks..."
                  className="w-full px-3 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#3d4951]/50 bg-white dark:bg-[#161a1d] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => !reviewing && setReviewingRequest(null)}
                  disabled={reviewing}
                  className="px-4 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#3d4951]/50 text-[#8B7355] dark:text-[#b1a7a6] hover:bg-[#F0E4D3] dark:hover:bg-[#0b090a] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReview('rejected')}
                  disabled={reviewing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  Reject
                </button>
                <button
                  onClick={() => handleReview('approved')}
                  disabled={reviewing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Approve
                </button>
              </div>
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
