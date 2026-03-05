// ==========================================
// Teacher Portal Service
// Dependency Inversion: Uses httpClient abstraction
// Single Responsibility: Handles teacher portal API calls
// ==========================================

import { apiClient, ServiceResult } from '@/lib/httpClient';

// ── Types ──────────────────────────────────────────────

export interface TeacherCourse {
  offering_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  credit: number;
  course_type: string;
  term: string;
  session: string;
  section: string | null;
}

export interface AttendanceRecord {
  id?: string;
  course_code: string;
  student_roll: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  section_or_group?: string;
}

export interface ExamMarksRecord {
  id?: string;
  course_code: string;
  student_roll: string;
  exam_type: string;
  marks: number;
  total_marks: number;
}

export interface TeacherAnnouncement {
  id?: string;
  title: string;
  content: string;
  type: 'notice' | 'class-test' | 'assignment' | 'lab-test' | 'quiz' | 'event' | 'other';
  course_code?: string;
  priority: 'low' | 'medium' | 'high';
  scheduled_date?: string;
  is_active?: boolean;
  created_by?: string;
  created_at?: string;
}

export interface RoomRequest {
  id?: string;
  teacher_user_id?: string;
  teacher_name?: string;
  room_number: string;
  date: string;
  start_time: string;
  end_time: string;
  purpose: string;
  status?: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

export interface TeacherScheduleSlot {
  id: string;
  course_code: string;
  course_title: string;
  room_number: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  section?: string;
  term?: string;
  session?: string;
}

export interface CourseStudent {
  roll_no: string;
  full_name: string;
  email: string;
  phone: string;
  section?: string;
  term: string;
  session: string;
}

export interface ProfileUpdate {
  full_name?: string;
  phone?: string;
  designation?: string;
  office_room?: string;
}

export interface ChangePasswordInput {
  current_password: string;
  new_password: string;
}

// ── API Methods ────────────────────────────────────────

const BASE = '/teacher-portal';

// ── My Courses ──

export async function getMyCourses(teacherId: string): Promise<TeacherCourse[]> {
  return apiClient.getList<TeacherCourse>(`${BASE}/my-courses`, { teacher_id: teacherId });
}

// ── Attendance ──

export async function uploadAttendance(records: AttendanceRecord[]): Promise<ServiceResult<{ inserted: number; errors: string[] }>> {
  return apiClient.post(`${BASE}/attendance`, { records });
}

export async function getAttendance(courseCode: string, date?: string): Promise<AttendanceRecord[]> {
  const params: Record<string, string> = { course_code: courseCode };
  if (date) params.date = date;
  return apiClient.getList<AttendanceRecord>(`${BASE}/attendance`, params);
}

export async function saveAttendance(records: AttendanceRecord[]): Promise<ServiceResult<{ saved: number }>> {
  return apiClient.post(`${BASE}/attendance`, { records });
}

// ── Exam Marks ──

export async function uploadMarks(records: ExamMarksRecord[]): Promise<ServiceResult<{ inserted: number; errors: string[] }>> {
  return apiClient.post(`${BASE}/marks`, { records });
}

export async function getMarks(courseCode: string, examType?: string): Promise<ExamMarksRecord[]> {
  const params: Record<string, string> = { course_code: courseCode };
  if (examType) params.exam_type = examType;
  return apiClient.getList<ExamMarksRecord>(`${BASE}/marks`, params);
}

// ── Announcements ──

export async function createAnnouncement(data: TeacherAnnouncement): Promise<ServiceResult<TeacherAnnouncement>> {
  return apiClient.post(`${BASE}/announcements`, data);
}

export async function getMyAnnouncements(teacherId: string): Promise<TeacherAnnouncement[]> {
  return apiClient.getList<TeacherAnnouncement>(`${BASE}/announcements`, { teacher_id: teacherId });
}

export async function deleteAnnouncement(id: string): Promise<ServiceResult<void>> {
  return apiClient.delete(`${BASE}/announcements`, { id });
}

// ── Room Requests ──

export async function requestRoom(data: RoomRequest): Promise<ServiceResult<RoomRequest>> {
  return apiClient.post(`${BASE}/room-requests`, data);
}

export async function getMyRoomRequests(teacherId: string): Promise<RoomRequest[]> {
  return apiClient.getList<RoomRequest>(`${BASE}/room-requests`, { teacher_id: teacherId });
}

// ── Schedule ──

export async function getMySchedule(teacherId: string): Promise<TeacherScheduleSlot[]> {
  return apiClient.getList<TeacherScheduleSlot>(`${BASE}/schedule`, { teacher_id: teacherId });
}

// ── Course Students ──

export async function getCourseStudents(courseCode: string, term?: string, section?: string): Promise<CourseStudent[]> {
  const params: Record<string, string> = { course_code: courseCode };
  if (term) params.term = term;
  if (section) params.section = section;
  return apiClient.getList<CourseStudent>(`${BASE}/course-students`, params);
}

// ── Profile ──

export async function updateMyProfile(userId: string, updates: ProfileUpdate): Promise<ServiceResult<void>> {
  return apiClient.patch(`${BASE}/profile`, { userId, ...updates });
}

// ── Change Password ──

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<ServiceResult<void>> {
  return apiClient.patch(`${BASE}/profile`, { userId, action: 'change_password', ...input });
}
