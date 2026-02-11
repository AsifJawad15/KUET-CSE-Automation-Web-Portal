'use client';

import PublicLayout from '@/components/PublicLayout';
import { fetchLandingPageData, getImageUrl } from '@/services/cmsService';
import type { LandingPageData } from '@/types/cms';
import { motion } from 'framer-motion';
import { BookOpen, Clock, GraduationCap } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ProgramsPage() {
  const [data, setData] = useState<LandingPageData | null>(null);
  useEffect(() => { fetchLandingPageData().then(setData); }, []);
  if (!data) return <PublicLayout><div className="min-h-screen" /></PublicLayout>;

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative h-72 md:h-80 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${getImageUrl(data.heroSlides[0]?.image_path)})` }} />
        <div className="absolute inset-0 bg-[#3E2723]/60" />
        <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#FDF8F3] to-transparent" />
        <div className="relative z-10 h-full flex items-center justify-center text-center px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Academic Programs</h1>
            <p className="text-white/80">Comprehensive programs for tomorrow&apos;s tech leaders</p>
          </motion.div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 md:px-8 py-16">
        <div className="space-y-8">
          {data.programs.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl p-8 border border-[#E8DDD1] shadow-warm hover:shadow-warm-lg transition-all">
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-shrink-0">
                  <span className={`inline-block px-4 py-2 text-sm font-bold rounded-full ${
                    p.degree_type === 'UNDERGRADUATE' ? 'bg-[#5D4037]/10 text-[#5D4037]'
                      : p.degree_type === 'POSTGRADUATE' ? 'bg-[#8B6914]/10 text-[#8B6914]'
                      : 'bg-[#D4A574]/20 text-[#A87B50]'
                  }`}>{p.degree_type.replace('_', ' ')}</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl md:text-2xl font-bold text-[#2C1810] mb-3">{p.name}</h2>
                  {p.description && <p className="text-[#6B5744] leading-relaxed mb-4">{p.description}</p>}
                  <div className="flex flex-wrap gap-4 text-sm text-[#8B7355]">
                    {p.duration && (
                      <span className="flex items-center gap-1.5 bg-[#F5EDE4] px-3 py-1.5 rounded-full">
                        <Clock className="w-4 h-4" /> {p.duration}
                      </span>
                    )}
                    {p.total_credits && (
                      <span className="flex items-center gap-1.5 bg-[#F5EDE4] px-3 py-1.5 rounded-full">
                        <BookOpen className="w-4 h-4" /> {p.total_credits} credits
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 bg-[#F5EDE4] px-3 py-1.5 rounded-full">
                      <GraduationCap className="w-4 h-4" /> {p.short_name || p.name}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
