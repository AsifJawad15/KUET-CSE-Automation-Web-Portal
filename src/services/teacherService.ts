import { TeacherDesignation, TeacherWithAuth } from '@/lib/supabase';

export interface AddTeacherInput {
  full_name: string;
  email: string;
  phone: string;
  designation: TeacherDesignation;
  password?: string; // Optional, if not provided, will generate 6-digit password
}

export interface AddTeacherResponse {
  success: boolean;
  data?: TeacherWithAuth;
  generatedPassword?: string; // The plain text password (only returned once!)
  error?: string;
}

/**
 * Add a new teacher to the system using server-side API
 */
export async function addTeacher(input: AddTeacherInput): Promise<AddTeacherResponse> {
  try {
    const response = await fetch('/api/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Error adding teacher:', error);
    return {
      success: false,
      error: error.message || 'Failed to add teacher',
    };
  }
}

/**
 * Fetch all teachers with their auth info using server-side API
 */
export async function getAllTeachers(): Promise<TeacherWithAuth[]> {
  try {
    const response = await fetch('/api/teachers');
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return [];
  }
}

/**
 * Update teacher information (TODO: Implement with API route)
 */
export async function updateTeacher(
  userId: string,
  updates: Partial<AddTeacherInput>
): Promise<AddTeacherResponse> {
  console.warn('updateTeacher not yet implemented with API');
  return {
    success: false,
    error: 'Update functionality not yet implemented',
  };
}

/**
 * Delete (deactivate) a teacher using server-side API
 */
export async function deleteTeacher(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/teachers?userId=${userId}`, {
      method: 'DELETE',
    });

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Error deleting teacher:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete teacher',
    };
  }
}

/**
 * Search teachers by name or email (TODO: Implement with API route)
 */
export async function searchTeachers(query: string): Promise<TeacherWithAuth[]> {
  console.warn('searchTeachers not yet implemented with API');
  return [];
}

/**
 * Reset a teacher's password - generates a new 6-digit password
 * Returns the new plain text password for the admin to share
 */
export async function resetTeacherPassword(userId: string): Promise<{ success: boolean; newPassword?: string; error?: string }> {
  try {
    const response = await fetch('/api/teachers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'reset_password' }),
    });

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return {
      success: false,
      error: error.message || 'Failed to reset password',
    };
  }
}

/**
 * Toggle teacher leave status
 */
export async function toggleTeacherLeave(
  userId: string,
  isOnLeave: boolean,
  leaveReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/teachers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        action: 'toggle_leave',
        is_on_leave: isOnLeave,
        leave_reason: leaveReason || null,
      }),
    });

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Error toggling leave status:', error);
    return {
      success: false,
      error: error.message || 'Failed to toggle leave status',
    };
  }
}

/**
 * Update teacher profile data (name, phone, designation)
 */
export async function updateTeacherProfile(
  userId: string,
  updates: { full_name?: string; phone?: string; designation?: TeacherDesignation }
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/teachers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'update_profile', ...updates }),
    });

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Error updating teacher profile:', error);
    return {
      success: false,
      error: error.message || 'Failed to update teacher profile',
    };
  }
}
