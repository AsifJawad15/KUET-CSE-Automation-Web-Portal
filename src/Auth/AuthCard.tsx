"use client";

import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Sparkles } from 'lucide-react';
import { useState } from 'react';
import SignIn from './SignIn';
import SignUp from './SignUp';

export default function AuthCard() {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-5xl"
      >
        {/* Desktop Layout */}
        <div className="hidden lg:flex bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden min-h-[600px] border border-slate-200 dark:border-slate-800">
          <AnimatePresence mode="wait">
            <motion.div 
              key={isSignUp ? 'signup-form' : 'signin-form'}
              initial={{ opacity: 0, x: isSignUp ? 50 : -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isSignUp ? -50 : 50 }}
              transition={{ duration: 0.4 }}
              className={`flex-1 flex items-center justify-center p-10 ${isSignUp ? 'order-2' : 'order-1'}`}
            >
              {isSignUp ? (
                <SignUp onToggleForm={() => setIsSignUp(false)} />
              ) : (
                <SignIn onToggleForm={() => setIsSignUp(true)} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Animated Side Panel */}
          <motion.div 
            layout
            className={`flex-1 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 flex items-center justify-center p-10 relative overflow-hidden ${isSignUp ? 'order-1' : 'order-2'}`}
          >
            {/* Animated Background Elements */}
            <div className="absolute inset-0">
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 180, 360],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"
              />
              <motion.div 
                animate={{ 
                  scale: [1.2, 1, 1.2],
                  rotate: [360, 180, 0],
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-20 -left-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
              />
              <motion.div 
                animate={{ y: [-20, 20, -20] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/4 left-1/4 w-32 h-32 bg-cyan-400/10 rounded-full blur-2xl"
              />
            </div>

            {/* Floating particles */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  y: [-30, 30, -30],
                  x: [-20, 20, -20],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 4 + i,
                  repeat: Infinity,
                  delay: i * 0.5,
                }}
                className="absolute w-2 h-2 bg-white/30 rounded-full"
                style={{
                  top: `${20 + i * 12}%`,
                  left: `${10 + i * 15}%`,
                }}
              />
            ))}
            
            <div className="text-center text-white space-y-6 relative z-10">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="mb-6"
              >
                <div className="w-24 h-24 mx-auto bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-xl">
                  <BookOpen className="w-12 h-12 text-white" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-4xl font-bold drop-shadow-lg flex items-center justify-center gap-2">
                  {isSignUp ? 'Welcome Back!' : 'Hello, Admin!'}
                  <Sparkles className="w-6 h-6 text-yellow-300" />
                </h2>
              </motion.div>

              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-lg opacity-95 max-w-sm mx-auto leading-relaxed"
              >
                {isSignUp 
                  ? 'Already have an account? Sign in to continue managing the CSE department.'
                  : 'New here? Create an account to access the automation portal.'
                }
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsSignUp(!isSignUp)}
                className="px-10 py-3 border-2 border-white/80 rounded-full font-semibold 
                           hover:bg-white hover:text-indigo-600 transition-all duration-300 
                           shadow-lg backdrop-blur-sm"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </motion.button>

              {/* Feature badges */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="flex flex-wrap justify-center gap-2 mt-8"
              >
                {['Secure', 'Fast', 'Modern'].map((tag, index) => (
                  <span 
                    key={tag}
                    className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs font-medium border border-white/20"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {tag}
                  </span>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 p-8 text-center text-white relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl" />
            
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
              className="w-20 h-20 mx-auto bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 border border-white/30 relative z-10"
            >
              <BookOpen className="w-10 h-10 text-white" />
            </motion.div>
            
            <h2 className="text-2xl font-bold mb-2 relative z-10">
              {isSignUp ? 'Create Account' : 'KUET CSE Portal'}
            </h2>
            <p className="text-sm opacity-90 relative z-10">
              {isSignUp ? 'Sign up to get started' : 'Admin & Teacher Access'}
            </p>
          </div>
          
          <div className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={isSignUp ? 'mobile-signup' : 'mobile-signin'}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {isSignUp ? (
                  <SignUp onToggleForm={() => setIsSignUp(false)} />
                ) : (
                  <SignIn onToggleForm={() => setIsSignUp(true)} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
