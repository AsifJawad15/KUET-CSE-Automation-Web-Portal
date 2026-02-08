"use client";

import React, { useState, useEffect, useCallback } from 'react';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { DBCourse } from '@/lib/supabase';
import { AnimatePresence, motion } from 'framer-motion';

// ==========================================
// Add / Edit Course Modal
// ==========================================
function CourseFormModal({
  course,
  onClose,
  onSave,
  saving,
}: {
  course: DBCourse | null; // null = add mode
  onClose: () => void;
  onSave: (data: { code: string; title: string; credit: number; course_type: string; description: string }) => void;
  saving: boolean;
}) {
  const isEdit = !!course;

  const [code, setCode] = useState(course?.code || '');
  const [title, setTitle] = useState(course?.title || '');
  const [credit, setCredit] = useState(course?.credit?.toString() || '3');
  const [courseType, setCourseType] = useState(course?.course_type || 'Theory');
  const [description, setDescription] = useState(course?.description || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!code.trim()) newErrors.code = 'Course code is required';
    else if (code !== code.toUpperCase()) newErrors.code = 'Code must be uppercase (e.g., CSE 3201)';
    if (!title.trim()) newErrors.title = 'Title is required';
    const creditNum = parseFloat(credit);
    if (isNaN(creditNum) || creditNum <= 0) newErrors.credit = 'Credit must be > 0';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave({
      code: code.trim().toUpperCase(),
      title: title.trim(),
      credit: parseFloat(credit),
      course_type: courseType,
      description: description.trim(),
    });
  };

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
        className="w-full max-w-lg bg-[#FAF7F3] dark:bg-[#0d0d1a] border border-[#DCC5B2] dark:border-[#392e4e] rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DCC5B2] dark:border-[#392e4e] bg-[#F0E4D3] dark:bg-white/5">
          <h2 className="text-lg font-bold text-[#5D4E37] dark:text-white">
            {isEdit ? 'Edit Course' : 'Add New Course'}
          </h2>
          <p className="text-sm text-[#8B7355] dark:text-white/50 mt-0.5">
            {isEdit ? 'Update course information' : 'Fill in the details for the new course'}
          </p>
        </div>

        {/* Form Body */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#DCC5B2] dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
          {/* Code & Title Row */}
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#5D4E37] dark:text-white/70 mb-1">
                Course Code <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CSE 3201"
                className={`w-full px-3 py-2 rounded-lg border ${errors.code ? 'border-red-400' : 'border-[#DCC5B2] dark:border-[#392e4e]'} bg-white dark:bg-white/5 text-[#5D4E37] dark:text-white placeholder-[#8B7355]/50 dark:placeholder-white/30 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent transition-all`}
              />
              {errors.code && <p className="text-xs text-red-400 mt-1">{errors.code}</p>}
            </div>
            <div className="col-span-3">
              <label className="block text-sm font-medium text-[#5D4E37] dark:text-white/70 mb-1">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Software Engineering"
                className={`w-full px-3 py-2 rounded-lg border ${errors.title ? 'border-red-400' : 'border-[#DCC5B2] dark:border-[#392e4e]'} bg-white dark:bg-white/5 text-[#5D4E37] dark:text-white placeholder-[#8B7355]/50 dark:placeholder-white/30 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent transition-all`}
              />
              {errors.title && <p className="text-xs text-red-400 mt-1">{errors.title}</p>}
            </div>
          </div>

          {/* Credit & Type Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5D4E37] dark:text-white/70 mb-1">
                Credit <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={credit}
                onChange={(e) => setCredit(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${errors.credit ? 'border-red-400' : 'border-[#DCC5B2] dark:border-[#392e4e]'} bg-white dark:bg-white/5 text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent transition-all`}
              />
              {errors.credit && <p className="text-xs text-red-400 mt-1">{errors.credit}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5D4E37] dark:text-white/70 mb-1">Type</label>
              <select
                value={courseType}
                onChange={(e) => setCourseType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#392e4e] bg-white dark:bg-white/5 text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent transition-all"
              >
                <option value="Theory" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Theory</option>
                <option value="Lab" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Lab</option>
                <option value="Thesis" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Thesis</option>
                <option value="Project" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Project</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#5D4E37] dark:text-white/70 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief course description..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#392e4e] bg-white dark:bg-white/5 text-[#5D4E37] dark:text-white placeholder-[#8B7355]/50 dark:placeholder-white/30 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent resize-none transition-all"
            />
          </div>
        </div>

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
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#8400ff] dark:to-[#a855f7] text-white font-medium text-sm shadow-lg shadow-[#D9A299]/25 dark:shadow-[#8400ff]/25 hover:from-[#C88989] hover:to-[#CCB5A2] dark:hover:from-[#9933ff] dark:hover:to-[#b366ff] transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Course' : 'Add Course'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// Delete Confirmation Modal
// ==========================================
function DeleteConfirmModal({
  course,
  onClose,
  onConfirm,
  deleting,
}: {
  course: DBCourse;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
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
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[#5D4E37] dark:text-white mb-1">Delete Course</h3>
          <p className="text-sm text-[#8B7355] dark:text-white/60 mb-1">
            Are you sure you want to delete
          </p>
          <p className="text-sm font-semibold text-[#5D4E37] dark:text-white">
            {course.code} — {course.title}?
          </p>
          <p className="text-xs text-red-400/80 mt-2">This action cannot be undone.</p>
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
            disabled={deleting}
            className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium text-sm shadow-lg shadow-red-500/25 transition-all disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// Course Detail Panel (Expandable Row)
// ==========================================
function CourseDetailPanel({ course }: { course: DBCourse }) {
  return (
    <motion.tr
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <td colSpan={5} className="px-6 py-4 bg-[#F0E4D3]/50 dark:bg-white/[0.02]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <h4 className="text-sm font-semibold text-[#5D4E37] dark:text-white/80 mb-1">Description</h4>
            <p className="text-sm text-[#8B7355] dark:text-white/50 leading-relaxed">
              {course.description || 'No description available.'}
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-[#5D4E37] dark:text-white/80 mb-1">Details</h4>
              <p className="text-sm text-[#8B7355] dark:text-white/50">
                {course.credit} Credit{Number(course.credit) !== 1 ? 's' : ''}  •  {course.course_type || 'Theory'}
              </p>
            </div>
            {course.created_at && (
              <div>
                <h4 className="text-sm font-semibold text-[#5D4E37] dark:text-white/80 mb-1">Added</h4>
                <p className="text-sm text-[#8B7355] dark:text-white/50">
                  {new Date(course.created_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </td>
    </motion.tr>
  );
}

// ==========================================
// Main Course Info Page
// ==========================================
export default function CourseInfoPage() {
  const [courses, setCourses] = useState<DBCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editCourse, setEditCourse] = useState<DBCourse | null>(null);
  const [deleteCourse, setDeleteCourse] = useState<DBCourse | null>(null);

  // Fetch courses from API
  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/courses');
      const data = await res.json();
      setCourses(data);
      setError(null);
    } catch {
      setError('Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Filter + search
  const filteredCourses = courses.filter((c) => {
    const matchesType = filterType === 'all' || (c.course_type || 'Theory').toLowerCase() === filterType.toLowerCase();
    const matchesSearch =
      !search ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Stats
  const totalCourses = courses.length;
  const theoryCourses = courses.filter((c) => (c.course_type || 'Theory') === 'Theory').length;
  const labCourses = courses.filter((c) => (c.course_type || 'Theory') === 'Lab').length;
  const totalCredits = courses.reduce((sum, c) => sum + Number(c.credit), 0);

  const handleSave = async (data: { code: string; title: string; credit: number; course_type: string; description: string }) => {
    try {
      setSaving(true);
      const isEdit = !!editCourse;
      const url = '/api/courses';
      const method = isEdit ? 'PATCH' : 'POST';
      const body = isEdit ? { id: editCourse!.id, ...data } : data;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (!result.success) {
        setError(result.error || 'Failed to save course');
        return;
      }

      await fetchCourses();
      setShowForm(false);
      setEditCourse(null);
      setError(null);
    } catch {
      setError('Failed to save course');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCourse) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/courses?id=${deleteCourse.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || 'Failed to delete course');
        return;
      }
      await fetchCourses();
      setDeleteCourse(null);
      if (expandedId === deleteCourse.id) setExpandedId(null);
      setError(null);
    } catch {
      setError('Failed to delete course');
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (course: DBCourse) => {
    setEditCourse(course);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white">Course Information</h1>
          <p className="text-[#8B7355] dark:text-white/60 mt-1">Manage all courses in the CSE department curriculum</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setEditCourse(null); setShowForm(true); }}
          className="px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#8400ff] dark:to-[#a855f7] text-white rounded-lg hover:from-[#C88989] hover:to-[#CCB5A2] dark:hover:from-[#9933ff] dark:hover:to-[#b366ff] transition-all flex items-center gap-2 shadow-lg shadow-[#D9A299]/25 dark:shadow-[#8400ff]/25 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Course
        </motion.button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Courses', value: totalCourses, color: 'from-[#D9A299] to-[#DCC5B2] dark:from-[#8400ff] dark:to-[#a855f7]', icon: '📚' },
          { label: 'Theory', value: theoryCourses, color: 'from-[#00e5ff]/80 to-[#00e5ff]/40 dark:from-[#00e5ff]/80 dark:to-[#00e5ff]/40', icon: '📖' },
          { label: 'Lab / Sessional', value: labCourses, color: 'from-[#a855f7]/80 to-[#a855f7]/40 dark:from-[#a855f7]/80 dark:to-[#a855f7]/40', icon: '🔬' },
          { label: 'Total Credits', value: totalCredits, color: 'from-amber-500/80 to-amber-400/40 dark:from-amber-500/80 dark:to-amber-400/40', icon: '🎓' },
        ].map((stat) => (
          <SpotlightCard
            key={stat.label}
            className="rounded-xl border border-[#DCC5B2] dark:border-[#392e4e] p-4 bg-[#FAF7F3] dark:bg-transparent"
            spotlightColor="rgba(217, 162, 153, 0.15)"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className="text-2xl font-bold text-[#5D4E37] dark:text-white">{stat.value}</p>
                <p className="text-xs text-[#8B7355] dark:text-white/50">{stat.label}</p>
              </div>
            </div>
          </SpotlightCard>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7355] dark:text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or title..."
            className="w-full pl-10 pr-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-white/5 text-[#5D4E37] dark:text-white placeholder-[#8B7355]/50 dark:placeholder-white/30 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent transition-all"
          />
        </div>
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
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={fetchCourses}
          disabled={loading}
          className="px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg text-[#5D4E37] dark:text-white/70 hover:bg-[#DCC5B2]/30 dark:hover:bg-white/5 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </motion.button>
      </div>

      {/* Courses Table */}
      <SpotlightCard className="rounded-xl border border-[#DCC5B2] dark:border-[#392e4e] overflow-hidden bg-[#FAF7F3] dark:bg-transparent" spotlightColor="rgba(217, 162, 153, 0.2)">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F0E4D3] dark:bg-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider">Title</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider">Credit</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCC5B2] dark:divide-[#392e4e]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-[#D9A299] dark:border-[#8400ff] border-t-transparent rounded-full animate-spin" />
                      <p className="text-[#8B7355] dark:text-white/40 text-sm">Loading courses...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 text-[#8B7355]/40 dark:text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <p className="text-[#8B7355] dark:text-white/40 text-sm">
                        {courses.length === 0 ? 'No courses yet. Add your first course!' : 'No courses match your filters'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
              filteredCourses.map((course) => (
                <React.Fragment key={course.id}>
                  <tr
                    className="hover:bg-[#F0E4D3] dark:hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === course.id ? null : course.id)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-semibold text-[#5D4E37] dark:text-white">{course.code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="text-[#5D4E37] dark:text-white font-medium">{course.title}</span>
                        {course.description && (
                          <p className="text-xs text-[#8B7355] dark:text-white/40 mt-0.5 line-clamp-1 max-w-xs">{course.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        (course.course_type || 'Theory') === 'Theory'
                          ? 'bg-[#D9A299]/30 text-[#5D4E37] border border-[#D9A299]/50 dark:bg-[#00e5ff]/20 dark:text-[#00e5ff] dark:border-[#00e5ff]/30'
                          : 'bg-[#DCC5B2]/40 text-[#5D4E37] border border-[#DCC5B2]/60 dark:bg-[#8400ff]/20 dark:text-[#a855f7] dark:border-[#8400ff]/30'
                      }`}>
                        {course.course_type || 'Theory'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-[#8B7355] dark:text-white/60 font-medium">
                      {course.credit}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {/* Expand */}
                        <button
                          onClick={() => setExpandedId(expandedId === course.id ? null : course.id)}
                          className="p-2 text-[#8B7355] dark:text-white/40 hover:text-[#5D4E37] dark:hover:text-white hover:bg-[#DCC5B2]/30 dark:hover:bg-white/5 rounded-lg transition-colors"
                          title="View details"
                        >
                          <motion.svg
                            animate={{ rotate: expandedId === course.id ? 180 : 0 }}
                            className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </motion.svg>
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => openEdit(course)}
                          className="p-2 text-[#00e5ff] hover:bg-[#00e5ff]/10 rounded-lg transition-colors"
                          title="Edit course"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => setDeleteCourse(course)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete course"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable detail row */}
                  <AnimatePresence>
                    {expandedId === course.id && <CourseDetailPanel course={course} />}
                  </AnimatePresence>
                </React.Fragment>
              ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-6 py-3 border-t border-[#DCC5B2] dark:border-[#392e4e] bg-[#F0E4D3]/50 dark:bg-white/[0.02]">
          <p className="text-xs text-[#8B7355] dark:text-white/40">
            Showing {filteredCourses.length} of {totalCourses} courses
          </p>
        </div>
      </SpotlightCard>

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <CourseFormModal
            course={editCourse}
            onClose={() => { setShowForm(false); setEditCourse(null); }}
            onSave={handleSave}
            saving={saving}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteCourse && (
          <DeleteConfirmModal
            course={deleteCourse}
            onClose={() => setDeleteCourse(null)}
            onConfirm={handleDelete}
            deleting={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
