// ==========================================
// KUET CSE Automation - Type Definitions
// ==========================================

// User Roles
export type UserRole = 'student' | 'teacher' | 'admin';

// Course Types
export type CourseType = 'theory' | 'lab';

// Designation Types
export type Designation = 'Professor' | 'Associate Professor' | 'Assistant Professor' | 'Lecturer';

// Room Types
export type RoomType = 'classroom' | 'lab' | 'seminar' | 'research';

// Attendance Status
export type AttendanceStatus = 'present' | 'absent' | 'late';

// ==========================================
// Faculty Model
// ==========================================
export interface Faculty {
  id: string;
  name: string;
  email: string;
  phone?: string;
  designation: Designation;
  department: string;
  officeRoom?: string;
  experience: number; // years
  assignedCourses: string[]; // course codes
  photoUrl?: string;
  isOnLeave?: boolean;
}

// ==========================================
// Student Model
// ==========================================
export interface Student {
  id: string;
  roll: string; // e.g., "2107001"
  name: string;
  email: string;
  batch: string; // "21", "22", "23", "24"
  section: 'A' | 'B';
  currentYear: 1 | 2 | 3 | 4;
  currentTerm: 1 | 2;
  department: string;
  photoUrl?: string;
}

// ==========================================
// Course Model
// ==========================================
export interface Course {
  id: string;
  code: string; // e.g., "CSE 3201"
  title: string;
  credits: number;
  type: CourseType;
  year: 1 | 2 | 3 | 4;
  term: 1 | 2;
  description?: string;
  teachers: string[]; // teacher IDs
  sections?: string[]; // For theory: ['A', 'B']
  groups?: string[]; // For lab: ['A1', 'A2', 'B1', 'B2']
}

// ==========================================
// Room Model
// ==========================================
export interface Room {
  id: string;
  name: string; // e.g., "Room 301"
  building: string;
  capacity: number;
  type: RoomType;
  isAvailable: boolean;
  occupiedBy?: string; // course code or event
  facilities?: string[]; // projector, AC, etc.
}

// ==========================================
// Schedule Model
// ==========================================
export interface ClassSchedule {
  id: string;
  courseCode: string;
  courseName: string;
  teacherId: string;
  teacherName: string;
  roomId: string;
  roomName: string;
  day: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  startTime: string; // "09:00"
  endTime: string; // "10:30"
  section?: string;
  group?: string;
}

export interface ExamSchedule {
  id: string;
  courseCode: string;
  courseName: string;
  examType: 'CT' | 'Quiz' | 'Mid-Term' | 'Final' | 'Viva';
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  syllabus?: string;
}

// ==========================================
// Result Models
// ==========================================
export interface TheoryResult {
  id: string;
  studentId: string;
  courseCode: string;
  courseName: string;
  classTests: number[]; // 3 CTs, each out of 20
  spotTest?: number; // out of 5
  assignment?: number; // out of 5
  attendance: number; // out of 10
  termFinal?: number; // out of 105
}

export interface LabResult {
  id: string;
  studentId: string;
  courseCode: string;
  courseName: string;
  labTask: number;
  labReport: number;
  labQuiz: number;
  labTest?: number;
  centralViva?: number;
}

// ==========================================
// Announcement Model (TV Display)
// ==========================================
export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'notice' | 'class-test' | 'assignment' | 'lab-test' | 'quiz' | 'event' | 'other';
  courseCode?: string;
  createdBy: string;
  createdAt: string;
  scheduledDate?: string;
  isActive: boolean;
  priority: 'low' | 'medium' | 'high';
}

// ==========================================
// Attendance Session Model
// ==========================================
export interface AttendanceSession {
  id: string;
  courseCode: string;
  date: string;
  sectionOrGroup: string;
  records: {
    studentRoll: string;
    status: AttendanceStatus;
  }[];
}
