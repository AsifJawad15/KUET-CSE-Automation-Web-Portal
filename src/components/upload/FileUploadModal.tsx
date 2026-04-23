"use client";

// ==========================================
// Shared File Upload Modal
// Single Responsibility: 3-step upload wizard (Upload → Preview → Result)
// Open/Closed: Entity-specific behavior via UploadEntityConfig
// Dependency Inversion: Depends on UploadEntityConfig abstraction
// ==========================================

import React, { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  X, Upload, FileSpreadsheet, Loader2, AlertCircle,
  CheckCircle2, Download, Trash2,
} from 'lucide-react';
import type { UploadEntityConfig, ParsedRecord, BulkImportResult } from './types';
import { parseCSV } from './csvParser';

// ── Props ──────────────────────────────────────────────

interface FileUploadModalProps {
  show: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  config: UploadEntityConfig;
  /** Extra fields to merge into the POST body alongside items */
  extraBody?: Record<string, unknown>;
}

// ── Steps ──────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'result';

// ── Styles ─────────────────────────────────────────────

const btnPrimary = 'px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50 transition-opacity flex items-center gap-2';
const btnSecondary = 'px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2';

// ── Component ──────────────────────────────────────────

export default function FileUploadModal({
  show,
  onClose,
  onImportComplete,
  extraBody,
  config,
}: FileUploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setStep('upload');
    setParsedRecords([]);
    setParseErrors([]);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleClose = () => { reset(); onClose(); };

  // ── File Handling ──────────────────────────────────

  const handleFile = async (file: File) => {
    setLoading(true);
    setParseErrors([]);

    const fileName = file.name.toLowerCase();

    try {
      if (fileName.endsWith('.csv')) {
        // Client-side CSV parsing
        const text = await file.text();
        const { records, errors } = parseCSV(text, config.columns);
        setParsedRecords(records);
        setParseErrors(errors);
        setStep(records.length > 0 ? 'preview' : 'upload');
      } else if (
        (fileName.endsWith('.docx') || fileName.endsWith('.doc')) &&
        config.parseEndpoint
      ) {
        // Server-side parsing for DOCX
        const formData = new FormData();
        formData.append('file', file);
        // Append context fields if available
        config.contextFields?.forEach((cf) => {
          formData.append(cf.label.toLowerCase().replace(/\s+/g, '_'), cf.value);
        });

        const res = await fetch(config.parseEndpoint, { method: 'POST', body: formData });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `Server parsing failed (${res.status})`);

        // Server returns { slots/records/items, errors } — normalize to records
        const items: ParsedRecord[] = data.slots || data.records || data.items || [];
        setParsedRecords(items);
        setParseErrors(data.errors || []);
        setStep(items.length > 0 ? 'preview' : 'upload');
      } else if (
        (fileName.endsWith('.docx') || fileName.endsWith('.doc')) &&
        !config.parseEndpoint
      ) {
        // Entity has no server-side parser — use shared one
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entity', config.entityName.toLowerCase());
        formData.append('columns', JSON.stringify(config.columns.map(c => ({
          key: c.key,
          label: c.label,
          aliases: c.aliases,
        }))));

        const res = await fetch('/api/upload/parse', { method: 'POST', body: formData });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `Failed to parse file (${res.status})`);

        const items: ParsedRecord[] = data.records || [];
        setParsedRecords(items);
        setParseErrors(data.errors || []);
        setStep(items.length > 0 ? 'preview' : 'upload');
      } else {
        setParseErrors(['Unsupported format. Use CSV or DOCX.']);
      }
    } catch (err: unknown) {
      setParseErrors([err instanceof Error ? err.message : 'Failed to parse file']);
    } finally {
      setLoading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Import ─────────────────────────────────────────

  const handleImport = async () => {
    setImporting(true);
    setParseErrors([]);

    try {
      // Transform records via entity config
      const { items, errors: transformErrors } = config.transformForApi(parsedRecords);

      if (transformErrors.length > 0) {
        setParseErrors(transformErrors);
      }

      if (items.length === 0) {
        setParseErrors((prev) => [...prev, 'No valid records to import.']);
        setImporting(false);
        return;
      }

      const res = await fetch(config.bulkEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, ...extraBody }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Import failed (${res.status})`);
      }

      const result: BulkImportResult = await res.json();
      setImportResult(result);
      setStep('result');
      onImportComplete();
    } catch (err: unknown) {
      setParseErrors([err instanceof Error ? err.message : 'Import failed']);
    } finally {
      setImporting(false);
    }
  };

  // ── Remove row ─────────────────────────────────────

  const removeRecord = (idx: number) => {
    setParsedRecords((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Template Download ──────────────────────────────

  const downloadTemplate = () => {
    const blob = new Blob([config.generateTemplate()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.entityName.toLowerCase()}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Visible columns (for preview table) ────────────

  const visibleCols = config.columns.filter((c) => !c.key.startsWith('_'));

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-full max-w-3xl border border-gray-200 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-700 dark:text-white">
                {step === 'upload' && `Upload ${config.entityNamePlural}`}
                {step === 'preview' && `Preview ${config.entityNamePlural}`}
                {step === 'result' && 'Import Results'}
              </h2>
              <button onClick={handleClose} className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Context Badge */}
            {config.contextFields && config.contextFields.length > 0 && (
              <div className="text-xs text-gray-400/70 bg-gray-50 rounded-lg p-3 border border-gray-200 mb-4">
                {config.contextFields.map((cf, i) => (
                  <span key={cf.label}>
                    {i > 0 && <span>&nbsp;&bull;&nbsp;</span>}
                    {cf.label}: <span className="font-medium text-gray-700 dark:text-white">{cf.value}</span>
                  </span>
                ))}
              </div>
            )}

            {/* ── STEP: Upload ─────────────────────── */}
            {step === 'upload' && (
              <div className="space-y-4">
                {/* Drop Zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer"
                  onClick={() => fileRef.current?.click()}
                >
                  {loading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 animate-spin text-indigo-500 dark:text-red-600" />
                      <p className="text-sm text-gray-400">Parsing file...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mx-auto text-indigo-500 dark:text-red-600 mb-3" />
                      <p className="text-gray-700 dark:text-white font-medium">Drop file here or click to browse</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Supports CSV, DOCX
                      </p>
                    </>
                  )}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept={'.csv,.docx,.doc'}
                  className="hidden"
                  onChange={handleFileInput}
                />

                {/* Template Download */}
                <button onClick={downloadTemplate} className={btnSecondary}>
                  <Download className="w-4 h-4" />
                  Download CSV Template
                </button>

                {/* Parse Errors */}
                {parseErrors.length > 0 && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg space-y-1">
                    {parseErrors.map((err, i) => (
                      <p key={i} className="text-sm text-red-500 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        {err}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── STEP: Preview ────────────────────── */}
            {step === 'preview' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  Found <span className="font-bold text-gray-700 dark:text-white">{parsedRecords.length}</span> {config.entityNamePlural.toLowerCase()}.
                  Review and remove any incorrect entries before importing.
                </p>

                {/* Parse warnings */}
                {parseErrors.length > 0 && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    {parseErrors.map((e, i) => (
                      <p key={i} className="text-xs text-amber-600 dark:text-amber-400">{e}</p>
                    ))}
                  </div>
                )}

                {/* Preview Table */}
                <div className="overflow-x-auto max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-white/5 sticky top-0">
                      <tr>
                        {visibleCols.map((col) => (
                          <th key={col.key} className="p-2 text-left text-gray-700 dark:text-white/70">{col.label}</th>
                        ))}
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRecords.map((rec, i) => (
                        <tr key={i} className="border-t border-gray-200 hover:bg-gray-50/50">
                          {visibleCols.map((col) => (
                            <td key={col.key} className="p-2 text-gray-700 dark:text-white">
                              {rec[col.key] || '—'}
                            </td>
                          ))}
                          <td className="p-2">
                            <button onClick={() => removeRecord(i)} className="text-red-400 hover:text-red-300">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                  <button onClick={reset} className={btnSecondary}>
                    <Upload className="w-4 h-4" />
                    Re-upload
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing || parsedRecords.length === 0}
                    className={btnPrimary}
                  >
                    {importing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                    ) : (
                      <><FileSpreadsheet className="w-4 h-4" /> Import {parsedRecords.length} {config.entityNamePlural}</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: Result ─────────────────────── */}
            {step === 'result' && importResult && (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">{importResult.inserted}</p>
                    <p className="text-xs text-green-600 dark:text-green-500">Inserted</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-500/10 border border-gray-200 dark:border-gray-500/30 text-center">
                    <FileSpreadsheet className="w-6 h-6 text-gray-500 dark:text-gray-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-gray-700 dark:text-gray-400">{importResult.skipped}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">Skipped (duplicate)</p>
                  </div>
                </div>

                {/* Auto-created resources info */}
                {importResult.created && Object.keys(importResult.created).length > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg space-y-2">
                    <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                      Auto-created resources:
                    </p>
                    {Object.entries(importResult.created).map(([key, values]) =>
                      values.length > 0 ? (
                        <p key={key} className="text-xs text-blue-600 dark:text-blue-500">
                          {key}: {values.join(', ')}
                        </p>
                      ) : null
                    )}
                  </div>
                )}

                {/* Errors */}
                {importResult.errors.length > 0 && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg space-y-1 max-h-40 overflow-y-auto">
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-500">{e}</p>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <button onClick={handleClose} className={btnPrimary}>
                    Done
                  </button>
                </div>
              </div>
            )}
      </motion.div>
    </motion.div>
  );
}
