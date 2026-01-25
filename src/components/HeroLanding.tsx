'use client';

import LightRays from '@/components/ui/LightRays';
import PillButton from '@/components/ui/PillButton';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { motion } from 'framer-motion';
import {
    BookOpen,
    Building2,
    Calendar,
    ChevronRight,
    FileText,
    GraduationCap,
    Monitor,
    Sparkles,
    Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

const features = [
  {
    icon: Monitor,
    title: 'TV Display',
    description: 'Real-time announcements and schedules',
    color: 'rgba(132, 0, 255, 0.25)'
  },
  {
    icon: Users,
    title: 'Faculty Info',
    description: 'Complete faculty directory',
    color: 'rgba(0, 229, 255, 0.25)'
  },
  {
    icon: Building2,
    title: 'Room Allocation',
    description: 'Smart room management system',
    color: 'rgba(132, 0, 255, 0.25)'
  },
  {
    icon: BookOpen,
    title: 'Course Allocation',
    description: 'Efficient course scheduling',
    color: 'rgba(0, 229, 255, 0.25)'
  },
  {
    icon: Calendar,
    title: 'Schedule',
    description: 'Class and exam schedules',
    color: 'rgba(132, 0, 255, 0.25)'
  },
  {
    icon: FileText,
    title: 'Results',
    description: 'Academic performance tracking',
    color: 'rgba(0, 229, 255, 0.25)'
  }
];

const stats = [
  { value: '1000+', label: 'Students' },
  { value: '50+', label: 'Faculty' },
  { value: '30+', label: 'Courses' },
  { value: '20+', label: 'Labs' }
];

const HeroLanding: React.FC = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
    }
  };

  const floatAnimation = {
    y: [-10, 10, -10],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut' as const
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#060010] relative overflow-hidden">
      {/* Light Rays Background */}
      <div className="absolute inset-0 z-0">
        <LightRays
          raysOrigin="top-center"
          raysColor="#8400ff"
          raysSpeed={0.6}
          lightSpread={0.8}
          rayLength={3.5}
          followMouse={true}
          mouseInfluence={0.2}
          pulsating={true}
          fadeDistance={1.8}
          saturation={1.5}
        />
      </div>

      {/* Gradient overlays - less opacity to show more light rays */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060010]/30 to-[#060010]/80 z-[1]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(132,0,255,0.1),transparent_50%)] z-[1]" />

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <motion.nav 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between px-6 md:px-12 py-6"
        >
          <div className="flex items-center gap-3">
            <motion.div 
              animate={floatAnimation}
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8400ff] to-[#5c00b3] flex items-center justify-center shadow-lg shadow-[#8400ff]/30"
            >
              <GraduationCap className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold text-white">KUET CSE</h1>
              <p className="text-xs text-white/60">Automation Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <PillButton 
              variant="primary" 
              size="sm"
              onClick={() => router.push('/auth/signin')}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Sign In
            </PillButton>
          </div>
        </motion.nav>

        {/* Hero Section */}
        <motion.section 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="px-6 md:px-12 py-20 md:py-32 max-w-7xl mx-auto"
        >
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <motion.div 
              variants={itemVariants}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#8400ff]/10 border border-[#8400ff]/30 mb-8"
            >
              <Sparkles className="w-4 h-4 text-[#8400ff]" />
              <span className="text-sm text-[#8400ff] font-medium">CSE Department Automation</span>
            </motion.div>

            {/* Main Heading */}
            <motion.h1 
              variants={itemVariants}
              className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight"
            >
              Streamline Your
              <span className="block bg-gradient-to-r from-[#8400ff] via-[#b366ff] to-[#00e5ff] bg-clip-text text-transparent">
                Academic Journey
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p 
              variants={itemVariants}
              className="text-lg md:text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              The complete automation solution for KUET CSE Department. 
              Manage schedules, resources, and academic information seamlessly.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div 
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <PillButton 
                variant="primary" 
                size="lg"
                onClick={() => router.push('/auth/signin')}
                icon={<ChevronRight className="w-5 h-5" />}
                iconPosition="right"
              >
                Access Portal
              </PillButton>
              <PillButton 
                variant="outline" 
                size="lg"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Explore Features
              </PillButton>
            </motion.div>

            {/* Stats */}
            <motion.div 
              variants={itemVariants}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
            >
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  className="text-center"
                >
                  <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#8400ff] to-[#00e5ff] bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="text-sm text-white/60 mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* Features Section */}
        <section id="features" className="px-6 md:px-12 py-20 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Powerful Features
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Everything you need to manage academic operations efficiently
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <SpotlightCard 
                  spotlightColor={feature.color}
                  className="h-full hover:-translate-y-2 transition-transform duration-300"
                >
                  <div className="flex flex-col h-full">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                      feature.color.includes('132') 
                        ? 'bg-[#8400ff]/20 text-[#8400ff]' 
                        : 'bg-[#00e5ff]/20 text-[#00e5ff]'
                    }`}>
                      <feature.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-white/60 text-sm flex-1">
                      {feature.description}
                    </p>
                    <motion.div 
                      className="mt-4 flex items-center text-sm text-[#8400ff] font-medium cursor-pointer group"
                      whileHover={{ x: 5 }}
                    >
                      Learn more 
                      <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </motion.div>
                  </div>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 md:px-12 py-20 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl overflow-hidden"
          >
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#8400ff] to-[#5c00b3]" />
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
            
            <div className="relative z-10 px-8 md:px-16 py-16 md:py-20 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-white/80 max-w-xl mx-auto mb-8">
                Join the KUET CSE automation portal today and experience seamless academic management.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <PillButton 
                  variant="secondary" 
                  size="lg"
                  onClick={() => router.push('/auth/signin')}
                >
                  Sign In Now
                </PillButton>
                <PillButton 
                  variant="ghost" 
                  size="lg"
                  onClick={() => router.push('/auth/signup')}
                  className="border-white/30 hover:border-white/50"
                >
                  Create Account
                </PillButton>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="px-6 md:px-12 py-8 border-t border-white/10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#8400ff]" />
              <span className="text-white/60 text-sm">
                © 2026 KUET CSE Department. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-white/60 hover:text-white text-sm transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-white/60 hover:text-white text-sm transition-colors">
                Terms of Service
              </a>
              <a href="#" className="text-white/60 hover:text-white text-sm transition-colors">
                Contact
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default HeroLanding;
