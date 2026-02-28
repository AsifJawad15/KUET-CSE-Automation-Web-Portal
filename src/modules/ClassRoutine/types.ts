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
  /** Whether this slot was imported from file (not persisted in DB) */
  isImported?: boolean;
  /** Original raw slots for reference */
  rawSlots: DBRoutineSlotWithDetails[];
}

// ── Parsed Routine Types (for file upload/import) ──────

/**
 * A single parsed routine slot from an uploaded file (CSV/PDF/DOCX).
 * Contains all display info inline — no DB references required.
 */
export interface ParsedRoutineSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  course_code: string;
  course_title: string;
  course_type: string;
  teacher_name: string;
  room_number: string;
  section: string;
  term: string;
  session: string;
}

/**
 * Result of bulk import attempt.
 */
export interface BulkImportResult {
  inserted: number;
  skipped: number;
  unmatched: ParsedRoutineSlot[];
  errors: string[];
}
