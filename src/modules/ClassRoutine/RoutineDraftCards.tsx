"use client";

import React from 'react';
import { Award, AlertTriangle, CheckCircle, Trash2, Eye } from 'lucide-react';
import SpotlightCard from '@/components/ui/SpotlightCard';

interface DraftSummary {
  reason: string;
  advantages: string[];
  disadvantages: string[];
}

interface Draft {
  id: string;
  draft_name: string;
  score: number;
  hard_conflict_count: number;
  soft_warning_count: number;
  summary: DraftSummary;
  is_selected: boolean;
}

interface RoutineDraftCardsProps {
  drafts: Draft[];
  selectedDraftId: string | null;
  onSelectDraft: (id: string) => void;
  onDeleteDraft: (id: string) => Promise<void>;
}

export default function RoutineDraftCards({
  drafts,
  selectedDraftId,
  onSelectDraft,
  onDeleteDraft,
}: RoutineDraftCardsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-500 dark:text-green-400 border-green-500/20 bg-green-500/10';
    if (score >= 70) return 'text-amber-500 dark:text-amber-400 border-amber-500/20 bg-amber-500/10';
    return 'text-red-500 dark:text-red-400 border-red-500/20 bg-red-500/10';
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">
        Generated Routine Recommendations ({drafts.length})
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drafts.map((draft) => {
          const isSelected = selectedDraftId === draft.id;
          return (
            <div
              key={draft.id}
              onClick={() => onSelectDraft(draft.id)}
              className="cursor-pointer"
            >
              <SpotlightCard
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between h-48 ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg'
                    : 'border-gray-200 dark:border-[#3d4951] hover:border-gray-300 dark:hover:border-zinc-500'
                }`}
                spotlightColor={isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(217, 162, 153, 0.1)'}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 dark:text-white">{draft.draft_name}</h4>
                      <p className="text-[10px] text-gray-400 dark:text-zinc-500">CSP Algorithm Result</p>
                    </div>
                    <div className={`px-2 py-0.5 border rounded-full text-[10px] font-bold ${getScoreColor(draft.score)}`}>
                      Score: {draft.score}/100
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-600 dark:text-zinc-300 line-clamp-3 mb-3 leading-relaxed">
                    {draft.summary?.reason || 'Calculated routine draft.'}
                  </p>

                  <div className="flex gap-3 text-[10px] text-gray-500">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      <span>{draft.hard_conflict_count} Hard Conflicts</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>{draft.soft_warning_count} Warnings</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100 dark:border-[#3d4951]/40">
                  <span className={`text-[10px] font-semibold ${isSelected ? 'text-indigo-500' : 'text-gray-400'}`}>
                    {isSelected ? 'Currently Selected' : 'Click to Load/Preview'}
                  </span>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDraft(draft.id);
                    }}
                    className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors"
                    title="Delete Draft"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </SpotlightCard>
            </div>
          );
        })}
      </div>
    </div>
  );
}
