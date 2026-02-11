'use client';

import PublicLayout from '@/components/PublicLayout';
import { fetchLandingPageData, getImageUrl } from '@/services/cmsService';
import type { LandingPageData } from '@/types/cms';
import { motion } from 'framer-motion';
import { BookOpen, Clock, GraduationCap } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AboutPage() {
  const [data, setData] = useState<LandingPageData | null>(null);
  useEffect(() => { fetchLandingPageData().then(setData); }, []);
  if (!data) return <PublicLayout><div className="min-h-screen" /></PublicLayout>;

  const dept = data.departmentInfo;

  return (
    <PublicLayout>
      {/* Hero banner */}
      <section className="relative h-72 md:h-96 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${getImageUrl(data.heroSlides[0]?.image_path)})` }} />
        <div className="absolute inset-0 bg-[#3E2723]/60" />
        <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#FDF8F3] to-transparent" />
        <div className="relative z-10 h-full flex items-center justify-center text-center px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">About Us</h1>
            <p className="text-white/80 text-lg">{dept['short_name'] || 'CSE, KUET'}</p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-5xl mx-auto px-6 md:px-8 py-16 space-y-16">
        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-10">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            className="bg-white rounded-2xl p-8 border border-[#E8DDD1] shadow-warm">
            <div className="w-12 h-12 rounded-xl bg-[#5D4037]/10 flex items-center justify-center mb-4">
              <GraduationCap className="w-6 h-6 text-[#5D4037]" />
            </div>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">Our Mission</h2>
            <p className="text-[#6B5744] leading-relaxed">{dept['mission'] || 'To produce world-class graduates in Computer Science and Engineering.'}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            className="bg-white rounded-2xl p-8 border border-[#E8DDD1] shadow-warm">
            <div className="w-12 h-12 rounded-xl bg-[#8B6914]/10 flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-[#8B6914]" />
            </div>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">Our Vision</h2>
            <p className="text-[#6B5744] leading-relaxed">{dept['vision'] || 'To be a center of excellence in CSE education and research.'}</p>
          </motion.div>
        </div>

        {/* History */}
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="bg-[#F5EDE4] rounded-2xl p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-6 h-6 text-[#5D4037]" />
            <h2 className="text-2xl font-bold text-[#2C1810]">Our History</h2>
          </div>
          <p className="text-[#6B5744] leading-relaxed text-lg">
            {dept['history'] || 'The Department of Computer Science and Engineering (CSE) at KUET was established in 2003.'}
          </p>
          {dept['established_year'] && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[#5D4037] text-white rounded-full text-sm font-semibold">
              Established {dept['established_year']}
            </div>
          )}
        </motion.div>

        {/* Department Info */}
        <div className="bg-white rounded-2xl p-8 border border-[#E8DDD1]">
          <h2 className="text-2xl font-bold text-[#2C1810] mb-6">Department Information</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'Department', value: dept['department_name'] },
              { label: 'University', value: dept['university_name'] },
              { label: 'Email', value: dept['email'] },
              { label: 'Phone', value: dept['phone'] },
              { label: 'Address', value: dept['address'] },
              { label: 'Established', value: dept['established_year'] },
            ].filter(r => r.value).map((r, i) => (
              <div key={i} className="p-4 bg-[#FAF7F3] rounded-xl">
                <p className="text-xs text-[#8B7355] uppercase tracking-wider mb-1">{r.label}</p>
                <p className="text-[#2C1810] font-medium">{r.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
