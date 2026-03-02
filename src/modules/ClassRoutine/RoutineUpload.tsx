"use client";

import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, FileSpreadsheet, Loader2, AlertCircle,
  CheckCircle2, Download, Trash2,
} from 'lucide-react';
import { DAYS, PERIODS } from './constants';
import type { ParsedRoutineSlot, BulkImportResult } from './types';
import { parseCSVText, generateCSVTemplate } from './routineParser';

// ── Props ──────────────────────────────────────────────

interface RoutineUploadProps {
  show: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  term: string;
  session: string;
  section: string;
}

// ── Steps ──────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'result';

// ── Component ──────────────────────────────────────────

export default function RoutineUpload({ show, onClose, onImportComplete, term, session, section }: RoutineUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [parsedSlots, setParsedSlots] = useState<ParsedRoutineSlot[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Styles
  const btnPrimary = 'px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white rounded-lg font-medium disabled:opacity-50 transition-opacity flex items-center gap-2';
  const btnSecondary = 'px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] text-[#5D4E37] dark:text-[#b1a7a6] rounded-lg hover:bg-[#F0E4D3] dark:hover:bg-[#3d4951]/30 transition-colors flex items-center gap-2';

  const reset = useCallback(() => {
    setStep('upload');
    setParsedSlots([]);
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
        const { slots, errors } = parseCSVText(text, term, session, section);
        setParsedSlots(slots);
        setParseErrors(errors);
        setStep(slots.length > 0 ? 'preview' : 'upload');
      } else if (fileName.endsWith('.pdf') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        // Server-side parsing for PDF/DOCX
        const formData = new FormData();
        formData.append('file', file);
        formData.append('term', term);
        formData.append('session', session);
        formData.append('section', section);

        const res = await fetch('/api/routine-slots/parse', { method: 'POST', body: formData });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `Server parsing failed (${res.status})`);
        setParsedSlots(data.slots || []);
        setParseErrors(data.errors || []);
        setStep(data.slots?.length > 0 ? 'preview' : 'upload');
      } else {
        setParseErrors(['Unsupported format. Use CSV, PDF, or DOCX.']);
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
    try {
      const res = await fetch('/api/routine-slots/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: parsedSlots }),
      });

      if (!res.ok) throw new Error('Import failed');
      const result: BulkImportResult = await res.json();
      setImportResult(result);
      setStep('result');

      // Notify parent to refresh grid
      onImportComplete();
    } catch (err: unknown) {
      setParseErrors([err instanceof Error ? err.message : 'Import failed']);
    } finally {
      setImporting(false);
    }
  };

  // ── Remove parsed slot ─────────────────────────────

  const removeSlot = (idx: number) => {
    setParsedSlots((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── CSV Template Download ──────────────────────────

  const downloadTemplate = () => {
    const blob = new Blob([generateCSVTemplate()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'routine_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Day/Period Label Helpers ───────────────────────

  const dayLabel = (d: number) => DAYS.find((x) => x.value === d)?.label || `Day ${d}`;
  const periodLabel = (time: string, isEnd = false) => {
    const p = isEnd
      ? PERIODS.find((x) => x.end === time)
      : PERIODS.find((x) => x.start === time);
    return p ? `P${p.id}` : time;
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FAF7F3] dark:bg-[#161a1d] rounded-2xl p-6 w-full max-w-3xl border border-[#DCC5B2] dark:border-[#3d4951] shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-[#5D4E37] dark:text-white">
                {step === 'upload' && 'Upload Routine File'}
                {step === 'preview' && 'Preview Parsed Routine'}
                {step === 'result' && 'Import Results'}
              </h2>
              <button onClick={handleClose} className="p-1.5 hover:bg-[#F0E4D3] dark:hover:bg-[#3d4951]/30 rounded-lg transition-colors">
                <X className="w-5 h-5 text-[#8B7355] dark:text-[#b1a7a6]" />
              </button>
            </div>

            {/* Context Badge */}
            <div className="text-xs text-[#8B7355] dark:text-[#b1a7a6]/70 bg-[#F0E4D3] dark:bg-[#0b090a] rounded-lg p-3 border border-[#DCC5B2] dark:border-[#3d4951] mb-4">
              Term: <span className="font-medium text-[#5D4E37] dark:text-white">{term}</span>
              &nbsp;•&nbsp;Session: <span className="font-medium text-[#5D4E37] dark:text-white">{session}</span>
              &nbsp;•&nbsp;Section: <span className="font-medium text-[#5D4E37] dark:text-white">{section}</span>
            </div>

            {/* ── STEP: Upload ─────────────────────── */}
            {step === 'upload' && (
              <div className="space-y-4">
                {/* Drop Zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-[#DCC5B2] dark:border-[#3d4951] rounded-xl p-8 text-center hover:border-[#D9A299] dark:hover:border-[#ba181b] transition-colors cursor-pointer"
                  onClick={() => fileRef.current?.click()}
                >
                  {loading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 animate-spin text-[#D9A299] dark:text-[#ba181b]" />
                      <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6]">Parsing file...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mx-auto text-[#D9A299] dark:text-[#ba181b] mb-3" />
                      <p className="text-[#5D4E37] dark:text-white font-medium">Drop file here or click to browse</p>
                      <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6] mt-1">
                        Supports CSV, PDF, DOCX
                      </p>
                    </>
                  )}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.pdf,.docx,.doc"
                  className="hidden"
                  onChange={handleFileInput}
                />

                {/* CSV Template Download */}
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
                <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6]">
                  Found <span className="font-bold text-[#5D4E37] dark:text-white">{parsedSlots.length}</span> slots.
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
                <div className="overflow-x-auto max-h-64 overflow-y-auto border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-[#F0E4D3] dark:bg-white/5 sticky top-0">
                      <tr>
                        <th className="p-2 text-left text-[#5D4E37] dark:text-white/70">Day</th>
                        <th className="p-2 text-left text-[#5D4E37] dark:text-white/70">Period</th>
                        <th className="p-2 text-left text-[#5D4E37] dark:text-white/70">Course</th>
                        <th className="p-2 text-left text-[#5D4E37] dark:text-white/70">Teacher</th>
                        <th className="p-2 text-left text-[#5D4E37] dark:text-white/70">Room</th>
                        <th className="p-2 text-left text-[#5D4E37] dark:text-white/70">Type</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedSlots.map((slot, i) => (
                        <tr key={i} className="border-t border-[#DCC5B2] dark:border-[#3d4951] hover:bg-[#F0E4D3]/50 dark:hover:bg-white/5">
                          <td className="p-2 text-[#5D4E37] dark:text-white">{dayLabel(slot.day_of_week)}</td>
                          <td className="p-2 text-[#8B7355] dark:text-[#b1a7a6]">{periodLabel(slot.start_time)}–{periodLabel(slot.end_time, true)}</td>
                          <td className="p-2 font-medium text-[#5D4E37] dark:text-white">{slot.course_code}</td>
                          <td className="p-2 text-[#8B7355] dark:text-[#b1a7a6]">{slot.teacher_name || '—'}</td>
                          <td className="p-2 text-[#8B7355] dark:text-[#b1a7a6]">{slot.room_number || '—'}</td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              slot.course_type === 'lab'
                                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                                : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                            }`}>
                              {slot.course_type}
                            </span>
                          </td>
                          <td className="p-2">
                            <button onClick={() => removeSlot(i)} className="text-red-400 hover:text-red-300">
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
                    disabled={importing || parsedSlots.length === 0}
                    className={btnPrimary}
                  >
                    {importing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                    ) : (
                      <><FileSpreadsheet className="w-4 h-4" /> Import {parsedSlots.length} Slots</>
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
                {(importResult.created_courses?.length > 0 ||
                  importResult.created_rooms?.length > 0 ||
                  importResult.created_teachers?.length > 0) && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg space-y-2">
                    <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                      Auto-created resources:
                    </p>
                    {importResult.created_courses?.length > 0 && (
                      <p className="text-xs text-blue-600 dark:text-blue-500">
                        Courses: {importResult.created_courses.join(', ')}
                      </p>
                    )}
                    {importResult.created_teachers?.length > 0 && (
                      <p className="text-xs text-blue-600 dark:text-blue-500">
                        Teachers: {importResult.created_teachers.join(', ')}
                      </p>
                    )}
                    {importResult.created_rooms?.length > 0 && (
                      <p className="text-xs text-blue-600 dark:text-blue-500">
                        Rooms: {importResult.created_rooms.join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {/* Errors */}
                {importResult.errors.length > 0 && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg space-y-1">
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
      )}
    </AnimatePresence>
  );
}
