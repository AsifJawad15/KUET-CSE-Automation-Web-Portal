"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Trash2, X, Lock, AlertTriangle, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { DAYS, PERIODS, BREAK_AFTER_PERIOD } from './constants';
import { getSlotColorLight, timeToMinutes } from './helpers';
import { updateDraftSlot, validateDraftSlot } from '@/services/routineGeneratorService';

interface DraftSlot {
  id: string;
  draft_id: string;
  course_offering_id: string | null;
  course_id: string;
  teacher_user_id: string;
  room_number: string;
  day_of_week: number;
  start_period: number;
  end_period: number;
  start_time: string | null;
  end_time: string | null;
  year: number;
  term: number;
  section: string;
  group_name: string | null;
  course_type: string;
  is_lab: boolean;
  is_combined: boolean;
  is_locked: boolean;
  conflict_status: 'valid' | 'warning' | 'conflict';
  conflict_reasons: string[];
  course_offerings?: {
    id: string;
    term: string;
    session: string;
    batch: string | null;
    courses: { code: string; title: string; credit: number; course_type: string };
    teachers: { full_name: string; teacher_uid: string };
  };
}

// DisplaySlot structure localized for Draft Grid
interface DraftDisplaySlot {
  id: string;
  slotIds: string[];
  day_of_week: number;
  start_period: number;
  end_period: number;
  start_time: string;
  end_time: string;
  section: string;
  room_number: string;
  course_code: string;
  course_title: string;
  course_type: string;
  teachers: { full_name: string; teacher_uid: string }[];
  isCombined: boolean;
  isLocked: boolean;
  conflict_status: 'valid' | 'warning' | 'conflict';
  conflict_reasons: string[];
  rawSlots: DraftSlot[];
}

interface SmartRoutineGridProps {
  draftId: string;
  draftSlots: DraftSlot[];
  lockedSlots: any[]; // other sections' locked slots
  rooms: { room_number: string; room_type: string | null }[];
  onRefresh: () => void;
  onSelectSlot: (slot: DraftDisplaySlot | null) => void;
}

export default function SmartRoutineGrid({
  draftId,
  draftSlots,
  lockedSlots,
  rooms,
  onRefresh,
  onSelectSlot,
}: SmartRoutineGridProps) {
  const [editingSlot, setEditingSlot] = useState<DraftDisplaySlot | null>(null);
  const [editFormData, setEditFormData] = useState({
    dayOfWeek: 0,
    startPeriod: 1,
    endPeriod: 1,
    roomNumber: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    hardConflicts: any[];
    softWarnings: any[];
  } | null>(null);
  const [validating, setValidating] = useState(false);

  // Group draftSlots into DraftDisplaySlots
  const displaySlots = useMemo(() => {
    const groupMap = new Map<string, DraftSlot[]>();

    for (const slot of draftSlots) {
      // Group by: course_id, group_name (lab groups A1/A2), day_of_week, start_period, room_number
      const key = `${slot.course_id}|${slot.group_name || 'whole'}|${slot.day_of_week}|${slot.start_period}|${slot.room_number}`;
      const list = groupMap.get(key) || [];
      list.push(slot);
      groupMap.set(key, list);
    }

    const result: DraftDisplaySlot[] = [];

    for (const [, group] of groupMap) {
      const primary = group[0];
      const teachers = group
        .map((s) => s.course_offerings?.teachers)
        .filter(Boolean) as { full_name: string; teacher_uid: string }[];

      // Deduplicate teachers
      const uniqueTeachers = Array.from(new Map(teachers.map((t) => [t.teacher_uid, t])).values());

      // Get combined reasons
      const allReasons = Array.from(new Set(group.flatMap((s) => s.conflict_reasons || [])));
      const worstStatus = group.some((s) => s.conflict_status === 'conflict')
        ? 'conflict'
        : group.some((s) => s.conflict_status === 'warning')
        ? 'warning'
        : 'valid';

      result.push({
        id: primary.id,
        slotIds: group.map((s) => s.id),
        day_of_week: primary.day_of_week,
        start_period: primary.start_period,
        end_period: primary.end_period,
        start_time: primary.start_time?.substring(0, 5) || '',
        end_time: primary.end_time?.substring(0, 5) || '',
        section: primary.section,
        room_number: primary.room_number,
        course_code: primary.course_offerings?.courses?.code || '',
        course_title: primary.course_offerings?.courses?.title || '',
        course_type: primary.course_type,
        teachers: uniqueTeachers,
        isCombined: primary.is_combined || uniqueTeachers.length > 1,
        isLocked: false,
        conflict_status: worstStatus,
        conflict_reasons: allReasons,
        rawSlots: group,
      });
    }

    // Add mapped locked slots as DraftDisplaySlots for visual blockages
    for (const locked of lockedSlots) {
      result.push({
        id: locked.id,
        slotIds: [locked.id],
        day_of_week: locked.dayOfWeek,
        start_period: locked.startPeriod,
        end_period: locked.endPeriod,
        start_time: locked.startTime || '',
        end_time: locked.endTime || '',
        section: locked.section || 'Other',
        room_number: locked.roomNumber,
        course_code: locked.courseCode,
        course_title: 'Other Section Batch Class',
        course_type: 'Theory',
        teachers: [{ full_name: locked.teacherName || 'Other', teacher_uid: 'locked' }],
        isCombined: false,
        isLocked: true,
        conflict_status: 'valid',
        conflict_reasons: [],
        rawSlots: [],
      });
    }

    return result;
  }, [draftSlots, lockedSlots]);

  const getSlotsForCell = (dayValue: number, period: (typeof PERIODS)[0]): DraftDisplaySlot[] => {
    return displaySlots.filter(
      (s) =>
        s.day_of_week === dayValue &&
        s.start_period <= period.id &&
        s.end_period >= period.id
    );
  };

  const isCellCovered = (dayValue: number, periodIndex: number): boolean => {
    for (let i = periodIndex - 1; i >= 0; i--) {
      const slots = getSlotsForCell(dayValue, PERIODS[i]);
      if (slots.length > 0) {
        // Find if any slot spans over current periodIndex
        const maxEnd = Math.max(...slots.map((s) => s.end_period));
        if (maxEnd > PERIODS[periodIndex].id) return true;
      }
    }
    return false;
  };

  // Open edit modal
  const handleEditClick = (slot: DraftDisplaySlot) => {
    if (slot.isLocked) return; // Cannot edit locked slots from other sections
    setEditingSlot(slot);
    setEditFormData({
      dayOfWeek: slot.day_of_week,
      startPeriod: slot.start_period,
      endPeriod: slot.end_period,
      roomNumber: slot.room_number,
    });
    setValidationResult(null);
  };

  // Validate manual edit in real-time
  useEffect(() => {
    if (!editingSlot) return;

    const timer = setTimeout(async () => {
      setValidating(true);
      try {
        const res = await validateDraftSlot(draftId, {
          activityId: editingSlot.rawSlots[0]?.course_id + '-' + (editingSlot.rawSlots[0]?.group_name || 'whole'), // mapping logic
          dayOfWeek: Number(editFormData.dayOfWeek),
          startPeriod: Number(editFormData.startPeriod),
          endPeriod: Number(editFormData.endPeriod),
          roomNumber: editFormData.roomNumber,
        });

        if (res.success && res.data) {
          setValidationResult(res.data);
        }
      } catch (err) {
        console.error('Validation fetch error:', err);
      } finally {
        setValidating(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [editFormData, editingSlot, draftId]);

  const handleSaveChanges = async () => {
    if (!editingSlot) return;
    setSubmitting(true);
    try {
      const res = await updateDraftSlot(
        draftId,
        editingSlot.slotIds,
        Number(editFormData.dayOfWeek),
        Number(editFormData.startPeriod),
        Number(editFormData.endPeriod),
        editFormData.roomNumber
      );

      if (res.success) {
        setEditingSlot(null);
        onRefresh();
      } else {
        alert(res.error || 'Failed to update slot');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const getCellBorderColor = (slot: DraftDisplaySlot) => {
    if (slot.isLocked) return 'border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed';
    if (slot.conflict_status === 'conflict') return 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400';
    if (slot.conflict_status === 'warning') return 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400';
    // Generated / valid slot
    return 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300';
  };

  return (
    <>
      <div className="overflow-x-auto border border-gray-200 dark:border-[#3d4951] rounded-lg">
        <table className="w-full border-collapse min-w-[850px]">
          <thead>
            <tr>
              <th className="px-2 py-2 border border-gray-200 bg-slate-800 text-white text-[11px] font-semibold w-20 sticky left-0 z-10">
                DAY / PERIOD
              </th>
              {PERIODS.map((p) => (
                <React.Fragment key={`period-header-${p.id}`}>
                  <th className="px-1 py-2 border border-gray-200 bg-slate-800 text-white text-[11px] font-semibold min-w-[95px]">
                    <div>{p.id}</div>
                    <div className="text-[8px] font-normal text-gray-400 mt-0.5">
                      {p.label}
                    </div>
                  </th>
                  {BREAK_AFTER_PERIOD.includes(p.id) && (
                    <th className="px-0.5 py-1 border border-gray-200 bg-gray-50 dark:bg-white/[0.02] text-gray-400 text-[8px] font-medium w-6">
                      <div className="whitespace-nowrap">
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
                <td className="px-2 py-3 border border-gray-200 bg-gray-50 dark:bg-white/[0.02] text-gray-900 dark:text-zinc-300 font-semibold text-xs text-center sticky left-0 z-10">
                  {day.label}
                </td>

                {PERIODS.map((period, periodIndex) => {
                  if (isCellCovered(day.value, periodIndex)) {
                    return (
                      <React.Fragment key={`covered-${day.value}-${period.id}`}>
                        {BREAK_AFTER_PERIOD.includes(period.id) && (
                          <td className="border border-gray-200 bg-gray-50 dark:bg-white/[0.01]" />
                        )}
                      </React.Fragment>
                    );
                  }

                  const slots = getSlotsForCell(day.value, period);
                  const hasSlots = slots.length > 0;
                  // Span corresponds to the maximum duration of the slots in this cell
                  const maxSpan = hasSlots
                    ? Math.max(...slots.map((s) => s.end_period - s.start_period + 1))
                    : 1;

                  return (
                    <React.Fragment key={`cell-${day.value}-${period.id}`}>
                      <td
                        colSpan={maxSpan}
                        className={`border border-gray-200 dark:border-[#3d4951] p-1 text-center align-top relative ${
                          hasSlots ? '' : 'bg-white dark:bg-[#0b090a]'
                        }`}
                      >
                        {hasSlots && (
                          <div className="flex flex-col gap-1">
                            {slots.map((slot) => (
                              <div
                                key={slot.id}
                                onClick={() => {
                                  handleEditClick(slot);
                                  onSelectSlot(slot);
                                }}
                                className={`rounded p-1.5 border text-[10px] cursor-pointer relative group transition-all ${getCellBorderColor(
                                  slot
                                )}`}
                              >
                                <div className="flex items-center justify-between font-bold text-[10px]">
                                  <span>{slot.course_code}</span>
                                  {slot.isLocked ? (
                                    <Lock className="w-2.5 h-2.5 text-gray-400" />
                                  ) : slot.conflict_status === 'conflict' ? (
                                    <AlertTriangle className="w-3 h-3 text-red-500" />
                                  ) : slot.conflict_status === 'warning' ? (
                                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                                  ) : null}
                                </div>
                                <div className="text-[9px] mt-0.5 truncate">
                                  {slot.teachers[0]?.full_name || 'No Teacher'}
                                </div>
                                <div className="text-[8px] text-gray-400 mt-0.5">
                                  Room {slot.room_number} {slot.rawSlots[0]?.group_name ? `(${slot.rawSlots[0].group_name})` : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      {BREAK_AFTER_PERIOD.includes(period.id) && (
                        <td className="border border-gray-200 bg-gray-50 dark:bg-white/[0.01]" />
                      )}
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Manual Rescheduling Modal */}
      {editingSlot && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setEditingSlot(null)}>
          <div className="bg-white dark:bg-[#161a1d] border border-gray-200 dark:border-[#3d4951] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#3d4951]">
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">
                  Reschedule Slot: {editingSlot.course_code}
                </h3>
                <p className="text-[10px] text-gray-400">Rearrange assignment parameters manually.</p>
              </div>
              <button onClick={() => setEditingSlot(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-semibold text-gray-500 block mb-1">Day</span>
                  <select
                    value={editFormData.dayOfWeek}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, dayOfWeek: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-[#D9A299] focus:ring-2 focus:ring-[#D9A299]/30 dark:border-[#3d4951] dark:bg-[#0b090a] dark:text-white"
                  >
                    {DAYS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] font-semibold text-gray-500 block mb-1">Room</span>
                  <select
                    value={editFormData.roomNumber}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, roomNumber: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-[#D9A299] focus:ring-2 focus:ring-[#D9A299]/30 dark:border-[#3d4951] dark:bg-[#0b090a] dark:text-white"
                  >
                    <option value="">Select Room</option>
                    {rooms.map((r) => (
                      <option key={r.room_number} value={r.room_number}>
                        Room {r.room_number} ({r.room_type || 'theory'})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-semibold text-gray-500 block mb-1">Start Period</span>
                  <select
                    value={editFormData.startPeriod}
                    onChange={(e) => {
                      const start = Number(e.target.value);
                      const duration = editingSlot.end_period - editingSlot.start_period;
                      setEditFormData((prev) => ({
                        ...prev,
                        startPeriod: start,
                        endPeriod: start + duration,
                      }));
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-[#D9A299] focus:ring-2 focus:ring-[#D9A299]/30 dark:border-[#3d4951] dark:bg-[#0b090a] dark:text-white"
                  >
                    {PERIODS.map((p) => (
                      <option key={p.id} value={p.id}>Period {p.id} ({p.start})</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] font-semibold text-gray-500 block mb-1">End Period</span>
                  <select
                    value={editFormData.endPeriod}
                    disabled
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-[#D9A299] focus:ring-2 focus:ring-[#D9A299]/30 dark:border-[#3d4951] dark:bg-[#0b090a] dark:text-white opacity-60"
                  >
                    {PERIODS.map((p) => (
                      <option key={p.id} value={p.id}>Period {p.id} ({p.end})</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Real-time Conflict feedback in modal */}
              <div className="pt-2 border-t border-gray-100 dark:border-[#3d4951]/40">
                {validating ? (
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    <span>Validating conflicts...</span>
                  </div>
                ) : validationResult ? (
                  validationResult.isValid ? (
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs bg-green-500/10 p-2 rounded-lg border border-green-500/20">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>This slot placement is perfectly valid! No conflicts detected.</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs font-bold bg-red-500/10 p-2 rounded-t-lg border-x border-t border-red-500/20">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span>Hard conflicts detected ({validationResult.hardConflicts.length}):</span>
                      </div>
                      <div className="bg-red-500/5 p-2 rounded-b-lg border-x border-b border-red-500/15 max-h-24 overflow-y-auto text-[10px] space-y-1 text-red-500 font-medium">
                        {validationResult.hardConflicts.map((c, i) => (
                          <div key={i} className="list-item ml-3">{c.reason}</div>
                        ))}
                      </div>
                    </div>
                  )
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-50 dark:bg-white/[0.01] border-t border-gray-100 dark:border-[#3d4951]">
              <button
                onClick={() => setEditingSlot(null)}
                className="px-4 py-2 border border-gray-200 dark:border-[#3d4951] text-gray-700 dark:text-[#d3d3d3] rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-semibold disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Apply Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
