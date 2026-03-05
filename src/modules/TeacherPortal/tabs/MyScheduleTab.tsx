"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { getMySchedule, type TeacherScheduleSlot } from '@/services/teacherPortalService';
import { Loader2, CalendarDays } from 'lucide-react';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] as const;

const dayColors = [
  'border-l-purple-500',
  'border-l-blue-500',
  'border-l-emerald-500',
  'border-l-amber-500',
  'border-l-red-500',
  'border-l-pink-500',
];

export default function MyScheduleTab() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<TeacherScheduleSlot[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSchedule = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const data = await getMySchedule(user.id);
    setSlots(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  // Group by day
  const byDay = DAYS.map((dayName, dayIndex) => ({
    dayName,
    dayIndex,
    slots: slots
      .filter(s => s.day_of_week === dayIndex)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  })).filter(d => d.slots.length > 0);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#8B7355] dark:text-[#b1a7a6]" />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-8 text-center">
        <CalendarDays className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
        <p className="text-[#8B7355] dark:text-[#b1a7a6]">No schedule found. Schedule slots will appear here once assigned.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {byDay.map(({ dayName, dayIndex, slots: daySlots }) => (
        <div key={dayName} className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 overflow-hidden">
          <div className="px-4 py-3 bg-[#F5EDE4] dark:bg-[#0b090a] border-b border-[#E8DDD1] dark:border-[#3d4951]/50">
            <h3 className="font-semibold text-[#2C1810] dark:text-white">{dayName}</h3>
          </div>
          <div className="divide-y divide-[#E8DDD1] dark:divide-[#3d4951]/50">
            {daySlots.map((slot) => (
              <div key={slot.id} className={`px-4 py-3 border-l-4 ${dayColors[dayIndex % dayColors.length]}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-[#2C1810] dark:text-white">{slot.course_code}</span>
                    <span className="text-sm text-[#6B5744] dark:text-[#b1a7a6] ml-2">— {slot.course_title}</span>
                  </div>
                  <div className="text-sm text-[#5D4037] dark:text-[#e5383b] font-medium">
                    {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                  </div>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-[#8B7355] dark:text-[#b1a7a6]">
                  <span>Room: {slot.room_number}</span>
                  {slot.section && <span>Section: {slot.section}</span>}
                  {slot.term && <span>Term: {slot.term}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
