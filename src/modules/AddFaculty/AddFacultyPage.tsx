"use client";

import { SpotlightCard } from '@/components/ui/SpotlightCard';
import { sampleFaculty } from '@/data/sampleData';
import { Designation, Faculty } from '@/types';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function AddFacultyPage() {
  const [faculty, setFaculty] = useState<Faculty[]>(sampleFaculty);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    designation: 'Lecturer' as Designation,
    officeRoom: '',
    experience: 0,
  });

  const filteredFaculty = faculty.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newFaculty: Faculty = {
      id: `F${Date.now()}`,
      ...formData,
      department: 'Computer Science & Engineering',
      assignedCourses: [],
    };
    setFaculty(prev => [newFaculty, ...prev]);
    setFormData({ name: '', email: '', phone: '', designation: 'Lecturer', officeRoom: '', experience: 0 });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setFaculty(prev => prev.filter(f => f.id !== id));
  };

  const getDesignationColor = (designation: Designation) => {
    switch (designation) {
      case 'Professor': return 'bg-[#8400ff]/20 text-[#a855f7] border border-[#8400ff]/30';
      case 'Associate Professor': return 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30';
      case 'Assistant Professor': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'Lecturer': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      default: return 'bg-white/10 text-white/60';
    }
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
          <h1 className="text-2xl font-bold text-white">Faculty Management</h1>
          <p className="text-white/60 mt-1">Add and manage faculty members</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-[#8400ff] to-[#a855f7] text-white rounded-full hover:shadow-lg hover:shadow-[#8400ff]/25 transition-all flex items-center gap-2"
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
            className="bg-[#0d0d1a] border border-[#392e4e] rounded-2xl p-6 w-full max-w-lg mx-4"
          >
            <h2 className="text-xl font-bold text-white mb-4">Add New Faculty</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@cse.kuet.ac.bd"
                  className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#060010] text-white placeholder:text-white/40 focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Designation</label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value as Designation })}
                    className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
                  >
                    <option value="Professor">Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Lecturer">Lecturer</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Office Room</label>
                  <input
                    type="text"
                    value={formData.officeRoom}
                    onChange={(e) => setFormData({ ...formData, officeRoom: e.target.value })}
                    placeholder="e.g., Room 301"
                    className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#060010] text-white placeholder:text-white/40 focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Experience (Years)</label>
                  <input
                    type="number"
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
                  />
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
                  Add Faculty
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
          className="w-full max-w-md px-4 py-2 border border-[#392e4e] rounded-lg bg-[#0d0d1a] text-white placeholder:text-white/40 focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
        />
      </motion.div>

      {/* Faculty Table */}
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Designation</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Experience</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Courses</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#392e4e]/50">
                {filteredFaculty.map((member, index) => (
                  <motion.tr 
                    key={member.id} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className="hover:bg-[#8400ff]/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8400ff] to-[#00e5ff] flex items-center justify-center text-white font-bold text-sm">
                          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="font-medium text-white">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/60">{member.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getDesignationColor(member.designation)}`}>
                        {member.designation}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white/60">{member.experience} years</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {member.assignedCourses.slice(0, 2).map((course) => (
                          <span key={course} className="px-2 py-0.5 bg-[#392e4e] text-white/70 rounded text-xs">
                            {course}
                          </span>
                        ))}
                        {member.assignedCourses.length > 2 && (
                          <span className="px-2 py-0.5 bg-[#392e4e] text-white/70 rounded text-xs">
                            +{member.assignedCourses.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-[#00e5ff] hover:bg-[#00e5ff]/10 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(member.id)}
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
