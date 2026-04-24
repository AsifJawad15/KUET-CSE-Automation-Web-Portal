// ==========================================
// Database Entity Types
// Single Responsibility: Only contains DB schema type definitions
// Interface Segregation: Types are grouped by domain entity
// ==========================================

// ── Enums / Unions ─────────────────────────────────────

export type TeacherDesignation = 'PROFESSOR' | 'ASSOCIATE_PROFESSOR' | 'ASSISTANT_PROFESSOR' | 'LECTURER';
export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'HEAD' | 'STAFF';
export type DBRoomType = 'classroom' | 'lab' | 'seminar' | 'research';
export type TermUpgradeStatus = 'pending' | 'approved' | 'rejected';
export type ValidTerm = '1-1' | '1-2' | '2-1' | '2-2' | '3-1' | '3-2' | '4-1' | '4-2';

// ── Auth / Profile ─────────────────────────────────────

export interface Profile {
  user_id: string;
  role: UserRole;
  email: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

// ── Teacher ────────────────────────────────────────────

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
  is_head?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeacherWithAuth extends Teacher {
  profile: Profile;
}

// ── Student ────────────────────────────────────────────

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
  is_cr: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentWithAuth extends Student {
  profile: Profile;
}

// ── Staff ──────────────────────────────────────────────

export interface Staff {
  user_id: string;
  staff_uid: string;
  full_name: string;
  phone: string | null;
  designation: string;
  department: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminPermissions {
  all?: boolean;
  menus?: string[];
  source?: string;
}

export interface StaffWithAuth extends Staff {
  profile: Profile;
  admin_permissions?: AdminPermissions | null;
}

// ── Course ─────────────────────────────────────────────

export interface DBCourse {
  id: string;
  code: string;
  title: string;
  credit: number;
  course_type: string;
  description: string | null;
  created_at: string;
}

// ── Course Offering ────────────────────────────────────

export interface DBCourseOffering {
  id: string;
  course_id: string;
  teacher_user_id: string;
  term: string;
  session: string;
  batch: string | null;
  section: string | null;
  academic_year: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DBCourseOfferingWithTeacher extends DBCourseOffering {
  teacher: Teacher;
}

export interface DBCourseWithOfferings extends DBCourse {
  course_offerings: DBCourseOfferingWithTeacher[];
}

// ── Room ───────────────────────────────────────────────

export interface DBRoom {
  room_number: string;
  building_name: string | null;
  capacity: number | null;
  room_type: DBRoomType | null;
  facilities: string[] | null;
  is_active: boolean;
  plus_code: string | null;
  floor_number: string | null;
  latitude: number | null;
  longitude: number | null;
}

// ── Routine Slot ───────────────────────────────────────

export interface DBRoutineSlot {
  id: string;
  offering_id: string;
  room_number: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  section: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
}

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

// ── Term Upgrade Request ───────────────────────────────

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

// ── CR Room Request ────────────────────────────────────

export type CRRoomRequestStatus = 'pending' | 'approved' | 'rejected';

export interface CRRoomRequest {
  id: string;
  student_user_id: string;
  course_code: string;
  teacher_user_id: string;
  room_number: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  term: string;
  session: string;
  section: string | null;
  reason: string | null;
  request_date: string | null;
  status: CRRoomRequestStatus;
  admin_remarks: string | null;
  admin_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CRRoomRequestWithDetails extends CRRoomRequest {
  students: {
    full_name: string;
    roll_no: string;
    term: string;
    session: string;
  };
  teachers: {
    full_name: string;
    teacher_uid: string;
  };
}

// ── Optional Course Assignment ─────────────────────────

export type ElectiveGroup = 'OPTIONAL_I' | 'OPTIONAL_II' | 'OPTIONAL_III';

export interface OptionalCourseAssignment {
  id: string;
  student_user_id: string;
  offering_id: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface OptionalCourseAssignmentWithDetails extends OptionalCourseAssignment {
  students: {
    user_id: string;
    roll_no: string;
    full_name: string;
    term: string;
    session: string;
    batch: string | null;
    section: string | null;
  };
  course_offerings: {
    id: string;
    course_id: string;
    term: string;
    session: string;
    is_active: boolean;
    courses: { code: string; title: string; credit: number; course_type: string };
    teachers: { full_name: string; teacher_uid: string };
  };
}
