// ==========================================
// News & Events Section
// Single Responsibility: Renders news/events card grid
// ==========================================

'use client';

import Reveal from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import { getImageUrl } from '@/services/cmsService';
import type { CmsNewsEvent } from '@/types/cms';
import React from 'react';

interface NewsSectionProps {
  news: CmsNewsEvent[];
  sectionTitle?: string;
  sectionSubtitle?: string;
}

const NewsSection: React.FC<NewsSectionProps> = ({ news, sectionTitle, sectionSubtitle }) => {
  if (!news.length) return null;

  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <Reveal>
          <SectionHeading
            title={sectionTitle || 'News & Activities'}
            subtitle={sectionSubtitle || "What's happening at CSE, KUET"}
          />
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {news.map((n, i) => (
            <Reveal key={n.id} delay={i * 0.1}>
              <div
                className={`group bg-[#FFFBF7] rounded-2xl overflow-hidden border border-[#E8DDD1]
                  hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300
                  ${i === 0 ? 'md:col-span-2 lg:col-span-2 md:row-span-2' : ''}`}
              >
                {n.image_path && (
                  <div className="relative overflow-hidden">
                    <img
                      src={getImageUrl(n.image_path)}
                      alt={n.title}
                      className={`w-full object-cover transition-transform duration-700 group-hover:scale-110 ${i === 0 ? 'h-64 md:h-80' : 'h-48'}`}
                    />
                    <div className="absolute inset-0 bg-[#5D4037]/15 group-hover:bg-[#5D4037]/5 transition-all duration-500" />
                    <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#161a1d]/60 via-[#161a1d]/20 to-transparent" />
                    <span className="absolute top-3 left-3 px-3 py-1 bg-[#D4A574] text-[#2C1810] text-xs font-bold rounded-full">
                      {n.category}
                    </span>
                  </div>
                )}
                <div className="p-5">
                  {n.published_at && (
                    <p className="text-xs text-[#8B7355] mb-2">
                      {new Date(n.published_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                  <h3 className={`font-bold text-[#2C1810] mb-2 line-clamp-2 group-hover:text-[#5D4037] transition-colors ${i === 0 ? 'text-xl' : 'text-base'}`}>
                    {n.title}
                  </h3>
                  {n.excerpt && <p className="text-[#6B5744] text-sm line-clamp-2">{n.excerpt}</p>}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NewsSection;
