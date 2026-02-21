// ==========================================
// Term Upgrade Service
// Dependency Inversion: Uses httpClient abstraction, not raw fetch
// Single Responsibility: Term progression logic + API calls
// Open/Closed: Term order is a constant, pure helpers derive from it
// ==========================================

import { apiClient, ServiceResult } from '@/lib/httpClient';
import type { TermUpgradeRequest, TermUpgradeRequestWithStudent } from '@/types/database';

// Re-export for backward compatibility
export type { TermUpgradeRequest, TermUpgradeRequestWithStudent };

// ── Term Progression Constants ─────────────────────────

const TERM_ORDER = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'] as const;

// ── Pure Helpers (no side effects, easily testable) ────

export function getNextTerm(currentTerm: string): string | null {
  const idx = TERM_ORDER.indexOf(currentTerm as typeof TERM_ORDER[number]);
  if (idx === -1 || idx === TERM_ORDER.length - 1) return null;
  return TERM_ORDER[idx + 1];
}

export function getPreviousTerm(currentTerm: string): string | null {
  const idx = TERM_ORDER.indexOf(currentTerm as typeof TERM_ORDER[number]);
  if (idx <= 0) return null;
  return TERM_ORDER[idx - 1];
}

export function getAllTerms(): string[] {
  return [...TERM_ORDER];
}

export function isValidUpgrade(currentTerm: string, requestedTerm: string): boolean {
  const currentIdx = TERM_ORDER.indexOf(currentTerm as typeof TERM_ORDER[number]);
  const requestedIdx = TERM_ORDER.indexOf(requestedTerm as typeof TERM_ORDER[number]);
  return currentIdx !== -1 && requestedIdx !== -1 && requestedIdx > currentIdx;
}

export function isValidTerm(term: string): boolean {
  return TERM_ORDER.includes(term as typeof TERM_ORDER[number]);
}

// ── API Methods ────────────────────────────────────────

const STUDENTS_ENDPOINT = '/students';
const UPGRADES_ENDPOINT = '/term-upgrades';

/** Directly update a student's term (admin action — no workflow). */
export async function directTermChange(
  studentUserId: string,
  newTerm: string
): Promise<ServiceResult<void>> {
  return apiClient.patch(STUDENTS_ENDPOINT, { user_id: studentUserId, term: newTerm });
}

/** Bulk update multiple students' terms. */
export async function bulkDirectTermChange(
  studentUserIds: string[],
  newTerm: string
): Promise<{ successCount: number; failedCount: number; errors: { studentId: string; error: string }[] }> {
  let successCount = 0;
  const errors: { studentId: string; error: string }[] = [];

  for (const studentId of studentUserIds) {
    const result = await directTermChange(studentId, newTerm);
    if (result.success) {
      successCount++;
    } else {
      errors.push({ studentId, error: result.error || 'Unknown error' });
    }
  }

  return { successCount, failedCount: errors.length, errors };
}

/** Submit a term upgrade request (student workflow). */
export async function submitTermUpgradeRequest(
  studentUserId: string,
  currentTerm: string,
  requestedTerm: string,
  reason?: string
): Promise<ServiceResult<TermUpgradeRequest>> {
  return apiClient.post<TermUpgradeRequest>(UPGRADES_ENDPOINT, {
    student_user_id: studentUserId,
    current_term: currentTerm,
    requested_term: requestedTerm,
    reason: reason || null,
  });
}

/** Fetch term upgrade requests (optionally filtered). */
export async function getTermUpgradeRequests(filters?: {
  studentUserId?: string;
  status?: string;
}): Promise<TermUpgradeRequestWithStudent[]> {
  const params: Record<string, string> = {};
  if (filters?.studentUserId) params.studentUserId = filters.studentUserId;
  if (filters?.status) params.status = filters.status;

  return apiClient.getList<TermUpgradeRequestWithStudent>(UPGRADES_ENDPOINT, params);
}

/** Review (approve/reject) a term upgrade request (admin). */
export async function reviewTermUpgradeRequest(
  requestId: string,
  action: 'approved' | 'rejected',
  adminUserId: string,
  adminRemarks?: string
): Promise<ServiceResult<void>> {
  return apiClient.patch(UPGRADES_ENDPOINT, {
    id: requestId,
    status: action,
    admin_user_id: adminUserId,
    admin_remarks: adminRemarks || null,
  });
}
