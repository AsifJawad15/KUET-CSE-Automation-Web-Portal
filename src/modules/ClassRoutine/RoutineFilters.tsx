"use client";

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { TERMS, SECTIONS, SESSIONS } from './constants';

interface RoutineFiltersProps {
  selectedTerm: string;
  selectedSession: string;
  selectedSection: string;
  onTermChange: (term: string) => void;
  onSessionChange: (session: string) => void;
  onSectionChange: (section: string) => void;
}

export default function RoutineFilters({
  selectedTerm,
  selectedSession,
  selectedSection,
  onTermChange,
  onSessionChange,
  onSectionChange,
}: RoutineFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {/* Term Selector */}
      <div className="relative">
        <select
          value={selectedTerm}
          onChange={(e) => onTermChange(e.target.value)}
          className="appearance-none pl-4 pr-10 py-2.5 border border-[#DCC5B2] dark:border-[#392e4e] rounded-xl bg-[#FAF7F3] dark:bg-white/5 text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent font-medium text-sm cursor-pointer"
        >
          {TERMS.map((t) => (
            <option key={t.value} value={t.value} className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">
              {t.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7355] dark:text-white/40 pointer-events-none" />
      </div>

      {/* Session Selector */}
      <div className="relative">
        <select
          value={selectedSession}
          onChange={(e) => onSessionChange(e.target.value)}
          className="appearance-none pl-4 pr-10 py-2.5 border border-[#DCC5B2] dark:border-[#392e4e] rounded-xl bg-[#FAF7F3] dark:bg-white/5 text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent font-medium text-sm cursor-pointer"
        >
          {SESSIONS.map((s) => (
            <option key={s} value={s} className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">
              {s}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7355] dark:text-white/40 pointer-events-none" />
      </div>

      {/* Section Toggle */}
      <div className="flex rounded-xl overflow-hidden border border-[#DCC5B2] dark:border-[#392e4e]">
        {SECTIONS.map((sec) => (
          <button
            key={sec}
            onClick={() => onSectionChange(sec)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              selectedSection === sec
                ? 'bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#8400ff] dark:to-[#a855f7] text-white'
                : 'bg-[#FAF7F3] dark:bg-white/5 text-[#8B7355] dark:text-white/60 hover:bg-[#F0E4D3] dark:hover:bg-white/10'
            }`}
          >
            SEC - {sec}
          </button>
        ))}
      </div>
    </div>
  );
}
