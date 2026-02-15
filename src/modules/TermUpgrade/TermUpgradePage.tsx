"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { useAuth } from '@/contexts/AuthContext';
import { TermUpgradeRequestWithStudent } from '@/lib/supabase';
import {
  getTermUpgradeRequests,
  getNextTerm,
  getAllTerms,
  isValidUpgrade,
  submitTermUpgradeRequest,
  reviewTermUpgradeRequest,
} from '@/services/termUpgradeService';
import { StudentWithAuth } from '@/services/studentService';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpCircle,
  Check,
  CheckCircle2,
  ChevronUp,
  Clock,
  Filter,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  TrendingUp,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type TabFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function TermUpgradePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [requests, setRequests] = useState<TermUpgradeRequestWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabFilter, setTabFilter] = useState<TabFilter>('pending');

  // Submit request form state
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [students, setStudents] = useState<StudentWithAuth[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudentTerm, setSelectedStudentTerm] = useState('');
  const [requestedTerm, setRequestedTerm] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Review modal state
  const [reviewingRequest, setReviewingRequest] = useState<TermUpgradeRequestWithStudent | null>(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter = tabFilter === 'all' ? undefined : tabFilter;
      const data = await getTermUpgradeRequests({ status: statusFilter });
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  }, [tabFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Fetch students for the submit form
  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/students');
      const data = await res.json();
      setStudents(data || []);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    }
  }, []);

  useEffect(() => {
    if (showSubmitForm && students.length === 0) {
      fetchStudents();
    }
  }, [showSubmitForm, students.length, fetchStudents]);

  // When student is selected, auto-fill current term and next term
  const handleStudentSelect = (studentId: string) => {
    setSelectedStudentId(studentId);
    const student = students.find(s => s.user_id === studentId);
    if (student) {
      setSelectedStudentTerm(student.term);
      const next = getNextTerm(student.term);
      setRequestedTerm(next || '');
    } else {
      setSelectedStudentTerm('');
      setRequestedTerm('');
    }
  };

  const handleSubmitRequest = async () => {
    if (!selectedStudentId || !selectedStudentTerm || !requestedTerm) return;
    if (!isValidUpgrade(selectedStudentTerm, requestedTerm)) {
      alert('Invalid term upgrade. Requested term must be after current term.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitTermUpgradeRequest(
        selectedStudentId,
        selectedStudentTerm,
        requestedTerm,
        reason
      );
      if (result.success) {
        setShowSubmitForm(false);
        setSelectedStudentId('');
        setSelectedStudentTerm('');
        setRequestedTerm('');
        setReason('');
        fetchRequests();
      } else {
        alert(result.error || 'Failed to submit request');
      }
    } catch (error) {
      alert('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (action: 'approved' | 'rejected') => {
    if (!reviewingRequest || !user?.id) return;

    setReviewing(true);
    try {
      const result = await reviewTermUpgradeRequest(
        reviewingRequest.id,
        action,
        user.id,
        adminRemarks
      );
      if (result.success) {
        setReviewingRequest(null);
        setAdminRemarks('');
        fetchRequests();
      } else {
        alert(result.error || 'Failed to review request');
      }
    } catch (error) {
      alert('Failed to review request');
    } finally {
      setReviewing(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  const tabs: { key: TabFilter; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending', count: tabFilter === 'pending' ? requests.length : pendingCount },
    { key: 'approved', label: 'Approved', count: tabFilter === 'approved' ? requests.length : approvedCount },
    { key: 'rejected', label: 'Rejected', count: tabFilter === 'rejected' ? requests.length : rejectedCount },
    { key: 'all', label: 'All' },
  ];

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
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchRequests}
            className="p-2 rounded-xl bg-[#F0E4D3] dark:bg-[#0b090a] border border-[#DCC5B2] dark:border-[#3d4951]/50 text-[#8B7355] dark:text-[#b1a7a6] hover:bg-[#D9A299]/20 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
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

      {/* Requests List */}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
