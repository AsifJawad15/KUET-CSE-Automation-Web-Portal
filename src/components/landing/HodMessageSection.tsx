// ==========================================
// HOD Message Section
// Single Responsibility: Renders Head of Department quote + photo
// ==========================================

'use client';

import Reveal from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import { getImageUrl } from '@/services/cmsService';
import type { CmsHodMessage } from '@/types/cms';
import { Quote } from 'lucide-react';
import React from 'react';

interface HodMessageSectionProps {
  hodMessage: CmsHodMessage;
  sectionTitle?: string;
}

const HodMessageSection: React.FC<HodMessageSectionProps> = ({ hodMessage, sectionTitle }) => (
  <section className="py-20 md:py-28 bg-[#FDF8F3]">
    <div className="max-w-7xl mx-auto px-6 md:px-8">
      <Reveal>
        <SectionHeading title={sectionTitle || 'Message from the Head'} />
      </Reveal>
      <Reveal delay={0.15}>
        <div className="grid md:grid-cols-5 gap-10 md:gap-16 items-center">
          {/* Photo */}
          <div className="md:col-span-2 relative">
            <div className="relative overflow-hidden rounded-2xl shadow-warm-lg">
              <img
                src={getImageUrl(hodMessage.photo_path)}
                alt={hodMessage.name}
                className="w-full aspect-[3/4] object-cover"
              />
              <div className="absolute inset-0 bg-[#5D4037]/10" />
              <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 60px rgba(93,64,55,0.25)' }} />
              <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-[#161a1d]/70 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 z-10">
                <p className="text-white font-bold text-lg">{hodMessage.name}</p>
                <p className="text-white/80 text-sm">{hodMessage.designation}</p>
              </div>
            </div>
          </div>
          {/* Quote */}
          <div className="md:col-span-3">
            <Quote className="w-10 h-10 text-[#D4A574] mb-4 opacity-60" />
            <p className="text-xl md:text-2xl leading-relaxed text-[#2C1810]/90 italic mb-6">
              &ldquo;{hodMessage.message}&rdquo;
            </p>
            <div className="w-16 h-0.5 bg-[#D4A574] mb-4" />
            <p className="font-bold text-[#5D4037]">{hodMessage.name}</p>
            <p className="text-[#8B7355] text-sm">{hodMessage.designation}</p>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

export default HodMessageSection;
