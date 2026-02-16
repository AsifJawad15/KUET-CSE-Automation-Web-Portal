"use client";

import { TermStudent } from './types';
import { motion } from 'framer-motion';
import { Check, Minus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

interface StudentSelectionTableProps {
  students: TermStudent[];
  selectedIds: Set<string>;
  onToggleStudent: (userId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export default function StudentSelectionTable({
  students,
  selectedIds,
  onToggleStudent,
  onSelectAll,
  onDeselectAll,
}: StudentSelectionTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.roll_no.toLowerCase().includes(q) ||
        s.session.includes(q)
    );
  }, [students, searchQuery]);

  const allSelected = filteredStudents.length > 0 && filteredStudents.every((s) => selectedIds.has(s.user_id));
  const someSelected = filteredStudents.some((s) => selectedIds.has(s.user_id));

  const handleHeaderCheckbox = () => {
    if (allSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  if (students.length === 0) {
    return (
      <div className="py-8 text-center text-[#8B7355] dark:text-white/40 text-sm">
        No students found in this term.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search & Count Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7355] dark:text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or roll..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#DCC5B2] dark:border-white/10 bg-white dark:bg-[#1a1a2e] text-[#5D4E37] dark:text-white text-sm focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] outline-none"
          />
        </div>
        <span className="text-xs text-[#8B7355] dark:text-white/40 whitespace-nowrap">
          {selectedIds.size} of {students.length} selected
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[#DCC5B2] dark:border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F0E4D3]/60 dark:bg-white/5 border-b border-[#DCC5B2] dark:border-white/10">
              <th className="w-12 px-3 py-2.5">
                <button
                  onClick={handleHeaderCheckbox}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    allSelected
                      ? 'bg-[#D9A299] dark:bg-[#8400ff] border-[#D9A299] dark:border-[#8400ff]'
                      : someSelected
                      ? 'bg-[#D9A299]/50 dark:bg-[#8400ff]/50 border-[#D9A299] dark:border-[#8400ff]'
                      : 'border-[#DCC5B2] dark:border-white/20 hover:border-[#D9A299] dark:hover:border-[#8400ff]'
                  }`}
                >
                  {allSelected ? (
                    <Check className="w-3 h-3 text-white" />
                  ) : someSelected ? (
                    <Minus className="w-3 h-3 text-white" />
                  ) : null}
                </button>
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider">
                Roll No
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider">
                Name
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider hidden sm:table-cell">
                Session
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider hidden md:table-cell">
                Section
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#5D4E37] dark:text-white/60 uppercase tracking-wider hidden md:table-cell">
                CGPA
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCC5B2]/50 dark:divide-white/5">
            {filteredStudents.map((student, i) => {
              const isSelected = selectedIds.has(student.user_id);
              return (
                <motion.tr
                  key={student.user_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => onToggleStudent(student.user_id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#D9A299]/10 dark:bg-[#8400ff]/10'
                      : 'hover:bg-[#F0E4D3]/40 dark:hover:bg-white/[0.02]'
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[#D9A299] dark:bg-[#8400ff] border-[#D9A299] dark:border-[#8400ff]'
                          : 'border-[#DCC5B2] dark:border-white/20'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[#5D4E37] dark:text-white/80 text-xs">
                    {student.roll_no}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-[#5D4E37] dark:text-white">
                    {student.full_name}
                  </td>
                  <td className="px-3 py-2.5 text-[#8B7355] dark:text-white/50 hidden sm:table-cell">
                    {student.session}
                  </td>
                  <td className="px-3 py-2.5 text-[#8B7355] dark:text-white/50 hidden md:table-cell">
                    {student.section || '—'}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    <span
                      className={`font-medium ${
                        student.cgpa >= 3.5
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : student.cgpa >= 3.0
                          ? 'text-blue-600 dark:text-blue-400'
                          : student.cgpa > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-[#8B7355] dark:text-white/30'
                      }`}
                    >
                      {student.cgpa > 0 ? student.cgpa.toFixed(2) : '—'}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredStudents.length === 0 && searchQuery && (
        <p className="text-center text-sm text-[#8B7355] dark:text-white/40 py-4">
          No students match &quot;{searchQuery}&quot;
        </p>
      )}
    </div>
  );
}
