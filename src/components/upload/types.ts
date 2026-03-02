// ==========================================
// Shared File Upload Types & Configuration
// Single Responsibility: Type definitions for the generic upload system
// Open/Closed: Entity-specific configs extend these base types
// ==========================================

// ── Column Definition ──────────────────────────────────

/**
 * Defines one column for CSV parsing + preview table display.
 * Each entity provides an array of these to configure parsing.
 */
export interface ColumnDef {
  /** Internal key in the parsed record */
  key: string;
  /** Human-friendly header label */
  label: string;
  /** Whether this column is required (fatal if missing in CSV header) */
  required?: boolean;
  /** Alternative header names that match this column (case-insensitive, partial) */
  aliases: string[];
  /** Transform raw cell value before storing */
  transform?: (raw: string) => string;
  /** Validate cell value; return error string or null */
  validate?: (value: string, rowIndex: number) => string | null;
  /** Default value when column missing or empty */
  defaultValue?: string;
}

// ── Parsed Record ──────────────────────────────────────

/** Generic parsed record — just a string-keyed object */
export type ParsedRecord = Record<string, string>;

// ── Upload Entity Config ───────────────────────────────

/**
 * Configuration for a specific entity's upload behavior.
 * Each page provides one of these to the shared FileUploadModal.
 */
export interface UploadEntityConfig {
  /** Display name for the entity, e.g. "Course", "Faculty" */
  entityName: string;
  /** Plural form, e.g. "Courses", "Faculty Members" */
  entityNamePlural: string;
  /** Column definitions for CSV parsing & preview table */
  columns: ColumnDef[];
  /** API endpoint for bulk import (POST) */
  bulkEndpoint: string;
  /** API endpoint for file parsing (POST, FormData) — null = client-only CSV */
  parseEndpoint?: string;
  /** Generate CSV template content */
  generateTemplate: () => string;
  /**
   * Transform parsed records into the shape expected by the bulk API.
   * Return { items, errors }. Items is the array to POST.
   */
  transformForApi: (records: ParsedRecord[]) => {
    items: Record<string, unknown>[];
    errors: string[];
  };
  /** If provided, extra context fields shown in the header badge */
  contextFields?: { label: string; value: string }[];
}

// ── Bulk Import Result ─────────────────────────────────

/**
 * Standardized bulk import result from any entity's bulk endpoint.
 */
export interface BulkImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
  /** Optional: resources auto-created by the import */
  created?: Record<string, string[]>;
}
