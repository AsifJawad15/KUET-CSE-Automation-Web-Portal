import { TermUpgradeRequest, TermUpgradeRequestWithStudent } from '@/lib/supabase';

export type { TermUpgradeRequest, TermUpgradeRequestWithStudent };

// Valid term progression: 1-1 → 1-2 → 2-1 → 2-2 → 3-1 → 3-2 → 4-1 → 4-2
const TERM_ORDER = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'];

/**
 * Get the next term in sequence
 */
export function getNextTerm(currentTerm: string): string | null {
  const idx = TERM_ORDER.indexOf(currentTerm);
  if (idx === -1 || idx === TERM_ORDER.length - 1) return null;
  return TERM_ORDER[idx + 1];
}

/**
 * Get the previous term in sequence
 */
export function getPreviousTerm(currentTerm: string): string | null {
  const idx = TERM_ORDER.indexOf(currentTerm);
  if (idx <= 0) return null;
  return TERM_ORDER[idx - 1];
}

/**
 * Get all valid terms
 */
export function getAllTerms(): string[] {
  return [...TERM_ORDER];
}

/**
 * Check if requested term is valid (must be after current term)
 */
export function isValidUpgrade(currentTerm: string, requestedTerm: string): boolean {
  const currentIdx = TERM_ORDER.indexOf(currentTerm);
  const requestedIdx = TERM_ORDER.indexOf(requestedTerm);
  return currentIdx !== -1 && requestedIdx !== -1 && requestedIdx > currentIdx;
}

/**
 * Check if a term is a valid term string
 */
export function isValidTerm(term: string): boolean {
  return TERM_ORDER.includes(term);
}

/**
 * Directly update a student's term (admin action — no pending workflow).
 * Supports both upgrade and downgrade.
 */
export async function directTermChange(
  studentUserId: string,
  newTerm: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/students', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: studentUserId,
        term: newTerm,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to update term' };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Bulk update multiple students' terms at once (admin action).
 */
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

/**
 * Submit a term upgrade request (student)
 */
export async function submitTermUpgradeRequest(
  studentUserId: string,
  currentTerm: string,
  requestedTerm: string,
  reason?: string
): Promise<{ success: boolean; data?: TermUpgradeRequest; error?: string }> {
  try {
    const response = await fetch('/api/term-upgrades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_user_id: studentUserId,
        current_term: currentTerm,
        requested_term: requestedTerm,
        reason: reason || null,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to submit request' };
    }
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Fetch all term upgrade requests (optionally filtered by student or status)
 */
export async function getTermUpgradeRequests(filters?: {
  studentUserId?: string;
  status?: string;
}): Promise<TermUpgradeRequestWithStudent[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.studentUserId) params.set('studentUserId', filters.studentUserId);
    if (filters?.status) params.set('status', filters.status);

    const response = await fetch(`/api/term-upgrades?${params.toString()}`);
    if (!response.ok) return [];
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('Error fetching term upgrade requests:', error);
    return [];
  }
}

/**
 * Review (approve/reject) a term upgrade request (admin)
 */
export async function reviewTermUpgradeRequest(
  requestId: string,
  action: 'approved' | 'rejected',
  adminUserId: string,
  adminRemarks?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/term-upgrades', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: requestId,
        status: action,
        admin_user_id: adminUserId,
        admin_remarks: adminRemarks || null,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to review request' };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}
