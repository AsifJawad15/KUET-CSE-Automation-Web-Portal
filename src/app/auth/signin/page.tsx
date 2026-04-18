'use client';

import LightRays from '@/components/ui/LightRays';
import PillButton from '@/components/ui/PillButton';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowRight,
    Eye,
    EyeOff,
    Lock,
    Mail,
    Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

export default function SignInPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [accountInfo, setAccountInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await login(email, password);
    if (result.success) {
      router.replace('/dashboard');
    } else {
      setError(result.error || 'Invalid credentials.');
    }
    setIsLoading(false);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5 } }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#1a1210] flex items-center justify-center relative overflow-hidden px-4">
      {/* Light Rays Background */}
      <div className="absolute inset-0 z-0">
        <LightRays
          raysOrigin="top-left"
          raysColor="#8B6914"
          raysSpeed={0.5}
          lightSpread={0.8}
          rayLength={3}
          followMouse={true}
          mouseInfluence={0.1}
          pulsating={true}
        />
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FAF7F3]/80 via-transparent to-[#FAF7F3]/80 dark:from-[#1a1210]/80 dark:via-transparent dark:to-[#1a1210]/80 z-[1]" />

      {/* Content */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <motion.div 
          variants={itemVariants}
          className="text-center mb-8"
        >
          <Link href="/" className="inline-flex items-center gap-3 group">
            <motion.div 
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-14 h-14 rounded-2xl bg-[#5D4037] flex items-center justify-center shadow-lg shadow-[#5D4037]/30"
            >
              <img src="/kuet-logo.png" alt="KUET" className="w-7 h-7 object-contain" />
            </motion.div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-[#3E2723] dark:text-white">KUET CSE</h1>
              <p className="text-xs text-[#795548] dark:text-[#D7CCC8]">Automation Portal</p>
            </div>
          </Link>
        </motion.div>

        {/* Sign In Card */}
        <motion.div variants={itemVariants}>
          <SpotlightCard className="p-8 bg-white dark:bg-transparent" spotlightColor="rgba(141, 110, 80, 0.25)">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-[#3E2723] dark:text-white mb-2">Welcome Back</h2>
              <p className="text-[#795548] dark:text-[#D7CCC8] text-sm">Sign in to access your portal</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input */}
              <div className="space-y-2">
                <label className="text-sm text-[#3E2723] dark:text-[#EFEBE9] font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8D6E50] dark:text-[#A1887F]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-12 pr-4 py-3.5 bg-[#FAF7F3] dark:bg-[#1a1210] border border-[#D7CCC8] dark:border-[#5D4037] rounded-xl text-[#3E2723] dark:text-white placeholder:text-[#A1887F] dark:placeholder:text-white/30 focus:outline-none focus:border-[#8D6E50] dark:focus:border-[#A1887F] focus:ring-1 focus:ring-[#8D6E50]/40 dark:focus:ring-[#A1887F]/40 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="text-sm text-[#3E2723] dark:text-[#EFEBE9] font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8D6E50] dark:text-[#A1887F]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-12 pr-12 py-3.5 bg-[#FAF7F3] dark:bg-[#1a1210] border border-[#D7CCC8] dark:border-[#5D4037] rounded-xl text-[#3E2723] dark:text-white placeholder:text-[#A1887F] dark:placeholder:text-white/30 focus:outline-none focus:border-[#8D6E50] dark:focus:border-[#A1887F] focus:ring-1 focus:ring-[#8D6E50]/40 dark:focus:ring-[#A1887F]/40 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A1887F] hover:text-[#5D4037] dark:hover:text-[#D7CCC8] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {accountInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center"
                  >
                    {accountInfo}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Forgot Password */}
              <div className="text-right">
                <Link 
                  href="/auth/forgot-password" 
                  className="text-sm text-[#8D6E50] dark:text-[#D7CCC8] hover:text-[#3E2723] dark:hover:text-white transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <PillButton
                type="submit"
                variant="primary"
                size="lg"
                disabled={isLoading}
                className="w-full !bg-[#5D4037]/80 hover:!bg-[#5D4037] !border-[#8D6E50]/50"
                icon={isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <ArrowRight className="w-5 h-5" />
                )}
                iconPosition="right"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </PillButton>
            </form>

            {/* Sign Up Link */}
            <p className="text-center text-[#795548] dark:text-[#D7CCC8] text-sm mt-6">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() =>
                  setAccountInfo('For account creation, visit the office or contact the system administrator.')
                }
                className="text-[#5D4037] dark:text-[#BCAAA4] hover:text-[#3E2723] dark:hover:text-white font-medium transition-colors"
              >
                Sign Up
              </button>
            </p>
          </SpotlightCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
