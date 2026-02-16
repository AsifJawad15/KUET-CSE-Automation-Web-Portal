'use client';

import PublicLayout from '@/components/PublicLayout';
import { fetchLandingPageData, getImageUrl } from '@/services/cmsService';
import type { LandingPageData } from '@/types/cms';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function FacultyPage() {
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
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Faculty & Staff</h1>
            <p className="text-white/80">Meet our dedicated team of educators and researchers</p>
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 md:px-8 py-16">
        {/* HOD Card */}
        {data.hodMessage && (
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="bg-white rounded-2xl overflow-hidden border border-[#E8DDD1] shadow-warm-lg mb-12">
            <div className="grid md:grid-cols-3 gap-0">
              <div className="relative overflow-hidden">
                <img src={getImageUrl(data.hodMessage.photo_path)} alt={data.hodMessage.name}
                  className="w-full h-64 md:h-full object-cover" />
                <div className="absolute inset-0 bg-[#5D4037]/15" />
                <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-[#161a1d]/50 to-transparent" />
              </div>
              <div className="md:col-span-2 p-8">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D4A574] mb-2 block">Head of Department</span>
                <h2 className="text-2xl font-bold text-[#2C1810] mb-1">{data.hodMessage.name}</h2>
                <p className="text-[#8B7355] mb-4">{data.hodMessage.designation}</p>
                <p className="text-[#6B5744] leading-relaxed italic">&ldquo;{data.hodMessage.message}&rdquo;</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Faculty placeholder */}
        <div className="text-center py-16">
          <Users className="w-16 h-16 text-[#D4C8BC] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#2C1810] mb-2">Faculty Directory</h3>
          <p className="text-[#6B5744] max-w-md mx-auto">
            Detailed faculty profiles with research interests, publications, and contact information will be available here.
            Currently, faculty data can be viewed from the{' '}
            <a href="/auth/signin" className="text-[#5D4037] font-semibold hover:text-[#D4A574] underline">dashboard</a> after signing in.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
