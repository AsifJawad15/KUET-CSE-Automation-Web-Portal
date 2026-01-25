"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { sampleSchedules } from '@/data/sampleData';
import { ClassSchedule } from '@/types';
import { motion } from 'framer-motion';
import { useState } from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<ClassSchedule[]>(sampleSchedules);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [filterDay, setFilterDay] = useState<string>('all');

  const filteredSchedules = filterDay === 'all' 
    ? schedules 
    : schedules.filter(s => s.day === filterDay);

  const getScheduleForSlot = (day: string, time: string) => {
    return schedules.filter(s => s.day === day && s.startTime === time);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Class Schedule</h1>
          <p className="text-white/60 mt-1">Manage class schedules and timetables</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 border border-[#392e4e] rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'table' 
                  ? 'bg-[#8400ff] text-white' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-[#8400ff] text-white' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Grid
            </button>
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
            Add Schedule
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterDay}
          onChange={(e) => setFilterDay(e.target.value)}
          className="px-4 py-2 border border-[#392e4e] rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-[#8400ff] focus:border-transparent"
        >
          <option value="all" className="bg-[#0d0d1a]">All Days</option>
          {DAYS.map(day => (
            <option key={day} value={day} className="bg-[#0d0d1a]">{day}</option>
          ))}
        </select>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <SpotlightCard className="rounded-xl border border-[#392e4e] overflow-hidden" spotlightColor="rgba(132, 0, 255, 0.1)">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Day</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Time</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Course</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Teacher</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Room</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Section/Group</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#392e4e]">
                {filteredSchedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-white">{schedule.day}</span>
                    </td>
                    <td className="px-6 py-4 text-white/60">
                      {schedule.startTime} - {schedule.endTime}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-medium text-white">{schedule.courseCode}</span>
                        <p className="text-sm text-white/50">{schedule.courseName}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {schedule.teacherName}
                    </td>
                    <td className="px-6 py-4 text-white/60">
                      {schedule.roomName}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30 rounded text-sm">
                        {schedule.section || schedule.group}
                      </span>
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
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <SpotlightCard className="rounded-xl border border-[#392e4e] overflow-hidden" spotlightColor="rgba(132, 0, 255, 0.1)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase w-20">Time</th>
                  {DAYS.slice(0, 5).map(day => (
                    <th key={day} className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#392e4e]">
                {TIME_SLOTS.map(time => (
                  <tr key={time}>
                    <td className="px-4 py-2 text-sm font-medium text-white/60 border-r border-[#392e4e]">
                      {time}
                    </td>
                    {DAYS.slice(0, 5).map(day => {
                      const slotSchedules = getScheduleForSlot(day, time);
                      return (
                        <td key={`${day}-${time}`} className="px-2 py-2 border-r border-[#392e4e] min-h-[60px]">
                          {slotSchedules.map(s => (
                            <div
                              key={s.id}
                              className="bg-[#8400ff]/20 text-white rounded p-2 text-xs mb-1 border border-[#8400ff]/30"
                            >
                              <p className="font-semibold">{s.courseCode}</p>
                              <p className="text-[#00e5ff]">{s.roomName}</p>
                              <p className="text-white/50">Sec {s.section || s.group}</p>
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SpotlightCard>
      )}
    </div>
  );
}
