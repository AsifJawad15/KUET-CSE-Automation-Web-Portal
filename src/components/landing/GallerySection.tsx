// ==========================================
// Gallery Section
// Single Responsibility: Renders gallery image grid (dark background)
// ==========================================

'use client';

import Reveal from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import { getImageUrl } from '@/services/cmsService';
import type { CmsGalleryItem } from '@/types/cms';
import React from 'react';

interface GallerySectionProps {
  gallery: CmsGalleryItem[];
  sectionTitle?: string;
  sectionSubtitle?: string;
}

const GallerySection: React.FC<GallerySectionProps> = ({ gallery, sectionTitle, sectionSubtitle }) => {
  if (!gallery.length) return null;

  return (
    <section className="py-20 md:py-28 bg-[#161a1d]">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <Reveal>
          <SectionHeading light title={sectionTitle || 'Gallery'} subtitle={sectionSubtitle || 'Life at CSE, KUET in pictures'} />
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {gallery.map((g, i) => (
            <Reveal key={g.id} delay={i * 0.06}>
              <div className={`group relative overflow-hidden rounded-xl cursor-pointer ${i === 0 || i === 5 ? 'md:col-span-2 md:row-span-2' : ''}`}>
                <img
                  src={getImageUrl(g.image_path)}
                  alt={g.caption || ''}
                  className={`w-full object-cover transition-transform duration-700 group-hover:scale-110 ${i === 0 || i === 5 ? 'h-64 md:h-full' : 'h-40 md:h-48'}`}
                />
                <div className="absolute inset-0 bg-[#3E2723]/0 group-hover:bg-[#3E2723]/40 transition-all duration-500" />
                <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#161a1d]/70 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                {g.caption && (
                  <div className="absolute bottom-0 inset-x-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-500 z-10">
                    <p className="text-white text-sm font-medium">{g.caption}</p>
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GallerySection;
