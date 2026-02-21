// ==========================================
// Programs Section
// Single Responsibility: Renders academic program cards
// ==========================================

'use client';

import Reveal from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import type { CmsProgram } from '@/types/cms';
import { BookOpen, Clock } from 'lucide-react';
import React from 'react';

interface ProgramsSectionProps {
  programs: CmsProgram[];
  sectionTitle?: string;
  sectionSubtitle?: string;
}

const DEGREE_BADGE_CLASSES: Record<string, string> = {
  UNDERGRADUATE: 'bg-[#5D4037]/10 text-[#5D4037]',
  POSTGRADUATE: 'bg-[#8B6914]/10 text-[#8B6914]',
};
const DEFAULT_BADGE_CLASS = 'bg-[#D4A574]/20 text-[#A87B50]';

const ProgramsSection: React.FC<ProgramsSectionProps> = ({ programs, sectionTitle, sectionSubtitle }) => {
  if (!programs.length) return null;

  return (
    <section className="py-20 md:py-28 bg-[#FDF8F3]">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <Reveal>
          <SectionHeading
            title={sectionTitle || 'Academic Programs'}
            subtitle={sectionSubtitle || "Comprehensive programs designed for tomorrow's tech leaders"}
          />
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {programs.map((p, i) => (
            <Reveal key={p.id} delay={i * 0.1}>
              <div className="group bg-white rounded-2xl p-7 border border-[#E8DDD1] hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300">
                <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full mb-4 ${
                  DEGREE_BADGE_CLASSES[p.degree_type] || DEFAULT_BADGE_CLASS
                }`}>
                  {p.degree_type}
                </span>
                <h3 className="text-lg font-bold text-[#2C1810] mb-2 group-hover:text-[#5D4037]">
                  {p.short_name || p.name}
                </h3>
                {p.description && <p className="text-[#6B5744] text-sm mb-4 line-clamp-3">{p.description}</p>}
                <div className="flex items-center gap-4 text-xs text-[#8B7355]">
                  {p.duration && (
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{p.duration}</span>
                  )}
                  {p.total_credits && (
                    <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{p.total_credits} credits</span>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProgramsSection;
