"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { StudentWithAuth, getAllStudents, deleteStudent } from '@/services/studentService';
import { motion } from 'framer-motion';
import { UserCog, Loader2, AlertCircle, Mail, Phone, GraduationCap, Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function StudentInfoPage() {
  const [students, setStudents] = useState<StudentWithAuth[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSession, setFilterSession] = useState<string>('all');
  const [filterTerm, setFilterTerm] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load students on mount
  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    const data = await getAllStudents();
    setStudents(data);
    setLoading(false);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.roll_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.profile.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSession = filterSession === 'all' || s.session === filterSession;
    const matchesTerm = filterTerm === 'all' || s.term === filterTerm;
    return matchesSearch && matchesSession && matchesTerm;
  });

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this student?')) return;

    setLoading(true);
    const result = await deleteStudent(userId);

    if (result.success) {
      setSuccess('Student deactivated successfully!');
      await loadStudents();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Failed to deactivate student');
    }

    setLoading(false);
  };

  const getSessionColor = (session: string) => {
    const year = parseInt(session);
    const colors = [
      'bg-[#ba181b]/20 text-[#e5383b] border border-[#ba181b]/30',
      'bg-[#d3d3d3]/20 text-[#d3d3d3] border border-[#d3d3d3]/30',
      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    ];
    return colors[(year % 4)];
  };

  const getTermLabel = (term: string) => {
    const [year, t] = term.split('-');
    return `Year ${year}, Term ${t}`;
  };

  // Get unique sessions and terms for filters
  const uniqueSessions = [...new Set(students.map(s => s.session))].sort().reverse();
  const uniqueTerms = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'];

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
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white">Student Directory</h1>
          <p className="text-[#8B7355] dark:text-[#b1a7a6] mt-1">View all enrolled students</p>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-[#8B7355] dark:text-[#b1a7a6]">
          <UserCog className="w-4 h-4" />
          <span>{filteredStudents.length} students</span>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <div className="sm:col-span-1">
          <input
            type="text"
            placeholder="Search by name, roll, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#161a1d] text-[#5D4E37] dark:text-white placeholder:text-[#8B7355] dark:placeholder:text-white/40 focus:border-[#D9A299] dark:focus:border-[#ba181b] focus:outline-none focus:ring-1 focus:ring-[#D9A299] dark:focus:ring-[#ba181b]"
          />
        </div>
        <select
          value={filterSession}
          onChange={(e) => setFilterSession(e.target.value)}
          className="px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#161a1d] text-[#5D4E37] dark:text-white focus:border-[#D9A299] dark:focus:border-[#ba181b] focus:outline-none"
        >
          <option value="all">All Sessions</option>
          {uniqueSessions.map(session => (
            <option key={session} value={session}>Session {session}</option>
          ))}
        </select>
        <select
          value={filterTerm}
          onChange={(e) => setFilterTerm(e.target.value)}
          className="px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#161a1d] text-[#5D4E37] dark:text-white focus:border-[#D9A299] dark:focus:border-[#ba181b] focus:outline-none"
        >
          <option value="all">All Terms</option>
          {uniqueTerms.map(term => (
            <option key={term} value={term}>{getTermLabel(term)}</option>
          ))}
        </select>
      </motion.div>

      {/* Student Grid */}
      {loading && students.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#D9A299] dark:text-[#ba181b]" />
          <span className="ml-3 text-[#8B7355] dark:text-[#b1a7a6]">Loading students...</span>
        </div>
      ) : filteredStudents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <GraduationCap className="w-16 h-16 mx-auto text-[#DCC5B2] dark:text-white/20 mb-4" />
          <p className="text-[#8B7355] dark:text-[#b1a7a6]">
            {searchTerm || filterSession !== 'all' || filterTerm !== 'all' 
              ? 'No students match your filters' 
              : 'No students found. Add students to get started!'}
          </p>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredStudents.map((student, index) => (
            <motion.div
              key={student.user_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <SpotlightCard 
                className="h-full bg-[#FAF7F3] dark:bg-transparent border border-[#DCC5B2] dark:border-transparent" 
                spotlightColor="rgba(217, 162, 153, 0.2)"
              >
                <div className="p-6 space-y-4">
                  {/* Avatar & Roll */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D9A299] to-[#DCC5B2] flex items-center justify-center text-white font-semibold text-lg">
                        {student.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#5D4E37] dark:text-white">
                          {student.full_name}
                        </h3>
                        <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6]">
                          Roll: {student.roll_no}
                        </p>
                      </div>
                    </div>
                    
                    {student.profile.is_active && (
                      <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full border border-emerald-500/30">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-[#8B7355] dark:text-[#b1a7a6]">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{student.profile.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#8B7355] dark:text-[#b1a7a6]">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span>{student.phone}</span>
                    </div>
                  </div>

                  {/* Academic Info */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 text-xs rounded-full ${getSessionColor(student.session)}`}>
                      <Calendar className="w-3 h-3 inline mr-1" />
                      Session {student.session}
                    </span>
                    <span className="px-2.5 py-1 bg-[#5D4E37]/10 dark:bg-[#3d4951]/30 text-[#5D4E37] dark:text-white text-xs rounded-full">
                      <GraduationCap className="w-3 h-3 inline mr-1" />
                      {getTermLabel(student.term)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-[#DCC5B2]/50 dark:border-[#3d4951]/50">
                    <button
                      onClick={() => handleDelete(student.user_id)}
                      disabled={loading}
                      className="w-full px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Deactivate
                    </button>
                  </div>
                </div>
              </SpotlightCard>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
