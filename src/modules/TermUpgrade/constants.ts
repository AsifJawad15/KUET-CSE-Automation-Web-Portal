// ==========================================
// Term Upgrade Module — Constants & Helpers
// ==========================================

import { TermId, TermInfo, TermGroup, TermStudent, ExpandedTerms, SelectedStudents } from './types';

/**
 * All 8 academic terms with display metadata.
 * KUET follows: 4 years × 2 terms = 8 terms total.
 */
export const TERMS: TermInfo[] = [
  {
    id: '1-1',
    label: '1st Year 1st Term',
    shortLabel: 'Y1-T1',
    year: 1,
    term: 1,
    colorClass: 'text-blue-700 dark:text-blue-400',
    bgClass: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
    iconColor: 'rgba(59, 130, 246, 0.15)',
  },
  {
    id: '1-2',
    label: '1st Year 2nd Term',
    shortLabel: 'Y1-T2',
    year: 1,
    term: 2,
    colorClass: 'text-sky-700 dark:text-sky-400',
    bgClass: 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20',
    iconColor: 'rgba(14, 165, 233, 0.15)',
  },
  {
    id: '2-1',
    label: '2nd Year 1st Term',
    shortLabel: 'Y2-T1',
    year: 2,
    term: 1,
    colorClass: 'text-teal-700 dark:text-teal-400',
    bgClass: 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20',
    iconColor: 'rgba(20, 184, 166, 0.15)',
  },
  {
    id: '2-2',
    label: '2nd Year 2nd Term',
    shortLabel: 'Y2-T2',
    year: 2,
    term: 2,
    colorClass: 'text-emerald-700 dark:text-emerald-400',
    bgClass: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
    iconColor: 'rgba(16, 185, 129, 0.15)',
  },
  {
    id: '3-1',
    label: '3rd Year 1st Term',
    shortLabel: 'Y3-T1',
    year: 3,
    term: 1,
    colorClass: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
    iconColor: 'rgba(245, 158, 11, 0.15)',
  },
  {
    id: '3-2',
    label: '3rd Year 2nd Term',
    shortLabel: 'Y3-T2',
    year: 3,
    term: 2,
    colorClass: 'text-orange-700 dark:text-orange-400',
    bgClass: 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20',
    iconColor: 'rgba(249, 115, 22, 0.15)',
  },
  {
    id: '4-1',
    label: '4th Year 1st Term',
    shortLabel: 'Y4-T1',
    year: 4,
    term: 1,
    colorClass: 'text-purple-700 dark:text-purple-400',
    bgClass: 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20',
    iconColor: 'rgba(168, 85, 247, 0.15)',
  },
  {
    id: '4-2',
    label: '4th Year 2nd Term',
    shortLabel: 'Y4-T2',
    year: 4,
    term: 2,
    colorClass: 'text-rose-700 dark:text-rose-400',
    bgClass: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',
    iconColor: 'rgba(244, 63, 94, 0.15)',
  },
];

/** Map term IDs to TermInfo for O(1) lookup */
export const TERM_MAP: Record<TermId, TermInfo> = Object.fromEntries(
  TERMS.map((t) => [t.id, t])
) as Record<TermId, TermInfo>;

/** Ordered array of term IDs */
export const TERM_ORDER: TermId[] = TERMS.map((t) => t.id);

/**
 * Get the next term after a given term.
 * Returns null if at the last term (4-2).
 */
export function getNextTermInfo(termId: TermId): TermInfo | null {
  const idx = TERM_ORDER.indexOf(termId);
  if (idx === -1 || idx >= TERM_ORDER.length - 1) return null;
  return TERM_MAP[TERM_ORDER[idx + 1]];
}

/**
 * Get the TermInfo for a given term string.
 * Returns undefined if invalid.
 */
export function getTermInfo(termId: string): TermInfo | undefined {
  return TERM_MAP[termId as TermId];
}

/**
 * Get the previous term before a given term.
 * Returns null if at the first term (1-1).
 */
export function getPrevTermInfo(termId: TermId): TermInfo | null {
  const idx = TERM_ORDER.indexOf(termId);
  if (idx <= 0) return null;
  return TERM_MAP[TERM_ORDER[idx - 1]];
}

/**
 * Group students by their current term into TermGroups.
 */
export function groupStudentsByTerm(students: TermStudent[]): TermGroup[] {
  return TERMS.map((termInfo) => {
    const termStudents = students.filter((s) => s.term === termInfo.id);
    const nextTerm = getNextTermInfo(termInfo.id);
    const prevTerm = getPrevTermInfo(termInfo.id);
    return {
      termInfo,
      students: termStudents.sort((a, b) => a.roll_no.localeCompare(b.roll_no)),
      nextTerm,
      prevTerm,
    };
  });
}

/**
 * Create initial expanded state (all collapsed).
 */
export function createInitialExpandedState(): ExpandedTerms {
  return Object.fromEntries(TERM_ORDER.map((t) => [t, false])) as ExpandedTerms;
}

/**
 * Create initial selected students state (all empty).
 */
export function createInitialSelectedState(): SelectedStudents {
  return Object.fromEntries(TERM_ORDER.map((t) => [t, new Set<string>()])) as SelectedStudents;
}
