"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { TERMS } from './constants';
import { TermGroup } from './types';
import { motion } from 'framer-motion';
import { ArrowUpDown, GraduationCap, Hash, Users } from 'lucide-react';

interface TermUpgradeStatsProps {
  termGroups: TermGroup[];
  totalStudents: number;
  totalChanged: number;
}

export default function TermUpgradeStats({
  termGroups,
  totalStudents,
  totalChanged,
}: TermUpgradeStatsProps) {
  const avgPerTerm = termGroups.filter((g) => g.students.length > 0).length > 0
    ? Math.round(totalStudents / termGroups.filter((g) => g.students.length > 0).length)
    : 0;

  const stats = [
    {
      label: 'Total Students',
      value: totalStudents,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-500/20',
      spotlightColor: 'rgba(59, 130, 246, 0.15)',
    },
    {
      label: 'Active Terms',
      value: termGroups.filter((g) => g.students.length > 0).length,
      icon: GraduationCap,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-500/20',
      spotlightColor: 'rgba(168, 85, 247, 0.15)',
    },
    {
      label: 'Avg / Term',
      value: avgPerTerm,
      icon: Hash,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-500/20',
      spotlightColor: 'rgba(245, 158, 11, 0.15)',
    },
    {
      label: 'Changed Today',
      value: totalChanged,
      icon: ArrowUpDown,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-500/20',
      spotlightColor: 'rgba(16, 185, 129, 0.15)',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <SpotlightCard className="p-4" spotlightColor={stat.spotlightColor}>
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center flex-shrink-0`}
              >
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-[#5D4E37] dark:text-white">
                  {stat.value}
                </p>
                <p className="text-xs text-[#8B7355] dark:text-white/50">
                  {stat.label}
                </p>
              </div>
            </div>
          </SpotlightCard>
        </motion.div>
      ))}
    </div>
  );
}
