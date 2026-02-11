'use client';

import PublicLayout from '@/components/PublicLayout';
import { fetchLandingPageData, getImageUrl } from '@/services/cmsService';
import type { LandingPageData } from '@/types/cms';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function GalleryPage() {
  const [data, setData] = useState<LandingPageData | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => { fetchLandingPageData().then(setData); }, []);
  if (!data) return <PublicLayout><div className="min-h-screen" /></PublicLayout>;

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative h-72 md:h-80 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${getImageUrl(data.gallery[0]?.image_path || data.heroSlides[0]?.image_path)})` }} />
        <div className="absolute inset-0 bg-[#3E2723]/60" />
        <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#FDF8F3] to-transparent" />
        <div className="relative z-10 h-full flex items-center justify-center text-center px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Gallery</h1>
            <p className="text-white/80">Life at CSE, KUET in pictures</p>
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 md:px-8 py-16">
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {data.gallery.map((g, i) => (
            <motion.div key={g.id} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              onClick={() => setSelected(i)}
              className="group relative overflow-hidden rounded-xl cursor-pointer break-inside-avoid">
              <img src={getImageUrl(g.image_path)} alt={g.caption || ''} className="w-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-[#3E2723]/0 group-hover:bg-[#3E2723]/40 transition-all duration-500" />
              <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#1A0F08]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {g.caption && (
                <div className="absolute bottom-0 inset-x-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-500 z-10">
                  <p className="text-white text-sm font-medium">{g.caption}</p>
                  <span className="text-[#D4A574] text-xs">{g.category}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Lightbox */}
        {selected !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-8"
            onClick={() => setSelected(null)}>
            <motion.img initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              src={getImageUrl(data.gallery[selected]?.image_path)} alt=""
              className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            {data.gallery[selected]?.caption && (
              <p className="absolute bottom-8 text-white text-lg font-medium">{data.gallery[selected].caption}</p>
            )}
          </motion.div>
        )}
      </section>
    </PublicLayout>
  );
}
