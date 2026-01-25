'use client';

import { motion } from 'framer-motion';
import React from 'react';

interface PillButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const PillButton: React.FC<PillButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
  icon,
  iconPosition = 'left'
}) => {
  const baseStyles = 'relative inline-flex items-center justify-center font-medium transition-all duration-300 rounded-full overflow-hidden backdrop-blur-md';
  
  const variantStyles = {
    primary: 'bg-[#8400ff]/30 text-white hover:bg-[#8400ff]/40 hover:shadow-[0_0_25px_rgba(132,0,255,0.35)] border border-[#8400ff]/40',
    secondary: 'bg-[#00e5ff]/20 text-white hover:bg-[#00e5ff]/30 hover:shadow-[0_0_25px_rgba(0,229,255,0.35)] border border-[#00e5ff]/40',
    outline: 'bg-white/5 border border-[#8400ff]/50 text-[#b366ff] hover:bg-[#8400ff]/15 hover:shadow-[0_0_20px_rgba(132,0,255,0.25)]',
    ghost: 'bg-white/5 border border-white/15 text-white/90 hover:bg-white/10 hover:border-white/25'
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm gap-1.5',
    md: 'px-6 py-3 text-base gap-2',
    lg: 'px-8 py-4 text-lg gap-2.5'
  };

  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledStyles} ${className}`}
    >
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 opacity-0 transition-opacity duration-300"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        style={{
          background: variant === 'primary' 
            ? 'radial-gradient(circle at center, rgba(132,0,255,0.3), transparent 70%)' 
            : variant === 'secondary'
            ? 'radial-gradient(circle at center, rgba(0,229,255,0.3), transparent 70%)'
            : 'radial-gradient(circle at center, rgba(255,255,255,0.1), transparent 70%)'
        }}
      />
      
      {/* Content */}
      <span className="relative z-10 flex items-center gap-2">
        {icon && iconPosition === 'left' && icon}
        {children}
        {icon && iconPosition === 'right' && icon}
      </span>

      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 -translate-x-full"
        animate={{ translateX: ['100%', '-100%'] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)'
        }}
      />
    </motion.button>
  );
};

export default PillButton;
