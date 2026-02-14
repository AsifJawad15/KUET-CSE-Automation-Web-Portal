"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { DisplaySlot } from '@/modules/ClassRoutine/types';
import { formatCombinedTeacherInitials, slotMatchesPeriod } from '@/modules/ClassRoutine/helpers';
import { PERIODS } from '@/modules/ClassRoutine/constants';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const DAY_MAP: Record<number, string> = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday' };

function getTermFromCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  return digits.length >= 2 ? `${digits[0]}-${digits[1]}` : '';
}

interface Props {
  slots: DisplaySlot[];
}

export default function ScheduleGridView({ slots }: Props) {
  const getScheduleForCell = (dayName: string, period: typeof PERIODS[number]): DisplaySlot[] => {
    const dayIndex = Object.entries(DAY_MAP).find(([, v]) => v === dayName)?.[0];
    if (dayIndex === undefined) return [];
    return slots.filter(s => s.day_of_week === Number(dayIndex) && slotMatchesPeriod(s, period));
  };

  return (
    <SpotlightCard
      className="rounded-xl border border-[#DCC5B2] dark:border-[#392e4e] overflow-hidden bg-[#FAF7F3] dark:bg-transparent"
      spotlightColor="rgba(217, 162, 153, 0.2)"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[#F0E4D3] dark:bg-white/5">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase w-28">Time</th>
              {DAY_NAMES.map(day => (
                <th key={day} className="px-3 py-3 text-center text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCC5B2] dark:divide-[#392e4e]">
            {PERIODS.map(period => (
              <tr key={period.id}>
                <td className="px-3 py-2 text-xs font-medium text-[#8B7355] dark:text-white/60 border-r border-[#DCC5B2] dark:border-[#392e4e] whitespace-nowrap">
                  {period.label}
                </td>
                {DAY_NAMES.map(day => {
                  const cellSlots = getScheduleForCell(day, period);
                  return (
                    <td key={`${day}-${period.id}`} className="px-2 py-2 border-r border-[#DCC5B2] dark:border-[#392e4e] align-top min-w-[140px]">
                      {cellSlots.map(s => (
                        <div
                          key={s.id}
                          className="bg-[#D9A299]/20 dark:bg-[#8400ff]/20 text-[#5D4E37] dark:text-white rounded p-2 text-xs mb-1 last:mb-0 border border-[#D9A299]/30 dark:border-[#8400ff]/30"
                        >
                          <p className="font-semibold">{s.course_code}</p>
                          <p className="text-[10px] text-[#8B7355] dark:text-white/50">
                            ({formatCombinedTeacherInitials(s.teachers)})
                          </p>
                          <p className="text-[#D9A299] dark:text-[#00e5ff]">{s.room_number}</p>
                          {s.section && <p className="text-[#8B7355] dark:text-white/50">Sec {s.section}</p>}
                          <p className="text-[10px] text-[#8B7355]/70 dark:text-white/30 mt-0.5">T {getTermFromCode(s.course_code)}</p>
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
  );
}
