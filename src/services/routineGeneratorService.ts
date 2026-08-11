// ==========================================
// Routine Generator Service
// Uses httpClient abstraction
// ==========================================

import { apiClient, ServiceResult } from '@/lib/httpClient';

export interface RequirementInput {
  id?: string;
  session: string;
  year: number;
  term: number;
  section: string | null;
  course_id: string;
  course_offering_id?: string | null;
  course_type: string;
  required_theory_slots: number;
  required_lab_slots: number;
  lab_duration_periods?: number;
  theory_duration_periods?: number;
  needs_combined_section?: boolean;
  lab_groups?: string[];
  preferred_room_type?: string | null;
  preferred_room_numbers?: string[];
  priority?: number;
}

export interface GeneratorOptions {
  includeExistingSelectedSlots?: boolean;
  respectTeacherAvailability?: boolean;
  respectRoomCapacity?: boolean;
  allowSaturday?: boolean;
}

export interface CandidateSlotInput {
  activityId: string;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  roomNumber: string;
}

// ── API Methods ────────────────────────────────────────

const BASE_URL = '/routine-generator';

export async function getRequirements(
  session: string,
  year: number,
  term: number,
  section?: string
): Promise<any[]> {
  const params: Record<string, string> = {
    session,
    year: String(year),
    term: String(term),
  };
  if (section) params.section = section;

  return apiClient.getList<any>(`${BASE_URL}/requirements`, params);
}

export async function saveRequirements(requirements: RequirementInput[]): Promise<ServiceResult<any>> {
  return apiClient.post<any>(`${BASE_URL}/requirements`, { requirements });
}

export async function generateRoutine(
  session: string,
  year: number,
  term: number,
  section: string,
  draftCount = 5,
  options: GeneratorOptions = {}
): Promise<ServiceResult<{ success: boolean; job?: any; draftCount?: number; message?: string }>> {
  return apiClient.post<any>(`${BASE_URL}/generate`, {
    session,
    year,
    term,
    section,
    draftCount,
    options,
  });
}

export async function getDraftsList(
  session: string,
  year: number,
  term: number,
  section: string
): Promise<any[]> {
  return apiClient.getList<any>(`${BASE_URL}/drafts`, {
    session,
    year: String(year),
    term: String(term),
    section,
  });
}

export async function getDraftDetails(draftId: string): Promise<ServiceResult<any>> {
  return apiClient.get<any>(`${BASE_URL}/drafts`, { draft_id: draftId });
}

export async function deleteDraft(draftId: string): Promise<ServiceResult<void>> {
  return apiClient.delete(`${BASE_URL}/drafts`, { id: draftId });
}

export async function validateDraftSlot(
  draftId: string,
  candidateSlot: CandidateSlotInput
): Promise<ServiceResult<{ isValid: boolean; hardConflicts: any[]; softWarnings: any[] }>> {
  return apiClient.post<any>(`${BASE_URL}/validate-slot`, {
    draftId,
    candidateSlot,
  });
}

export async function updateDraftSlot(
  draftId: string,
  slotIds: string[],
  dayOfWeek: number,
  startPeriod: number,
  endPeriod: number,
  roomNumber: string
): Promise<ServiceResult<{ success: boolean; score: number; hardConflictCount: number; softWarningCount: number }>> {
  return apiClient.patch<any>(`${BASE_URL}/update-draft-slot`, {
    draftId,
    slotIds,
    dayOfWeek,
    startPeriod,
    endPeriod,
    roomNumber,
  });
}

export async function publishDraft(
  draftId: string,
  replaceExistingForSelection = true
): Promise<ServiceResult<{ success: boolean; versionId: string; publishedSlotsCount: number }>> {
  return apiClient.post<any>(`${BASE_URL}/publish`, {
    draftId,
    replaceExistingForSelection,
  });
}
