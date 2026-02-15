"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { TeacherDesignation, TeacherWithAuth } from '@/lib/supabase';
import { addTeacher, getAllTeachers, deleteTeacher, resetTeacherPassword, updateTeacherProfile, toggleTeacherLeave } from '@/services/teacherService';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, UserCog, Loader2, AlertCircle, X, Check, Key, Upload, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import FacultyCard from './FacultyCard';
import AddFacultyCSV from '@/modules/AddFaculty/AddFacultyCSV';

export default function FacultyInfoPage() {
  const [teachers, setTeachers] = useState<TeacherWithAuth[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDesignation, setFilterDesignation] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'view' | 'add'>('view');
  const [addMode, setAddMode] = useState<'manual' | 'csv'>('manual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<TeacherWithAuth | null>(null);
  const [editFormData, setEditFormData] = useState({ full_name: '', phone: '', designation: 'LECTURER' as TeacherDesignation });
  const [passwordPopup, setPasswordPopup] = useState<{ show: boolean; password: string; teacherName: string }>({ show: false, password: '', teacherName: '' });

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    designation: 'LECTURER' as TeacherDesignation,
  });

  // Load teachers on mount
  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    setLoading(true);
    const data = await getAllTeachers();
    setTeachers(data);
    setLoading(false);
  };

  const designationRank: Record<string, number> = {
    PROFESSOR: 0,
    ASSOCIATE_PROFESSOR: 1,
    ASSISTANT_PROFESSOR: 2,
    LECTURER: 3,
  };

  const filteredTeachers = teachers.filter(t => {
    const matchesSearch = t.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.profile.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDesignation = filterDesignation === 'all' || t.designation === filterDesignation;
    return matchesSearch && matchesDesignation;
  }).sort((a, b) => {
    // On-leave teachers always go to the bottom
    if (a.is_on_leave !== b.is_on_leave) return a.is_on_leave ? 1 : -1;
    // Within same leave status, sort by designation rank
    return (designationRank[a.designation] ?? 9) - (designationRank[b.designation] ?? 9);
  });

  const activeTeachers = filteredTeachers.filter(t => !t.is_on_leave);
  const onLeaveTeachers = filteredTeachers.filter(t => t.is_on_leave);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await addTeacher(formData);

    if (result.success) {
      setSuccess('Teacher added successfully!');
      setFormData({ full_name: '', email: '', phone: '', designation: 'LECTURER' });
      setActiveTab('view'); // Switch to view tab
      await loadTeachers();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Failed to add teacher');
    }

    setLoading(false);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this teacher?')) return;

    setLoading(true);
    const result = await deleteTeacher(userId);

    if (result.success) {
      setSuccess('Teacher deactivated successfully!');
      await loadTeachers();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Failed to deactivate teacher');
    }

    setLoading(false);
  };

  const handleCopyPassword = async (teacher: TeacherWithAuth) => {
    setLoading(true);
    const result = await resetTeacherPassword(teacher.user_id);
    setLoading(false);

    if (result.success && result.newPassword) {
      setPasswordPopup({
        show: true,
        password: result.newPassword,
        teacherName: teacher.full_name,
      });
    } else {
      setError(result.error || 'Failed to reset password');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleEditProfile = (teacher: TeacherWithAuth) => {
    setEditingTeacher(teacher);
    setEditFormData({
      full_name: teacher.full_name,
      phone: teacher.phone,
      designation: teacher.designation,
    });
  };

  const handleUpdateProfile = async () => {
    if (!editingTeacher) return;
    setLoading(true);
    setError(null);

    const result = await updateTeacherProfile(editingTeacher.user_id, editFormData);

    if (result.success) {
      setSuccess('Profile updated successfully!');
      setEditingTeacher(null);
      await loadTeachers();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Failed to update profile');
    }
    setLoading(false);
  };

  const handleToggleLeave = async (teacher: TeacherWithAuth) => {
    setLoading(true);
    const isOnLeave = !teacher.is_on_leave;
    const result = await toggleTeacherLeave(teacher.user_id, isOnLeave);
    if (result.success) {
      setSuccess(`${teacher.full_name} marked as ${isOnLeave ? 'on leave' : 'present'}.`);
      await loadTeachers();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Failed to update leave status');
      setTimeout(() => setError(null), 3000);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {success}
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5" />
          {error}
        </motion.div>
      )}

      {/* Header with Tabs */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white">Faculty Management</h1>
          <p className="text-[#8B7355] dark:text-[#b1a7a6] mt-1">View and manage faculty members</p>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex bg-[#F0E4D3] dark:bg-[#161a1d] border border-[#DCC5B2] dark:border-[#3d4951] rounded-full p-1">
          <button
            onClick={() => setActiveTab('view')}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'view' 
                ? 'bg-[#D9A299] text-white shadow-lg shadow-[#D9A299]/25' 
                : 'text-[#8B7355] dark:text-[#b1a7a6] hover:text-[#5D4E37] dark:hover:text-white'
            }`}
          >
            <UserCog className="w-4 h-4" />
            View Faculty
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'add' 
                ? 'bg-[#D9A299] text-white shadow-lg shadow-[#D9A299]/25' 
                : 'text-[#8B7355] dark:text-[#b1a7a6] hover:text-[#5D4E37] dark:hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Faculty
          </button>
        </div>
      </motion.div>

      {/* Content based on active tab */}
      {activeTab === 'view' ? (
        <>
          {/* Filters */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#161a1d] text-[#5D4E37] dark:text-white placeholder:text-[#8B7355] dark:placeholder:text-white/40 focus:border-[#D9A299] dark:focus:border-[#ba181b] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#ba181b]"
              />
            </div>
            <select
              value={filterDesignation}
              onChange={(e) => setFilterDesignation(e.target.value)}
              className="px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#161a1d] text-[#5D4E37] dark:text-white focus:border-[#D9A299] dark:focus:border-[#ba181b] focus:outline-none"
            >
              <option value="all">All Designations</option>
              <option value="PROFESSOR">Professor</option>
              <option value="ASSOCIATE_PROFESSOR">Associate Professor</option>
              <option value="ASSISTANT_PROFESSOR">Assistant Professor</option>
              <option value="LECTURER">Lecturer</option>
            </select>
          </motion.div>

          {/* Faculty Grid */}
          {loading && teachers.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#D9A299] dark:text-[#ba181b]" />
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="text-center py-12 text-[#8B7355] dark:text-[#b1a7a6]">
              No teachers found. {filterDesignation !== 'all' || searchTerm ? 'Try adjusting your filters.' : 'Add your first teacher to get started.'}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Teachers */}
              {activeTeachers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeTeachers.map((teacher, index) => (
                    <FacultyCard
                      key={teacher.user_id}
                      teacher={teacher}
                      index={index}
                      onUpdate={handleEditProfile}
                      onToggleLeave={handleToggleLeave}
                      onCopyPassword={handleCopyPassword}
                      onDelete={(t) => handleDelete(t.user_id)}
                    />
                  ))}
                </div>
              )}

              {/* On Leave Separator & Section */}
              {onLeaveTeachers.length > 0 && (
                <>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex-1 h-px bg-amber-500/30" />
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                      <UserX className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium text-amber-500">
                        On Leave ({onLeaveTeachers.length})
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-amber-500/30" />
                  </div>
                  <p className="text-center text-xs text-[#8B7355] dark:text-amber-500/60 -mt-3">
                    These teachers cannot be assigned to any course
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
                    {onLeaveTeachers.map((teacher, index) => (
                      <FacultyCard
                        key={teacher.user_id}
                        teacher={teacher}
                        index={index}
                        onUpdate={handleEditProfile}
                        onToggleLeave={handleToggleLeave}
                        onCopyPassword={handleCopyPassword}
                        onDelete={(t) => handleDelete(t.user_id)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        /* Add Faculty Section */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-2xl mx-auto space-y-4"
        >
          {/* Sub-toggle: Manual / CSV */}
          <div className="flex justify-center">
            <div className="flex bg-[#F0E4D3] dark:bg-[#161a1d] border border-[#DCC5B2] dark:border-[#3d4951] rounded-full p-1">
              <button
                onClick={() => setAddMode('manual')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  addMode === 'manual'
                    ? 'bg-[#D9A299] dark:bg-gradient-to-r dark:from-[#ba181b] dark:to-[#e5383b] text-white shadow-lg'
                    : 'text-[#8B7355] dark:text-[#b1a7a6] hover:text-[#5D4E37] dark:hover:text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
                Manual
              </button>
              <button
                onClick={() => setAddMode('csv')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  addMode === 'csv'
                    ? 'bg-[#D9A299] dark:bg-gradient-to-r dark:from-[#ba181b] dark:to-[#e5383b] text-white shadow-lg'
                    : 'text-[#8B7355] dark:text-[#b1a7a6] hover:text-[#5D4E37] dark:hover:text-white'
                }`}
              >
                <Upload className="w-4 h-4" />
                CSV Upload
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {addMode === 'manual' ? (
              <motion.div key="manual" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                <SpotlightCard className="p-6" spotlightColor="rgba(132, 0, 255, 0.15)">
                  <h2 className="text-xl font-bold text-[#5D4E37] dark:text-white mb-6">Add New Faculty Member</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-[#3d4951] rounded-lg bg-[#0b090a] text-white focus:border-[#ba181b] focus:outline-none focus:ring-1 focus:ring-[#ba181b]"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@cse.kuet.ac.bd"
                  className="w-full px-4 py-2 border border-[#3d4951] rounded-lg bg-[#0b090a] text-white placeholder:text-white/40 focus:border-[#ba181b] focus:outline-none focus:ring-1 focus:ring-[#ba181b]"
                  required
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Phone <span className="text-white/30">(optional)</span></label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g., 01712345678"
                    className="w-full px-4 py-2 border border-[#3d4951] rounded-lg bg-[#0b090a] text-white placeholder:text-white/40 focus:border-[#ba181b] focus:outline-none focus:ring-1 focus:ring-[#ba181b]"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Designation</label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value as TeacherDesignation })}
                    className="w-full px-4 py-2 border border-[#3d4951] rounded-lg bg-[#0b090a] text-white focus:border-[#ba181b] focus:outline-none focus:ring-1 focus:ring-[#ba181b]"
                    disabled={loading}
                  >
                    <option value="PROFESSOR">Professor</option>
                    <option value="ASSOCIATE_PROFESSOR">Associate Professor</option>
                    <option value="ASSISTANT_PROFESSOR">Assistant Professor</option>
                    <option value="LECTURER">Lecturer</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setFormData({ full_name: '', email: '', phone: '', designation: 'LECTURER' })}
                  className="flex-1 px-4 py-2 border border-[#3d4951] rounded-full text-white/70 hover:bg-white/5"
                  disabled={loading}
                >
                  Reset
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#ba181b] to-[#e5383b] text-white rounded-full flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Faculty'
                  )}
                </motion.button>
              </div>
            </form>
          </SpotlightCard>
              </motion.div>
            ) : (
              <motion.div key="csv" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <AddFacultyCSV onComplete={loadTeachers} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {editingTeacher && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setEditingTeacher(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#161a1d] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Edit Profile</h3>
                <button onClick={() => setEditingTeacher(null)} className="text-white/50 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editFormData.full_name}
                    onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#ba181b]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#ba181b]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Designation</label>
                  <select
                    value={editFormData.designation}
                    onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value as TeacherDesignation })}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#ba181b]/50"
                  >
                    <option value="LECTURER">Lecturer</option>
                    <option value="ASSISTANT_PROFESSOR">Assistant Professor</option>
                    <option value="ASSOCIATE_PROFESSOR">Associate Professor</option>
                    <option value="PROFESSOR">Professor</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingTeacher(null)}
                  className="flex-1 px-4 py-2 rounded-full border border-white/20 text-white/70 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-full bg-gradient-to-r from-[#ba181b] to-[#e5383b] text-white flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password Popup Modal */}
      <AnimatePresence>
        {passwordPopup.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setPasswordPopup({ show: false, password: '', teacherName: '' })}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#161a1d] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">New Password</h3>
                <button
                  onClick={() => setPasswordPopup({ show: false, password: '', teacherName: '' })}
                  className="text-white/50 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-white/60 text-sm mb-2">
                Password for <span className="text-white font-medium">{passwordPopup.teacherName}</span>
              </p>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-3 flex items-center justify-between">
                <span className="font-mono text-2xl tracking-widest text-[#e5383b]">{passwordPopup.password}</span>
              </div>

              <p className="text-amber-400/80 text-xs mb-4">
                ⚠ This is a NEW password. The old password has been replaced.
              </p>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(passwordPopup.password);
                  setSuccess('Password copied to clipboard!');
                  setTimeout(() => setSuccess(null), 2000);
                  setPasswordPopup({ show: false, password: '', teacherName: '' });
                }}
                className="w-full px-4 py-2 rounded-full bg-gradient-to-r from-[#ba181b] to-[#e5383b] text-white flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                Copy to Clipboard
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
