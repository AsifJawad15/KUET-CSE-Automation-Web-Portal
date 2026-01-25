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
    GraduationCap,
    Lock,
    Mail,
    Shield,
    Sparkles,
    User
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

const demoCredentials = [
  { email: 'admin@gmail.com', password: 'admin123', role: 'Admin', icon: Shield },
  { email: 'teacher@kuet.ac.bd', password: 'teacher123', role: 'Teacher', icon: User }
];

export default function SignInPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    const result = await login(email, password);
    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'Invalid credentials. Try the demo accounts below.');
    }
    setIsLoading(false);
  };

  const handleDemoLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
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
    <div className="min-h-screen bg-[#060010] flex items-center justify-center relative overflow-hidden px-4">
      {/* Light Rays Background */}
      <div className="absolute inset-0 z-0">
        <LightRays
          raysOrigin="top-left"
          raysColor="#8400ff"
          raysSpeed={0.5}
          lightSpread={0.8}
          rayLength={3}
          followMouse={true}
          mouseInfluence={0.1}
          pulsating={true}
        />
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#060010]/80 via-transparent to-[#060010]/80 z-[1]" />

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
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8400ff] to-[#5c00b3] flex items-center justify-center shadow-lg shadow-[#8400ff]/30"
            >
              <GraduationCap className="w-7 h-7 text-white" />
            </motion.div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-white">KUET CSE</h1>
              <p className="text-xs text-white/60">Automation Portal</p>
            </div>
          </Link>
        </motion.div>

        {/* Sign In Card */}
        <motion.div variants={itemVariants}>
          <SpotlightCard className="p-8" spotlightColor="rgba(132, 0, 255, 0.2)">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
              <p className="text-white/60 text-sm">Sign in to access your portal</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input */}
              <div className="space-y-2">
                <label className="text-sm text-white/80 font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-[#392e4e] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#8400ff] focus:ring-1 focus:ring-[#8400ff]/50 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="text-sm text-white/80 font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-[#392e4e] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#8400ff] focus:ring-1 focus:ring-[#8400ff]/50 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
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

              {/* Forgot Password */}
              <div className="text-right">
                <Link 
                  href="/auth/forgot-password" 
                  className="text-sm text-[#8400ff] hover:text-[#b366ff] transition-colors"
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
                className="w-full"
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

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-[#392e4e]" />
              <span className="text-white/40 text-sm">Demo Accounts</span>
              <div className="flex-1 h-px bg-[#392e4e]" />
            </div>

            {/* Demo Credentials */}
            <div className="space-y-3">
              {demoCredentials.map((demo, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDemoLogin(demo.email, demo.password)}
                  className="w-full p-4 rounded-xl bg-white/5 border border-[#392e4e] hover:border-[#8400ff]/50 hover:bg-[#8400ff]/5 transition-all flex items-center gap-4 group"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    index === 0 ? 'bg-[#8400ff]/20 text-[#8400ff]' : 'bg-[#00e5ff]/20 text-[#00e5ff]'
                  }`}>
                    <demo.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-white font-medium text-sm">{demo.role}</div>
                    <div className="text-white/50 text-xs">{demo.email}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
                </motion.button>
              ))}
            </div>

            {/* Sign Up Link */}
            <p className="text-center text-white/60 text-sm mt-6">
              Don&apos;t have an account?{' '}
              <Link 
                href="/auth/signup" 
                className="text-[#8400ff] hover:text-[#b366ff] font-medium transition-colors"
              >
                Sign Up
              </Link>
            </p>
          </SpotlightCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
