'use client';

import { motion } from 'framer-motion';
import React, { ReactNode } from 'react';
import SpotlightCard from './SpotlightCard';

interface BentoItemProps {
  children: ReactNode;
  className?: string;
  colSpan?: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2 | 3;
  spotlightColor?: string;
  delay?: number;
}

export const BentoItem: React.FC<BentoItemProps> = ({
  children,
  className = '',
  colSpan = 1,
  rowSpan = 1,
  spotlightColor = 'rgba(132, 0, 255, 0.15)',
  delay = 0,
}) => {
  const colSpanClasses: Record<number, string> = {
    1: 'col-span-1',
    2: 'col-span-1 md:col-span-2',
    3: 'col-span-1 md:col-span-2 lg:col-span-3',
    4: 'col-span-1 md:col-span-2 lg:col-span-4',
  };

  const rowSpanClasses: Record<number, string> = {
    1: 'row-span-1',
    2: 'row-span-1 md:row-span-2',
    3: 'row-span-1 md:row-span-2 lg:row-span-3',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`${colSpanClasses[colSpan]} ${rowSpanClasses[rowSpan]} ${className}`}
    >
      <SpotlightCard
        spotlightColor={spotlightColor}
        className="h-full"
      >
        {children}
      </SpotlightCard>
    </motion.div>
  );
};

interface BentoGridProps {
  children: ReactNode;
  className?: string;
  cols?: 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
}

export const BentoGrid: React.FC<BentoGridProps> = ({
  children,
  className = '',
  cols = 4,
  gap = 'md',
}) => {
  const colClasses: Record<number, string> = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const gapClasses: Record<string, string> = {
    sm: 'gap-3',
    md: 'gap-4 md:gap-6',
    lg: 'gap-6 md:gap-8',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`grid ${colClasses[cols]} ${gapClasses[gap]} ${className}`}
    >
      {children}
    </motion.div>
  );
};

// Preset Bento Card Components
interface BentoStatCardProps {
  icon: ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  spotlightColor?: string;
  delay?: number;
}

export const BentoStatCard: React.FC<BentoStatCardProps> = ({
  icon,
  title,
  value,
  subtitle,
  trend,
  spotlightColor = 'rgba(132, 0, 255, 0.15)',
  delay = 0,
}) => {
  return (
    <BentoItem spotlightColor={spotlightColor} delay={delay}>
      <div className="p-5 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2.5 rounded-xl bg-[#8400ff]/10">
            {icon}
          </div>
          {trend && (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              trend.isPositive 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : 'bg-red-500/10 text-red-400'
            }`}>
              {trend.isPositive ? '+' : ''}{trend.value}
            </span>
          )}
        </div>
        <div className="mt-auto">
          <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
          <p className="text-sm text-white/60">{title}</p>
          {subtitle && (
            <p className="text-xs text-white/40 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    </BentoItem>
  );
};

interface BentoListCardProps {
  title: string;
  items: Array<{
    id: string;
    primary: string;
    secondary?: string;
    badge?: string;
    badgeColor?: string;
  }>;
  spotlightColor?: string;
  delay?: number;
  colSpan?: 1 | 2;
  rowSpan?: 1 | 2;
}

export const BentoListCard: React.FC<BentoListCardProps> = ({
  title,
  items,
  spotlightColor = 'rgba(132, 0, 255, 0.15)',
  delay = 0,
  colSpan = 1,
  rowSpan = 1,
}) => {
  return (
    <BentoItem spotlightColor={spotlightColor} delay={delay} colSpan={colSpan} rowSpan={rowSpan}>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-sm font-semibold text-white/80 mb-4">{title}</h3>
        <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-1 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#392e4e] [&::-webkit-scrollbar-thumb]:rounded-full">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + index * 0.05 }}
              className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-[#8400ff]/10 transition-colors group cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate group-hover:text-[#00e5ff] transition-colors">
                  {item.primary}
                </p>
                {item.secondary && (
                  <p className="text-xs text-white/50 truncate">{item.secondary}</p>
                )}
              </div>
              {item.badge && (
                <span 
                  className="text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0"
                  style={{ 
                    backgroundColor: item.badgeColor ? `${item.badgeColor}20` : 'rgba(132, 0, 255, 0.2)',
                    color: item.badgeColor || '#a855f7'
                  }}
                >
                  {item.badge}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </BentoItem>
  );
};

interface BentoChartCardProps {
  title: string;
  children: ReactNode;
  spotlightColor?: string;
  delay?: number;
  colSpan?: 1 | 2 | 3;
  rowSpan?: 1 | 2;
}

export const BentoChartCard: React.FC<BentoChartCardProps> = ({
  title,
  children,
  spotlightColor = 'rgba(0, 229, 255, 0.15)',
  delay = 0,
  colSpan = 2,
  rowSpan = 1,
}) => {
  return (
    <BentoItem spotlightColor={spotlightColor} delay={delay} colSpan={colSpan} rowSpan={rowSpan}>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-sm font-semibold text-white/80 mb-4">{title}</h3>
        <div className="flex-1 min-h-0">
          {children}
        </div>
      </div>
    </BentoItem>
  );
};

export default { BentoGrid, BentoItem, BentoStatCard, BentoListCard, BentoChartCard };
