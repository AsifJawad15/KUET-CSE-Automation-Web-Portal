"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { getAllStudents } from '@/services/studentService';
import { toggleCRStatus, getAllCRRoomRequests } from '@/services/crRoomRequestService';
import type { StudentWithAuth, CRRoomRequestWithDetails } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import {
  Crown, Search, Loader2, X, AlertCircle,
  CheckCircle, Building2, User,
  BookOpen, ChevronDown, ChevronUp, Clock
} from 'lucide-react';

// ── Days / Periods ─────────────────────────────────────

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function formatTime(time: string) {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

// ── Main Component ─────────────────────────────────────

export default function CRManagementPage() {
  const { } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<'manage-cr' | 'room-allocations'>('manage-cr');

  // CR management state
  const [students, setStudents] = useState<StudentWithAuth[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTerm, setFilterTerm] = useState<string>('all');
  const [filterSession, setFilterSession] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // Room allocations state (read-only, FCFS ordered)
  const [allocations, setAllocations] = useState<CRRoomRequestWithDetails[]>([]);
  const [allocationsLoading, setAllocationsLoading] = useState(false);
  const [expandedAllocation, setExpandedAllocation] = useState<string | null>(null);

  // Messages
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showMessage = useCallback((msg: string, type: 'success' | 'error') => {
    if (type === 'success') { setSuccess(msg); setError(null); }
    else { setError(msg); setSuccess(null); }
    setTimeout(() => { setSuccess(null); setError(null); }, 4000);
  }, []);

  // ── Load Data ────────────────────────────────────────

  useEffect(() => { loadStudents(); }, []);

  const loadAllocations = useCallback(async () => {
    setAllocationsLoading(true);
    const data = await getAllCRRoomRequests();
    setAllocations(data);
    setAllocationsLoading(false);
  }, []);

  useEffect(() => { if (activeTab === 'room-allocations') { loadAllocations(); } }, [activeTab, loadAllocations]);

  const loadStudents = async () => {
    setLoading(true);
    const data = await getAllStudents();
    setStudents(data);
    setLoading(false);
  };

  // ── CR Toggle ────────────────────────────────────────

  const handleToggleCR = async (student: StudentWithAuth) => {
    setToggling(student.user_id);
    const result = await toggleCRStatus(student.user_id, !student.is_cr);
    if (result.success) {
      setStudents(prev => prev.map(s =>
        s.user_id === student.user_id ? { ...s, is_cr: !s.is_cr } : s
      ));
      showMessage(`${student.full_name} ${student.is_cr ? 'removed from' : 'designated as'} CR`, 'success');
    } else {
      showMessage(result.error || 'Failed to update CR status', 'error');
    }
    setToggling(null);
  };

  // ── Filters ──────────────────────────────────────────

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.roll_no.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTerm = filterTerm === 'all' || s.term === filterTerm;
    const matchesSession = filterSession === 'all' || s.session === filterSession;
    return matchesSearch && matchesTerm && matchesSession;
  });

  const crStudents = filteredStudents.filter(s => s.is_cr);
  const nonCRStudents = filteredStudents.filter(s => !s.is_cr);
  const uniqueTerms = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'];
  const uniqueSessions = [...new Set(students.map(s => s.session))].sort().reverse();

  // ── Render ───────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white flex items-center gap-3">
            <Crown className="w-7 h-7 text-amber-500" />
            CR Management
          </h1>
          <p className="text-[#8B7355] dark:text-[#b1a7a6] mt-1">
            Designate Class Representatives and manage their room requests
          </p>
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-5 h-5" /> {success}
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F5EDE4] dark:bg-[#161a1d] p-1 rounded-xl">
        <button onClick={() => setActiveTab('manage-cr')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'manage-cr' ? 'bg-white dark:bg-[#0b090a] text-[#5D4037] dark:text-white shadow-sm' : 'text-[#8B7355] dark:text-[#b1a7a6] hover:text-[#5D4E37] dark:hover:text-white'}`}>
          <Crown className="w-4 h-4 inline mr-2" />Manage CRs
        </button>
        <button onClick={() => setActiveTab('room-allocations')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'room-allocations' ? 'bg-white dark:bg-[#0b090a] text-[#5D4037] dark:text-white shadow-sm' : 'text-[#8B7355] dark:text-[#b1a7a6] hover:text-[#5D4E37] dark:hover:text-white'}`}>
          <Building2 className="w-4 h-4 inline mr-2" />Room Allocations
          {allocations.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              {allocations.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab: Manage CRs ─────────────────────────── */}
      {activeTab === 'manage-cr' && (
        <div className="space-y-6">
          {/* Filters */}
          <SpotlightCard className="p-4 rounded-xl bg-white dark:bg-[#161a1d] border border-[#E8DDD1] dark:border-[#3d4951]/50">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7355] dark:text-[#b1a7a6]" />
                <input type="text" placeholder="Search by name or roll..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] border border-[#E8DDD1] dark:border-[#3d4951] text-[#5D4E37] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5D4037]/30 dark:focus:ring-[#ba181b]/30" />
              </div>
              <select value={filterTerm} onChange={e => setFilterTerm(e.target.value)}
                className="px-3 py-2.5 rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] border border-[#E8DDD1] dark:border-[#3d4951] text-[#5D4E37] dark:text-white text-sm focus:outline-none">
                <option value="all">All Terms</option>
                {uniqueTerms.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterSession} onChange={e => setFilterSession(e.target.value)}
                className="px-3 py-2.5 rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] border border-[#E8DDD1] dark:border-[#3d4951] text-[#5D4E37] dark:text-white text-sm focus:outline-none">
                <option value="all">All Sessions</option>
                {uniqueSessions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </SpotlightCard>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#5D4037] dark:text-[#ba181b]" /></div>
          ) : (
            <>
              {/* Current CRs */}
              {crStudents.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-[#5D4E37] dark:text-white mb-3 flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-500" />
                    Class Representatives ({crStudents.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {crStudents.map(student => (
                      <SpotlightCard key={student.user_id} className="p-4 rounded-xl bg-white dark:bg-[#161a1d] border-2 border-amber-500/30 dark:border-amber-500/20">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                              <Crown className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                              <p className="font-semibold text-[#5D4E37] dark:text-white text-sm">{student.full_name}</p>
                              <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">{student.roll_no}</p>
                              <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">Term {student.term} · {student.session}</p>
                            </div>
                          </div>
                          <button onClick={() => handleToggleCR(student)} disabled={toggling === student.user_id}
                            className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                            {toggling === student.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><X className="w-3 h-3 inline mr-1" />Remove</>}
                          </button>
                        </div>
                      </SpotlightCard>
                    ))}
                  </div>
                </div>
              )}

              {/* All Students */}
              <div>
                <h2 className="text-lg font-semibold text-[#5D4E37] dark:text-white mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-[#5D4037] dark:text-[#ba181b]" />
                  Students ({nonCRStudents.length})
                </h2>
                {nonCRStudents.length === 0 ? (
                  <p className="text-center py-8 text-[#8B7355] dark:text-[#b1a7a6]">No students found matching filters</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#F5EDE4] dark:bg-[#0b090a]">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">Student</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">Roll</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">Term</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">Session</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8DDD1] dark:divide-[#3d4951]/30">
                        {nonCRStudents.map(student => (
                          <tr key={student.user_id} className="bg-white dark:bg-[#161a1d] hover:bg-[#FAF7F3] dark:hover:bg-[#0b090a]/50 transition-colors">
                            <td className="px-4 py-3 text-sm text-[#5D4E37] dark:text-white font-medium">{student.full_name}</td>
                            <td className="px-4 py-3 text-sm text-[#8B7355] dark:text-[#b1a7a6]">{student.roll_no}</td>
                            <td className="px-4 py-3 text-sm text-[#8B7355] dark:text-[#b1a7a6]">{student.term}</td>
                            <td className="px-4 py-3 text-sm text-[#8B7355] dark:text-[#b1a7a6]">{student.session}</td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => handleToggleCR(student)} disabled={toggling === student.user_id}
                                className="px-3 py-1.5 text-xs rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                                {toggling === student.user_id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <><Crown className="w-3 h-3 inline mr-1" />Make CR</>}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Room Allocations (FCFS, read-only) ── */}
      {activeTab === 'room-allocations' && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-sm">
            <Clock className="w-4 h-4 flex-shrink-0" />
            Rooms are automatically assigned on a First-Come-First-Served basis. Who requested first gets a room first.
          </div>

          {allocationsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#5D4037] dark:text-[#ba181b]" /></div>
          ) : allocations.length === 0 ? (
            <div className="text-center py-12 text-[#8B7355] dark:text-[#b1a7a6]">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No room allocation history yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F5EDE4] dark:bg-[#0b090a]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">CR (Booked By)</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">Room</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">Course</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">Section</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">Teacher</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">Schedule</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">Requested At</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-[#8B7355] dark:text-[#b1a7a6] uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DDD1] dark:divide-[#3d4951]/30">
                  {allocations.map((alloc, index) => (
                    <>
                      <tr key={alloc.id} className="bg-white dark:bg-[#161a1d] hover:bg-[#FAF7F3] dark:hover:bg-[#0b090a]/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#5D4037]/10 dark:bg-[#ba181b]/20 text-[#5D4037] dark:text-[#ba181b]">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-[#5D4E37] dark:text-white">{alloc.students?.full_name}</p>
                              <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">{alloc.students?.roll_no}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <Building2 className="w-3.5 h-3.5" />
                            {alloc.room_number || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-[#5D4E37] dark:text-white flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-[#5D4037] dark:text-[#ba181b]" />
                            {alloc.course_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#5D4E37] dark:text-white">
                          {alloc.section || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#8B7355] dark:text-[#b1a7a6]">
                          {alloc.teachers?.full_name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#8B7355] dark:text-[#b1a7a6] whitespace-nowrap">
                          {DAYS[alloc.day_of_week]}, {formatTime(alloc.start_time)}-{formatTime(alloc.end_time)}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#5D4E37] dark:text-white whitespace-nowrap">
                          {alloc.request_date ? new Date(alloc.request_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#8B7355] dark:text-[#b1a7a6] whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(alloc.created_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => setExpandedAllocation(expandedAllocation === alloc.id ? null : alloc.id)}
                            className="p-1.5 rounded-lg hover:bg-[#F5EDE4] dark:hover:bg-[#0b090a] transition-colors text-[#8B7355] dark:text-[#b1a7a6]">
                            {expandedAllocation === alloc.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                      {expandedAllocation === alloc.id && (
                        <tr key={`${alloc.id}-details`} className="bg-[#FAF7F3] dark:bg-[#0b090a]/70">
                          <td colSpan={10} className="px-6 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div><span className="text-[#8B7355] dark:text-[#b1a7a6]">Term:</span> <span className="text-[#5D4E37] dark:text-white ml-1">{alloc.term}</span></div>
                              <div><span className="text-[#8B7355] dark:text-[#b1a7a6]">Session:</span> <span className="text-[#5D4E37] dark:text-white ml-1">{alloc.session}</span></div>
                              {alloc.section && <div><span className="text-[#8B7355] dark:text-[#b1a7a6]">Section:</span> <span className="text-[#5D4E37] dark:text-white ml-1">{alloc.section}</span></div>}
                              {alloc.reason && <div className="col-span-2"><span className="text-[#8B7355] dark:text-[#b1a7a6]">Reason:</span> <span className="text-[#5D4E37] dark:text-white ml-1">{alloc.reason}</span></div>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
