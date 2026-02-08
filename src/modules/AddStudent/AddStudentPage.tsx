"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  addStudent, 
  getAllStudents, 
  deleteStudent, 
  formatTerm, 
  formatSession,
  StudentWithAuth 
} from '@/services/studentService';
import AddStudentCSV from './AddStudentCSV';

export default function AddStudentPage() {
  const [students, setStudents] = useState<StudentWithAuth[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBatch, setFilterBatch] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    roll: '',
    name: '',
    email: '',
    phone: '',
    batch: '24',
    currentYear: 1 as 1 | 2 | 3 | 4,
    currentTerm: 1 as 1 | 2,
  });

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setIsLoading(true);
    const data = await getAllStudents();
    setStudents(data);
    setIsLoading(false);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.roll_no.includes(searchTerm);
    const matchesBatch = filterBatch === 'all' || s.session === formatSession(filterBatch);
    return matchesSearch && matchesBatch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate email and phone
      if (!formData.email || !formData.phone) {
        setError('Email and phone number are required');
        setIsSubmitting(false);
        return;
      }

      const result = await addStudent({
        full_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        roll_no: formData.roll,
        term: formatTerm(formData.currentYear, formData.currentTerm),
        session: formatSession(formData.batch),
      });

      if (result.success && result.data) {
        // Show the initial password to the admin
        if (result.initialPassword) {
          const copyPassword = () => {
            navigator.clipboard.writeText(result.initialPassword!);
            alert('Password copied to clipboard!');
          };
          
          const showCopyOption = confirm(
            `✅ Student added successfully!\n\n` +
            `📧 Email: ${formData.email}\n` +
            `🔑 Initial Password: ${result.initialPassword}\n\n` +
            `⚠️ IMPORTANT: The initial password is the student's roll number.\n` +
            `The student will login using their EMAIL and PASSWORD.\n` +
            `Please advise the student to change it after first login.\n\n` +
            `Click OK to copy password to clipboard, or Cancel to continue.`
          );
          
          if (showCopyOption) {
            copyPassword();
          }
        }
        
        setStudents(prev => [result.data!, ...prev]);
        setFormData({ roll: '', name: '', email: '', phone: '', batch: '24', currentYear: 1, currentTerm: 1 });
        setShowForm(false);
      } else {
        setError(result.error || 'Failed to add student');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error adding student:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this student?')) return;

    const result = await deleteStudent(userId);
    if (result.success) {
      setStudents(prev => prev.filter(s => s.user_id !== userId));
    } else {
      alert(result.error || 'Failed to delete student');
    }
  };

  return (
    <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white">Student Management</h1>
          <p className="text-[#8B7355] dark:text-white/60 mt-1">Add and manage student records</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] text-white rounded-full hover:shadow-lg hover:shadow-[#D9A299]/25 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add Student
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCSV(!showCSV)}
            className={`px-5 py-2.5 rounded-full transition-all flex items-center gap-2 ${
              showCSV
                ? 'bg-gradient-to-r from-[#00e5ff] to-[#8400ff] text-white shadow-lg shadow-[#8400ff]/25'
                : 'border border-[#DCC5B2] dark:border-[#392e4e] text-[#5D4E37] dark:text-white/70 hover:bg-[#F0E4D3] dark:hover:bg-white/5'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            CSV Upload
          </motion.button>
        </div>
      </motion.div>

      {/* CSV Upload Section */}
      {showCSV && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl"
        >
          <AddStudentCSV onComplete={loadStudents} />
        </motion.div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#FAF7F3] dark:bg-[#0d0d1a] border border-[#DCC5B2] dark:border-[#392e4e] rounded-2xl p-6 w-full max-w-lg mx-4"
          >
            <h2 className="text-xl font-bold text-[#5D4E37] dark:text-white mb-4">Add New Student</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-white/70 mb-1">Roll Number</label>
                  <input
                    type="text"
                    value={formData.roll}
                    onChange={(e) => setFormData({ ...formData, roll: e.target.value })}
                    placeholder="e.g., 2107001"
                    className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-[#060010] text-[#5D4E37] dark:text-white placeholder:text-[#8B7355] dark:placeholder:text-white/40 focus:border-[#D9A299] dark:focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#8400ff]"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-white/70 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Student name"
                    className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-[#060010] text-[#5D4E37] dark:text-white focus:border-[#D9A299] dark:focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#8400ff]"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-white/70 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g., student@stud.kuet.ac.bd"
                    className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-[#060010] text-[#5D4E37] dark:text-white placeholder:text-[#8B7355] dark:placeholder:text-white/40 focus:border-[#D9A299] dark:focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#8400ff]"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-white/70 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g., 01712345678"
                    className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-[#060010] text-[#5D4E37] dark:text-white placeholder:text-[#8B7355] dark:placeholder:text-white/40 focus:border-[#D9A299] dark:focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#8400ff]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-white/70 mb-1">Batch</label>
                  <select
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                    className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-[#060010] text-[#5D4E37] dark:text-white focus:border-[#D9A299] dark:focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#8400ff]"
                  >
                    <option value="21">2k21</option>
                    <option value="22">2k22</option>
                    <option value="23">2k23</option>
                    <option value="24">2k24</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-white/70 mb-1">Current Year</label>
                  <select
                    value={formData.currentYear}
                    onChange={(e) => setFormData({ ...formData, currentYear: parseInt(e.target.value) as 1 | 2 | 3 | 4 })}
                    className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-[#060010] text-[#5D4E37] dark:text-white focus:border-[#D9A299] dark:focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#8400ff]"
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-white/70 mb-1">Current Term</label>
                  <select
                    value={formData.currentTerm}
                    onChange={(e) => setFormData({ ...formData, currentTerm: parseInt(e.target.value) as 1 | 2 })}
                    className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-[#060010] text-[#5D4E37] dark:text-white focus:border-[#D9A299] dark:focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#8400ff]"
                  >
                    <option value={1}>1st Term</option>
                    <option value={2}>2nd Term</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-full text-[#5D4E37] dark:text-white/70 hover:bg-[#F0E4D3] dark:hover:bg-white/5"
                  disabled={isSubmitting}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Adding...' : 'Add Student'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name or roll..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#F0E4D3] dark:bg-[#0d0d1a] text-[#5D4E37] dark:text-white placeholder:text-[#8B7355] dark:placeholder:text-white/40 focus:border-[#D9A299] dark:focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#8400ff]"
          />
        </div>
        <select
          value={filterBatch}
          onChange={(e) => setFilterBatch(e.target.value)}
          className="px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#F0E4D3] dark:bg-[#0d0d1a] text-[#5D4E37] dark:text-white focus:border-[#D9A299] dark:focus:border-[#8400ff] focus:outline-none"
        >
          <option value="all">All Batches</option>
          <option value="21">2k21</option>
          <option value="22">2k22</option>
          <option value="23">2k23</option>
          <option value="24">2k24</option>
        </select>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SpotlightCard className="bg-[#FAF7F3] dark:bg-transparent border border-[#DCC5B2] dark:border-transparent" spotlightColor="rgba(217, 162, 153, 0.2)">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D9A299] dark:border-[#8400ff]"></div>
              <span className="ml-3 text-[#8B7355] dark:text-white/60">Loading students...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-[#8B7355] dark:text-white/60">
              No students found. Add your first student to get started!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F0E4D3] dark:bg-[#060010]/50 border-b border-[#DCC5B2] dark:border-[#392e4e]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Roll</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Phone</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Session</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Term</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCC5B2]/50 dark:divide-[#392e4e]/50">
                  {filteredStudents.map((student, index) => (
                    <motion.tr 
                      key={student.user_id} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="hover:bg-[#D9A299]/10 dark:hover:bg-[#8400ff]/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-[#5D4E37] dark:text-white">{student.roll_no}</td>
                      <td className="px-6 py-4 text-[#5D4E37] dark:text-white">{student.full_name}</td>
                      <td className="px-6 py-4 text-[#8B7355] dark:text-white/60 text-sm">{student.profile.email}</td>
                      <td className="px-6 py-4 text-[#8B7355] dark:text-white/60 text-sm">{student.phone}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-[#D9A299]/20 dark:bg-[#8400ff]/20 text-[#D9A299] dark:text-[#a855f7] rounded-full text-sm border border-[#D9A299]/30 dark:border-[#8400ff]/30">
                          {student.session}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-[#5D4E37]/10 dark:bg-white/10 text-[#5D4E37] dark:text-white rounded-full text-sm">
                          {student.term}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(student.user_id)}
                            className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Deactivate student"
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
            </div>
          )}
        </SpotlightCard>
      </motion.div>
    </div>
  );
}
