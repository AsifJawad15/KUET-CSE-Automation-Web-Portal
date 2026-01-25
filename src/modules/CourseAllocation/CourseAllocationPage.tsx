"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { sampleCourses, sampleFaculty } from '@/data/sampleData';
import { Course } from '@/types';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function CourseAllocationPage() {
  const [courses, setCourses] = useState<Course[]>(sampleCourses);
  const [showForm, setShowForm] = useState(false);
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredCourses = courses.filter(c => {
    const matchesYear = filterYear === 'all' || c.year.toString() === filterYear;
    const matchesType = filterType === 'all' || c.type === filterType;
    return matchesYear && matchesType;
  });

  const getTeacherNames = (teacherIds: string[]) => {
    return teacherIds.map(id => {
      const teacher = sampleFaculty.find(f => f.id === id);
      return teacher?.name || id;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Course Allocation</h1>
          <p className="text-white/60 mt-1">Assign courses to faculty members</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-[#8400ff] to-[#a855f7] text-white rounded-lg hover:from-[#9933ff] hover:to-[#b366ff] transition-all flex items-center gap-2 shadow-lg shadow-[#8400ff]/25"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Course
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="px-4 py-2 border border-[#392e4e] rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-[#8400ff] focus:border-transparent"
        >
          <option value="all" className="bg-[#0d0d1a]">All Years</option>
          <option value="1" className="bg-[#0d0d1a]">1st Year</option>
          <option value="2" className="bg-[#0d0d1a]">2nd Year</option>
          <option value="3" className="bg-[#0d0d1a]">3rd Year</option>
          <option value="4" className="bg-[#0d0d1a]">4th Year</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-[#392e4e] rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-[#8400ff] focus:border-transparent"
        >
          <option value="all" className="bg-[#0d0d1a]">All Types</option>
          <option value="theory" className="bg-[#0d0d1a]">Theory</option>
          <option value="lab" className="bg-[#0d0d1a]">Lab/Sessional</option>
        </select>
      </div>

      {/* Courses Table */}
      <SpotlightCard className="rounded-xl border border-[#392e4e] overflow-hidden" spotlightColor="rgba(132, 0, 255, 0.1)">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Title</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Credits</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Year-Term</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Teachers</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Sections/Groups</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#392e4e]">
              {filteredCourses.map((course) => (
                <tr key={course.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-medium text-white">{course.code}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-white">{course.title}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      course.type === 'theory' 
                        ? 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30' 
                        : 'bg-[#8400ff]/20 text-[#a855f7] border border-[#8400ff]/30'
                    }`}>
                      {course.type === 'theory' ? 'Theory' : 'Lab'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white/60">
                    {course.credits}
                  </td>
                  <td className="px-6 py-4 text-white/60">
                    {course.year}-{course.term}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {getTeacherNames(course.teachers).map((name, idx) => (
                        <span key={idx} className="text-sm text-white/70">{name}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(course.sections || course.groups || []).map((item) => (
                        <span
                          key={item}
                          className="px-2 py-0.5 bg-white/5 text-white/60 rounded text-xs border border-[#392e4e]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-[#00e5ff] hover:bg-[#00e5ff]/10 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SpotlightCard>
    </div>
  );
}
