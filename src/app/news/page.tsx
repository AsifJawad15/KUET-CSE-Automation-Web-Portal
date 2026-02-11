'use client';

import PublicLayout from '@/components/PublicLayout';
import { fetchLandingPageData, getImageUrl } from '@/services/cmsService';
import type { LandingPageData } from '@/types/cms';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function NewsPage() {
  const [data, setData] = useState<LandingPageData | null>(null);
  useEffect(() => { fetchLandingPageData().then(setData); }, []);
  if (!data) return <PublicLayout><div className="min-h-screen" /></PublicLayout>;

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative h-72 md:h-80 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${getImageUrl(data.heroSlides[3]?.image_path || data.heroSlides[0]?.image_path)})` }} />
        <div className="absolute inset-0 bg-[#3E2723]/60" />
        <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#FDF8F3] to-transparent" />
        <div className="relative z-10 h-full flex items-center justify-center text-center px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">News & Events</h1>
            <p className="text-white/80">Stay updated with the latest from CSE, KUET</p>
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 md:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.news.map((n, i) => (
            <motion.div key={n.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className={`group bg-white rounded-2xl overflow-hidden border border-[#E8DDD1] hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300 ${
                i === 0 ? 'md:col-span-2 lg:col-span-2 md:row-span-2' : ''
              }`}>
              {n.image_path && (
                <div className="relative overflow-hidden">
                  <img src={getImageUrl(n.image_path)} alt={n.title}
                    className={`w-full object-cover transition-transform duration-700 group-hover:scale-110 ${i === 0 ? 'h-64 md:h-80' : 'h-48'}`} />
                  <div className="absolute inset-0 bg-[#5D4037]/15 group-hover:bg-[#5D4037]/5 transition-all" />
                  <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#2C1810]/60 to-transparent" />
                  <span className="absolute top-3 left-3 px-3 py-1 bg-[#D4A574] text-[#2C1810] text-xs font-bold rounded-full">{n.category}</span>
                </div>
              )}
              <div className="p-5">
                {n.published_at && (
                  <p className="text-xs text-[#8B7355] mb-2">
                    {new Date(n.published_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                )}
                <h3 className={`font-bold text-[#2C1810] mb-2 group-hover:text-[#5D4037] ${i === 0 ? 'text-xl' : 'text-base'}`}>{n.title}</h3>
                {n.excerpt && <p className="text-[#6B5744] text-sm line-clamp-3">{n.excerpt}</p>}
                {n.body && i === 0 && <p className="text-[#6B5744] text-sm mt-3 line-clamp-4">{n.body}</p>}
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
