"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { TeacherDesignation, TeacherWithAuth } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical, Edit, UserX, UserCheck, Trash2, Copy } from 'lucide-react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface FacultyCardProps {
  teacher: TeacherWithAuth;
  index: number;
  onUpdate: (teacher: TeacherWithAuth) => void;
  onToggleLeave: (teacher: TeacherWithAuth) => void;
  onCopyPassword: (teacher: TeacherWithAuth) => void;
  onDelete: (teacher: TeacherWithAuth) => void;
}

const getDesignationColor = (designation: TeacherDesignation) => {
  switch (designation) {
    case 'PROFESSOR': return 'bg-[#ba181b]/20 text-[#e5383b] border border-[#ba181b]/30';
    case 'ASSOCIATE_PROFESSOR': return 'bg-[#d3d3d3]/20 text-[#d3d3d3] border border-[#d3d3d3]/30';
    case 'ASSISTANT_PROFESSOR': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    case 'LECTURER': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    default: return 'bg-white/10 text-white/70 border border-white/20';
  }
};

const getDesignationLabel = (designation: TeacherDesignation) => {
  switch (designation) {
    case 'PROFESSOR': return 'Professor';
    case 'ASSOCIATE_PROFESSOR': return 'Associate Professor';
    case 'ASSISTANT_PROFESSOR': return 'Assistant Professor';
    case 'LECTURER': return 'Lecturer';
    default: return designation;
  }
};

export default function FacultyCard({ teacher, index, onUpdate, onToggleLeave, onCopyPassword, onDelete }: FacultyCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Close on outside click or scroll
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };
    const handleScroll = () => closeMenu();
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [menuOpen, closeMenu]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!menuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 });
    }
    setMenuOpen(prev => !prev);
  };

  // Portal-based dropdown menu rendered at document body level
  const dropdownMenu = menuOpen
    ? createPortal(
        <AnimatePresence>
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.15 }}
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
            className="w-48 bg-[#FAF7F3] dark:bg-[#161a1d] border border-[#DCC5B2] dark:border-[#3d4951] rounded-xl shadow-xl overflow-hidden"
          >
            <button
              onClick={() => { closeMenu(); onUpdate(teacher); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#5D4E37] dark:text-[#f5f3f4] hover:bg-[#F0E4D3] dark:hover:bg-[#0b090a] transition-colors"
            >
              <Edit className="w-4 h-4 text-[#D9A299] dark:text-[#ba181b]" />
              Update Profile
            </button>
            <div className="border-t border-[#DCC5B2]/50 dark:border-[#3d4951]/50" />
            <button
              onClick={() => { closeMenu(); onToggleLeave(teacher); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                teacher.is_on_leave
                  ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                  : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10'
              }`}
            >
              {teacher.is_on_leave ? (
                <><UserCheck className="w-4 h-4" /> Mark as Present</>
              ) : (
                <><UserX className="w-4 h-4" /> Mark as On Leave</>
              )}
            </button>
            <div className="border-t border-[#DCC5B2]/50 dark:border-[#3d4951]/50" />
            <button
              onClick={() => { closeMenu(); onCopyPassword(teacher); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#5D4E37] dark:text-[#f5f3f4] hover:bg-[#F0E4D3] dark:hover:bg-[#0b090a] transition-colors"
            >
              <Copy className="w-4 h-4 text-[#D9A299] dark:text-[#d3d3d3]" />
              Copy Password
            </button>
            <div className="border-t border-[#DCC5B2]/50 dark:border-[#3d4951]/50" />
            <button
              onClick={() => { closeMenu(); onDelete(teacher); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </motion.div>
        </AnimatePresence>,
        document.body
      )
    : null;

  return (
    <motion.div
      key={teacher.user_id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <SpotlightCard className={`rounded-xl p-5 border h-full ${teacher.is_on_leave ? 'border-amber-400/50 dark:border-amber-400/30' : 'border-[#DCC5B2] dark:border-[#3d4951]'}`} spotlightColor={teacher.is_on_leave ? 'rgba(245, 158, 11, 0.15)' : 'rgba(217, 162, 153, 0.2)'}>
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold ${teacher.is_on_leave ? 'bg-gradient-to-br from-amber-500/70 to-amber-600/70 opacity-70' : 'bg-gradient-to-br from-[#D9A299] to-[#DCC5B2]'}`}>
            {teacher.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold ${teacher.is_on_leave ? 'text-[#8B7355] dark:text-[#b1a7a6]' : 'text-[#5D4E37] dark:text-white'}`}>{teacher.full_name}</h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getDesignationColor(teacher.designation)}`}>
                {getDesignationLabel(teacher.designation)}
              </span>
              {teacher.is_on_leave && (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-500 border border-amber-500/30">
                  On Leave
                </span>
              )}
            </div>
          </div>
          {/* 3-dot menu */}
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={toggleMenu}
              className="p-1.5 rounded-lg text-[#8B7355] dark:text-[#b1a7a6]/70 hover:text-[#5D4E37] dark:hover:text-white hover:bg-[#F0E4D3] dark:hover:bg-[#3d4951]/30 transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {dropdownMenu}
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-[#8B7355] dark:text-[#b1a7a6]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="truncate">{teacher.profile.email}</span>
          </div>
          {teacher.phone && (
            <div className="flex items-center gap-2 text-[#8B7355] dark:text-[#b1a7a6]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>{teacher.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[#8B7355] dark:text-[#b1a7a6]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            </svg>
            <span className="font-mono text-xs">{teacher.teacher_uid}</span>
          </div>
          {teacher.is_on_leave ? (
            <div className="flex items-center gap-2 text-amber-500">
              <UserX className="w-4 h-4" />
              <span className="text-xs">On Leave</span>
            </div>
          ) : teacher.profile.is_active ? (
            <div className="flex items-center gap-2 text-emerald-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs">Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs">Inactive</span>
            </div>
          )}
        </div>
      </SpotlightCard>
    </motion.div>
  );
}
