"use client";

import { BentoGrid, BentoStatCard } from '@/components/ui/MagicBento';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { motion } from 'framer-motion';
import { Award, Download, FileText, Search, TrendingUp, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

// Dummy result data
const dummyStudents = [
  { id: 'S001', roll: '2107001', name: 'Asif Jawad', section: 'A', batch: '21' },
  { id: 'S002', roll: '2107002', name: 'Abdullah Md. Shahporan', section: 'A', batch: '21' },
  { id: 'S003', roll: '2107003', name: 'Mehedi Hasan', section: 'A', batch: '21' },
  { id: 'S004', roll: '2107004', name: 'Rakib Hossain', section: 'A', batch: '21' },
  { id: 'S005', roll: '2107005', name: 'Tanvir Ahmed', section: 'A', batch: '21' },
  { id: 'S006', roll: '2107061', name: 'Nusrat Jahan', section: 'B', batch: '21' },
  { id: 'S007', roll: '2107062', name: 'Farhan Islam', section: 'B', batch: '21' },
  { id: 'S008', roll: '2107063', name: 'Sajid Rahman', section: 'B', batch: '21' },
  { id: 'S009', roll: '2107064', name: 'Priya Das', section: 'B', batch: '21' },
  { id: 'S010', roll: '2107065', name: 'Arif Mahmud', section: 'B', batch: '21' },
];

const dummyCourses = [
  { id: 'C001', code: 'CSE 3201', title: 'Computer Architecture', type: 'theory', credits: 3 },
  { id: 'C002', code: 'CSE 3203', title: 'Database Systems', type: 'theory', credits: 3 },
  { id: 'C003', code: 'CSE 3205', title: 'Operating Systems', type: 'theory', credits: 3 },
  { id: 'C004', code: 'CSE 3207', title: 'Computer Networks', type: 'theory', credits: 3 },
  { id: 'C005', code: 'CSE 3209', title: 'Software Engineering', type: 'theory', credits: 3 },
];

// Pre-populated dummy results
const generateDummyResults = () => {
  const results: Record<string, Record<string, ResultEntry>> = {};
  
  dummyStudents.forEach(student => {
    results[student.id] = {};
    dummyCourses.forEach(course => {
      results[student.id][course.code] = {
        studentId: student.id,
        courseCode: course.code,
        ct1: Math.floor(Math.random() * 8) + 12,
        ct2: Math.floor(Math.random() * 8) + 12,
        ct3: Math.floor(Math.random() * 8) + 12,
        attendance: Math.floor(Math.random() * 4) + 6,
        assignment: Math.floor(Math.random() * 2) + 3,
      };
    });
  });
  
  return results;
};

interface ResultEntry {
  studentId: string;
  courseCode: string;
  ct1: number;
  ct2: number;
  ct3: number;
  attendance: number;
  assignment: number;
}

export default function ResultPage() {
  const [selectedCourse, setSelectedCourse] = useState<string>(dummyCourses[0].code);
  const [selectedSection, setSelectedSection] = useState<string>('A');
  const [viewMode, setViewMode] = useState<'input' | 'view'>('view');
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Record<string, Record<string, ResultEntry>>>(generateDummyResults);

  const filteredStudents = useMemo(() => {
    return dummyStudents.filter(s => {
      const matchesSection = s.section === selectedSection;
      const matchesSearch = searchTerm === '' || 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.roll.includes(searchTerm);
      return matchesSection && matchesSearch;
    });
  }, [selectedSection, searchTerm]);

  const handleResultChange = (studentId: string, field: keyof ResultEntry, value: number) => {
    setResults(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [selectedCourse]: {
          ...prev[studentId]?.[selectedCourse],
          studentId,
          courseCode: selectedCourse,
          [field]: value,
        },
      },
    }));
  };

  const getResultValue = (studentId: string, field: keyof ResultEntry): number => {
    return results[studentId]?.[selectedCourse]?.[field] ?? 0;
  };

  const calculateTotal = (studentId: string): number => {
    const r = results[studentId]?.[selectedCourse];
    if (!r) return 0;
    return (r.ct1 || 0) + (r.ct2 || 0) + (r.ct3 || 0) + (r.attendance || 0) + (r.assignment || 0);
  };

  const getGrade = (total: number): { grade: string; color: string } => {
    if (total >= 70) return { grade: 'A+', color: '#00e5ff' };
    if (total >= 65) return { grade: 'A', color: '#22c55e' };
    if (total >= 60) return { grade: 'A-', color: '#84cc16' };
    if (total >= 55) return { grade: 'B+', color: '#eab308' };
    if (total >= 50) return { grade: 'B', color: '#f97316' };
    if (total >= 45) return { grade: 'B-', color: '#fb923c' };
    if (total >= 40) return { grade: 'C', color: '#ef4444' };
    return { grade: 'F', color: '#dc2626' };
  };

  const stats = useMemo(() => {
    const totals = filteredStudents.map(s => calculateTotal(s.id));
    const avg = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const highest = Math.max(...totals, 0);
    const passed = totals.filter(t => t >= 40).length;
    
    return {
      average: avg.toFixed(1),
      highest,
      passRate: totals.length > 0 ? ((passed / totals.length) * 100).toFixed(0) : '0',
      totalStudents: filteredStudents.length,
    };
  }, [filteredStudents, results, selectedCourse]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Result Management</h1>
          <p className="text-white/60 mt-1">Enter and manage student results</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 rounded-full bg-[#0d0d1a] border border-[#392e4e] text-white/70 hover:border-[#8400ff]/50 flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </motion.button>
          <div className="flex bg-[#0d0d1a] border border-[#392e4e] rounded-full p-1">
            <button
              onClick={() => setViewMode('input')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                viewMode === 'input' 
                  ? 'bg-[#8400ff] text-white shadow-lg shadow-[#8400ff]/25' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Input Results
            </button>
            <button
              onClick={() => setViewMode('view')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                viewMode === 'view' 
                  ? 'bg-[#8400ff] text-white shadow-lg shadow-[#8400ff]/25' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              View Results
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards - Bento Grid */}
      <BentoGrid cols={4} gap="md">
        <BentoStatCard
          icon={<Users className="w-5 h-5 text-[#8400ff]" />}
          title="Total Students"
          value={stats.totalStudents}
          subtitle={`Section ${selectedSection}`}
          spotlightColor="rgba(132, 0, 255, 0.15)"
          delay={0}
        />
        <BentoStatCard
          icon={<TrendingUp className="w-5 h-5 text-[#00e5ff]" />}
          title="Class Average"
          value={stats.average}
          subtitle="Out of 75"
          trend={{ value: '5.2%', isPositive: true }}
          spotlightColor="rgba(0, 229, 255, 0.15)"
          delay={0.1}
        />
        <BentoStatCard
          icon={<Award className="w-5 h-5 text-emerald-400" />}
          title="Highest Score"
          value={stats.highest}
          subtitle="Top performer"
          spotlightColor="rgba(16, 185, 129, 0.15)"
          delay={0.2}
        />
        <BentoStatCard
          icon={<FileText className="w-5 h-5 text-amber-400" />}
          title="Pass Rate"
          value={`${stats.passRate}%`}
          subtitle="≥40 marks"
          trend={{ value: '2.1%', isPositive: true }}
          spotlightColor="rgba(245, 158, 11, 0.15)"
          delay={0.3}
        />
      </BentoGrid>

      {/* Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search by name or roll..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#392e4e] rounded-lg bg-[#0d0d1a] text-white placeholder:text-white/40 focus:border-[#8400ff] focus:outline-none focus:ring-1 focus:ring-[#8400ff]"
          />
        </div>
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="px-4 py-2 border border-[#392e4e] rounded-lg bg-[#0d0d1a] text-white focus:border-[#8400ff] focus:outline-none"
        >
          {dummyCourses.map(course => (
            <option key={course.id} value={course.code}>{course.code} - {course.title}</option>
          ))}
        </select>
        <select
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value)}
          className="px-4 py-2 border border-[#392e4e] rounded-lg bg-[#0d0d1a] text-white focus:border-[#8400ff] focus:outline-none"
        >
          <option value="A">Section A</option>
          <option value="B">Section B</option>
        </select>
      </motion.div>

      {/* Results Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <SpotlightCard spotlightColor="rgba(132, 0, 255, 0.15)">
          <div className="p-4 border-b border-[#392e4e] flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">
                {dummyCourses.find(c => c.code === selectedCourse)?.title}
              </h3>
              <p className="text-sm text-white/50">{selectedCourse} - Section {selectedSection}</p>
            </div>
            <span className="text-xs text-white/40 px-3 py-1 rounded-full bg-white/5 border border-[#392e4e]">
              {filteredStudents.length} students
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#060010]/50 border-b border-[#392e4e]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase">Roll</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase">Name</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">CT-1 (20)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">CT-2 (20)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">CT-3 (20)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Attend. (10)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Assign. (5)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#392e4e]/50">
                {filteredStudents.map((student, index) => {
                  const total = calculateTotal(student.id);
                  const { grade, color } = getGrade(total);
                  
                  return (
                    <motion.tr 
                      key={student.id} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 + index * 0.03 }}
                      className="hover:bg-[#8400ff]/5 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-white">{student.roll}</td>
                      <td className="px-4 py-3 text-white/70">{student.name}</td>
                      <td className="px-4 py-3 text-center">
                        {viewMode === 'input' ? (
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={getResultValue(student.id, 'ct1') || ''}
                            onChange={(e) => handleResultChange(student.id, 'ct1', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-center border border-[#392e4e] rounded bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none"
                          />
                        ) : (
                          <span className="text-white/80">{getResultValue(student.id, 'ct1')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {viewMode === 'input' ? (
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={getResultValue(student.id, 'ct2') || ''}
                            onChange={(e) => handleResultChange(student.id, 'ct2', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-center border border-[#392e4e] rounded bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none"
                          />
                        ) : (
                          <span className="text-white/80">{getResultValue(student.id, 'ct2')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {viewMode === 'input' ? (
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={getResultValue(student.id, 'ct3') || ''}
                            onChange={(e) => handleResultChange(student.id, 'ct3', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-center border border-[#392e4e] rounded bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none"
                          />
                        ) : (
                          <span className="text-white/80">{getResultValue(student.id, 'ct3')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {viewMode === 'input' ? (
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={getResultValue(student.id, 'attendance') || ''}
                            onChange={(e) => handleResultChange(student.id, 'attendance', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-center border border-[#392e4e] rounded bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none"
                          />
                        ) : (
                          <span className="text-white/80">{getResultValue(student.id, 'attendance')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {viewMode === 'input' ? (
                          <input
                            type="number"
                            min="0"
                            max="5"
                            value={getResultValue(student.id, 'assignment') || ''}
                            onChange={(e) => handleResultChange(student.id, 'assignment', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-center border border-[#392e4e] rounded bg-[#060010] text-white focus:border-[#8400ff] focus:outline-none"
                          />
                        ) : (
                          <span className="text-white/80">{getResultValue(student.id, 'assignment')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-bold" style={{ color }}>
                        {total}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          className="px-2.5 py-1 rounded-full text-xs font-bold"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          {grade}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {viewMode === 'input' && (
            <div className="p-4 border-t border-[#392e4e] flex justify-end gap-3">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-5 py-2.5 rounded-full border border-[#392e4e] text-white/70 hover:bg-white/5 transition-colors"
              >
                Reset
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-2.5 bg-gradient-to-r from-[#8400ff] to-[#a855f7] text-white rounded-full hover:shadow-lg hover:shadow-[#8400ff]/25 transition-all"
              >
                Save Results
              </motion.button>
            </div>
          )}
        </SpotlightCard>
      </motion.div>
    </div>
  );
}
