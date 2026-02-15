"use client";

import { TermChangeDirection, TermInfo, TermStudent } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  Loader2,
  Users,
  X,
} from 'lucide-react';

interface UpgradeConfirmModalProps {
  isOpen: boolean;
  students: TermStudent[];
  fromTerm: TermInfo;
  toTerm: TermInfo;
  direction: TermChangeDirection;
  isProcessing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function UpgradeConfirmModal({
  isOpen,
  students,
  fromTerm,
  toTerm,
  direction,
  isProcessing,
  onConfirm,
  onClose,
}: UpgradeConfirmModalProps) {
  if (!isOpen) return null;

  const isUpgrade = direction === 'upgrade';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={() => !isProcessing && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-white dark:bg-[#0d0d1a] rounded-2xl border border-[#DCC5B2] dark:border-white/10 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className={`p-6 border-b ${
            isUpgrade
              ? 'border-emerald-200 dark:border-emerald-500/20'
              : 'border-amber-200 dark:border-amber-500/20'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#5D4E37] dark:text-white flex items-center gap-2">
                  {isUpgrade ? (
                    <ArrowUpCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <ArrowDownCircle className="w-5 h-5 text-amber-500" />
                  )}
                  Confirm Term {isUpgrade ? 'Upgrade' : 'Downgrade'}
                </h3>
                <p className="text-sm text-[#8B7355] dark:text-white/50 mt-1">
                  This will directly {isUpgrade ? 'upgrade' : 'downgrade'} the selected students. No pending approval needed.
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="p-1.5 rounded-lg hover:bg-[#F0E4D3] dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-[#8B7355] dark:text-white/40" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Visual */}
            <div className="flex items-center justify-center gap-4 py-3">
              <div className={`px-4 py-2 rounded-xl border font-semibold text-sm ${fromTerm.bgClass} ${fromTerm.colorClass}`}>
                {fromTerm.label}
              </div>
              {isUpgrade ? (
                <ArrowUpCircle className="w-6 h-6 text-emerald-500 animate-bounce" />
              ) : (
                <ArrowDownCircle className="w-6 h-6 text-amber-500 animate-bounce" />
              )}
              <div className={`px-4 py-2 rounded-xl border font-semibold text-sm ${toTerm.bgClass} ${toTerm.colorClass}`}>
                {toTerm.label}
              </div>
            </div>

            {/* Students Summary */}
            <div className="bg-[#F0E4D3]/40 dark:bg-white/5 rounded-xl p-4 border border-[#DCC5B2]/50 dark:border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-[#8B7355] dark:text-white/50" />
                <span className="text-sm font-semibold text-[#5D4E37] dark:text-white">
                  {students.length} Student{students.length !== 1 ? 's' : ''} Selected
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                {students.map((s) => (
                  <div key={s.user_id} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-[#5D4E37] dark:text-white/70">{s.full_name}</span>
                    <span className="font-mono text-[#8B7355] dark:text-white/40">{s.roll_no}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning for downgrade */}
            {!isUpgrade && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3">
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  ⚠ You are about to downgrade students to a lower term. Please verify this is correct.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#DCC5B2] dark:border-white/10 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg border border-[#DCC5B2] dark:border-white/10 text-[#8B7355] dark:text-white/60 hover:bg-[#F0E4D3] dark:hover:bg-white/5 text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isProcessing}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${
                isUpgrade
                  ? 'bg-emerald-500 dark:bg-emerald-600'
                  : 'bg-amber-500 dark:bg-amber-600'
              }`}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {isProcessing ? 'Processing...' : `Confirm ${isUpgrade ? 'Upgrade' : 'Downgrade'}`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
