// ==========================================
// Optional Course Assignment Service
// Dependency Inversion: Uses httpClient abstraction
// Single Responsibility: Optional course allocation logic + API calls
// ==========================================

import { apiClient, ServiceResult } from '@/lib/httpClient';

// ── Types ──────────────────────────────────────────────

export interface ElectiveOffering {
  id: string;
  course_id: string;
  teacher_user_id: string;
  term: string;
  session: string;
  batch: string | null;
  is_active: boolean;
  elective_group: string | null;
  courses: {
    id: string;
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

export interface OptionalAssignment {
  id: string;
  student_user_id: string;
  offering_id: string;
  assigned_by: string | null;
  assigned_at: string;
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
    teacher_user_id: string;
    term: string;
    session: string;
    is_active: boolean;
    courses: {
      id: string;
      code: string;
      title: string;
      credit: number;
      course_type: string;
    };
    teachers: {
      full_name: string;
      teacher_uid: string;
    };
  };
}

export interface ElectiveCourse {
  id: string;
  code: string;
  title: string;
  credit: number;
  course_type: string;
  elective_group: string | null;
}

export interface CreateOfferingPayload {
  course_id: string;
  teacher_user_id: string;
  term: string;
  session?: string;
  batch?: string;
}

export interface UpdateOfferingPayload {
  id: string;
  teacher_user_id?: string;
  session?: string;
  batch?: string;
  is_active?: boolean;
}

// ── API Methods ────────────────────────────────────────

const ENDPOINT = '/optional-course-assignments';
const ELECTIVE_ENDPOINT = '/optional-course-assignments/elective-offerings';

/** Fetch elective course offerings for a given term. */
export async function getElectiveOfferings(term: string): Promise<ElectiveOffering[]> {
  return apiClient.getList<ElectiveOffering>(ELECTIVE_ENDPOINT, { term });
}

/** Fetch all optional course assignments, optionally filtered. */
export async function getOptionalAssignments(filters?: {
  term?: string;
  studentUserId?: string;
  offeringId?: string;
}): Promise<OptionalAssignment[]> {
  const params: Record<string, string> = {};
  if (filters?.term) params.term = filters.term;
  if (filters?.studentUserId) params.student_user_id = filters.studentUserId;
  if (filters?.offeringId) params.offering_id = filters.offeringId;
  return apiClient.getList<OptionalAssignment>(ENDPOINT, params);
}

/** Assign an elective course offering to multiple students. */
export async function assignCourseToStudents(
  studentUserIds: string[],
  offeringId: string,
  assignedBy?: string
): Promise<ServiceResult<{ assigned_count: number; assignments: unknown[] }>> {
  return apiClient.post(ENDPOINT, {
    student_user_ids: studentUserIds,
    offering_id: offeringId,
    assigned_by: assignedBy || null,
  });
}

/** Remove an optional course assignment. */
export async function removeAssignment(
  studentUserId: string,
  offeringId: string
): Promise<ServiceResult<void>> {
  return apiClient.delete(ENDPOINT, {
    student_user_id: studentUserId,
    offering_id: offeringId,
  });
}

/** Remove assignment by ID. */
export async function removeAssignmentById(id: string): Promise<ServiceResult<void>> {
  return apiClient.delete(ENDPOINT, { id });
}

// ── Elective Offering CRUD ─────────────────────────────

/** Create a new elective course offering. */
export async function createElectiveOffering(
  payload: CreateOfferingPayload
): Promise<ServiceResult<ElectiveOffering>> {
  return apiClient.post(ELECTIVE_ENDPOINT, payload);
}

/** Update an existing elective offering. */
export async function updateElectiveOffering(
  payload: UpdateOfferingPayload
): Promise<ServiceResult<ElectiveOffering>> {
  return apiClient.patch(ELECTIVE_ENDPOINT, payload);
}

/** Delete (deactivate) an elective offering. */
export async function deleteElectiveOffering(
  id: string,
  hard = false
): Promise<ServiceResult<void>> {
  return apiClient.delete(ELECTIVE_ENDPOINT, { id, hard: hard ? 'true' : 'false' });
}

// ── Elective Courses (from curriculum) ─────────────────

const ELECTIVE_COURSES_ENDPOINT = '/optional-course-assignments/elective-courses';

/** Fetch available elective courses from curriculum for a term. */
export async function getElectiveCourses(term: string): Promise<ElectiveCourse[]> {
  return apiClient.getList<ElectiveCourse>(ELECTIVE_COURSES_ENDPOINT, { term });
}

/** Fetch all teachers for dropdown selection. */
export async function getTeachers(): Promise<{ user_id: string; full_name: string; teacher_uid: string }[]> {
  try {
    const response = await fetch('/api/teachers');
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}
