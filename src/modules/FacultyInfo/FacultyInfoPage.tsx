"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { sampleFaculty } from '@/data/sampleData';
import { Designation, Faculty } from '@/types';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function FacultyInfoPage() {
  const [faculty, setFaculty] = useState<Faculty[]>(sampleFaculty);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDesignation, setFilterDesignation] = useState<string>('all');

  const filteredFaculty = faculty.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          f.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDesignation = filterDesignation === 'all' || f.designation === filterDesignation;
    return matchesSearch && matchesDesignation;
  });

  const getDesignationColor = (designation: Designation) => {
    switch (designation) {
      case 'Professor': return 'bg-[#8400ff]/20 text-[#a855f7] border border-[#8400ff]/30';
      case 'Associate Professor': return 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30';
      case 'Assistant Professor': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'Lecturer': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      default: return 'bg-white/10 text-white/70 border border-white/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Faculty Information</h1>
          <p className="text-white/60 mt-1">View and manage faculty members</p>
        </div>
        <div className="text-sm text-white/50">
          Total: {faculty.length} faculty members
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-[#392e4e] rounded-lg bg-white/5 text-white placeholder-white/40 focus:ring-2 focus:ring-[#8400ff] focus:border-transparent"
          />
        </div>
        <select
          value={filterDesignation}
          onChange={(e) => setFilterDesignation(e.target.value)}
          className="px-4 py-2 border border-[#392e4e] rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-[#8400ff] focus:border-transparent"
        >
          <option value="all" className="bg-[#0d0d1a]">All Designations</option>
          <option value="Professor" className="bg-[#0d0d1a]">Professor</option>
          <option value="Associate Professor" className="bg-[#0d0d1a]">Associate Professor</option>
          <option value="Assistant Professor" className="bg-[#0d0d1a]">Assistant Professor</option>
          <option value="Lecturer" className="bg-[#0d0d1a]">Lecturer</option>
        </select>
      </div>

      {/* Faculty Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFaculty.map((member, index) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <SpotlightCard className="rounded-xl p-5 border border-[#392e4e] h-full" spotlightColor="rgba(132, 0, 255, 0.15)">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8400ff] to-[#00e5ff] flex items-center justify-center text-white text-xl font-bold">
                  {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{member.name}</h3>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getDesignationColor(member.designation)}`}>
                    {member.designation}
                  </span>
                </div>
              </div>
              
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-white/60">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="truncate">{member.email}</span>
                </div>
                {member.phone && (
                  <div className="flex items-center gap-2 text-white/60">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>{member.phone}</span>
                  </div>
                )}
                {member.officeRoom && (
                  <div className="flex items-center gap-2 text-white/60">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>{member.officeRoom}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-white/60">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{member.experience} years experience</span>
                </div>
              </div>

              {member.assignedCourses.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#392e4e]">
                  <p className="text-xs text-white/40 mb-2">Assigned Courses:</p>
                  <div className="flex flex-wrap gap-1">
                    {member.assignedCourses.map((course) => (
                      <span
                        key={course}
                        className="px-2 py-0.5 bg-white/5 text-white/70 rounded text-xs border border-[#392e4e]"
                      >
                        {course}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </SpotlightCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
