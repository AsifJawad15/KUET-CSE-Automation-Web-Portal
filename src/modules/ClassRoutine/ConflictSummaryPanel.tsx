"use client";

import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import SpotlightCard from '@/components/ui/SpotlightCard';

interface ConflictReason {
  type: string;
  reason: string;
}

interface ConflictSummaryPanelProps {
  draftName: string;
  score: number;
  hardConflictCount: number;
  softWarningCount: number;
  summary: {
    reason: string;
    advantages: string[];
    disadvantages: string[];
  };
  slots: { conflict_status: string; conflict_reasons: string[] }[];
}

export default function ConflictSummaryPanel({
  draftName,
  score,
  hardConflictCount,
  softWarningCount,
  summary,
  slots,
}: ConflictSummaryPanelProps) {
  // Aggregate all reasons directly from the draft slots
  const allConflictReasons = React.useMemo(() => {
    const set = new Set<string>();
    for (const slot of slots) {
      for (const r of slot.conflict_reasons || []) {
        set.add(r);
      }
    }
    return Array.from(set);
  }, [slots]);

  return (
    <SpotlightCard className="p-4 rounded-xl border border-gray-200 dark:border-[#3d4951] space-y-4" spotlightColor="rgba(217, 162, 153, 0.05)">
      <div>
        <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider mb-1">
          Draft Health Check
        </h3>
        <p className="text-[10px] text-gray-400">Real-time schedule validation diagnostics</p>
      </div>

      {/* Grade and Status Overview */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-50 dark:bg-white/[0.02] border border-gray-100 dark:border-[#3d4951]/40 rounded-lg p-2">
          <div className="text-base font-black text-gray-800 dark:text-white">{score}/100</div>
          <div className="text-[8px] text-gray-400 font-semibold uppercase">Score</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
          <div className="text-base font-black text-red-600 dark:text-red-400">{hardConflictCount}</div>
          <div className="text-[8px] text-red-500 font-semibold uppercase">Conflicts</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
          <div className="text-base font-black text-amber-600 dark:text-amber-400">{softWarningCount}</div>
          <div className="text-[8px] text-amber-500 font-semibold uppercase">Warnings</div>
        </div>
      </div>

      {/* Summary Narrative */}
      {summary && (
        <div className="text-[10px] bg-slate-50 dark:bg-white/[0.01] p-3 rounded-lg border border-gray-100 dark:border-[#3d4951]/40 space-y-1.5 leading-relaxed text-gray-600 dark:text-zinc-300">
          <div className="flex items-center gap-1 font-bold text-gray-700 dark:text-white">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>Schedule Advantages</span>
          </div>
          {summary.advantages && summary.advantages.length > 0 ? (
            <ul className="list-disc pl-4 space-y-0.5">
              {summary.advantages.map((adv, idx) => (
                <li key={idx}>{adv}</li>
              ))}
            </ul>
          ) : (
            <p>None documented.</p>
          )}

          {summary.disadvantages && summary.disadvantages.length > 0 && (
            <>
              <div className="flex items-center gap-1 font-bold text-gray-700 dark:text-white pt-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Areas to Improve</span>
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                {summary.disadvantages.map((dis, idx) => (
                  <li key={idx}>{dis}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* List of Conflicts/Warnings */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-bold text-gray-800 dark:text-white uppercase tracking-wider">
          Validation Reports ({allConflictReasons.length})
        </h4>

        {allConflictReasons.length === 0 ? (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 dark:text-green-400 text-xs">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            <span>No hard conflicts or soft warnings detected in this draft placement. Clean and ready to publish!</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {allConflictReasons.map((reason, idx) => {
              const isHard = reason.toLowerCase().includes('already occupied') || reason.toLowerCase().includes('conflict') || reason.toLowerCase().includes('unavailable') || reason.toLowerCase().includes('requires a lab');
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border text-[10px] leading-normal font-medium ${
                    isHard
                      ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {isHard ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <span>{reason}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}
