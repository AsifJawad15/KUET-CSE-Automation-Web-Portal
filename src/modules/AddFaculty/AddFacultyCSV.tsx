"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { TeacherDesignation } from '@/lib/supabase';
import { addTeacher, AddTeacherResponse } from '@/services/teacherService';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, Trash2, CheckCircle2, XCircle, Loader2, Download, AlertCircle, X } from 'lucide-react';
import { useRef, useState } from 'react';

interface CSVRow {
  full_name: string;
  email: string;
  phone: string;
  designation: TeacherDesignation;
}

interface UploadResult {
  row: CSVRow;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  generatedPassword?: string;
}

const VALID_DESIGNATIONS: TeacherDesignation[] = ['PROFESSOR', 'ASSOCIATE_PROFESSOR', 'ASSISTANT_PROFESSOR', 'LECTURER'];

function parseDesignation(raw: string): TeacherDesignation | null {
  const normalized = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (VALID_DESIGNATIONS.includes(normalized as TeacherDesignation)) return normalized as TeacherDesignation;
  // Friendly mappings
  const map: Record<string, TeacherDesignation> = {
    'PROFESSOR': 'PROFESSOR',
    'PROF': 'PROFESSOR',
    'ASSOCIATE_PROFESSOR': 'ASSOCIATE_PROFESSOR',
    'ASSOCIATE_PROF': 'ASSOCIATE_PROFESSOR',
    'ASSISTANT_PROFESSOR': 'ASSISTANT_PROFESSOR',
    'ASSISTANT_PROF': 'ASSISTANT_PROFESSOR',
    'LECTURER': 'LECTURER',
    'LECT': 'LECTURER',
  };
  return map[normalized] || null;
}

function parseCSV(text: string): { rows: CSVRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return { rows: [], errors: ['CSV file must have a header row and at least one data row.'] };

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const nameIdx = header.findIndex((h) => h.includes('name') || h === 'full_name');
  const emailIdx = header.findIndex((h) => h.includes('email'));
  const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('mobile'));
  const desigIdx = header.findIndex((h) => h.includes('designation') || h.includes('rank') || h.includes('position'));

  if (nameIdx === -1 || emailIdx === -1) {
    return { rows: [], errors: ['CSV must contain "Full Name" and "Email" columns.'] };
  }

  const rows: CSVRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted CSV fields
    const cols = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map((c) => c.replace(/^"|"$/g, '').trim()) || lines[i].split(',').map((c) => c.trim());

    const name = cols[nameIdx] || '';
    const email = cols[emailIdx] || '';
    const phone = phoneIdx !== -1 ? (cols[phoneIdx] || '') : '';
    const rawDesig = desigIdx !== -1 ? (cols[desigIdx] || 'LECTURER') : 'LECTURER';

    if (!name || !email) {
      errors.push(`Row ${i + 1}: Missing name or email, skipped.`);
      continue;
    }

    const designation = parseDesignation(rawDesig);
    if (!designation) {
      errors.push(`Row ${i + 1}: Invalid designation "${rawDesig}", defaulting to Lecturer.`);
    }

    rows.push({ full_name: name, email, phone, designation: designation || 'LECTURER' });
  }

  return { rows, errors };
}

const DESIGNATION_LABELS: Record<TeacherDesignation, string> = {
  PROFESSOR: 'Professor',
  ASSOCIATE_PROFESSOR: 'Assoc. Prof',
  ASSISTANT_PROFESSOR: 'Asst. Prof',
  LECTURER: 'Lecturer',
};

interface AddFacultyCSVProps {
  onComplete: () => void; // Called after upload finishes to refresh teacher list
}

export default function AddFacultyCSV({ onComplete }: AddFacultyCSVProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [passwordResults, setPasswordResults] = useState<{ name: string; email: string; password: string }[]>([]);
  const [showPasswords, setShowPasswords] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, errors } = parseCSV(text);
      setParseErrors(errors);
      setResults(rows.map((row) => ({ row, status: 'pending' })));
      setUploadDone(false);
      setPasswordResults([]);
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removeRow = (idx: number) => {
    setResults((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadAll = async () => {
    if (results.length === 0) return;
    setUploading(true);
    const passwords: { name: string; email: string; password: string }[] = [];

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'success') continue; // skip already uploaded

      setResults((prev) => prev.map((r, j) => (j === i ? { ...r, status: 'uploading' } : r)));

      const res: AddTeacherResponse = await addTeacher(results[i].row);

      if (res.success) {
        if (res.generatedPassword) {
          passwords.push({ name: results[i].row.full_name, email: results[i].row.email, password: res.generatedPassword });
        }
        setResults((prev) => prev.map((r, j) => (j === i ? { ...r, status: 'success', generatedPassword: res.generatedPassword } : r)));
      } else {
        setResults((prev) => prev.map((r, j) => (j === i ? { ...r, status: 'error', error: res.error } : r)));
      }
    }

    setPasswordResults(passwords);
    setUploading(false);
    setUploadDone(true);
    if (passwords.length > 0) setShowPasswords(true);
    onComplete();
  };

  const handleClear = () => {
    setResults([]);
    setParseErrors([]);
    setUploadDone(false);
    setPasswordResults([]);
  };

  const handleDownloadTemplate = () => {
    const csv = 'Full Name,Email,Phone,Designation\nDr. Example Name,example@cse.kuet.ac.bd,01712345678,Professor\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'faculty_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyAllPasswords = () => {
    const text = passwordResults.map((p) => `${p.name} | ${p.email} | ${p.password}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  const successCount = results.filter((r) => r.status === 'success').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const pendingCount = results.filter((r) => r.status === 'pending').length;

  return (
    <>
      <SpotlightCard className="p-6" spotlightColor="rgba(0, 229, 255, 0.12)">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-[#5D4E37] dark:text-white">Import Faculty from CSV</h2>
            <p className="text-sm text-[#8B7355] dark:text-white/50 mt-1">Upload a CSV file with columns: Full Name, Email, Phone, Designation</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-[#DCC5B2] dark:border-[#392e4e] text-[#5D4E37] dark:text-white/70 hover:bg-[#F0E4D3] dark:hover:bg-white/5 transition-colors"
          >
            <Download className="w-4 h-4" />
            Template
          </motion.button>
        </div>

        {/* Upload Area */}
        {results.length === 0 ? (
          <motion.div
            whileHover={{ borderColor: 'rgba(132, 0, 255, 0.5)' }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#DCC5B2] dark:border-[#392e4e] rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-[#F0E4D3]/30 dark:hover:bg-white/[0.02] transition-colors"
          >
            <Upload className="w-10 h-10 text-[#D9A299] dark:text-[#8400ff] mb-3" />
            <p className="text-[#5D4E37] dark:text-white font-medium">Click to upload CSV file</p>
            <p className="text-sm text-[#8B7355] dark:text-white/40 mt-1">or drag and drop</p>
          </motion.div>
        ) : (
          <>
            {/* Parse Errors */}
            {parseErrors.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                {parseErrors.map((err, i) => (
                  <p key={i} className="text-xs text-amber-500 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {err}
                  </p>
                ))}
              </div>
            )}

            {/* Summary Bar */}
            <div className="flex items-center justify-between mb-4 text-sm">
              <span className="text-[#8B7355] dark:text-white/60">
                {results.length} row{results.length > 1 ? 's' : ''} parsed
                {uploadDone && (
                  <span className="ml-2">
                    — <span className="text-emerald-400">{successCount} added</span>
                    {errorCount > 0 && <>, <span className="text-red-400">{errorCount} failed</span></>}
                  </span>
                )}
              </span>
              <div className="flex gap-2">
                <button onClick={handleClear} className="text-xs text-[#8B7355] dark:text-white/40 hover:text-red-400 transition-colors">
                  Clear All
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="text-xs text-[#D9A299] dark:text-[#8400ff] hover:underline">
                  Re-upload
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="border border-[#DCC5B2] dark:border-[#392e4e] rounded-xl overflow-hidden mb-4">
              <div className="overflow-x-auto max-h-[45vh] overflow-y-auto [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#DCC5B2] dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                <table className="w-full text-sm">
                  <thead className="bg-[#F0E4D3] dark:bg-white/5 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/70 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/70 uppercase tracking-wider">Full Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/70 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/70 uppercase tracking-wider">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/70 uppercase tracking-wider">Designation</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#5D4E37] dark:text-white/70 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCC5B2]/30 dark:divide-[#392e4e]/50">
                    {results.map((r, idx) => (
                      <tr key={idx} className={`transition-colors ${r.status === 'error' ? 'bg-red-500/5' : r.status === 'success' ? 'bg-emerald-500/5' : 'hover:bg-[#F0E4D3]/30 dark:hover:bg-white/[0.02]'}`}>
                        <td className="px-4 py-2.5 text-[#8B7355] dark:text-white/40 font-mono text-xs">{idx + 1}</td>
                        <td className="px-4 py-2.5 text-[#5D4E37] dark:text-white font-medium">{r.row.full_name}</td>
                        <td className="px-4 py-2.5 text-[#8B7355] dark:text-white/60 text-xs">{r.row.email}</td>
                        <td className="px-4 py-2.5 text-[#8B7355] dark:text-white/60 text-xs">{r.row.phone || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#8400ff]/10 text-[#a855f7] border border-[#8400ff]/20">
                            {DESIGNATION_LABELS[r.row.designation]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {r.status === 'pending' && <span className="text-xs text-[#8B7355] dark:text-white/40">Pending</span>}
                          {r.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-[#8400ff] mx-auto" />}
                          {r.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />}
                          {r.status === 'error' && (
                            <span className="text-xs text-red-400" title={r.error}>
                              <XCircle className="w-4 h-4 mx-auto" />
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {r.status === 'pending' && (
                            <button onClick={() => removeRow(idx)} className="text-[#8B7355] dark:text-white/30 hover:text-red-400 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Error details */}
            {errorCount > 0 && uploadDone && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-1">
                {results.filter((r) => r.status === 'error').map((r, i) => (
                  <p key={i} className="text-xs text-red-400">
                    <span className="font-medium">{r.row.full_name}</span>: {r.error}
                  </p>
                ))}
              </div>
            )}

            {/* Upload Button */}
            {pendingCount > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleUploadAll}
                disabled={uploading}
                className="w-full py-3 rounded-full bg-gradient-to-r from-[#00e5ff] to-[#8400ff] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#8400ff]/20"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading {successCount + errorCount}/{results.length}...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Upload {pendingCount} Faculty Member{pendingCount > 1 ? 's' : ''}
                  </>
                )}
              </motion.button>
            )}
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </SpotlightCard>

      {/* Generated Passwords Modal */}
      <AnimatePresence>
        {showPasswords && passwordResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPasswords(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FAF7F3] dark:bg-[#1a1a2e] border border-[#DCC5B2] dark:border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#5D4E37] dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#D9A299] dark:text-[#8400ff]" />
                  Generated Passwords
                </h3>
                <button onClick={() => setShowPasswords(false)} className="text-[#8B7355] dark:text-white/50 hover:text-[#5D4E37] dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-amber-500 dark:text-amber-400 mb-3">
                ⚠ Save these passwords now — they cannot be retrieved later.
              </p>

              <div className="overflow-y-auto flex-1 space-y-2 mb-4 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#DCC5B2] dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                {passwordResults.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-white/50 dark:bg-white/5 border border-[#DCC5B2]/50 dark:border-white/10 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#5D4E37] dark:text-white truncate">{p.name}</p>
                      <p className="text-xs text-[#8B7355] dark:text-white/40 truncate">{p.email}</p>
                    </div>
                    <span className="font-mono text-lg tracking-widest text-[#8400ff] dark:text-[#a855f7] ml-4">{p.password}</span>
                  </div>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCopyAllPasswords}
                className="w-full py-2.5 rounded-full bg-gradient-to-r from-[#8400ff] to-[#a855f7] text-white font-medium flex items-center justify-center gap-2"
              >
                Copy All Passwords
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
