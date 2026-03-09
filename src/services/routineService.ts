// ==========================================
// Routine Service
// Dependency Inversion: Uses httpClient abstraction, not raw fetch
// Single Responsibility: Only handles routine slot API calls
// ==========================================

import { apiClient, ServiceResult } from '@/lib/httpClient';
import type { DBRoutineSlotWithDetails } from '@/types/database';

// ── Input Types ────────────────────────────────────────

export interface AddRoutineSlotInput {
  offering_id: string;
  room_number: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  section?: string;
}

export type RoutineSlotResponse = ServiceResult<DBRoutineSlotWithDetails>;

// ── API Methods ────────────────────────────────────────

const ENDPOINT = '/routine-slots';

export async function getRoutineSlots(
  term?: string,
  session?: string,
  section?: string,
  date?: string,
): Promise<DBRoutineSlotWithDetails[]> {
  const params: Record<string, string> = {};
  if (term) params.term = term;
  if (session) params.session = session;
  if (section) params.section = section;
  if (date) params.date = date;

  return apiClient.getList<DBRoutineSlotWithDetails>(ENDPOINT, params);
}

export async function addRoutineSlot(input: AddRoutineSlotInput): Promise<RoutineSlotResponse> {
  return apiClient.post<DBRoutineSlotWithDetails>(ENDPOINT, input);
}

export async function deleteRoutineSlot(id: string): Promise<ServiceResult<void>> {
  return apiClient.delete(ENDPOINT, { id });
}

export async function updateRoutineSlot(
  id: string,
  updates: Partial<AddRoutineSlotInput>
): Promise<RoutineSlotResponse> {
  return apiClient.patch<DBRoutineSlotWithDetails>(ENDPOINT, { id, ...updates });
}
