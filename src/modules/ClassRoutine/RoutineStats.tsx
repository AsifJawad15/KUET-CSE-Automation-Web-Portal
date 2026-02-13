"use client";

import React from 'react';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { DisplaySlot } from './types';

interface RoutineStatsProps {
  displaySlots: DisplaySlot[];
}

export default function RoutineStats({ displaySlots }: RoutineStatsProps) {
  const uniqueCourses = new Set(displaySlots.map((s) => s.course_code)).size;
  const uniqueRooms = new Set(displaySlots.map((s) => s.room_number)).size;

  // Gather all unique teacher UIDs across all display slots
  const teacherUids = new Set<string>();
  for (const slot of displaySlots) {
    for (const t of slot.teachers) {
      teacherUids.add(t.teacher_uid);
    }
  }
  const uniqueTeachers = teacherUids.size;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <SpotlightCard
        className="rounded-xl p-4 border border-[#DCC5B2] dark:border-[#392e4e]"
        spotlightColor="rgba(217, 162, 153, 0.2)"
      >
        <p className="text-sm text-[#8B7355] dark:text-white/50">Total Slots</p>
        <p className="text-2xl font-bold text-[#5D4E37] dark:text-white">{displaySlots.length}</p>
      </SpotlightCard>

      <SpotlightCard
        className="rounded-xl p-4 border border-[#DCC5B2] dark:border-[#392e4e]"
        spotlightColor="rgba(217, 162, 153, 0.2)"
      >
        <p className="text-sm text-[#8B7355] dark:text-white/50">Courses</p>
        <p className="text-2xl font-bold text-[#D9A299] dark:text-[#00e5ff]">{uniqueCourses}</p>
      </SpotlightCard>

      <SpotlightCard
        className="rounded-xl p-4 border border-[#DCC5B2] dark:border-[#392e4e]"
        spotlightColor="rgba(217, 162, 153, 0.2)"
      >
        <p className="text-sm text-[#8B7355] dark:text-white/50">Rooms Used</p>
        <p className="text-2xl font-bold text-[#D9A299] dark:text-[#8400ff]">{uniqueRooms}</p>
      </SpotlightCard>

      <SpotlightCard
        className="rounded-xl p-4 border border-[#DCC5B2] dark:border-[#392e4e]"
        spotlightColor="rgba(217, 162, 153, 0.2)"
      >
        <p className="text-sm text-[#8B7355] dark:text-white/50">Teachers</p>
        <p className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">{uniqueTeachers}</p>
      </SpotlightCard>
    </div>
  );
}
