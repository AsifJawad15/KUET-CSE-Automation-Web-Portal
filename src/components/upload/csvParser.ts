// ==========================================
// Shared CSV Parser
// Single Responsibility: Parse CSV text into records using ColumnDef[]
// Reusable across all entity uploads
// ==========================================

import type { ColumnDef, ParsedRecord } from './types';

/**
 * Parse CSV text into an array of ParsedRecords based on column definitions.
 * Handles quoted fields, flexible column name matching, transforms & validation.
 */
export function parseCSV(
  text: string,
  columns: ColumnDef[],
): { records: ParsedRecord[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) {
    return { records: [], errors: ['CSV must have a header row and at least one data row.'] };
  }

  // ── Resolve header → column index mapping ──
  const header = lines[0]
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/[\s\-]+/g, '_'));

  const colIndexMap = new Map<string, number>();
  const missingRequired: string[] = [];

  for (const col of columns) {
    const idx = header.findIndex((h) =>
      col.aliases.some((alias) => h.includes(alias.toLowerCase())),
    );
    if (idx !== -1) {
      colIndexMap.set(col.key, idx);
    } else if (col.required) {
      missingRequired.push(col.label);
    }
  }

  if (missingRequired.length > 0) {
    return {
      records: [],
      errors: [`Missing required columns: ${missingRequired.join(', ')}`],
    };
  }

  // ── Parse rows ──
  const records: ParsedRecord[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const record: ParsedRecord = {};
    let rowHasError = false;

    for (const col of columns) {
      const idx = colIndexMap.get(col.key);
      let value = idx !== undefined ? (cells[idx] || '').trim() : '';

      // Apply default
      if (!value && col.defaultValue !== undefined) {
        value = col.defaultValue;
      }

      // Apply transform
      if (col.transform) {
        value = col.transform(value);
      }

      // Validate
      if (col.validate) {
        const err = col.validate(value, i + 1);
        if (err) {
          errors.push(err);
          rowHasError = true;
          break;
        }
      }

      // Required check (value level — column was found but cell is empty)
      if (col.required && !value) {
        errors.push(`Row ${i + 1}: Missing required field "${col.label}"`);
        rowHasError = true;
        break;
      }

      record[col.key] = value;
    }

    if (!rowHasError) {
      records.push(record);
    }
  }

  return { records, errors };
}

/**
 * Split a CSV line handling quoted fields.
 * "John, Doe",email → ["John, Doe", "email"]
 */
function splitCSVLine(line: string): string[] {
  const result =
    line
      .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      ?.map((c) => c.replace(/^"|"$/g, '').trim()) ||
    line.split(',').map((c) => c.trim());
  return result;
}
