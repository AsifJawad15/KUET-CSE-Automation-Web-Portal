"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { TeacherDesignation, TeacherWithAuth } from '@/lib/supabase';
import { addTeacher, getAllTeachers, deleteTeacher } from '@/services/teacherService';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

export default function AddFacultyPage() {
  const [teachers, setTeachers] = useState<TeacherWithAuth[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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

  const filteredTeachers = teachers.filter(t =>
    t.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.profile.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await addTeacher(formData);

    if (result.success) {
      // Show the generated password to the admin
      if (result.generatedPassword) {
        const copyPassword = () => {
          navigator.clipboard.writeText(result.generatedPassword!);
          alert('Password copied to clipboard!');
        };
        
        const showCopyOption = confirm(
          `✅ Teacher added successfully!\n\n` +
          `📧 Email: ${formData.email}\n` +
          `🔑 Password: ${result.generatedPassword}\n\n` +
          `⚠️ IMPORTANT: This password will only be shown once!\n` +
          `Please save it and share it with the teacher.\n\n` +
          `Click OK to copy password to clipboard, or Cancel to continue.`
        );
        
        if (showCopyOption) {
          copyPassword();
        }
      }
      
      setSuccess('Teacher added successfully!');
      setFormData({ full_name: '', email: '', phone: '', designation: 'LECTURER' });
      setShowForm(false);
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

  const getDesignationColor = (designation: TeacherDesignation) => {
    switch (designation) {
      case 'PROFESSOR': return 'bg-[#ba181b]/20 text-[#e5383b] border border-[#ba181b]/30';
      case 'ASSOCIATE_PROFESSOR': return 'bg-[#d3d3d3]/20 text-[#d3d3d3] border border-[#d3d3d3]/30';
      case 'ASSISTANT_PROFESSOR': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'LECTURER': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      default: return 'bg-white/10 text-white/60';
    }
  };

  const getDesignationLabel = (designation: TeacherDesignation) => {
    switch (designation) {
      case 'PROFESSOR': return 'Professor';
      case 'ASSOCIATE_PROFESSOR': return 'Associate Professor';
      case 'ASSISTANT_PROFESSOR': return 'Assistant Professor';
      case 'LECTURER': return 'Lecturer';
      default: return designation;
    }
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

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white">Faculty Management</h1>
          <p className="text-[#8B7355] dark:text-[#b1a7a6] mt-1">Add and manage faculty members</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] text-white rounded-full hover:shadow-lg hover:shadow-[#D9A299]/25 transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Add Faculty
        </motion.button>
      </motion.div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#FAF7F3] dark:bg-[#161a1d] border border-[#DCC5B2] dark:border-[#3d4951] rounded-2xl p-6 w-full max-w-lg mx-4"
          >
            <h2 className="text-xl font-bold text-[#5D4E37] dark:text-white mb-4">Add New Faculty</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white focus:border-[#D9A299] dark:focus:border-[#ba181b] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#ba181b]"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@cse.kuet.ac.bd"
                  className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder:text-[#8B7355] dark:placeholder:text-white/40 focus:border-[#D9A299] dark:focus:border-[#ba181b] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#ba181b]"
                  required
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g., 01712345678"
                    className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder:text-[#8B7355] dark:placeholder:text-white/40 focus:border-[#D9A299] dark:focus:border-[#ba181b] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#ba181b]"
                    disabled={loading}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-1">Designation</label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value as TeacherDesignation })}
                    className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white focus:border-[#D9A299] dark:focus:border-[#ba181b] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#ba181b]"
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
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] rounded-full text-[#5D4E37] dark:text-[#d3d3d3] hover:bg-[#F0E4D3] dark:hover:bg-[#0b090a]"
                  disabled={loading}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white rounded-full flex items-center justify-center gap-2"
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
          </motion.div>
        </div>
      )}

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#161a1d] text-[#5D4E37] dark:text-white placeholder:text-[#8B7355] dark:placeholder:text-white/40 focus:border-[#D9A299] dark:focus:border-[#ba181b] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#ba181b]"
        />
      </motion.div>

      {/* Faculty Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SpotlightCard spotlightColor="rgba(217, 162, 153, 0.2)">
          <div className="overflow-x-auto">
            {loading && teachers.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#D9A299] dark:text-[#ba181b]" />
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="text-center py-12 text-[#8B7355] dark:text-[#b1a7a6]">
                No teachers found. Add your first teacher to get started.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-[#F0E4D3] dark:bg-[#0b090a]/50 border-b border-[#DCC5B2] dark:border-[#3d4951]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-[#b1a7a6] uppercase">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-[#b1a7a6] uppercase">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-[#b1a7a6] uppercase">Phone</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-[#b1a7a6] uppercase">Designation</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-[#b1a7a6] uppercase">Teacher ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-[#b1a7a6] uppercase">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-[#b1a7a6] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCC5B2]/50 dark:divide-[#3d4951]/50">
                  {filteredTeachers.map((teacher, index) => (
                    <motion.tr 
                      key={teacher.user_id} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="hover:bg-[#F0E4D3] dark:hover:bg-[#ba181b]/5 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#d3d3d3] flex items-center justify-center text-white font-bold text-sm">
                            {teacher.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="font-medium text-[#5D4E37] dark:text-white">{teacher.full_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[#8B7355] dark:text-[#b1a7a6]">{teacher.profile.email}</td>
                      <td className="px-6 py-4 text-[#8B7355] dark:text-[#b1a7a6]">{teacher.phone}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getDesignationColor(teacher.designation)}`}>
                          {getDesignationLabel(teacher.designation)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#8B7355] dark:text-[#b1a7a6] font-mono text-sm">{teacher.teacher_uid}</td>
                      <td className="px-6 py-4">
                        {teacher.profile.is_active ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button className="p-2 text-[#D9A299] dark:text-[#d3d3d3] hover:bg-[#D9A299]/10 dark:hover:bg-[#d3d3d3]/10 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(teacher.user_id)}
                            className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            disabled={loading}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </SpotlightCard>
      </motion.div>
    </div>
  );
}
