// ==========================================
// Labs & Facilities Section
// Single Responsibility: Renders lab image cards with overlays
// ==========================================

'use client';

import Reveal from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import { getImageUrl } from '@/services/cmsService';
import type { CmsLabFacility } from '@/types/cms';
import React from 'react';

interface LabsSectionProps {
  labs: CmsLabFacility[];
  sectionTitle?: string;
  sectionSubtitle?: string;
}

const LabsSection: React.FC<LabsSectionProps> = ({ labs, sectionTitle, sectionSubtitle }) => {
  if (!labs.length) return null;

  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <Reveal>
          <SectionHeading
            title={sectionTitle || 'Your Future Starts Here'}
            subtitle={sectionSubtitle || 'State-of-the-art lab facilities'}
          />
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {labs.map((l, i) => (
            <Reveal key={l.id} delay={i * 0.08}>
              <div className="group relative overflow-hidden rounded-2xl h-72 cursor-pointer">
                <img src={getImageUrl(l.image_path)} alt={l.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-[#3E2723]/40 group-hover:bg-[#3E2723]/55 transition-all duration-500" />
                <div className="absolute bottom-0 inset-x-0 h-2/3 bg-gradient-to-t from-[#161a1d]/90 via-[#161a1d]/40 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-5 z-10">
                  <h3 className="text-lg font-bold text-white mb-1">{l.name}</h3>
                  {l.description && <p className="text-white/70 text-sm line-clamp-2">{l.description}</p>}
                  {l.room_number && <p className="text-[#D4A574] text-xs mt-2">Room: {l.room_number}</p>}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LabsSection;
