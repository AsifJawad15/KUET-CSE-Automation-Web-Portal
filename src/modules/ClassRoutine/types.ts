// ==========================================
// Types for ClassRoutine module
// ==========================================

import { DBRoutineSlotWithDetails } from '@/lib/supabase';

/**
 * Represents a teacher's info extracted from a routine slot
 */
export interface TeacherInfo {
  full_name: string;
  teacher_uid: string;
}

/**
 * A "display slot" that groups combined/lab slots together.
 * When two slots share the same course + day + time + room + section,
 * they are merged into one DisplaySlot with multiple teachers.
 */
export interface DisplaySlot {
  /** Primary slot ID (first slot in group) */
  id: string;
  /** All slot IDs in this group (for deletion of combined slots) */
  slotIds: string[];
  /** Day of week (0=Sun..4=Thu) */
  day_of_week: number;
  /** Start time (HH:MM) */
  start_time: string;
  /** End time (HH:MM) */
  end_time: string;
  /** Section */
  section: string;
  /** Room info */
  room_number: string;
  room_type: string | null;
  /** Course info */
  course_code: string;
  course_title: string;
  course_credit: number;
  course_type: string;
  /** Offering info */
  offering_term: string;
  offering_session: string;
  /** Array of teachers (1 for normal, 2 for combined/lab) */
  teachers: TeacherInfo[];
  /** Whether this is a combined slot (has multiple teachers) */
  isCombined: boolean;
  /** Original raw slots for reference */
  rawSlots: DBRoutineSlotWithDetails[];
}
