"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    assignCourseToStudents,
    createElectiveOffering,
    deleteElectiveOffering,
    ElectiveCourse,
    ElectiveOffering,
    getElectiveCourses,
    getElectiveOfferings,
    getOptionalAssignments,
    getTeachers,
    OptionalAssignment,
    removeAssignment,
    updateElectiveOffering,
} from '@/services/optionalCourseService';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertCircle,
    BookOpen,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Edit2,
    Info,
    Loader2,
    Plus,
    Search,
    Settings,
    Trash2,
    Upload,
    UserCheck,
    Users,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ── Types ──────────────────────────────────────────────

interface StudentRow {
  user_id: string;
  roll_no: string;
  full_name: string;
  term: string;
  session: string;
  batch: string | null;
  section: string | null;
}

interface Teacher {
  user_id: string;
  full_name: string;
  teacher_uid: string;
}

type GroupedOfferings = Record<string, ElectiveOffering[]>;
type GroupedCourses = Record<string, ElectiveCourse[]>;

// ── Component ──────────────────────────────────────────

export default function OptionalCourseAllocationPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Data
  const [selectedTerm, setSelectedTerm] = useState<'4-1' | '4-2'>('4-1');
  const [electiveOfferings, setElectiveOfferings] = useState<ElectiveOffering[]>([]);
  const [electiveCourses, setElectiveCourses] = useState<ElectiveCourse[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<OptionalAssignment[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedOffering, setSelectedOffering] = useState<ElectiveOffering | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['OPTIONAL_I', 'OPTIONAL_II', 'OPTIONAL_III']));
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showStudentAssignments, setShowStudentAssignments] = useState<string | null>(null);
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [viewMode, setViewMode] = useState<'assign' | 'view' | 'manage'>('assign');

  // Manage mode state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOffering, setEditingOffering] = useState<ElectiveOffering | null>(null);
  const [selectedCourseForCreate, setSelectedCourseForCreate] = useState<ElectiveCourse | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Fetch Data ─────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [offeringsData, assignmentsData, studentsRes, coursesData, teachersData] = await Promise.all([
        getElectiveOfferings(selectedTerm),
        getOptionalAssignments({ term: selectedTerm }),
        fetch(`/api/students?term=${selectedTerm}`),
        getElectiveCourses(selectedTerm),
        getTeachers(),
      ]);

      setElectiveOfferings(offeringsData);
      setAssignments(assignmentsData);
      setElectiveCourses(coursesData);
      setTeachers(teachersData);

      if (studentsRes.ok) {
        const studentsJson = await studentsRes.json();
        const list = Array.isArray(studentsJson) ? studentsJson : studentsJson.data || [];
        setStudents(list.map((s: Record<string, unknown>) => ({
          user_id: s.user_id as string,
          roll_no: s.roll_no as string,
          full_name: s.full_name as string,
          term: s.term as string,
          session: s.session as string,
          batch: (s.batch as string) || null,
          section: (s.section as string) || null,
        })));
      }
    } catch (e) {
      setErrorMsg('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Clear messages after timeout
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(''), 5000);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  // ── Derived Data ───────────────────────────────────

  const groupedOfferings = useMemo<GroupedOfferings>(() => {
    const groups: GroupedOfferings = {};
    for (const off of electiveOfferings) {
      const group = off.elective_group || 'UNCATEGORIZED';
      if (!groups[group]) groups[group] = [];
      groups[group].push(off);
    }
    // Sort each group by course code
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => (a.courses?.code || '').localeCompare(b.courses?.code || ''));
    }
    return groups;
  }, [electiveOfferings]);

  // Group elective courses by elective_group (for manage mode)
  const groupedCourses = useMemo<GroupedCourses>(() => {
    const groups: GroupedCourses = {};
    for (const course of electiveCourses) {
      const group = course.elective_group || 'UNCATEGORIZED';
      if (!groups[group]) groups[group] = [];
      groups[group].push(course);
    }
    return groups;
  }, [electiveCourses]);

  // Courses that already have offerings
  const coursesWithOfferings = useMemo(() => {
    return new Set(electiveOfferings.map((o) => o.course_id));
  }, [electiveOfferings]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) => s.roll_no.toLowerCase().includes(q) || s.full_name.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  // Students already assigned to selected offering
  const assignedStudentIdsForOffering = useMemo(() => {
    if (!selectedOffering) return new Set<string>();
    return new Set(
      assignments
        .filter((a) => a.offering_id === selectedOffering.id)
        .map((a) => a.student_user_id)
    );
  }, [assignments, selectedOffering]);

  // Per-student assignment map for "view" mode
  const studentAssignmentMap = useMemo(() => {
    const map = new Map<string, OptionalAssignment[]>();
    for (const a of assignments) {
      const existing = map.get(a.student_user_id) || [];
      existing.push(a);
      map.set(a.student_user_id, existing);
    }
    return map;
  }, [assignments]);

  // ── Handlers ───────────────────────────────────────

  const handleAssign = async () => {
    if (!selectedOffering || selectedStudentIds.size === 0) return;
    setAssigning(true);
    setErrorMsg('');
    try {
      const result = await assignCourseToStudents(
        Array.from(selectedStudentIds),
        selectedOffering.id,
        user?.id
      );
      if (result.success) {
        setSuccessMsg(
          `Assigned ${selectedOffering.courses?.code} to ${selectedStudentIds.size} student(s)`
        );
        setSelectedStudentIds(new Set());
        await fetchData();
      } else {
        setErrorMsg(result.error || 'Assignment failed');
      }
    } catch {
      setErrorMsg('Failed to assign courses');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveAssignment = async (studentUserId: string, offeringId: string) => {
    try {
      const result = await removeAssignment(studentUserId, offeringId);
      if (result.success) {
        setSuccessMsg('Assignment removed');
        await fetchData();
      } else {
        setErrorMsg(result.error || 'Failed to remove');
      }
    } catch {
      setErrorMsg('Failed to remove assignment');
    }
  };

  const handleSelectAll = () => {
    const unassigned = filteredStudents.filter((s) => !assignedStudentIdsForOffering.has(s.user_id));
    setSelectedStudentIds(new Set(unassigned.map((s) => s.user_id)));
  };

  const handleDeselectAll = () => setSelectedStudentIds(new Set());

  const handleBulkAssign = () => {
    // Parse roll numbers from bulk input
    const rolls = bulkInput
      .split(/[\n,;]+/)
      .map((r) => r.trim())
      .filter(Boolean);

    const matchedIds = new Set<string>();
    for (const roll of rolls) {
      const student = students.find((s) => s.roll_no === roll);
      if (student && !assignedStudentIdsForOffering.has(student.user_id)) {
        matchedIds.add(student.user_id);
      }
    }
    setSelectedStudentIds(matchedIds);
    setShowBulkModal(false);
    setBulkInput('');
    if (matchedIds.size > 0) {
      setSuccessMsg(`Matched ${matchedIds.size} student(s) from input`);
    } else {
      setErrorMsg('No matching unassigned students found');
    }
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  // ── Manage Mode CRUD Handlers ──────────────────────

  const handleCreateOffering = async () => {
    if (!selectedCourseForCreate || !selectedTeacher) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const currentYear = new Date().getFullYear();
      const result = await createElectiveOffering({
        course_id: selectedCourseForCreate.id,
        teacher_user_id: selectedTeacher,
        term: selectedTerm,
        session: selectedSession || `${currentYear - 1}-${currentYear}`,
      });
      if (result.success) {
        setSuccessMsg(`Created offering for ${selectedCourseForCreate.code}`);
        setShowCreateModal(false);
        setSelectedCourseForCreate(null);
        setSelectedTeacher('');
        setSelectedSession('');
        await fetchData();
      } else {
        setErrorMsg(result.error || 'Failed to create offering');
      }
    } catch {
      setErrorMsg('Failed to create offering');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateOffering = async () => {
    if (!editingOffering || !selectedTeacher) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const result = await updateElectiveOffering({
        id: editingOffering.id,
        teacher_user_id: selectedTeacher,
        session: selectedSession || editingOffering.session,
      });
      if (result.success) {
        setSuccessMsg(`Updated ${editingOffering.courses?.code}`);
        setShowEditModal(false);
        setEditingOffering(null);
        setSelectedTeacher('');
        setSelectedSession('');
        await fetchData();
      } else {
        setErrorMsg(result.error || 'Failed to update offering');
      }
    } catch {
      setErrorMsg('Failed to update offering');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOffering = async (offering: ElectiveOffering) => {
    if (!confirm(`Delete offering for ${offering.courses?.code}? This will also remove all student assignments for this course.`)) {
      return;
    }
    try {
      const result = await deleteElectiveOffering(offering.id, true);
      if (result.success) {
        setSuccessMsg(`Deleted offering for ${offering.courses?.code}`);
        await fetchData();
      } else {
        setErrorMsg(result.error || 'Failed to delete offering');
      }
    } catch {
      setErrorMsg('Failed to delete offering');
    }
  };

  const openCreateModal = (course: ElectiveCourse) => {
    setSelectedCourseForCreate(course);
    setSelectedTeacher('');
    setSelectedSession('');
    setShowCreateModal(true);
  };

  const openEditModal = (offering: ElectiveOffering) => {
    setEditingOffering(offering);
    setSelectedTeacher(offering.teacher_user_id);
    setSelectedSession(offering.session);
    setShowEditModal(true);
  };

  const toggleStudent = (userId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const groupLabel = (group: string) => {
    switch (group) {
      case 'OPTIONAL_I': return 'Optional-I';
      case 'OPTIONAL_II': return 'Optional-II';
      case 'OPTIONAL_III': return 'Optional-III';
      default: return group;
    }
  };

  // ── Render ─────────────────────────────────────────

  const cardClass = `rounded-xl border ${isDark ? 'bg-[#161a1d] border-[#3d4951]/50' : 'bg-white border-[#E8DDD1]'}`;
  const textPrimary = isDark ? 'text-white' : 'text-[#5D4E37]';
  const textSecondary = isDark ? 'text-[#b1a7a6]' : 'text-[#8B7355]';
  const inputClass = `w-full px-4 py-2.5 rounded-xl border text-sm transition-colors ${
    isDark
      ? 'bg-[#0b090a] border-[#3d4951] text-white placeholder-[#6c757d] focus:border-[#ba181b]'
      : 'bg-white border-[#E8DDD1] text-[#5D4E37] placeholder-[#8B7355] focus:border-[#5D4037]'
  } focus:outline-none focus:ring-2 focus:ring-opacity-20 ${isDark ? 'focus:ring-[#ba181b]' : 'focus:ring-[#5D4037]'}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-[#ba181b]' : 'text-[#5D4037]'}`} />
        <span className={`ml-3 text-lg ${textSecondary}`}>Loading optional course data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>Optional Course Allocation</h1>
          <p className={`text-sm mt-1 ${textSecondary}`}>
            Assign elective courses to individual 4th year students
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Term selector */}
          <div className="flex rounded-xl overflow-hidden border border-[#E8DDD1] dark:border-[#3d4951]">
            {(['4-1', '4-2'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setSelectedTerm(t); setSelectedOffering(null); setSelectedStudentIds(new Set()); }}
                className={`px-5 py-2.5 text-sm font-medium transition-all ${
                  selectedTerm === t
                    ? isDark ? 'bg-[#ba181b] text-white' : 'bg-[#5D4037] text-white'
                    : isDark ? 'bg-[#0b090a] text-[#b1a7a6] hover:text-white' : 'bg-white text-[#8B7355] hover:text-[#5D4E37]'
                }`}
              >
                4th Year {t === '4-1' ? '1st' : '2nd'} Term
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div className="flex rounded-xl overflow-hidden border border-[#E8DDD1] dark:border-[#3d4951]">
            <button
              onClick={() => setViewMode('assign')}
              className={`px-4 py-2.5 text-sm font-medium transition-all ${
                viewMode === 'assign'
                  ? isDark ? 'bg-[#ba181b] text-white' : 'bg-[#5D4037] text-white'
                  : isDark ? 'bg-[#0b090a] text-[#b1a7a6]' : 'bg-white text-[#8B7355]'
              }`}
            >
              Assign
            </button>
            <button
              onClick={() => setViewMode('view')}
              className={`px-4 py-2.5 text-sm font-medium transition-all ${
                viewMode === 'view'
                  ? isDark ? 'bg-[#ba181b] text-white' : 'bg-[#5D4037] text-white'
                  : isDark ? 'bg-[#0b090a] text-[#b1a7a6]' : 'bg-white text-[#8B7355]'
              }`}
            >
              View
            </button>
            <button
              onClick={() => setViewMode('manage')}
              className={`px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-1.5 ${
                viewMode === 'manage'
                  ? isDark ? 'bg-[#ba181b] text-white' : 'bg-[#5D4037] text-white'
                  : isDark ? 'bg-[#0b090a] text-[#b1a7a6]' : 'bg-white text-[#8B7355]'
              }`}
            >
              <Settings className="w-4 h-4" /> Manage
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
          >
            <CheckCircle2 className="w-5 h-5" /> <span className="text-sm">{successMsg}</span>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
          >
            <AlertCircle className="w-5 h-5" /> <span className="text-sm">{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Students in Term', value: students.length, icon: Users },
          { label: 'Elective Offerings', value: electiveOfferings.length, icon: BookOpen },
          { label: 'Total Assignments', value: assignments.length, icon: UserCheck },
          { label: 'Groups', value: Object.keys(groupedOfferings).length, icon: Info },
        ].map((stat) => (
          <div key={stat.label} className={`${cardClass} p-4`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isDark ? 'bg-[#ba181b]/10' : 'bg-[#5D4037]/10'}`}>
                <stat.icon className={`w-5 h-5 ${isDark ? 'text-[#ba181b]' : 'text-[#5D4037]'}`} />
              </div>
              <div>
                <p className={`text-xl font-bold ${textPrimary}`}>{stat.value}</p>
                <p className={`text-xs ${textSecondary}`}>{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {viewMode === 'assign' ? (
        /* ── ASSIGN MODE ──────────────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Elective Courses */}
          <div className={`${cardClass} overflow-hidden`}>
            <div className={`px-5 py-4 border-b ${isDark ? 'border-[#3d4951]/50' : 'border-[#E8DDD1]'}`}>
              <h2 className={`text-lg font-semibold ${textPrimary}`}>
                Elective Course Offerings
              </h2>
              <p className={`text-xs mt-1 ${textSecondary}`}>
                Select a course to assign students
              </p>
            </div>

            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {electiveOfferings.length === 0 ? (
                <div className={`text-center py-8 ${textSecondary}`}>
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No elective offerings found for {selectedTerm === '4-1' ? '4th Year 1st Term' : '4th Year 2nd Term'}</p>
                  <p className="text-xs mt-1">Create course offerings first, then come back here.</p>
                </div>
              ) : (
                Object.entries(groupedOfferings).map(([group, offerings]) => (
                  <div key={group} className={`rounded-lg border ${isDark ? 'border-[#3d4951]/30' : 'border-[#E8DDD1]'}`}>
                    <button
                      onClick={() => toggleGroup(group)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left ${
                        isDark ? 'hover:bg-[#0b090a]/50' : 'hover:bg-[#F5EDE4]/50'
                      } transition-colors rounded-t-lg`}
                    >
                      <div className="flex items-center gap-2">
                        {expandedGroups.has(group) ? (
                          <ChevronDown className={`w-4 h-4 ${textSecondary}`} />
                        ) : (
                          <ChevronRight className={`w-4 h-4 ${textSecondary}`} />
                        )}
                        <span className={`font-semibold text-sm ${textPrimary}`}>
                          {groupLabel(group)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isDark ? 'bg-[#3d4951]/50 text-[#b1a7a6]' : 'bg-[#F5EDE4] text-[#8B7355]'
                        }`}>
                          {offerings.length}
                        </span>
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedGroups.has(group) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 space-y-2">
                            {offerings.map((off) => {
                              const isSelected = selectedOffering?.id === off.id;
                              const assignedCount = assignments.filter((a) => a.offering_id === off.id).length;
                              return (
                                <button
                                  key={off.id}
                                  onClick={() => {
                                    setSelectedOffering(isSelected ? null : off);
                                    setSelectedStudentIds(new Set());
                                  }}
                                  className={`w-full text-left p-3 rounded-lg transition-all ${
                                    isSelected
                                      ? isDark ? 'bg-[#ba181b]/20 border-[#ba181b] border' : 'bg-[#5D4037]/10 border-[#5D4037] border'
                                      : isDark ? 'bg-[#0b090a]/30 hover:bg-[#0b090a]/50 border border-transparent' : 'bg-[#F5EDE4]/30 hover:bg-[#F5EDE4]/60 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className={`text-sm font-medium ${textPrimary}`}>
                                        {off.courses?.code}
                                      </span>
                                      <span className={`text-xs ml-2 ${textSecondary}`}>
                                        {off.courses?.credit} cr
                                      </span>
                                    </div>
                                    {assignedCount > 0 && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                        {assignedCount} assigned
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-xs mt-1 ${textSecondary} truncate`}>
                                    {off.courses?.title}
                                  </p>
                                  {off.teachers?.full_name && (
                                    <p className={`text-xs mt-0.5 ${textSecondary}`}>
                                      Teacher: {off.teachers.full_name}
                                    </p>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Student List */}
          <div className={`${cardClass} overflow-hidden`}>
            <div className={`px-5 py-4 border-b ${isDark ? 'border-[#3d4951]/50' : 'border-[#E8DDD1]'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`text-lg font-semibold ${textPrimary}`}>
                    Students ({selectedTerm === '4-1' ? '4-1' : '4-2'})
                  </h2>
                  <p className={`text-xs mt-1 ${textSecondary}`}>
                    {selectedOffering
                      ? `Select students to assign to ${selectedOffering.courses?.code}`
                      : 'Select a course first'}
                  </p>
                </div>
                {selectedOffering && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowBulkModal(true)}
                      className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#0b090a]' : 'hover:bg-[#F5EDE4]'} transition-colors`}
                      title="Bulk assign by roll numbers"
                    >
                      <Upload className={`w-4 h-4 ${textSecondary}`} />
                    </button>
                    <button
                      onClick={handleSelectAll}
                      className={`text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-[#0b090a] hover:bg-[#161a1d]' : 'bg-[#F5EDE4] hover:bg-[#E8DDD1]'} ${textSecondary} transition-colors`}
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      className={`text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-[#0b090a] hover:bg-[#161a1d]' : 'bg-[#F5EDE4] hover:bg-[#E8DDD1]'} ${textSecondary} transition-colors`}
                    >
                      Deselect
                    </button>
                  </div>
                )}
              </div>

              {/* Search */}
              <div className="mt-3 relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textSecondary}`} />
                <input
                  type="text"
                  placeholder="Search by roll or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div className="p-4 max-h-[500px] overflow-y-auto">
              {!selectedOffering ? (
                <div className={`text-center py-12 ${textSecondary}`}>
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Select a course from the left panel first</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className={`text-center py-8 ${textSecondary}`}>
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No students found in this term</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredStudents.map((student) => {
                    const isAssigned = assignedStudentIdsForOffering.has(student.user_id);
                    const isSelected = selectedStudentIds.has(student.user_id);

                    return (
                      <div
                        key={student.user_id}
                        onClick={() => !isAssigned && toggleStudent(student.user_id)}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                          isAssigned
                            ? isDark ? 'bg-emerald-900/10 border border-emerald-800/30' : 'bg-emerald-50 border border-emerald-200'
                            : isSelected
                              ? isDark ? 'bg-[#ba181b]/10 border border-[#ba181b]/30' : 'bg-[#5D4037]/5 border border-[#5D4037]/20'
                              : isDark ? 'hover:bg-[#0b090a]/50 border border-transparent' : 'hover:bg-[#F5EDE4]/50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isAssigned
                              ? 'bg-emerald-500 border-emerald-500'
                              : isSelected
                                ? isDark ? 'bg-[#ba181b] border-[#ba181b]' : 'bg-[#5D4037] border-[#5D4037]'
                                : isDark ? 'border-[#3d4951]' : 'border-[#E8DDD1]'
                          }`}>
                            {(isAssigned || isSelected) && <Check className="w-3 h-3 text-white" />}
                          </div>

                          <div>
                            <span className={`text-sm font-medium ${textPrimary}`}>
                              {student.roll_no}
                            </span>
                            <span className={`text-sm ml-3 ${textSecondary}`}>
                              {student.full_name}
                            </span>
                          </div>
                        </div>

                        {isAssigned && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            Already Assigned
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Assign Button */}
            {selectedOffering && selectedStudentIds.size > 0 && (
              <div className={`px-5 py-4 border-t ${isDark ? 'border-[#3d4951]/50' : 'border-[#E8DDD1]'}`}>
                <button
                  onClick={handleAssign}
                  disabled={assigning}
                  className={`w-full py-3 rounded-xl font-medium text-white transition-all ${
                    assigning
                      ? 'opacity-50 cursor-not-allowed'
                      : isDark ? 'bg-[#ba181b] hover:bg-[#a0161a]' : 'bg-[#5D4037] hover:bg-[#4E342E]'
                  }`}
                >
                  {assigning ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Assigning...
                    </span>
                  ) : (
                    `Assign ${selectedOffering.courses?.code} to ${selectedStudentIds.size} Student(s)`
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── VIEW MODE ────────────────────────────────── */
        <div className={`${cardClass} overflow-hidden`}>
          <div className={`px-5 py-4 border-b ${isDark ? 'border-[#3d4951]/50' : 'border-[#E8DDD1]'}`}>
            <h2 className={`text-lg font-semibold ${textPrimary}`}>
              Current Assignments ({assignments.length})
            </h2>
          </div>

          {assignments.length === 0 ? (
            <div className={`text-center py-12 ${textSecondary}`}>
              <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No optional courses assigned yet for this term</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E8DDD1] dark:divide-[#3d4951]/50">
              {students.map((student) => {
                const studentAssignments = studentAssignmentMap.get(student.user_id) || [];
                if (studentAssignments.length === 0) return null;
                const isExpanded = showStudentAssignments === student.user_id;

                return (
                  <div key={student.user_id} className="px-5">
                    <button
                      onClick={() => setShowStudentAssignments(isExpanded ? null : student.user_id)}
                      className={`w-full flex items-center justify-between py-4 text-left ${isDark ? 'hover:bg-[#0b090a]/30' : 'hover:bg-[#F5EDE4]/30'} -mx-2 px-2 rounded-lg transition-colors`}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span className={`font-medium text-sm ${textPrimary}`}>{student.roll_no}</span>
                        <span className={`text-sm ${textSecondary}`}>{student.full_name}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isDark ? 'bg-[#3d4951]/50 text-[#b1a7a6]' : 'bg-[#F5EDE4] text-[#8B7355]'
                      }`}>
                        {studentAssignments.length} course{studentAssignments.length > 1 ? 's' : ''}
                      </span>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pb-4"
                        >
                          <div className="space-y-2 ml-8">
                            {studentAssignments.map((a) => (
                              <div
                                key={a.id}
                                className={`flex items-center justify-between p-3 rounded-lg ${
                                  isDark ? 'bg-[#0b090a]/50' : 'bg-[#F5EDE4]/50'
                                }`}
                              >
                                <div>
                                  <span className={`text-sm font-medium ${textPrimary}`}>
                                    {a.course_offerings?.courses?.code}
                                  </span>
                                  <span className={`text-xs ml-2 ${textSecondary}`}>
                                    {a.course_offerings?.courses?.title}
                                  </span>
                                  <p className={`text-xs mt-1 ${textSecondary}`}>
                                    Teacher: {a.course_offerings?.teachers?.full_name || 'N/A'}
                                    {' · '}{a.course_offerings?.courses?.credit} credits
                                  </p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveAssignment(a.student_user_id, a.offering_id);
                                  }}
                                  className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  title="Remove assignment"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MANAGE MODE ────────────────────────────────── */}
      {viewMode === 'manage' && (
        <div className={`${cardClass} overflow-hidden`}>
          <div className={`px-5 py-4 border-b ${isDark ? 'border-[#3d4951]/50' : 'border-[#E8DDD1]'}`}>
            <h2 className={`text-lg font-semibold ${textPrimary}`}>
              Manage Elective Course Offerings
            </h2>
            <p className={`text-xs mt-1 ${textSecondary}`}>
              Create, edit, or delete course offerings for {selectedTerm === '4-1' ? '4th Year 1st Term' : '4th Year 2nd Term'}
            </p>
          </div>

          <div className="p-5 space-y-4">
            {Object.entries(groupedCourses).length === 0 ? (
              <div className={`text-center py-12 ${textSecondary}`}>
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No elective courses found in curriculum for this term</p>
                <p className="text-xs mt-1">Run the optional_course_setup.sql to add elective courses</p>
              </div>
            ) : (
              Object.entries(groupedCourses).map(([group, courses]) => (
                <div key={group} className={`rounded-lg border ${isDark ? 'border-[#3d4951]/30' : 'border-[#E8DDD1]'}`}>
                  <button
                    onClick={() => toggleGroup(group)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left ${
                      isDark ? 'hover:bg-[#0b090a]/50' : 'hover:bg-[#F5EDE4]/50'
                    } transition-colors rounded-t-lg`}
                  >
                    <div className="flex items-center gap-2">
                      {expandedGroups.has(group) ? <ChevronDown className={`w-4 h-4 ${textSecondary}`} /> : <ChevronRight className={`w-4 h-4 ${textSecondary}`} />}
                      <span className={`font-semibold text-sm ${textPrimary}`}>{groupLabel(group)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-[#3d4951]/50 text-[#b1a7a6]' : 'bg-[#F5EDE4] text-[#8B7355]'}`}>
                        {courses.length} courses
                      </span>
                    </div>
                  </button>

                  <AnimatePresence>
                    {expandedGroups.has(group) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2">
                          {courses.map((course) => {
                            const offering = electiveOfferings.find((o) => o.course_id === course.id);
                            const hasOffering = !!offering;
                            const assignmentCount = offering ? assignments.filter((a) => a.offering_id === offering.id).length : 0;

                            return (
                              <div
                                key={course.id}
                                className={`flex items-center justify-between p-3 rounded-lg ${
                                  isDark ? 'bg-[#0b090a]/30' : 'bg-[#F5EDE4]/30'
                                }`}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${textPrimary}`}>{course.code}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      course.course_type === 'Lab' 
                                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                    }`}>
                                      {course.course_type}
                                    </span>
                                    <span className={`text-xs ${textSecondary}`}>{course.credit} cr</span>
                                  </div>
                                  <p className={`text-xs mt-0.5 ${textSecondary} truncate max-w-md`}>{course.title}</p>
                                  {offering && (
                                    <p className={`text-xs mt-1 ${textSecondary}`}>
                                      Teacher: {offering.teachers?.full_name || 'N/A'}
                                      {assignmentCount > 0 && (
                                        <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                                          · {assignmentCount} student{assignmentCount > 1 ? 's' : ''} assigned
                                        </span>
                                      )}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {hasOffering ? (
                                    <>
                                      <button
                                        onClick={() => openEditModal(offering)}
                                        className={`p-2 rounded-lg transition-colors ${
                                          isDark ? 'hover:bg-[#0b090a] text-[#b1a7a6] hover:text-white' : 'hover:bg-[#E8DDD1] text-[#8B7355] hover:text-[#5D4E37]'
                                        }`}
                                        title="Edit offering"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteOffering(offering)}
                                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        title="Delete offering"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => openCreateModal(course)}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        isDark ? 'bg-[#ba181b] hover:bg-[#a0161a] text-white' : 'bg-[#5D4037] hover:bg-[#4E342E] text-white'
                                      }`}
                                    >
                                      <Plus className="w-4 h-4" /> Create
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bulk Input Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowBulkModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-[#161a1d]' : 'bg-white'} p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Bulk Assign by Roll Numbers</h3>
                <button onClick={() => setShowBulkModal(false)}>
                  <X className={`w-5 h-5 ${textSecondary}`} />
                </button>
              </div>
              <p className={`text-sm mb-3 ${textSecondary}`}>
                Paste roll numbers separated by commas, newlines, or semicolons:
              </p>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={"2007001\n2007002\n2007003"}
                rows={8}
                className={`${inputClass} font-mono text-xs`}
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowBulkModal(false)}
                  className={`px-4 py-2 rounded-xl text-sm ${isDark ? 'bg-[#0b090a] text-[#b1a7a6]' : 'bg-[#F5EDE4] text-[#8B7355]'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkAssign}
                  disabled={!bulkInput.trim()}
                  className={`px-4 py-2 rounded-xl text-sm text-white ${
                    isDark ? 'bg-[#ba181b] hover:bg-[#a0161a]' : 'bg-[#5D4037] hover:bg-[#4E342E]'
                  } disabled:opacity-50`}
                >
                  Match & Select
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Offering Modal */}
      <AnimatePresence>
        {showCreateModal && selectedCourseForCreate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-[#161a1d]' : 'bg-white'} p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Create Course Offering</h3>
                <button onClick={() => setShowCreateModal(false)}>
                  <X className={`w-5 h-5 ${textSecondary}`} />
                </button>
              </div>

              <div className={`p-3 rounded-lg mb-4 ${isDark ? 'bg-[#0b090a]' : 'bg-[#F5EDE4]'}`}>
                <p className={`text-sm font-medium ${textPrimary}`}>{selectedCourseForCreate.code}</p>
                <p className={`text-xs ${textSecondary}`}>{selectedCourseForCreate.title}</p>
                <p className={`text-xs mt-1 ${textSecondary}`}>
                  {selectedCourseForCreate.credit} credits · {selectedCourseForCreate.course_type}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${textPrimary}`}>Teacher *</label>
                  <select
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="">Select a teacher...</option>
                    {teachers.map((t) => (
                      <option key={t.user_id} value={t.user_id}>
                        {t.full_name} ({t.teacher_uid})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${textPrimary}`}>Session</label>
                  <input
                    type="text"
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    placeholder={`${new Date().getFullYear() - 1}-${new Date().getFullYear()}`}
                    className={inputClass}
                  />
                  <p className={`text-xs mt-1 ${textSecondary}`}>Leave empty to use current academic year</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className={`px-4 py-2 rounded-xl text-sm ${isDark ? 'bg-[#0b090a] text-[#b1a7a6]' : 'bg-[#F5EDE4] text-[#8B7355]'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateOffering}
                  disabled={!selectedTeacher || saving}
                  className={`px-4 py-2 rounded-xl text-sm text-white ${
                    isDark ? 'bg-[#ba181b] hover:bg-[#a0161a]' : 'bg-[#5D4037] hover:bg-[#4E342E]'
                  } disabled:opacity-50 flex items-center gap-2`}
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Offering
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Offering Modal */}
      <AnimatePresence>
        {showEditModal && editingOffering && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-[#161a1d]' : 'bg-white'} p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Edit Course Offering</h3>
                <button onClick={() => setShowEditModal(false)}>
                  <X className={`w-5 h-5 ${textSecondary}`} />
                </button>
              </div>

              <div className={`p-3 rounded-lg mb-4 ${isDark ? 'bg-[#0b090a]' : 'bg-[#F5EDE4]'}`}>
                <p className={`text-sm font-medium ${textPrimary}`}>{editingOffering.courses?.code}</p>
                <p className={`text-xs ${textSecondary}`}>{editingOffering.courses?.title}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${textPrimary}`}>Teacher</label>
                  <select
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="">Select a teacher...</option>
                    {teachers.map((t) => (
                      <option key={t.user_id} value={t.user_id}>
                        {t.full_name} ({t.teacher_uid})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${textPrimary}`}>Session</label>
                  <input
                    type="text"
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    placeholder={editingOffering.session}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className={`px-4 py-2 rounded-xl text-sm ${isDark ? 'bg-[#0b090a] text-[#b1a7a6]' : 'bg-[#F5EDE4] text-[#8B7355]'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateOffering}
                  disabled={!selectedTeacher || saving}
                  className={`px-4 py-2 rounded-xl text-sm text-white ${
                    isDark ? 'bg-[#ba181b] hover:bg-[#a0161a]' : 'bg-[#5D4037] hover:bg-[#4E342E]'
                  } disabled:opacity-50 flex items-center gap-2`}
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update Offering
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
