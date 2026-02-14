"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { DisplaySlot } from '@/modules/ClassRoutine/types';
import { formatCombinedTeacherNames, slotMatchesPeriod } from '@/modules/ClassRoutine/helpers';
import { PERIODS } from '@/modules/ClassRoutine/constants';
import { Loader2, Trash2 } from 'lucide-react';

const DAY_MAP: Record<number, string> = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday' };

function getTermFromCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  return digits.length >= 2 ? `${digits[0]}-${digits[1]}` : '';
}

interface Props {
  slots: DisplaySlot[];
  deleting: string | null;
  onDelete: (ids: string[]) => void;
}

export default function ScheduleTableView({ slots, deleting, onDelete }: Props) {
  // Group slots by period
  const slotsByPeriod = PERIODS.map(period => ({
    period,
    slots: slots
      .filter(s => slotMatchesPeriod(s, period))
      .sort((a, b) => a.day_of_week - b.day_of_week || a.course_code.localeCompare(b.course_code)),
  }));

  return (
    <div className="space-y-4">
      {slotsByPeriod.map(({ period, slots: periodSlots }, idx) => (
        <SpotlightCard
          key={period.id}
          className="rounded-xl border border-[#DCC5B2] dark:border-[#392e4e] overflow-hidden bg-[#FAF7F3] dark:bg-transparent"
          spotlightColor="rgba(217, 162, 153, 0.2)"
        >
          {/* Period Header */}
          <div className="bg-[#F0E4D3] dark:bg-white/5 px-5 py-3 flex items-center gap-3">
            <span className="text-sm font-bold text-[#D9A299] dark:text-[#8400ff] min-w-[24px]">{idx + 1}.</span>
            <span className="text-sm font-semibold text-[#5D4E37] dark:text-white">
              {period.label}
            </span>
            <span className="text-xs text-[#8B7355] dark:text-white/40 ml-auto">
              {periodSlots.length} class{periodSlots.length !== 1 ? 'es' : ''}
            </span>
          </div>

          {periodSlots.length === 0 ? (
            <div className="px-5 py-4 text-sm text-[#8B7355] dark:text-white/30 italic">No classes</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#DCC5B2] dark:border-[#392e4e]">
                    <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#8B7355] dark:text-white/40 uppercase">Day</th>
                    <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#8B7355] dark:text-white/40 uppercase">Term</th>
                    <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#8B7355] dark:text-white/40 uppercase">Course</th>
                    <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#8B7355] dark:text-white/40 uppercase">Teacher(s)</th>
                    <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#8B7355] dark:text-white/40 uppercase">Room</th>
                    <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#8B7355] dark:text-white/40 uppercase">Section</th>
                    <th className="px-5 py-2 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCC5B2]/50 dark:divide-[#392e4e]/50">
                  {periodSlots.map(slot => (
                    <tr key={slot.id} className="hover:bg-[#F0E4D3]/60 dark:hover:bg-white/5 transition-colors">
                      <td className="px-5 py-2.5 text-sm font-medium text-[#5D4E37] dark:text-white">
                        {DAY_MAP[slot.day_of_week]}
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="px-2 py-0.5 bg-[#F0E4D3] dark:bg-white/10 text-[#5D4E37] dark:text-white/70 rounded text-xs font-medium">
                          {getTermFromCode(slot.course_code)}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-sm text-[#5D4E37] dark:text-white">{slot.course_code}</span>
                        <p className="text-xs text-[#8B7355] dark:text-white/50">{slot.course_title}</p>
                      </td>
                      <td className="px-5 py-2.5 text-sm text-[#5D4E37] dark:text-white/70">
                        {formatCombinedTeacherNames(slot.teachers)}
                        {slot.isCombined && (
                          <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">Combined</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-sm text-[#8B7355] dark:text-white/60">{slot.room_number}</td>
                      <td className="px-5 py-2.5">
                        {slot.section && (
                          <span className="px-2 py-0.5 bg-[#D9A299]/30 text-[#5D4E37] border border-[#D9A299]/50 dark:bg-[#00e5ff]/20 dark:text-[#00e5ff] dark:border-[#00e5ff]/30 rounded text-xs">
                            {slot.section}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => onDelete(slot.slotIds)}
                          disabled={deleting === slot.id}
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === slot.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SpotlightCard>
      ))}
    </div>
  );
}
