"use client";

import { SpotlightCard } from '@/components/ui/SpotlightCard';
import { sampleStudents } from '@/data/sampleData';
import { Student } from '@/types';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function AddStudentPage() {
  const [students, setStudents] = useState<Student[]>(sampleStudents);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBatch, setFilterBatch] = useState<string>('all');
  const [formData, setFormData] = useState({
    roll: '',
    name: '',
    email: '',
    batch: '24',
    section: 'A' as 'A' | 'B',
    currentYear: 1 as 1 | 2 | 3 | 4,
    currentTerm: 1 as 1 | 2,
  });

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.roll.includes(searchTerm);
    const matchesBatch = filterBatch === 'all' || s.batch === filterBatch;
    return matchesSearch && matchesBatch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newStudent: Student = {
      id: `S${Date.now()}`,
      ...formData,
      email: formData.email || `${formData.roll}@stud.kuet.ac.bd`,
      department: 'Computer Science & Engineering',
    };
    setStudents(prev => [newStudent, ...prev]);
    setFormData({ roll: '', name: '', email: '', batch: '24', section: 'A', currentYear: 1, currentTerm: 1 });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Student Management</h1>
          <p className="text-white/60 mt-1">Add and manage student records</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-[#8400ff] to-[#a855f7] text-white rounded-full hover:shadow-lg hover:shadow-[#8400ff]/25 transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Add Student
        </motion.button>
      </motion.div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0d0d1a] border border-[#392e4e] rounded-2xl p-6 w-full max-w-lg mx-4"
          >
            <h2 className="text-xl font-bold text-white mb-4">Add New Student</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-white/70 mb-1">Roll Number</label>
                  <input
                    type="text"
                    value={formData.roll}
                    onChange={(e) => setFormData({ ...formData, roll: e.target.value })}
                    placeholder="e.g., 2107001"
                    className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#060010] text-white placeholder:text-white/40 focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-white/70 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-white/70 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Auto-generated if empty"
                    className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#060010] text-white placeholder:text-white/40 focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Batch</label>
                  <select
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                    className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
                  >
                    <option value="21">2k21</option>
                    <option value="22">2k22</option>
                    <option value="23">2k23</option>
                    <option value="24">2k24</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Section</label>
                  <select
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value as 'A' | 'B' })}
                    className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Current Year</label>
                  <select
                    value={formData.currentYear}
                    onChange={(e) => setFormData({ ...formData, currentYear: parseInt(e.target.value) as 1 | 2 | 3 | 4 })}
                    className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Current Term</label>
                  <select
                    value={formData.currentTerm}
                    onChange={(e) => setFormData({ ...formData, currentTerm: parseInt(e.target.value) as 1 | 2 })}
                    className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
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
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-[#392e4e] rounded-full text-white/70 hover:bg-white/5"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#8400ff] to-[#a855f7] text-white rounded-full"
                >
                  Add Student
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

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
            placeholder="Search by name or roll..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#0d0d1a] text-white placeholder:text-white/40 focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
          />
        </div>
        <select
          value={filterBatch}
          onChange={(e) => setFilterBatch(e.target.value)}
          className="px-4 py-2 border border-[#392e4e] rounded-lg bg-[#0d0d1a] text-white focus:border-[#8400ff] focus:outline-none"
        >
          <option value="all">All Batches</option>
          <option value="21">2k21</option>
          <option value="22">2k22</option>
          <option value="23">2k23</option>
          <option value="24">2k24</option>
        </select>
      </motion.div>

      {/* Students Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SpotlightCard spotlightColor="rgba(132, 0, 255, 0.15)">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#060010]/50 border-b border-[#392e4e]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Roll</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Batch</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Section</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Year-Term</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#392e4e]/50">
                {filteredStudents.map((student, index) => (
                  <motion.tr 
                    key={student.id} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className="hover:bg-[#8400ff]/5 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-white">{student.roll}</td>
                    <td className="px-6 py-4 text-white">{student.name}</td>
                    <td className="px-6 py-4 text-white/60">{student.email}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-[#8400ff]/20 text-[#a855f7] rounded-full text-sm border border-[#8400ff]/30">
                        2k{student.batch}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white/60">{student.section}</td>
                    <td className="px-6 py-4 text-white/60">{student.currentYear}-{student.currentTerm}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-[#00e5ff] hover:bg-[#00e5ff]/10 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(student.id)}
                          className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
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
        </SpotlightCard>
      </motion.div>
    </div>
  );
}
