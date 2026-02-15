"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { TermGroup, TermId, TermInfo } from './types';
import { TERMS } from './constants';
import StudentSelectionTable from './StudentSelectionTable';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  GraduationCap,
  Loader2,
  MoveVertical,
  Users,
} from 'lucide-react';
import { useState } from 'react';

interface TermAccordionItemProps {
  group: TermGroup;
  isExpanded: boolean;
  selectedIds: Set<string>;
  onToggleExpand: () => void;
  onToggleStudent: (userId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onMoveSelected: (targetTermId: TermId) => void;
  processingTerm: TermId | null;
}

export default function TermAccordionItem({
  group,
  isExpanded,
  selectedIds,
  onToggleExpand,
  onToggleStudent,
  onSelectAll,
  onDeselectAll,
  onMoveSelected,
  processingTerm,
}: TermAccordionItemProps) {
  const { termInfo, students, nextTerm, prevTerm } = group;
  const isProcessing = processingTerm === termInfo.id;
  const selectedCount = selectedIds.size;
  const [targetTermId, setTargetTermId] = useState<TermId | ''>(nextTerm?.id || '');

  // All terms except the current one
  const availableTargets = TERMS.filter((t) => t.id !== termInfo.id);

  const selectedTarget = availableTargets.find((t) => t.id === targetTermId);
  const isUpgrade = selectedTarget
    ? TERMS.indexOf(selectedTarget) > TERMS.findIndex((t) => t.id === termInfo.id)
    : true;

  return (
    <SpotlightCard className="overflow-hidden" spotlightColor={termInfo.iconColor}>
      {/* Accordion Header */}
      <button
        onClick={onToggleExpand}
        className={`w-full flex items-center justify-between p-4 transition-colors text-left ${
          isExpanded
            ? 'border-b border-[#DCC5B2] dark:border-white/10'
            : ''
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${termInfo.bgClass}`}
          >
            <GraduationCap className={`w-5 h-5 ${termInfo.colorClass}`} />
          </div>

          <div className="min-w-0">
            <h3 className={`font-semibold text-sm sm:text-base ${termInfo.colorClass}`}>
              {termInfo.label}
            </h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-[#8B7355] dark:text-white/40 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {students.length} student{students.length !== 1 ? 's' : ''}
              </span>
              {termInfo.id === '4-2' && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  Final Term
                </span>
              )}
              {termInfo.id === '1-1' && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                  Entry Term
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {selectedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#D9A299]/20 dark:bg-[#8400ff]/20 text-[#D9A299] dark:text-[#8400ff] font-medium">
              {selectedCount} selected
            </span>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-5 h-5 text-[#8B7355] dark:text-white/40" />
          </motion.div>
        </div>
      </button>

      {/* Accordion Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <StudentSelectionTable
                students={students}
                selectedIds={selectedIds}
                onToggleStudent={onToggleStudent}
                onSelectAll={onSelectAll}
                onDeselectAll={onDeselectAll}
              />

              {/* Term Change Action Bar */}
              {students.length > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-[#DCC5B2]/50 dark:border-white/5">
                  {/* From → Target term selector */}
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className={`px-2.5 py-1 rounded-lg border font-medium text-xs ${termInfo.bgClass} ${termInfo.colorClass}`}>
                      {termInfo.shortLabel}
                    </span>

                    {isUpgrade ? (
                      <ArrowUpCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    ) : (
                      <ArrowDownCircle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    )}

                    <select
                      value={targetTermId}
                      onChange={(e) => setTargetTermId(e.target.value as TermId)}
                      className="px-2.5 py-1 rounded-lg border border-[#DCC5B2] dark:border-white/10 bg-white dark:bg-[#1a1a2e] text-[#5D4E37] dark:text-white text-xs font-medium focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] outline-none"
                    >
                      <option value="">Select target term</option>
                      {availableTargets.map((t) => {
                        const idx = TERMS.findIndex((tt) => tt.id === t.id);
                        const currentIdx = TERMS.findIndex((tt) => tt.id === termInfo.id);
                        const dir = idx > currentIdx ? '↑' : '↓';
                        return (
                          <option key={t.id} value={t.id}>
                            {dir} {t.label}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Move button */}
                  <motion.button
                    whileHover={{ scale: selectedCount > 0 && targetTermId ? 1.02 : 1 }}
                    whileTap={{ scale: selectedCount > 0 && targetTermId ? 0.98 : 1 }}
                    onClick={() => targetTermId && onMoveSelected(targetTermId as TermId)}
                    disabled={selectedCount === 0 || !targetTermId || isProcessing}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all ${
                      selectedCount > 0 && targetTermId
                        ? isUpgrade
                          ? 'bg-emerald-500 dark:bg-emerald-600 text-white hover:opacity-90 cursor-pointer'
                          : 'bg-amber-500 dark:bg-amber-600 text-white hover:opacity-90 cursor-pointer'
                        : 'bg-[#F0E4D3] dark:bg-white/5 text-[#8B7355] dark:text-white/30 cursor-not-allowed'
                    }`}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MoveVertical className="w-4 h-4" />
                    )}
                    {isProcessing
                      ? 'Processing...'
                      : selectedCount > 0 && targetTermId
                      ? `${isUpgrade ? 'Upgrade' : 'Downgrade'} ${selectedCount} Student${selectedCount !== 1 ? 's' : ''}`
                      : 'Select students & target term'}
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SpotlightCard>
  );
}
