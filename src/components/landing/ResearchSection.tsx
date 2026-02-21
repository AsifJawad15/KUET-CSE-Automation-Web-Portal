// ==========================================
// Research Highlights Section
// Single Responsibility: Renders research cards with external links
// ==========================================

'use client';

import Reveal from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import { getImageUrl } from '@/services/cmsService';
import type { CmsResearchHighlight } from '@/types/cms';
import { ExternalLink } from 'lucide-react';
import React from 'react';

interface ResearchSectionProps {
  research: CmsResearchHighlight[];
  sectionTitle?: string;
  sectionSubtitle?: string;
}

const ResearchSection: React.FC<ResearchSectionProps> = ({ research, sectionTitle, sectionSubtitle }) => {
  if (!research.length) return null;

  return (
    <section className="py-20 md:py-28 bg-[#F5EDE4]">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <Reveal>
          <SectionHeading
            title={sectionTitle || 'Research in CSE'}
            subtitle={sectionSubtitle || 'Advancing knowledge through innovation'}
          />
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {research.map((r, i) => (
            <Reveal key={r.id} delay={i * 0.08}>
              <div className="group bg-white rounded-2xl overflow-hidden border border-[#E8DDD1] hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300">
                {r.image_path && (
                  <div className="relative overflow-hidden">
                    <img src={getImageUrl(r.image_path)} alt={r.title} className="w-full h-48 object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-[#5D4037]/20 group-hover:bg-[#5D4037]/10 transition-all" />
                    <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#161a1d]/70 to-transparent" />
                    <span className="absolute bottom-3 left-3 text-white text-xs font-medium bg-white/20 backdrop-blur-md px-3 py-1 rounded-full">
                      {r.category}
                    </span>
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-bold text-[#2C1810] mb-2 line-clamp-2 group-hover:text-[#5D4037]">{r.title}</h3>
                  {r.description && <p className="text-[#6B5744] text-sm line-clamp-3">{r.description}</p>}
                  {r.external_link && (
                    <a href={r.external_link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-[#5D4037] hover:text-[#D4A574]">
                      View Paper <ExternalLink className="w-3.5 h-3.5" />
                    </a>
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

export default ResearchSection;
