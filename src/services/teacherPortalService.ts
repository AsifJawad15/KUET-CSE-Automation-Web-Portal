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

export interface GeoAttendanceRoom {
  id: string;
  offering_id: string;
  session_id?: string;
  teacher_user_id: string;
  room_number?: string;
  section?: string;
  date: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  submission_count?: number;
  course_offerings?: {
    id: string;
    term?: string;
    courses: {
      code: string;
      title: string;
      course_type: string;
    };
  };
}

export interface GeoAttendanceLog {
  id: string;
  geo_room_id: string;
  student_user_id: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  status: string;
  submitted_at: string;
  students?: {
    roll_no: string;
    full_name: string;
  };
}

export interface OpenGeoRoomInput {
  offering_id: string;
  teacher_user_id: string;
  room_number?: string;
  section?: string;
  start_time: string;
  end_time: string;
}

// ── API Methods ────────────────────────────────────────

const BASE = '/teacher-portal';

// ── My Courses ──

export async function getMyCourses(teacherId: string): Promise<TeacherCourse[]> {
  return apiClient.getList<TeacherCourse>(`${BASE}/my-courses`, { teacher_id: teacherId });
}

// ── Attendance ──

export async function uploadAttendance(records: AttendanceRecord[], offeringId?: string, teacherId?: string): Promise<ServiceResult<{ inserted: number; errors: string[] }>> {
  return apiClient.post(`${BASE}/attendance`, { records, offering_id: offeringId, teacher_id: teacherId });
}

export async function getAttendance(courseCode: string, date?: string): Promise<AttendanceRecord[]> {
  const params: Record<string, string> = { course_code: courseCode };
  if (date) params.date = date;
  return apiClient.getList<AttendanceRecord>(`${BASE}/attendance`, params);
}

export async function saveAttendance(records: AttendanceRecord[], offeringId?: string, teacherId?: string): Promise<ServiceResult<{ saved: number }>> {
  return apiClient.post(`${BASE}/attendance`, { records, offering_id: offeringId, teacher_id: teacherId });
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

// ── Geo-Attendance ──

export async function openGeoAttendanceRoom(data: OpenGeoRoomInput): Promise<ServiceResult<GeoAttendanceRoom>> {
  return apiClient.post(`${BASE}/geo-attendance`, data);
}

export async function getGeoAttendanceRooms(teacherId: string, activeOnly = false): Promise<GeoAttendanceRoom[]> {
  const params: Record<string, string> = { teacher_user_id: teacherId };
  if (activeOnly) params.active_only = 'true';
  return apiClient.getList<GeoAttendanceRoom>(`${BASE}/geo-attendance`, params);
}

export async function closeGeoAttendanceRoom(roomId: string, teacherId?: string): Promise<ServiceResult<void>> {
  return apiClient.patch(`${BASE}/geo-attendance`, { room_id: roomId, teacher_user_id: teacherId });
}

export async function getGeoRoomLogs(roomId: string): Promise<GeoAttendanceLog[]> {
  return apiClient.getList<GeoAttendanceLog>(`${BASE}/geo-attendance`, { room_id: roomId });
}
