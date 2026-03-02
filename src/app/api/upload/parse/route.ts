// ==========================================
// API: /api/upload/parse
// Generic file parser for DOCX
// Extracts text and attempts to parse into records
// using column definitions sent from the client
// ==========================================

import { NextRequest } from 'next/server';
import { badRequest, internalError } from '@/lib/apiResponse';

// ── Text Extraction ────────────────────────────────────

async function extractTextFromDOCX(buffer: ArrayBuffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return result.value;
}

// ── Column Info (from client) ──────────────────────────

interface ColumnInfo {
  key: string;
  label: string;
  aliases: string[];
}

// ── Line → Record Parser ──────────────────────────────

function parseTextToRecords(
  rawText: string,
  columns: ColumnInfo[],
): { records: Record<string, string>[]; errors: string[] } {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { records: [], errors: ['Could not extract enough structured text from the file.'] };
  }

  // Try to find a header row
  const headerIdx = lines.findIndex((line) => {
    const lower = line.toLowerCase();
    return columns.some((col) =>
      col.aliases.some((alias) => lower.includes(alias.toLowerCase())),
    );
  });

  if (headerIdx === -1) {
    return { records: [], errors: ['Could not find a recognized header row in the document. Please use CSV format instead.'] };
  }

  // Parse header
  const headerLine = lines[headerIdx];
  const headerCells = splitLine(headerLine);
  const headerLower = headerCells.map((h) =>
    h.toLowerCase().replace(/[\s\-]+/g, '_'),
  );

  // Map columns to indices
  const colIndexMap = new Map<string, number>();
  for (const col of columns) {
    const idx = headerLower.findIndex((h) =>
      col.aliases.some((alias) => h.includes(alias.toLowerCase())),
    );
    if (idx !== -1) colIndexMap.set(col.key, idx);
  }

  if (colIndexMap.size === 0) {
    return { records: [], errors: ['Could not match any columns from the document.'] };
  }

  // Parse data rows
  const records: Record<string, string>[] = [];
  const errors: string[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    if (cells.length === 0) continue;

    const record: Record<string, string> = {};
    let hasValue = false;

    for (const col of columns) {
      const idx = colIndexMap.get(col.key);
      const value = idx !== undefined ? (cells[idx] || '').trim() : '';
      record[col.key] = value;
      if (value) hasValue = true;
    }

    if (hasValue) records.push(record);
  }

  if (records.length === 0) {
    errors.push('No data rows could be extracted. The document format may not be supported.');
  }

  return { records, errors };
}

/** Split a line by common delimiters: tab, pipe, comma, multiple spaces */
function splitLine(line: string): string[] {
  // Try tab first
  if (line.includes('\t')) return line.split('\t').map((s) => s.trim());
  // Try pipe
  if (line.includes('|')) return line.split('|').map((s) => s.trim()).filter(Boolean);
  // Try comma
  if (line.includes(',')) return line.split(',').map((s) => s.trim());
  // Try multiple spaces (table-like)
  return line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
}

// ── POST Handler ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const columnsJson = formData.get('columns') as string | null;

    if (!file) return badRequest('No file uploaded');
    if (!columnsJson) return badRequest('No column definitions provided');

    let columns: ColumnInfo[];
    try {
      columns = JSON.parse(columnsJson);
    } catch {
      return badRequest('Invalid column definitions');
    }

    const fileName = file.name.toLowerCase();
    const buffer = await file.arrayBuffer();

    let rawText: string;

    if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      rawText = await extractTextFromDOCX(buffer);
    } else {
      return badRequest('Unsupported file format. Use CSV or DOCX.');
    }

    if (!rawText || rawText.trim().length === 0) {
      return Response.json({
        records: [],
        errors: ['Could not extract any text from the file. It may be image-based or empty.'],
      });
    }

    const { records, errors } = parseTextToRecords(rawText, columns);

    return Response.json({ records, errors });
  } catch (error: unknown) {
    console.error('Parse error:', error);
    return internalError(error instanceof Error ? error.message : 'Failed to parse file');
  }
}
