// ==========================================
// CR Room Request Service
// Dependency Inversion: Uses httpClient abstraction
// Single Responsibility: Only handles CR room request API calls
// ==========================================

import { apiClient, ServiceResult } from '@/lib/httpClient';
import type { CRRoomRequestWithDetails } from '@/types/database';

// ── Input Types ────────────────────────────────────────

export interface CreateCRRoomRequestInput {
  student_user_id: string;
  course_code: string;
  teacher_user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  term: string;
  session: string;
  section?: string;
  reason?: string;
}

// ── API Methods ────────────────────────────────────────

const ENDPOINT = '/cr-room-requests';
const CR_ENDPOINT = '/students/cr';

export async function getAllCRRoomRequests(status?: string, student_user_id?: string): Promise<CRRoomRequestWithDetails[]> {
  const params: Record<string, string> = {};
  if (status && status !== 'all') params.status = status;
  if (student_user_id) params.student_user_id = student_user_id;
  return apiClient.getList<CRRoomRequestWithDetails>(ENDPOINT, params);
}

export async function createCRRoomRequest(input: CreateCRRoomRequestInput): Promise<ServiceResult<CRRoomRequestWithDetails>> {
  return apiClient.post<CRRoomRequestWithDetails>(ENDPOINT, input);
}

export async function deleteCRRoomRequest(id: string): Promise<ServiceResult<void>> {
  return apiClient.delete(ENDPOINT, { id });
}

export async function toggleCRStatus(user_id: string, is_cr: boolean): Promise<ServiceResult<unknown>> {
  return apiClient.patch(CR_ENDPOINT, { user_id, is_cr });
}
