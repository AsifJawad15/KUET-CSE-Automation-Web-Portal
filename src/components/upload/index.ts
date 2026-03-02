// ==========================================
// Shared Upload — Barrel Export
// ==========================================

export { default as FileUploadModal } from './FileUploadModal';
export { parseCSV } from './csvParser';
export type {
  ColumnDef,
  ParsedRecord,
  UploadEntityConfig,
  BulkImportResult,
} from './types';

// ── Per-entity configurations ──
export {
  courseUploadConfig,
  teacherUploadConfig,
  studentUploadConfig,
  roomUploadConfig,
  courseAllocationUploadConfig,
  createRoutineUploadConfig,
} from './configs';
