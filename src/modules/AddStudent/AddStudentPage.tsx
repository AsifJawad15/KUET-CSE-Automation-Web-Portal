"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  addStudent, 
  getAllStudents, 
  deleteStudent, 
  formatTerm, 
  formatSession,
  StudentWithAuth 
} from '@/services/studentService';
import { FileUploadModal, studentUploadConfig } from '@/components/upload';
import { Select } from '@/components/ui/FormPicker';

export default function AddStudentPage() {
  const [students, setStudents] = useState<StudentWithAuth[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
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
    const matchesTerm = !selectedTerm || s.term === selectedTerm;
    return matchesSearch && matchesTerm;
  });

  const TERMS = [
    { id: '1-1', label: 'Term 1-1', year: '1st Year', color: 'bg-blue-600', lightBg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    { id: '1-2', label: 'Term 1-2', year: '1st Year', color: 'bg-indigo-600', lightBg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
    { id: '2-1', label: 'Term 2-1', year: '2nd Year', color: 'bg-teal-600', lightBg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
    { id: '2-2', label: 'Term 2-2', year: '2nd Year', color: 'bg-emerald-600', lightBg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    { id: '3-1', label: 'Term 3-1', year: '3rd Year', color: 'bg-violet-600', lightBg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
    { id: '3-2', label: 'Term 3-2', year: '3rd Year', color: 'bg-purple-600', lightBg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
    { id: '4-1', label: 'Term 4-1', year: '4th Year', color: 'bg-rose-600', lightBg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
    { id: '4-2', label: 'Term 4-2', year: '4th Year', color: 'bg-amber-600', lightBg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  ];

  const getStudentCountForTerm = (termId: string) => {
    return students.filter(s => s.term === termId).length;
  };

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
          <h1 className="text-2xl font-bold text-gray-700 dark:text-white">Student Management</h1>
          <p className="text-gray-400 dark:text-[#b1a7a6] mt-1">Add and manage student records</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-full hover:shadow-lg hover:shadow-indigo-600/25 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add Student
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCSV(true)}
            className="px-5 py-2.5 rounded-full border border-gray-200 dark:border-[#3d4951] text-gray-700 dark:text-[#d3d3d3] hover:bg-gray-50 dark:hover:bg-[#0b090a] transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload CSV
          </motion.button>
        </div>
      </motion.div>

      {/* CSV Upload Modal */}
      <FileUploadModal
        show={showCSV}
        onClose={() => setShowCSV(false)}
        onImportComplete={loadStudents}
        config={studentUploadConfig}
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#161a1d] border border-gray-200 dark:border-[#3d4951] rounded-2xl p-6 w-full max-w-lg mx-4"
          >
            <h2 className="text-xl font-bold text-gray-700 dark:text-white mb-4">Add New Student</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-1">Roll Number</label>
                  <input
                    type="text"
                    value={formData.roll}
                    onChange={(e) => setFormData({ ...formData, roll: e.target.value })}
                    placeholder="e.g., 2107001"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/40 focus:border-indigo-400 dark:focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:focus:ring-red-400"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Student name"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white focus:border-indigo-400 dark:focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:focus:ring-red-400"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g., student@stud.kuet.ac.bd"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/40 focus:border-indigo-400 dark:focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:focus:ring-red-400"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g., 01712345678"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/40 focus:border-indigo-400 dark:focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:focus:ring-red-400"
                    required
                  />
                </div>
                <div>
                  <Select
                    label="Batch"
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                  >
                    <option value="21">2k21</option>
                    <option value="22">2k22</option>
                    <option value="23">2k23</option>
                    <option value="24">2k24</option>
                  </Select>
                </div>
                <div>
                  <Select
                    label="Current Year"
                    value={formData.currentYear}
                    onChange={(e) => setFormData({ ...formData, currentYear: parseInt(e.target.value) as 1 | 2 | 3 | 4 })}
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Select
                    label="Current Term"
                    value={formData.currentTerm}
                    onChange={(e) => setFormData({ ...formData, currentTerm: parseInt(e.target.value) as 1 | 2 })}
                  >
                    <option value={1}>1st Term</option>
                    <option value={2}>2nd Term</option>
                  </Select>
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
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-[#3d4951] rounded-full text-gray-700 dark:text-[#d3d3d3] hover:bg-gray-50 dark:hover:bg-[#0b090a]"
                  disabled={isSubmitting}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Adding...' : 'Add Student'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Term Boxes Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {TERMS.map((term, i) => {
          const count = getStudentCountForTerm(term.id);
          const isSelected = selectedTerm === term.id;
          return (
            <motion.button
              key={term.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              onClick={() => {
                setSelectedTerm(isSelected ? null : term.id);
                setSearchTerm('');
              }}
              className={`relative p-5 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? `${term.lightBg} ${term.border} ring-2 ring-offset-1 ring-current ${term.text}`
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg ${term.color} flex items-center justify-center text-white text-sm font-bold mb-3`}>
                {term.id}
              </div>
              <h3 className={`text-lg font-bold ${isSelected ? term.text : 'text-gray-800'}`}>
                {term.label}
              </h3>
              <p className={`text-xs mt-0.5 ${isSelected ? term.text : 'text-gray-400'}`}>
                {term.year}
              </p>
              <p className={`text-sm mt-1 ${isSelected ? term.text + '/70' : 'text-gray-500'}`}>
                {isLoading ? '...' : `${count} student${count !== 1 ? 's' : ''}`}
              </p>
              {isSelected && (
                <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${term.color}`} />
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Expanded Student Table (shown when a term is selected) */}
      <AnimatePresence>
        {selectedTerm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="space-y-4">
              {/* Search within term */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder={`Search in ${TERMS.find(t => t.id === selectedTerm)?.label || ''}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <button
                  onClick={() => setSelectedTerm(null)}
                  className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>

              {/* Student table */}
              <SpotlightCard className="bg-white border border-gray-200">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                    <span className="ml-3 text-gray-400">Loading students...</span>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    No students found in this term.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Roll</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Session</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredStudents.map((student, index) => (
                          <motion.tr
                            key={student.user_id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.03 }}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4 font-medium text-gray-800">{student.roll_no}</td>
                            <td className="px-6 py-4 text-gray-700">{student.full_name}</td>
                            <td className="px-6 py-4 text-gray-500 text-sm">{student.profile.email}</td>
                            <td className="px-6 py-4 text-gray-500 text-sm">{student.phone}</td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-sm border border-indigo-200">
                                {student.session}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleDelete(student.user_id)}
                                className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                title="Deactivate student"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SpotlightCard>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
