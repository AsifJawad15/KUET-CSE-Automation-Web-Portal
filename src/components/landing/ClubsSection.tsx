// ==========================================
// Clubs & Activities Section
// Single Responsibility: Renders club cards with logos
// ==========================================

'use client';

import Reveal from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import { getImageUrl } from '@/services/cmsService';
import type { CmsClubActivity } from '@/types/cms';
import { ExternalLink } from 'lucide-react';
import React from 'react';

interface ClubsSectionProps {
  clubs: CmsClubActivity[];
  sectionTitle?: string;
  sectionSubtitle?: string;
}

const ClubsSection: React.FC<ClubsSectionProps> = ({ clubs, sectionTitle, sectionSubtitle }) => {
  if (!clubs.length) return null;

  return (
    <section className="py-20 md:py-28 bg-[#F5EDE4]">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <Reveal>
          <SectionHeading
            title={sectionTitle || 'Clubs & Activities'}
            subtitle={sectionSubtitle || 'Get involved in our vibrant community'}
          />
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {clubs.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.08}>
              <div className="group bg-white rounded-2xl p-6 border border-[#E8DDD1] hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300 text-center">
                {c.logo_path && (
                  <div className="relative w-16 h-16 mx-auto mb-4 rounded-xl overflow-hidden">
                    <img src={getImageUrl(c.logo_path)} alt={c.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-[#5D4037]/10" />
                  </div>
                )}
                <h3 className="font-bold text-[#2C1810] mb-2 group-hover:text-[#5D4037]">{c.name}</h3>
                {c.description && <p className="text-[#6B5744] text-sm line-clamp-2">{c.description}</p>}
                {c.external_link && (
                  <a href={c.external_link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-[#D4A574] hover:text-[#5D4037]">
                    Visit <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ClubsSection;
