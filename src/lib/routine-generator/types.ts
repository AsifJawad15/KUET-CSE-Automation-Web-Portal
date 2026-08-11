// ==========================================
// Smart Routine Generator: Types
// ==========================================

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

export interface Period {
  id: number; // 1-9
  start: string; // HH:MM
  end: string; // HH:MM
  label: string;
}

export interface Room {
  room_number: string;
  building_name: string | null;
  capacity: number | null;
  room_type: 'classroom' | 'lab' | 'seminar' | 'research' | null;
  is_active: boolean;
}

export interface Teacher {
  user_id: string;
  teacher_uid: string;
  full_name: string;
  is_on_leave: boolean;
}

export interface CourseOffering {
  id: string;
  course_id: string;
  teacher_user_id: string;
  term: string;
  session: string;
  batch: string | null;
  section: string | null;
  courses: {
    code: string;
    title: string;
    credit: number;
    course_type: string;
  };
  teachers: {
    full_name: string;
    teacher_uid: string;
  };
}

export interface ActivityTeacher {
  teacherUserId: string;
  teacherName: string;
  teacherUid: string;
  courseOfferingId: string;
  section: string | null;
}

export interface ScheduleActivity {
  id: string; // unique activity identifier (e.g. course-offering-id + activity-index)
  courseId: string;
  courseCode: string;
  courseTitle: string;
  courseType: 'Theory' | 'Lab' | 'Sessional';
  duration: number; // in periods (e.g., 1 for theory, 3 for lab)
  teachers: ActivityTeacher[];
  groupName: string | null; // e.g. "A1", "A2", or null for entire section
  isCombined: boolean; // if true, runs with other teachers/offerings concurrently
  preferredRoomType: string | null;
  preferredRoomNumbers: string[];
  section: string | null;
}

export interface ScheduleAssignment {
  activityId: string;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  roomNumber: string;
}

export interface LockedSlot {
  id: string;
  courseCode: string;
  teacherUserId: string;
  teacherName: string;
  roomNumber: string;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  term: string;
  session: string;
  section: string | null;
  groupName?: string | null;
}

export interface TeacherAvailability {
  teacherUserId: string;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  availabilityType: 'available' | 'unavailable' | 'preferred' | 'not_preferred';
  priority: number;
  note?: string | null;
}

export interface CourseScheduleRequirement {
  id: string;
  session: string;
  year: number;
  term: number;
  section: string | null;
  courseId: string;
  courseOfferingId: string | null;
  courseType: string;
  requiredTheorySlots: number;
  requiredLabSlots: number;
  labDurationPeriods: number;
  theoryDurationPeriods: number;
  needsCombinedSection: boolean;
  labGroups: string[];
  preferredRoomType: string | null;
  preferredRoomNumbers: string[];
  priority: number;
}

export interface HardConflict {
  type: string; // e.g., 'teacher_overlap', 'room_overlap'
  reason: string;
  activityId?: string;
  dayOfWeek?: number;
  startPeriod?: number;
  roomNumber?: string;
}

export interface SoftWarning {
  type: string; // e.g., 'student_gap', 'teacher_gap'
  reason: string;
  penalty: number;
  activityId?: string;
  dayOfWeek?: number;
  startPeriod?: number;
}

export interface ValidationResult {
  isValid: boolean;
  hardConflicts: HardConflict[];
  softWarnings: SoftWarning[];
}

export interface SolverOptions {
  includeExistingSelectedSlots: boolean;
  respectTeacherAvailability: boolean;
  respectRoomCapacity: boolean;
  allowSaturday: boolean;
  theoryRooms?: string[];
  labRooms?: string[];
}

export interface SolverInput {
  session: string;
  year: number;
  term: number;
  section: string;
  activities: ScheduleActivity[];
  rooms: Room[];
  lockedSlots: LockedSlot[];
  teacherAvailabilities: TeacherAvailability[];
  constraints: Record<string, { isActive: boolean; weight: number }>;
  options: SolverOptions;
}

export interface SolverDraft {
  id?: string;
  name: string;
  score: number;
  assignments: ScheduleAssignment[];
  hardConflictCount: number;
  softWarningCount: number;
  summary: {
    reason: string;
    advantages: string[];
    disadvantages: string[];
  };
}
