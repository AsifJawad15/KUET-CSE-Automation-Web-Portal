// ==========================================
// Stats Section
// Single Responsibility: Renders animated stat counters
// ==========================================

'use client';

import AnimatedCounter from '@/components/ui/AnimatedCounter';
import { getIcon } from '@/components/ui/iconMap';
import Reveal from '@/components/ui/Reveal';
import React from 'react';

export interface StatItem {
  id: string;
  icon: string;
  value: string;
  label: string;
}

interface StatsSectionProps {
  stats: StatItem[];
}

const StatsSection: React.FC<StatsSectionProps> = ({ stats }) => {
  if (!stats.length) return null;

  return (
    <section className="py-16 bg-[#F5EDE4]">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {stats.map((s, i) => {
            const Icon = getIcon(s.icon);
            return (
              <Reveal key={s.id} delay={i * 0.08}>
                <div className="text-center group">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-white shadow-warm flex items-center justify-center
                    group-hover:shadow-warm-lg group-hover:scale-110 transition-all duration-300">
                    <Icon className="w-6 h-6 text-[#5D4037]" />
                  </div>
                  <div className="text-3xl md:text-4xl font-bold text-[#5D4037]">
                    <AnimatedCounter value={s.value} />
                  </div>
                  <p className="text-sm text-[#6B5744] mt-1">{s.label}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
