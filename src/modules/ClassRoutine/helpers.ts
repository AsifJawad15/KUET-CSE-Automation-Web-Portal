// ==========================================
// Helper functions for ClassRoutine module
// ==========================================

import { DBRoutineSlotWithDetails } from '@/lib/supabase';
import { DisplaySlot, TeacherInfo } from './types';
import { PERIODS } from './constants';

/**
 * Extract teacher initials from full name.
 * e.g. "Dr. Wahid Ibn Sufian" → "WIS"
 */
export function getTeacherInitials(fullName: string): string {
  if (!fullName) return '??';
  const parts = fullName.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s*/i, '').trim().split(/\s+/);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('');
}

/**
 * Format multiple teacher initials for display.
 * e.g. ["Dr. Wahid Ibn Sufian", "Dr. Dulal Md Hossain"] → "WIS & DMH"
 */
export function formatCombinedTeacherInitials(teachers: TeacherInfo[]): string {
  if (teachers.length === 0) return '??';
  return teachers.map((t) => getTeacherInitials(t.full_name)).join(' & ');
}

/**
 * Format multiple teacher full names for display.
 * e.g. ["Dr. Wahid", "Dr. Dulal"] → "Dr. Wahid, Dr. Dulal"
 */
export function formatCombinedTeacherNames(teachers: TeacherInfo[]): string {
  if (teachers.length === 0) return 'Unknown';
  return teachers.map((t) => t.full_name).join(', ');
}

/**
 * Get dark-mode background color for a course type.
 */
export function getSlotColor(courseType: string): string {
  switch (courseType?.toLowerCase()) {
    case 'theory':
      return 'bg-blue-900/60 border-blue-500/40';
    case 'lab':
      return 'bg-green-900/60 border-green-500/40';
    case 'sessional':
      return 'bg-purple-900/60 border-purple-500/40';
    default:
      return 'bg-gray-800/60 border-gray-500/40';
  }
}

/**
 * Get light-mode background color for a course type.
 */
export function getSlotColorLight(courseType: string): string {
  switch (courseType?.toLowerCase()) {
    case 'theory':
      return 'bg-blue-100 border-blue-300';
    case 'lab':
      return 'bg-green-100 border-green-300';
    case 'sessional':
      return 'bg-purple-100 border-purple-300';
    default:
      return 'bg-gray-100 border-gray-300';
  }
}

/**
 * Convert "HH:MM" to minutes since midnight.
 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Check if a display slot's time range overlaps a given period.
 */
export function slotMatchesPeriod(
  slot: DisplaySlot,
  period: { start: string; end: string }
): boolean {
  const ss = timeToMinutes(slot.start_time);
  const se = timeToMinutes(slot.end_time);
  const ps = timeToMinutes(period.start);
  const pe = timeToMinutes(period.end);
  return ss < pe && se > ps;
}

/**
 * Get how many period columns a display slot spans.
 */
export function getSlotSpan(slot: DisplaySlot): number {
  const sm = timeToMinutes(slot.start_time);
  const em = timeToMinutes(slot.end_time);
  let span = 0;
  for (const p of PERIODS) {
    const ps = timeToMinutes(p.start);
    const pe = timeToMinutes(p.end);
    if (sm < pe && em > ps) span++;
  }
  return Math.max(span, 1);
}

/**
 * Generate a grouping key for identifying combined slots.
 * Slots with the same key are combined (same course, same day/time/room/section).
 */
function getGroupingKey(slot: DBRoutineSlotWithDetails): string {
  const courseCode = slot.course_offerings?.courses?.code || '';
  return `${courseCode}|${slot.day_of_week}|${slot.start_time}|${slot.end_time}|${slot.rooms?.room_number || ''}|${slot.section}`;
}

/**
 * Group raw DB slots into DisplaySlots.
 * Slots sharing the same course + day + time + room + section are merged
 * into a single DisplaySlot with multiple teachers.
 */
export function groupSlotsForDisplay(
  rawSlots: DBRoutineSlotWithDetails[]
): DisplaySlot[] {
  const groupMap = new Map<string, DBRoutineSlotWithDetails[]>();

  for (const slot of rawSlots) {
    const key = getGroupingKey(slot);
    const existing = groupMap.get(key);
    if (existing) {
      existing.push(slot);
    } else {
      groupMap.set(key, [slot]);
    }
  }

  const displaySlots: DisplaySlot[] = [];

  for (const [, group] of groupMap) {
    const primary = group[0];
    const teachers: TeacherInfo[] = [];
    const seenTeacherUids = new Set<string>();

    for (const slot of group) {
      const uid = slot.course_offerings?.teachers?.teacher_uid;
      const name = slot.course_offerings?.teachers?.full_name;
      if (uid && !seenTeacherUids.has(uid)) {
        seenTeacherUids.add(uid);
        teachers.push({ full_name: name || 'Unknown', teacher_uid: uid });
      }
    }

    displaySlots.push({
      id: primary.id,
      slotIds: group.map((s) => s.id),
      day_of_week: primary.day_of_week,
      start_time: primary.start_time,
      end_time: primary.end_time,
      section: primary.section || '',
      room_number: primary.rooms?.room_number || '',
      room_type: primary.rooms?.room_type || null,
      course_code: primary.course_offerings?.courses?.code || '',
      course_title: primary.course_offerings?.courses?.title || '',
      course_credit: primary.course_offerings?.courses?.credit || 0,
      course_type: primary.course_offerings?.courses?.course_type || '',
      offering_term: primary.course_offerings?.term || '',
      offering_session: primary.course_offerings?.session || '',
      teachers,
      isCombined: group.length > 1,
      rawSlots: group,
    });
  }

  return displaySlots;
}
