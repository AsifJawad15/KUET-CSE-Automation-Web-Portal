// ==========================================
// Supabase Client
// Single Responsibility: Only initializes and exports the DB client
// All DB types are in @/types/database
// ==========================================

import { createClient } from '@supabase/supabase-js';

// ── Configuration ──────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

const isConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-anon-key'
);

if (!isConfigured && typeof window !== 'undefined') {
  console.warn(
    '⚠️ Supabase not configured. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// ── Client Export ──────────────────────────────────────

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const isSupabaseConfigured = () => isConfigured;

// ── Re-export all DB types for backward compatibility ──

export type {
  CRRoomRequest,
  CRRoomRequestStatus,
  CRRoomRequestWithDetails,
  DBCourse,
  DBCourseOffering,
  DBCourseOfferingWithTeacher,
  DBCourseWithOfferings,
  DBRoom,
  DBRoomType,
  DBRoutineSlot,
  DBRoutineSlotWithDetails,
  Profile,
  Staff,
  StaffWithAuth,
  Student,
  StudentWithAuth,
  Teacher,
  TeacherDesignation,
  TeacherWithAuth,
  TermUpgradeRequest,
  TermUpgradeRequestWithStudent,
  TermUpgradeStatus,
  UserRole,
} from '@/types/database';
