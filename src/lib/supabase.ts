import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

const isConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-anon-key'
);

if (!isConfigured && typeof window !== 'undefined') {
  console.error('⚠️ SUPABASE CONFIGURATION MISSING!');
  console.error('Please create .env.local file with:');
  console.error('NEXT_PUBLIC_SUPABASE_URL=your_supabase_url');
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key');
  console.error('Get these from: https://app.supabase.com/project/YOUR_PROJECT_ID/settings/api');
}

// Create Supabase client (with placeholder values if not configured)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => isConfigured;

// Database types based on schema
export type TeacherDesignation = 'PROFESSOR' | 'ASSOCIATE_PROFESSOR' | 'ASSISTANT_PROFESSOR' | 'LECTURER';
export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

// Profile = auth only (email + password + role)
export interface Profile {
  user_id: string;
  role: UserRole;
  email: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

// Teacher = all faculty data (self-contained, no profile join needed for display)
export interface Teacher {
  user_id: string;
  teacher_uid: string;
  full_name: string;
  phone: string;
  designation: TeacherDesignation;
  department: string;
  office_room: string | null;
  is_on_leave: boolean;
  leave_reason: string | null;
  created_at: string;
  updated_at: string;
}

// Teacher with auth info (only when you need email/is_active)
export interface TeacherWithAuth extends Teacher {
  profile: Profile;
}

// Student = all student data (self-contained)
export interface Student {
  user_id: string;
  roll_no: string;
  full_name: string;
  phone: string;
  term: string;
  session: string;
  batch: string | null;
  section: string | null;
  cgpa: number;
  created_at: string;
  updated_at: string;
}

// Student with auth info (only when you need email/is_active)
export interface StudentWithAuth extends Student {
  profile: Profile;
}

// Course from DB
export interface DBCourse {
  id: string;
  code: string;
  title: string;
  credit: number;
  course_type: string; // 'Theory' | 'Lab'
  description: string | null;
  created_at: string;
}

// Course offering from DB (teacher ↔ course assignment)
export interface DBCourseOffering {
  id: string;
  course_id: string;
  teacher_user_id: string;
  term: string; // e.g. '3-2'
  session: string;
  batch: string | null;
  section: string | null;
  academic_year: string | null;
  is_active: boolean;
  created_at: string;
}

// Course offering with joined teacher data
export interface DBCourseOfferingWithTeacher extends DBCourseOffering {
  teacher: Teacher;
}

// Course with its offerings (for allocation view)
export interface DBCourseWithOfferings extends DBCourse {
  course_offerings: DBCourseOfferingWithTeacher[];
}

// Room from DB
export type DBRoomType = 'classroom' | 'lab' | 'seminar' | 'research';

export interface DBRoom {
  room_number: string; // Primary key
  building_name: string | null;
  capacity: number | null;
  room_type: DBRoomType | null;
  facilities: string[] | null;
  is_active: boolean;
}

// Routine slot from DB
export interface DBRoutineSlot {
  id: string;
  offering_id: string;
  room_number: string;
  day_of_week: number; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  start_time: string; // HH:MM:SS
  end_time: string;
  section: string | null; // 'A' | 'B'
  created_at: string;
}

// Routine slot with all joined data for display
export interface DBRoutineSlotWithDetails extends DBRoutineSlot {
  course_offerings: {
    id: string;
    term: string;
    session: string;
    batch: string | null;
    courses: { code: string; title: string; credit: number; course_type: string };
    teachers: { full_name: string; teacher_uid: string };
  };
  rooms: { room_number: string; room_type: string | null };
}

// Term Upgrade Request
export type TermUpgradeStatus = 'pending' | 'approved' | 'rejected';

export interface TermUpgradeRequest {
  id: string;
  student_user_id: string;
  current_term: string;
  requested_term: string;
  status: TermUpgradeStatus;
  reason: string | null;
  admin_user_id: string | null;
  admin_remarks: string | null;
  requested_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Term upgrade request with student details for admin view
export interface TermUpgradeRequestWithStudent extends TermUpgradeRequest {
  students: {
    full_name: string;
    roll_no: string;
    term: string;
    session: string;
    batch: string | null;
    section: string | null;
    cgpa: number;
  };
}
