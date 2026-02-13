"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { DAYS, PERIODS, BREAK_AFTER_PERIOD } from './constants';
import { DisplaySlot } from './types';
import {
  formatCombinedTeacherInitials,
  getSlotColor,
  getSlotColorLight,
  slotMatchesPeriod,
  getSlotSpan,
} from './helpers';

interface RoutineGridProps {
  displaySlots: DisplaySlot[];
  onDeleteSlot: (slotIds: string[]) => void;
}

export default function RoutineGrid({ displaySlots, onDeleteSlot }: RoutineGridProps) {
  /**
   * Find the DisplaySlot starting at this day+period.
   */
  const getSlotForCell = (
    dayValue: number,
    period: (typeof PERIODS)[0]
  ): DisplaySlot | null => {
    return (
      displaySlots.find(
        (s) => s.day_of_week === dayValue && slotMatchesPeriod(s, period)
      ) || null
    );
  };

  /**
   * Check if a cell is covered by a multi-span slot from an earlier period.
   */
  const isCellCovered = (dayValue: number, periodIndex: number): boolean => {
    for (let i = periodIndex - 1; i >= 0; i--) {
      const slot = getSlotForCell(dayValue, PERIODS[i]);
      if (slot) {
        const span = getSlotSpan(slot);
        if (i + span > periodIndex) return true;
        break;
      }
    }
    return false;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[900px]">
        {/* Header row: period numbers + time labels */}
        <thead>
          <tr>
            <th className="p-2 border border-[#DCC5B2] dark:border-[#392e4e] bg-[#F0E4D3] dark:bg-white/5 text-[#5D4E37] dark:text-white/70 text-xs font-semibold w-24 sticky left-0 z-10">
              Day / Period
            </th>
            {PERIODS.map((p) => (
              <React.Fragment key={`period-header-${p.id}`}>
                <th className="p-2 border border-[#DCC5B2] dark:border-[#392e4e] bg-[#F0E4D3] dark:bg-white/5 text-[#5D4E37] dark:text-white/70 text-xs font-semibold min-w-[110px]">
                  <div>{p.id}</div>
                  <div className="text-[10px] font-normal text-[#8B7355] dark:text-white/40 mt-0.5">
                    {p.label}
                  </div>
                </th>
                {BREAK_AFTER_PERIOD.includes(p.id) && (
                  <th className="p-1 border border-[#DCC5B2] dark:border-[#392e4e] bg-amber-50 dark:bg-amber-500/5 text-amber-600 dark:text-amber-400 text-[10px] font-medium w-8 writing-mode-vertical">
                    <div className="rotate-0 whitespace-nowrap">
                      B<br />R<br />E<br />A<br />K
                    </div>
                  </th>
                )}
              </React.Fragment>
            ))}
          </tr>
        </thead>

        <tbody>
          {DAYS.map((day) => (
            <tr key={day.value}>
              {/* Day name cell */}
              <td className="p-2 border border-[#DCC5B2] dark:border-[#392e4e] bg-[#F0E4D3] dark:bg-white/5 text-[#5D4E37] dark:text-white font-semibold text-sm text-center sticky left-0 z-10">
                {day.label}
              </td>

              {/* Period cells */}
              {PERIODS.map((period, periodIndex) => {
                // Skip if covered by a multi-span slot
                if (isCellCovered(day.value, periodIndex)) {
                  return (
                    <React.Fragment key={`covered-${day.value}-${period.id}`}>
                      {BREAK_AFTER_PERIOD.includes(period.id) && (
                        <td className="border border-[#DCC5B2] dark:border-[#392e4e] bg-amber-50 dark:bg-amber-500/5" />
                      )}
                    </React.Fragment>
                  );
                }

                const slot = getSlotForCell(day.value, period);
                const span = slot ? getSlotSpan(slot) : 1;

                return (
                  <React.Fragment key={`cell-${day.value}-${period.id}`}>
                    <td
                      colSpan={span}
                      className={`border border-[#DCC5B2] dark:border-[#392e4e] p-1 text-center align-top ${
                        slot
                          ? ''
                          : 'bg-[#FAF7F3] dark:bg-transparent hover:bg-[#F0E4D3] dark:hover:bg-white/5'
                      }`}
                    >
                      {slot && (
                        <SlotCell
                          slot={slot}
                          onDelete={() => onDeleteSlot(slot.slotIds)}
                        />
                      )}
                    </td>
                    {BREAK_AFTER_PERIOD.includes(period.id) && (
                      <td className="border border-[#DCC5B2] dark:border-[#392e4e] bg-amber-50 dark:bg-amber-500/5" />
                    )}
                  </React.Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// Sub-component: Individual slot cell
// ==========================================
interface SlotCellProps {
  slot: DisplaySlot;
  onDelete: () => void;
}

function SlotCell({ slot, onDelete }: SlotCellProps) {
  const teacherInitials = formatCombinedTeacherInitials(slot.teachers);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative group rounded-lg p-2 border text-xs h-full ${getSlotColor(
        slot.course_type
      )} dark:${getSlotColor(slot.course_type)} ${getSlotColorLight(
        slot.course_type
      )} dark:bg-transparent`}
    >
      {/* Course code */}
      <div className="font-bold text-[11px] text-[#5D4E37] dark:text-white">
        {slot.course_code}
      </div>

      {/* Teacher initials — shows "WIS & DMH" for combined */}
      <div className="text-[10px] text-[#8B7355] dark:text-white/50 mt-0.5">
        ({teacherInitials})
      </div>

      {/* Room number */}
      <div className="text-[9px] text-[#8B7355] dark:text-white/40 mt-0.5">
        {slot.room_number}
      </div>

      {/* Combined badge */}
      {slot.isCombined && (
        <div className="text-[8px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
          Combined
        </div>
      )}

      {/* Delete button on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete slot"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </motion.div>
  );
}
