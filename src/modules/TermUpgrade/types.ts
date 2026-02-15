// ==========================================
// Term Upgrade Module — Type Definitions
// ==========================================

/** Academic term identifier (e.g., '1-1' = Year 1, Term 1) */
export type TermId = '1-1' | '1-2' | '2-1' | '2-2' | '3-1' | '3-2' | '4-1' | '4-2';

/** Direction of term change */
export type TermChangeDirection = 'upgrade' | 'downgrade';

/** Metadata for a single academic term */
export interface TermInfo {
  id: TermId;
  label: string;       // e.g., "1st Year 1st Term"
  shortLabel: string;   // e.g., "Y1-T1"
  year: number;
  term: number;
  colorClass: string;   // Tailwind color classes for the term badge
  bgClass: string;      // Background color for the accordion header
  iconColor: string;    // Spotlight card color
}

/** Student row within a term accordion — with selection state */
export interface TermStudent {
  user_id: string;
  roll_no: string;
  full_name: string;
  session: string;
  section: string | null;
  batch: string | null;
  cgpa: number;
  term: string;
}

/** Grouped students by term for display */
export interface TermGroup {
  termInfo: TermInfo;
  students: TermStudent[];
  nextTerm: TermInfo | null;
  prevTerm: TermInfo | null;
}

/** Modal state for confirm dialog */
export interface TermChangeModalState {
  fromTermId: TermId;
  targetTermId: TermId;
  direction: TermChangeDirection;
}

/** Bulk change result */
export interface BulkChangeResult {
  totalRequested: number;
  successCount: number;
  failedCount: number;
  errors: { studentId: string; error: string }[];
}

/** Accordion expand state */
export type ExpandedTerms = Record<TermId, boolean>;

/** Selected students state: termId -> Set of user_ids */
export type SelectedStudents = Record<TermId, Set<string>>;
