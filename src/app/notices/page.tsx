'use client';

import PublicLayout from '@/components/PublicLayout';
import { fetchLandingPageData, getImageUrl } from '@/services/cmsService';
import type { LandingPageData } from '@/types/cms';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function NoticesPage() {
  const [data, setData] = useState<LandingPageData | null>(null);
  useEffect(() => { fetchLandingPageData().then(setData); }, []);
  if (!data) return <PublicLayout><div className="min-h-screen" /></PublicLayout>;

  return (
    <PublicLayout>
      <section className="relative h-64 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${getImageUrl(data.heroSlides[0]?.image_path)})` }} />
        <div className="absolute inset-0 bg-[#3E2723]/60" />
        <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#FDF8F3] to-transparent" />
        <div className="relative z-10 h-full flex items-center justify-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-bold text-white">
            Notices & Announcements
          </motion.h1>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 md:px-8 py-16">
        <div className="space-y-4">
          {data.news.map((n, i) => (
            <motion.div key={n.id} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl p-5 border border-[#E8DDD1] hover:shadow-warm hover:-translate-y-0.5 transition-all flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#5D4037]/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-[#5D4037]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-[#D4A574]/20 text-[#5D4037] text-xs font-bold rounded-full">{n.category}</span>
                  {n.published_at && (
                    <span className="text-xs text-[#8B7355]">
                      {new Date(n.published_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-[#2C1810]">{n.title}</h3>
                {n.excerpt && <p className="text-[#6B5744] text-sm mt-1 line-clamp-2">{n.excerpt}</p>}
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
