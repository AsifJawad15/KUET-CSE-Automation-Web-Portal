"use client";

import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

// ==========================================
// Constants
// ==========================================
const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
];

const PERIODS = [
  { id: 1, start: '08:00', end: '08:50', label: '08:00-08:50' },
  { id: 2, start: '08:50', end: '09:40', label: '08:50-09:40' },
  { id: 3, start: '09:40', end: '10:30', label: '09:40-10:30' },
  { id: 4, start: '10:40', end: '11:30', label: '10:40-11:30' },
  { id: 5, start: '11:30', end: '12:20', label: '11:30-12:20' },
  { id: 6, start: '12:20', end: '13:10', label: '12:20-01:10' },
  { id: 7, start: '14:30', end: '15:20', label: '02:30-03:20' },
  { id: 8, start: '15:20', end: '16:10', label: '03:20-04:10' },
  { id: 9, start: '16:10', end: '17:00', label: '04:10-05:00' },
];

// ==========================================
// Types
// ==========================================
interface CourseOffering {
  id: string;
  course_id: string;
  teacher_user_id: string;
  term: string;
  session: string;
  courses: { code: string; title: string } | null;
  teachers: { full_name: string; teacher_uid?: string } | null;
}

interface Room {
  room_number: string;
  room_type: string | null;
  is_active: boolean;
}

// Unique course derived from offerings
interface UniqueCourse {
  course_id: string;
  code: string;
  title: string;
}

// Teacher option for a selected course
interface TeacherOption {
  offering_id: string;
  name: string;
  type: 'single'; // individual teacher
}

export interface AddSlotPayload {
  offering_id: string;
  room_number: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  section: string;
}

interface AddRoutineSlotProps {
  show: boolean;
  onClose: () => void;
  onSave: (data: AddSlotPayload) => Promise<void>;
  term: string;
  session: string;
  section: string;
}

// ==========================================
// Helper: derive term from course code
// ==========================================
function getTermFromCode(code: string): string | null {
  const digits = code.replace(/\D/g, '');
  if (digits.length < 2) return null;
  return `${digits[0]}-${digits[1]}`;
}

// ==========================================
// Component
// ==========================================
export default function AddRoutineSlot({ show, onClose, onSave, term, session, section }: AddRoutineSlotProps) {
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState(''); // offering_id or 'combined'
  const [formData, setFormData] = useState({
    room_number: '',
    day_of_week: 0,
    period_start: 0,
    period_end: 0,
  });

  // Fetch offerings & rooms when modal opens
  const fetchData = useCallback(async () => {
    setLoadingData(true);
    setFetchError(null);
    try {
      const [offeringsRes, roomsRes] = await Promise.all([
        fetch('/api/course-offerings'),
        fetch('/api/rooms'),
      ]);

      if (!offeringsRes.ok) throw new Error('Failed to fetch course offerings');
      if (!roomsRes.ok) throw new Error('Failed to fetch rooms');

      const allOfferings: CourseOffering[] = await offeringsRes.json();
      const allRooms: Room[] = await roomsRes.json();

      // Filter by term derived from course code
      const filtered = Array.isArray(allOfferings)
        ? allOfferings.filter(o => getTermFromCode(o.courses?.code || '') === term)
        : [];

      setOfferings(filtered);
      setRooms(Array.isArray(allRooms) ? allRooms.filter(r => r.is_active) : []);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load data');
    } finally {
      setLoadingData(false);
    }
  }, [term]);

  useEffect(() => {
    if (show) {
      fetchData();
      setSelectedCourseId('');
      setSelectedTeacher('');
      setFormData({ room_number: '', day_of_week: 0, period_start: 0, period_end: 0 });
    }
  }, [show, fetchData]);

  // Derive unique courses from offerings
  const uniqueCourses = useMemo<UniqueCourse[]>(() => {
    const map = new Map<string, UniqueCourse>();
    for (const o of offerings) {
      if (o.courses && !map.has(o.course_id)) {
        map.set(o.course_id, {
          course_id: o.course_id,
          code: o.courses.code,
          title: o.courses.title,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [offerings]);

  // Get teacher options for the selected course
  const teacherOptions = useMemo(() => {
    if (!selectedCourseId) return [];
    const courseOfferings = offerings.filter(o => o.course_id === selectedCourseId);
    const teachers: TeacherOption[] = courseOfferings.map(o => ({
      offering_id: o.id,
      name: o.teachers?.full_name || 'Unknown',
      type: 'single' as const,
    }));
    return teachers;
  }, [selectedCourseId, offerings]);

  // Whether to show "Combined" option (when exactly 2 teachers)
  const showCombined = teacherOptions.length === 2;

  // Reset teacher when course changes
  useEffect(() => {
    setSelectedTeacher('');
  }, [selectedCourseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startPeriod = PERIODS[formData.period_start];
    const endPeriod = PERIODS[formData.period_end];
    if (!startPeriod || !endPeriod || !formData.room_number) return;

    const payload = {
      room_number: formData.room_number,
      day_of_week: formData.day_of_week,
      start_time: startPeriod.start + ':00',
      end_time: endPeriod.end + ':00',
      section,
    };

    setSubmitting(true);
    try {
      if (selectedTeacher === 'combined') {
        // Add a slot for each teacher (both at the same time/room)
        for (const t of teacherOptions) {
          await onSave({ ...payload, offering_id: t.offering_id });
        }
      } else {
        await onSave({ ...payload, offering_id: selectedTeacher });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = selectedCourseId && selectedTeacher && formData.room_number;

  // Styles
  const selectClass =
    'w-full px-3 py-2.5 mt-1 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#161a1d] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-colors';
  const optionClass = 'bg-white dark:bg-[#161a1d] text-[#5D4E37] dark:text-white';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FAF7F3] dark:bg-[#161a1d] rounded-2xl p-6 w-full max-w-lg border border-[#DCC5B2] dark:border-[#3d4951] shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-[#5D4E37] dark:text-white">Add Routine Slot</h2>
              <button onClick={onClose} className="p-1.5 hover:bg-[#F0E4D3] dark:hover:bg-[#3d4951]/30 rounded-lg transition-colors">
                <X className="w-5 h-5 text-[#8B7355] dark:text-[#b1a7a6]" />
              </button>
            </div>

            {/* Loading */}
            {loadingData && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#D9A299] dark:text-[#ba181b]" />
                <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6]">Loading courses & rooms...</p>
              </div>
            )}

            {/* Error */}
            {fetchError && (
              <div className="flex flex-col items-center py-8 gap-3 text-center">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-red-400 text-sm">{fetchError}</p>
                <button
                  onClick={fetchData}
                  className="px-4 py-2 text-sm bg-[#D9A299] dark:bg-[#ba181b] text-white rounded-lg hover:opacity-90 transition"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Form */}
            {!loadingData && !fetchError && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Course */}
                <div>
                  <label className="text-sm font-medium text-[#8B7355] dark:text-[#b1a7a6]">Course</label>
                  {uniqueCourses.length === 0 ? (
                    <div className="mt-1 p-3 border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        No courses found for Term {term}.
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                        Go to Course Allocation to assign courses first.
                      </p>
                    </div>
                  ) : (
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      required
                      className={selectClass}
                    >
                      <option value="" className={optionClass}>Select a course...</option>
                      {uniqueCourses.map(c => (
                        <option key={c.course_id} value={c.course_id} className={optionClass}>
                          {c.code} – {c.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Teacher */}
                {selectedCourseId && (
                  <div>
                    <label className="text-sm font-medium text-[#8B7355] dark:text-[#b1a7a6]">Teacher</label>
                    {teacherOptions.length === 0 ? (
                      <div className="mt-1 p-3 border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                          No teacher assigned to this course.
                        </p>
                      </div>
                    ) : (
                      <select
                        value={selectedTeacher}
                        onChange={(e) => setSelectedTeacher(e.target.value)}
                        required
                        className={selectClass}
                      >
                        <option value="" className={optionClass}>Select teacher...</option>
                        {teacherOptions.map((t, i) => (
                          <option key={t.offering_id} value={t.offering_id} className={optionClass}>
                            {t.name} (Teacher {i + 1})
                          </option>
                        ))}
                        {showCombined && (
                          <option value="combined" className={optionClass}>
                            Combined ({teacherOptions.map(t => t.name).join(' & ')})
                          </option>
                        )}
                      </select>
                    )}
                  </div>
                )}

                {/* Room */}
                <div>
                  <label className="text-sm font-medium text-[#8B7355] dark:text-[#b1a7a6]">Room</label>
                  {rooms.length === 0 ? (
                    <div className="mt-1 p-3 border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        No rooms available. Add rooms in Room Allocation first.
                      </p>
                    </div>
                  ) : (
                    <select
                      value={formData.room_number}
                      onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                      required
                      className={selectClass}
                    >
                      <option value="" className={optionClass}>Select a room...</option>
                      {rooms.map(r => (
                        <option key={r.room_number} value={r.room_number} className={optionClass}>
                          {r.room_number} ({r.room_type || 'General'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Day */}
                <div>
                  <label className="text-sm font-medium text-[#8B7355] dark:text-[#b1a7a6]">Day</label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                    className={selectClass}
                  >
                    {DAYS.map(d => (
                      <option key={d.value} value={d.value} className={optionClass}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Period Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#8B7355] dark:text-[#b1a7a6]">From Period</label>
                    <select
                      value={formData.period_start}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setFormData({ ...formData, period_start: v, period_end: Math.max(v, formData.period_end) });
                      }}
                      className={selectClass}
                    >
                      {PERIODS.map((p, i) => (
                        <option key={i} value={i} className={optionClass}>
                          P{p.id}: {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#8B7355] dark:text-[#b1a7a6]">To Period</label>
                    <select
                      value={formData.period_end}
                      onChange={(e) => setFormData({ ...formData, period_end: parseInt(e.target.value) })}
                      className={selectClass}
                    >
                      {PERIODS.filter((_, i) => i >= formData.period_start).map((p, i) => (
                        <option key={formData.period_start + i} value={formData.period_start + i} className={optionClass}>
                          P{p.id}: {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Info */}
                <div className="text-xs text-[#8B7355] dark:text-[#b1a7a6]/70 bg-[#F0E4D3] dark:bg-[#0b090a] rounded-lg p-3 border border-[#DCC5B2] dark:border-[#3d4951]">
                  Adding to: <span className="font-medium text-[#5D4E37] dark:text-white">Term {term}</span>
                  &nbsp;•&nbsp;Session: <span className="font-medium text-[#5D4E37] dark:text-white">{session}</span>
                  &nbsp;•&nbsp;Section: <span className="font-medium text-[#5D4E37] dark:text-white">{section}</span>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className="w-full py-2.5 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Slot'
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
