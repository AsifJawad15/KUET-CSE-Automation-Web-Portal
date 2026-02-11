"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { DBCourse, isSupabaseConfigured, supabase } from '@/lib/supabase';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';

// Types for API responses
interface TeacherProfile {
  email: string;
}

interface TeacherData {
  user_id: string;
  full_name: string;
  phone: string | null;
  department: string;
  designation: string;
  is_on_leave: boolean;
  leave_reason: string | null;
  profiles: TeacherProfile;
}

interface OfferingData {
  id: string;
  course_id: string;
  teacher_user_id: string;
  term: string | null;
  session: string | null;
  section: string | null;
  is_active: boolean;
  courses: DBCourse;
  teachers: TeacherData;
}

// ==========================================
// Assign Teacher Modal
// ==========================================
function AssignTeacherModal({
  course,
  allTeachers,
  existingAssignments,
  onClose,
  onAssign,
  assigning,
}: {
  course: DBCourse;
  allTeachers: TeacherData[];
  existingAssignments: string[]; // teacher user_ids already assigned
  onClose: () => void;
  onAssign: (teacherUserId: string) => void;
  assigning: boolean;
}) {
  const [search, setSearch] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  const filteredTeachers = allTeachers.filter(
    (t) =>
      !existingAssignments.includes(t.user_id) &&
      !t.is_on_leave &&
      (t.full_name.toLowerCase().includes(search.toLowerCase()) ||
        t.designation.toLowerCase().includes(search.toLowerCase()))
  );

  const onLeaveCount = allTeachers.filter((t) => t.is_on_leave && !existingAssignments.includes(t.user_id)).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 40 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-[#FAF7F3] dark:bg-[#0d0d1a] border border-[#DCC5B2] dark:border-[#392e4e] rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DCC5B2] dark:border-[#392e4e] bg-[#F0E4D3] dark:bg-white/5">
          <h2 className="text-lg font-bold text-[#5D4E37] dark:text-white">Assign Teacher</h2>
          <p className="text-sm text-[#8B7355] dark:text-white/50 mt-0.5">
            <span className="font-medium text-[#5D4E37] dark:text-white/70">{course.code}</span> — {course.title}
          </p>
        </div>

        {/* Search */}
        <div className="px-6 pt-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7355] dark:text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teachers..."
              className="w-full pl-10 pr-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-white dark:bg-white/5 text-[#5D4E37] dark:text-white placeholder-[#8B7355]/50 dark:placeholder-white/30 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent text-sm transition-all"
            />
          </div>
        </div>

        {/* Teacher List */}
        <div className="px-6 py-4 max-h-[40vh] overflow-y-auto space-y-2 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#DCC5B2] dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
          {filteredTeachers.length === 0 ? (
            <p className="text-sm text-[#8B7355] dark:text-white/40 text-center py-4">
              {allTeachers.length === 0 ? 'No teachers found in the system' : 'All teachers are already assigned or on leave'}
            </p>
          ) : (
            filteredTeachers.map((teacher) => {
              const isSelected = selectedTeacherId === teacher.user_id;
              return (
                <motion.button
                  key={teacher.user_id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedTeacherId(isSelected ? null : teacher.user_id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 text-left ${
                    isSelected
                      ? 'bg-[#D9A299]/20 border-[#D9A299]/50 dark:bg-[#8400ff]/20 dark:border-[#8400ff]/40'
                      : 'bg-white dark:bg-white/[0.02] border-[#DCC5B2] dark:border-[#392e4e] hover:border-[#D9A299]/50 dark:hover:border-[#8400ff]/30'
                  }`}
                >
                  {/* Radio */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected
                      ? 'bg-[#D9A299] dark:bg-[#8400ff] border-[#D9A299] dark:border-[#8400ff]'
                      : 'border-[#DCC5B2] dark:border-[#392e4e]'
                  }`}>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-[#D9A299]/30 dark:bg-[#8400ff]/30 border border-[#D9A299]/50 dark:border-[#8400ff]/40 flex items-center justify-center text-[#5D4E37] dark:text-white text-sm font-semibold flex-shrink-0">
                    {teacher.full_name.charAt(0)}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#5D4E37] dark:text-white truncate">{teacher.full_name}</p>
                    <p className="text-xs text-[#8B7355] dark:text-white/50">{teacher.designation}</p>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>

        {/* On Leave Notice */}
        {onLeaveCount > 0 && (
          <div className="px-6 py-2 text-xs text-amber-500 dark:text-amber-400/70 bg-amber-50 dark:bg-amber-500/5 border-t border-amber-200 dark:border-amber-500/10">
            {onLeaveCount} teacher{onLeaveCount > 1 ? 's' : ''} on leave (hidden from list)
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#DCC5B2] dark:border-[#392e4e] bg-[#F0E4D3]/50 dark:bg-white/[0.02] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#392e4e] text-[#5D4E37] dark:text-white/70 hover:bg-[#DCC5B2]/30 dark:hover:bg-white/5 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => selectedTeacherId && onAssign(selectedTeacherId)}
            disabled={!selectedTeacherId || assigning}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#8400ff] dark:to-[#a855f7] text-white font-medium text-sm shadow-lg shadow-[#D9A299]/25 dark:shadow-[#8400ff]/25 hover:from-[#C88989] hover:to-[#CCB5A2] dark:hover:from-[#9933ff] dark:hover:to-[#b366ff] transition-all disabled:opacity-50"
          >
            {assigning ? 'Assigning...' : 'Assign Teacher'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// Remove Teacher Confirmation
// ==========================================
function RemoveTeacherModal({
  teacherName,
  courseCode,
  courseTitle,
  onClose,
  onConfirm,
  removing,
}: {
  teacherName: string;
  courseCode: string;
  courseTitle: string;
  onClose: () => void;
  onConfirm: () => void;
  removing: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-sm bg-[#FAF7F3] dark:bg-[#0d0d1a] border border-[#DCC5B2] dark:border-[#392e4e] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[#5D4E37] dark:text-white mb-1">Remove Teacher</h3>
          <p className="text-sm text-[#8B7355] dark:text-white/60">
            Remove <span className="font-semibold text-[#5D4E37] dark:text-white">{teacherName}</span> from
          </p>
          <p className="text-sm font-semibold text-[#5D4E37] dark:text-white mt-0.5">
            {courseCode} — {courseTitle}?
          </p>
        </div>
        <div className="px-6 py-4 border-t border-[#DCC5B2] dark:border-[#392e4e] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#392e4e] text-[#5D4E37] dark:text-white/70 hover:bg-[#DCC5B2]/30 dark:hover:bg-white/5 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onConfirm}
            disabled={removing}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50"
          >
            {removing ? 'Removing...' : 'Remove'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// Main Course Allocation Page
// (Teacher Assignment Only — fetches from API)
// ==========================================
export default function CourseAllocationPage() {
  const [courses, setCourses] = useState<DBCourse[]>([]);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [offerings, setOfferings] = useState<OfferingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [assignCourse, setAssignCourse] = useState<DBCourse | null>(null);
  const [removeInfo, setRemoveInfo] = useState<{ offeringId: string; teacherName: string; courseCode: string; courseTitle: string } | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<string>('connecting');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [coursesRes, teachersRes, offeringsRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/teachers'),
        fetch('/api/course-offerings'),
      ]);
      const [coursesData, teachersData, offeringsData] = await Promise.all([
        coursesRes.json(),
        teachersRes.json(),
        offeringsRes.json(),
      ]);
      setCourses(coursesData);
      // Teachers API returns array of teacher objects with profile data
      // Map to our expected shape
      const mappedTeachers: TeacherData[] = (teachersData || []).map((t: any) => ({
        user_id: t.user_id,
        full_name: t.full_name || 'Unknown',
        phone: t.phone || null,
        department: t.department || 'CSE',
        designation: t.designation || '',
        is_on_leave: t.is_on_leave || false,
        leave_reason: t.leave_reason || null,
        profiles: {
          email: t.profiles?.email || t.profile?.email || t.email || '',
        },
      }));
      setTeachers(mappedTeachers);
      setOfferings(offeringsData || []);
      setError(null);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==========================================
  // Supabase Real-Time Subscription
  // ==========================================
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('course-allocation-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'course_offerings',
        },
        (payload) => {
          console.log('[Realtime] course_offerings changed:', payload.eventType, payload);
          // Refetch all data to get joined teacher/course info
          fetchData();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
        setRealtimeStatus(status === 'SUBSCRIBED' ? 'connected' : status === 'CLOSED' ? 'disconnected' : 'connecting');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Get offerings for a course
  const getOfferingsForCourse = (courseId: string) =>
    offerings.filter((o) => o.course_id === courseId);

  // Get existing teacher IDs for a course
  const getAssignedTeacherIds = (courseId: string) =>
    getOfferingsForCourse(courseId).map((o) => o.teacher_user_id);

  // Filter courses
  const filteredCourses = courses.filter((c) => {
    const matchesType = filterType === 'all' || (c.course_type || 'Theory').toLowerCase() === filterType.toLowerCase();
    return matchesType;
  });

  // Assign teacher
  const handleAssign = async (teacherUserId: string) => {
    if (!assignCourse) return;
    try {
      setAssigning(true);
      const res = await fetch('/api/course-offerings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: assignCourse.id,
          teacher_user_id: teacherUserId,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || 'Failed to assign teacher');
        return;
      }
      await fetchData();
      setAssignCourse(null);
      setError(null);
      setSuccessMsg('Teacher assigned successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError('Failed to assign teacher');
    } finally {
      setAssigning(false);
    }
  };

  // Remove assignment
  const handleRemove = async () => {
    if (!removeInfo) return;
    try {
      setRemoving(true);
      const res = await fetch(`/api/course-offerings?id=${removeInfo.offeringId}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || 'Failed to remove assignment');
        return;
      }
      await fetchData();
      setRemoveInfo(null);
      setError(null);
      setSuccessMsg('Teacher removed successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError('Failed to remove assignment');
    } finally {
      setRemoving(false);
    }
  };

  // Stats
  const unassigned = courses.filter((c) => getOfferingsForCourse(c.id).length === 0).length;
  const totalAssignments = offerings.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white">Course Allocation</h1>
          <p className="text-[#8B7355] dark:text-white/60 mt-1">Assign teachers to courses</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg text-[#5D4E37] dark:text-white/70 hover:bg-[#DCC5B2]/30 dark:hover:bg-white/5 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </motion.button>
      </div>

      {/* Real-time Connection Indicator */}
      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-block w-2 h-2 rounded-full ${
          realtimeStatus === 'connected' ? 'bg-green-400 animate-pulse' :
          realtimeStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
          'bg-red-400'
        }`} />
        <span className={`${
          realtimeStatus === 'connected' ? 'text-green-500 dark:text-green-400' :
          realtimeStatus === 'connecting' ? 'text-yellow-500 dark:text-yellow-400' :
          'text-red-500 dark:text-red-400'
        }`}>
          {realtimeStatus === 'connected' ? 'Live — Real-time sync active' :
           realtimeStatus === 'connecting' ? 'Connecting to real-time...' :
           'Disconnected — changes may not sync automatically'}
        </span>
      </div>

      {/* Success Banner */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-between"
          >
            <p className="text-sm text-green-400">{successMsg}</p>
            <button onClick={() => setSuccessMsg(null)} className="text-green-400 hover:text-green-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Courses', value: courses.length, icon: '📚' },
          { label: 'Teacher Assignments', value: totalAssignments, icon: '👨‍🏫' },
          { label: 'Unassigned Courses', value: unassigned, icon: '⚠️', alert: unassigned > 0 },
        ].map((stat) => (
          <SpotlightCard
            key={stat.label}
            className={`rounded-xl border p-4 bg-[#FAF7F3] dark:bg-transparent ${stat.alert ? 'border-amber-400/50 dark:border-amber-400/30' : 'border-[#DCC5B2] dark:border-[#392e4e]'}`}
            spotlightColor={stat.alert ? 'rgba(245, 158, 11, 0.15)' : 'rgba(217, 162, 153, 0.15)'}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className={`text-2xl font-bold ${stat.alert ? 'text-amber-500' : 'text-[#5D4E37] dark:text-white'}`}>{stat.value}</p>
                <p className="text-xs text-[#8B7355] dark:text-white/50">{stat.label}</p>
              </div>
            </div>
          </SpotlightCard>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-white/5 text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent"
        >
          <option value="all" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">All Types</option>
          <option value="Theory" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Theory</option>
          <option value="Lab" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Lab / Sessional</option>
          <option value="Thesis" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Thesis</option>
          <option value="Project" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Project</option>
        </select>
      </div>

      {/* Allocation Table */}
      <SpotlightCard className="rounded-xl border border-[#DCC5B2] dark:border-[#392e4e] overflow-hidden bg-[#FAF7F3] dark:bg-transparent" spotlightColor="rgba(217, 162, 153, 0.2)">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F0E4D3] dark:bg-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider">Title</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider">Credit</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider">Assigned Teachers</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCC5B2] dark:divide-[#392e4e]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-[#D9A299] dark:border-[#8400ff] border-t-transparent rounded-full animate-spin" />
                      <p className="text-[#8B7355] dark:text-white/40 text-sm">Loading courses & assignments...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <p className="text-[#8B7355] dark:text-white/40 text-sm">
                      {courses.length === 0 ? 'No courses yet. Add courses from the Course Info page first.' : 'No courses match your filter'}
                    </p>
                  </td>
                </tr>
              ) : (
              filteredCourses.map((course) => {
                const courseOfferings = getOfferingsForCourse(course.id);
                return (
                <tr key={course.id} className="hover:bg-[#F0E4D3] dark:hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-[#5D4E37] dark:text-white">{course.code}</span>
                  </td>
                  <td className="px-6 py-4 text-[#5D4E37] dark:text-white">{course.title}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      (course.course_type || 'Theory') === 'Theory'
                        ? 'bg-[#D9A299]/30 text-[#5D4E37] border border-[#D9A299]/50 dark:bg-[#00e5ff]/20 dark:text-[#00e5ff] dark:border-[#00e5ff]/30'
                        : 'bg-[#DCC5B2]/40 text-[#5D4E37] border border-[#DCC5B2]/60 dark:bg-[#8400ff]/20 dark:text-[#a855f7] dark:border-[#8400ff]/30'
                    }`}>
                      {course.course_type || 'Theory'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-[#8B7355] dark:text-white/60">{course.credit}</td>
                  <td className="px-6 py-4">
                    {courseOfferings.length === 0 ? (
                      <span className="text-xs text-amber-500 italic">No teacher assigned</span>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {courseOfferings.map((offering) => {
                          const name = offering.teachers?.full_name || 'Unknown';
                          return (
                            <div key={offering.id} className="flex items-center gap-2 group">
                              <div className="w-7 h-7 rounded-full bg-[#D9A299]/30 dark:bg-[#8400ff]/30 border border-[#D9A299]/50 dark:border-[#8400ff]/40 flex items-center justify-center text-xs font-semibold text-[#5D4E37] dark:text-white flex-shrink-0">
                                {name.charAt(0)}
                              </div>
                              <span className="text-sm text-[#5D4E37] dark:text-white/70 flex-1">{name}</span>
                              <button
                                onClick={() => setRemoveInfo({
                                  offeringId: offering.id,
                                  teacherName: name,
                                  courseCode: course.code,
                                  courseTitle: course.title,
                                })}
                                className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded transition-all"
                                title="Remove teacher"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setAssignCourse(course)}
                        disabled={courseOfferings.length >= 2}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          courseOfferings.length >= 2
                            ? 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed dark:bg-white/5 dark:text-white/30 dark:border-white/10'
                            : 'bg-[#D9A299]/20 text-[#5D4E37] border border-[#D9A299]/40 hover:bg-[#D9A299]/30 dark:bg-[#8400ff]/20 dark:text-[#a855f7] dark:border-[#8400ff]/30 dark:hover:bg-[#8400ff]/30'
                        }`}
                        title={courseOfferings.length >= 2 ? 'Maximum 2 teachers per course' : 'Assign teacher'}
                      >
                        {courseOfferings.length >= 2 ? 'Max Reached' : '+ Assign'}
                      </motion.button>
                    </div>
                  </td>
                </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#DCC5B2] dark:border-[#392e4e] bg-[#F0E4D3]/50 dark:bg-white/[0.02]">
          <p className="text-xs text-[#8B7355] dark:text-white/40">
            Showing {filteredCourses.length} of {courses.length} courses  •  {totalAssignments} total assignments
          </p>
        </div>
      </SpotlightCard>

      {/* Assign Teacher Modal */}
      <AnimatePresence>
        {assignCourse && (
          <AssignTeacherModal
            course={assignCourse}
            allTeachers={teachers}
            existingAssignments={getAssignedTeacherIds(assignCourse.id)}
            onClose={() => setAssignCourse(null)}
            onAssign={handleAssign}
            assigning={assigning}
          />
        )}
      </AnimatePresence>

      {/* Remove Teacher Confirmation */}
      <AnimatePresence>
        {removeInfo && (
          <RemoveTeacherModal
            teacherName={removeInfo.teacherName}
            courseCode={removeInfo.courseCode}
            courseTitle={removeInfo.courseTitle}
            onClose={() => setRemoveInfo(null)}
            onConfirm={handleRemove}
            removing={removing}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
