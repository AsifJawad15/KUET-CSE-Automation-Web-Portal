// ==========================================
// Hero Carousel Section
// Single Responsibility: Renders hero slider with LightRays overlay
// ==========================================

'use client';

import LightRays from '@/components/ui/LightRays';
import { getImageUrl } from '@/services/cmsService';
import type { CmsHeroSlide } from '@/types/cms';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';

interface HeroCarouselProps {
  slides: CmsHeroSlide[];
  universityName: string;
}

const AUTO_SLIDE_INTERVAL = 6000;

const HeroCarousel: React.FC<HeroCarouselProps> = ({ slides, universityName }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!slides.length) return;
    const t = setInterval(() => setCurrentSlide(p => (p + 1) % slides.length), AUTO_SLIDE_INTERVAL);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!slides.length) return null;

  const slide = slides[currentSlide];

  return (
    <section className="relative h-screen overflow-hidden">
      {slides.map((s, i) => (
        <div key={s.id} className={`absolute inset-0 transition-all duration-[1500ms] ${i === currentSlide ? 'opacity-100' : 'opacity-0'}`}>
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-[8000ms]"
            style={{
              backgroundImage: `url(${getImageUrl(s.image_path)})`,
              transform: i === currentSlide ? 'scale(1.08)' : 'scale(1)',
            }}
          />
          <div className="absolute inset-0 bg-[#3E2723]/45" />
          <div className="absolute top-0 inset-x-0 h-[45%] bg-gradient-to-b from-[#161a1d]/85 via-[#161a1d]/30 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 h-[55%] bg-gradient-to-t from-[#0b090a] via-[#0b090a]/60 to-transparent" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(15,10,6,0.55) 100%)' }} />
        </div>
      ))}

      {/* LightRays */}
      <div className="absolute inset-0 z-[2] opacity-50 pointer-events-none">
        <LightRays
          raysOrigin="top-center" raysColor="#D4A574" raysSpeed={0.5} lightSpread={0.8}
          rayLength={3.5} followMouse mouseInfluence={0.15} pulsating fadeDistance={1.8} saturation={1.2}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-center items-center text-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
              <GraduationCap className="w-4 h-4 text-[#D4A574]" />
              <span className="text-sm text-white/90 font-medium">{universityName}</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-tight">
              {slide?.title}
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              {slide?.subtitle}
            </p>
            {slide?.cta_text && (
              <Link
                href={slide?.cta_link || '#'}
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#D4A574] text-[#2C1810] font-semibold rounded-full
                  hover:bg-[#C4956A] transition-all hover:shadow-lg hover:shadow-[#D4A574]/30 hover:scale-105 active:scale-95"
              >
                {slide?.cta_text}
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-3">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentSlide(i)}
            className={`h-2 rounded-full transition-all duration-500 ${i === currentSlide ? 'w-10 bg-[#D4A574]' : 'w-2 bg-white/40 hover:bg-white/60'}`}
          />
        ))}
      </div>

      {/* Scroll indicator */}
      <motion.div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20" animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
        <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-1.5">
          <motion.div className="w-1.5 h-2.5 rounded-full bg-[#D4A574]" animate={{ y: [0, 12, 0] }} transition={{ repeat: Infinity, duration: 2 }} />
        </div>
      </motion.div>
    </section>
  );
};

export default HeroCarousel;
