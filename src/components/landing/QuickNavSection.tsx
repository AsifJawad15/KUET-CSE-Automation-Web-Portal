// ==========================================
// Quick Navigation Section
// Single Responsibility: Renders "Find Your Way" navigation grid
// ==========================================

'use client';

import { getIcon } from '@/components/ui/iconMap';
import Reveal from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import { getImageUrl } from '@/services/cmsService';
import type { CmsNavigationLink } from '@/types/cms';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

interface QuickNavSectionProps {
  links: CmsNavigationLink[];
  backgroundImagePath: string | null | undefined;
  sectionTitle?: string;
  sectionSubtitle?: string;
}

const QuickNavSection: React.FC<QuickNavSectionProps> = ({
  links, backgroundImagePath, sectionTitle, sectionSubtitle,
}) => {
  if (!links.length) return null;

  return (
    <section className="relative py-20 md:py-28 overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url(${getImageUrl(backgroundImagePath)})` }}
      />
      <div className="absolute inset-0 bg-[#F5EDE4]/85" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#FDF8F3] via-transparent to-[#FDF8F3]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8">
        <Reveal>
          <SectionHeading
            title={sectionTitle || 'Find Your Way'}
            subtitle={sectionSubtitle || 'Explore the countless paths and opportunities that CSE, KUET has to offer'}
          />
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
          {links.map((l, i) => {
            const Icon = getIcon(l.icon);
            return (
              <Reveal key={l.id} delay={i * 0.08}>
                <Link
                  href={l.url}
                  className="group flex items-center gap-4 p-5 md:p-6 rounded-2xl
                    bg-white/60 backdrop-blur-xl border border-white/70 shadow-lg shadow-[#5D4037]/5
                    hover:bg-white/80 hover:border-[#D4A574]/50 hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#F5EDE4]/80 backdrop-blur-md flex items-center justify-center flex-shrink-0
                    group-hover:bg-[#5D4037] transition-colors">
                    <Icon className="w-5 h-5 text-[#5D4037] group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#2C1810] group-hover:text-[#5D4037] transition-colors">{l.label}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#D4C8BC] group-hover:text-[#D4A574] transition-colors flex-shrink-0" />
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default QuickNavSection;
