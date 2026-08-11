"use client";

import React from 'react';
import { Select } from '@/components/ui/FormPicker';
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
      <Select
        value={selectedTerm}
        onChange={(e) => onTermChange(e.target.value)}
        wrapperClassName="w-auto min-w-[120px]"
        className="pl-4 pr-10 py-2.5 font-medium text-sm"
      >
        {TERMS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </Select>

      {/* Session Selector */}
      <Select
        value={selectedSession}
        onChange={(e) => onSessionChange(e.target.value)}
        wrapperClassName="w-auto min-w-[120px]"
        className="pl-4 pr-10 py-2.5 font-medium text-sm"
      >
        {SESSIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      {/* Section Toggle */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200">
        {SECTIONS.map((sec) => (
          <button
            key={sec}
            onClick={() => onSectionChange(sec)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              selectedSection === sec
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            SEC - {sec}
          </button>
        ))}
      </div>
    </div>
  );
}
