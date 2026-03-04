// ==========================================
// Teacher Service
// Dependency Inversion: Uses httpClient abstraction, not raw fetch
// Single Responsibility: Only handles teacher-related API calls
// Open/Closed: PATCH actions extend via discriminated `action` field
// ==========================================

import { apiClient, ServiceResult } from '@/lib/httpClient';
import type { TeacherDesignation, TeacherWithAuth } from '@/types/database';

// ── Input / Response Types ─────────────────────────────

export interface AddTeacherInput {
  full_name: string;
  email: string;
  phone: string;
  designation: TeacherDesignation;
  password?: string;
}

export interface AddTeacherResponse extends ServiceResult<TeacherWithAuth> {
  generatedPassword?: string;
}

interface ResetPasswordResponse extends ServiceResult<void> {
  newPassword?: string;
}

// ── API Methods ────────────────────────────────────────

const ENDPOINT = '/teachers';

/** Create a new teacher (profile + teacher record). */
export async function addTeacher(input: AddTeacherInput): Promise<AddTeacherResponse> {
  return apiClient.post<TeacherWithAuth>(ENDPOINT, input) as Promise<AddTeacherResponse>;
}

/** Fetch all teachers with their auth info. */
export async function getAllTeachers(): Promise<TeacherWithAuth[]> {
  return apiClient.getList<TeacherWithAuth>(ENDPOINT);
}

/** Soft-delete (deactivate) a teacher. */
export async function deleteTeacher(userId: string): Promise<ServiceResult<void>> {
  return apiClient.delete(ENDPOINT, { userId });
}

/** Reset a teacher's password — returns new plain-text password. */
export async function resetTeacherPassword(userId: string): Promise<ResetPasswordResponse> {
  const result = await apiClient.patch<{ newPassword: string }>(ENDPOINT, { userId, action: 'reset_password' });
  if (result.success && result.data?.newPassword) {
    return { success: true, newPassword: result.data.newPassword };
  }
  return { success: false, error: result.error || 'Failed to reset password' };
}

/** Toggle teacher on-leave status. */
export async function toggleTeacherLeave(
  userId: string,
  isOnLeave: boolean,
  leaveReason?: string
): Promise<ServiceResult<void>> {
  return apiClient.patch(ENDPOINT, {
    userId,
    action: 'toggle_leave',
    is_on_leave: isOnLeave,
    leave_reason: leaveReason || null,
  });
}

/** Update teacher profile fields (name, phone, designation). */
export async function updateTeacherProfile(
  userId: string,
  updates: { full_name?: string; phone?: string; designation?: TeacherDesignation }
): Promise<ServiceResult<void>> {
  return apiClient.patch(ENDPOINT, { userId, action: 'update_profile', ...updates });
}

/** Search teachers by name or email. */
export async function searchTeachers(query: string): Promise<TeacherWithAuth[]> {
  return apiClient.getList<TeacherWithAuth>(ENDPOINT, { q: query });
}
