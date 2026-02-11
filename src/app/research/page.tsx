'use client';

import PublicLayout from '@/components/PublicLayout';
import { fetchLandingPageData, getImageUrl } from '@/services/cmsService';
import type { LandingPageData } from '@/types/cms';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ResearchPage() {
  const [data, setData] = useState<LandingPageData | null>(null);
  useEffect(() => { fetchLandingPageData().then(setData); }, []);
  if (!data) return <PublicLayout><div className="min-h-screen" /></PublicLayout>;

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative h-72 md:h-80 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${getImageUrl(data.heroSlides[1]?.image_path || data.heroSlides[0]?.image_path)})` }} />
        <div className="absolute inset-0 bg-[#3E2723]/60" />
        <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#FDF8F3] to-transparent" />
        <div className="relative z-10 h-full flex items-center justify-center text-center px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Research</h1>
            <p className="text-white/80">Advancing knowledge through innovation and discovery</p>
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 md:px-8 py-16">
        {/* Category filters */}
        <div className="flex flex-wrap gap-3 mb-10 justify-center">
          {['ALL', 'PUBLICATION', 'JOURNAL', 'CONFERENCE', 'UGC_PROJECT', 'GRANT'].map(c => (
            <span key={c} className="px-4 py-2 text-sm font-medium rounded-full bg-[#F5EDE4] text-[#5D4037] cursor-pointer hover:bg-[#5D4037] hover:text-white transition-all">
              {c.replace('_', ' ')}
            </span>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.research.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="group bg-white rounded-2xl overflow-hidden border border-[#E8DDD1] hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300">
              {r.image_path && (
                <div className="relative overflow-hidden">
                  <img src={getImageUrl(r.image_path)} alt={r.title} className="w-full h-52 object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-[#5D4037]/20 group-hover:bg-[#5D4037]/10 transition-all" />
                  <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#2C1810]/70 to-transparent" />
                  <span className="absolute bottom-3 left-3 text-white text-xs font-medium bg-white/20 backdrop-blur-md px-3 py-1 rounded-full">{r.category.replace('_', ' ')}</span>
                </div>
              )}
              <div className="p-5">
                <h3 className="font-bold text-[#2C1810] mb-2 group-hover:text-[#5D4037] transition-colors">{r.title}</h3>
                {r.description && <p className="text-[#6B5744] text-sm line-clamp-3 mb-3">{r.description}</p>}
                {r.external_link && (
                  <a href={r.external_link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#5D4037] hover:text-[#D4A574]">
                    View Paper <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
