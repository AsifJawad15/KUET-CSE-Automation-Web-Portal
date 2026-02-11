'use client';

import PublicLayout from '@/components/PublicLayout';
import { fetchLandingPageData, getImageUrl } from '@/services/cmsService';
import type { LandingPageData } from '@/types/cms';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function FacilitiesPage() {
  const [data, setData] = useState<LandingPageData | null>(null);
  useEffect(() => { fetchLandingPageData().then(setData); }, []);
  if (!data) return <PublicLayout><div className="min-h-screen" /></PublicLayout>;

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative h-72 md:h-80 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${getImageUrl(data.heroSlides[2]?.image_path || data.heroSlides[0]?.image_path)})` }} />
        <div className="absolute inset-0 bg-[#3E2723]/60" />
        <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#FDF8F3] to-transparent" />
        <div className="relative z-10 h-full flex items-center justify-center text-center px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Lab Facilities</h1>
            <p className="text-white/80">State-of-the-art laboratories and research facilities</p>
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 md:px-8 py-16">
        <div className="grid md:grid-cols-2 gap-8">
          {data.labs.map((l, i) => (
            <motion.div key={l.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="group bg-white rounded-2xl overflow-hidden border border-[#E8DDD1] hover:shadow-warm-lg transition-all duration-300">
              <div className="relative overflow-hidden h-56">
                <img src={getImageUrl(l.image_path)} alt={l.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-[#3E2723]/35 group-hover:bg-[#3E2723]/20 transition-all" />
                <div className="absolute bottom-0 inset-x-0 h-2/3 bg-gradient-to-t from-[#1A0F08]/80 via-[#1A0F08]/30 to-transparent" />
                <div className="absolute bottom-4 left-4 z-10">
                  <h3 className="text-lg font-bold text-white">{l.name}</h3>
                  {l.room_number && <p className="text-[#D4A574] text-sm">Room: {l.room_number}</p>}
                </div>
              </div>
              <div className="p-5">
                {l.description && <p className="text-[#6B5744] text-sm mb-3">{l.description}</p>}
                {l.equipment && Array.isArray(l.equipment) && l.equipment.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(l.equipment as string[]).map((e, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-[#F5EDE4] text-[#5D4037] text-xs font-medium rounded-full">{e}</span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
