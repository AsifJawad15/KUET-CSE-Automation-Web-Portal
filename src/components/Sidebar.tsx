"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import {
    BookOpen,
    Building2,
    Calendar,
    ChevronLeft,
    ChevronRight,
    FileText,
    GraduationCap,
    LayoutDashboard,
    LogOut,
    Monitor,
    Moon,
    Settings,
    Sparkles,
    Sun,
    UserPlus,
    Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

interface SidebarProps {
  activeItem: string;
  onMenuChange: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// AnimatedListItem component for sidebar menu items
const AnimatedListItem = ({ 
  children, 
  index, 
  onClick 
}: { 
  children: React.ReactNode; 
  index: number; 
  onClick: () => void;
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const inView = useInView(ref, { amount: 0.5, once: false });

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      initial={{ scale: 0.8, opacity: 0, x: -20 }}
      animate={inView ? { scale: 1, opacity: 1, x: 0 } : { scale: 0.8, opacity: 0, x: -20 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      whileHover={{ x: 4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full"
    >
      {children}
    </motion.button>
  );
};

export default function Sidebar({ activeItem, onMenuChange, isCollapsed, onToggleCollapse }: SidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = user?.role === 'admin';

  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tv-display', label: 'TV Display', icon: Monitor },
    { id: 'faculty-info', label: 'Faculty Info', icon: Users },
    { id: 'room-allocation', label: 'Room Allocation', icon: Building2 },
    { id: 'course-allocation', label: 'Course Allocation', icon: BookOpen },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'add-student', label: 'Add Student', icon: UserPlus, adminOnly: true },
    { id: 'add-faculty', label: 'Add Faculty', icon: GraduationCap, adminOnly: true },
    { id: 'result', label: 'Result', icon: FileText },
  ];

  const filteredMenuItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const sidebarVariants = {
    expanded: { width: 280 },
    collapsed: { width: 80 },
  };

  return (
    <motion.aside 
      variants={sidebarVariants}
      animate={isCollapsed ? 'collapsed' : 'expanded'}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="bg-white dark:bg-[#060010]/80 backdrop-blur-xl border-r border-slate-200 dark:border-white/10 h-screen fixed left-0 top-0 flex flex-col z-40 shadow-xl shadow-slate-200 dark:shadow-[#8400ff]/5 transition-colors"
    >
      {/* Header */}
      <div className={`p-4 border-b border-slate-200 dark:border-white/10 ${isCollapsed ? 'px-3' : ''}`}>
        <div className="flex items-center justify-between">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-[#8400ff]/20 dark:bg-[#8400ff]/30 backdrop-blur-sm border border-[#8400ff]/30 dark:border-[#8400ff]/40 flex items-center justify-center shadow-lg shadow-[#8400ff]/20">
                  <Sparkles className="w-5 h-5 text-[#8400ff] dark:text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">KUET CSE</h2>
                  <p className="text-xs text-slate-500 dark:text-white/50">Automation Portal</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onToggleCollapse}
            className={`p-2 rounded-xl bg-slate-100 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/15 text-slate-500 dark:text-white/60 hover:bg-[#8400ff]/20 hover:border-[#8400ff]/40 hover:text-[#8400ff] transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </motion.button>
        </div>
      </div>

      {/* User Info */}
      <div className={`p-4 border-b border-slate-200 dark:border-white/10 ${isCollapsed ? 'px-3' : ''}`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#8400ff]/20 dark:bg-[#8400ff]/30 backdrop-blur-sm border border-[#8400ff]/30 dark:border-[#8400ff]/40 flex items-center justify-center text-[#8400ff] dark:text-white font-semibold text-sm shadow-md shadow-[#8400ff]/20">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#060010]/80 ${user?.role === 'admin' ? 'bg-[#8400ff]' : 'bg-[#00e5ff]'}`} />
          </div>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-slate-500 dark:text-white/50 capitalize">
                  {user?.role || 'Guest'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Menu Items with AnimatedList */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
        {filteredMenuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          
          return (
            <AnimatedListItem 
              key={item.id} 
              index={index}
              onClick={() => onMenuChange(item.id)}
            >
              <div
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-[#8400ff]/20 dark:bg-[#8400ff]/30 backdrop-blur-sm border border-[#8400ff]/30 dark:border-[#8400ff]/40 text-[#8400ff] dark:text-white shadow-lg shadow-[#8400ff]/15'
                    : 'text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white border border-transparent'
                } ${isCollapsed ? 'justify-center px-2' : ''}`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#8400ff] dark:text-white' : 'text-slate-400 dark:text-white/50 group-hover:text-[#8400ff]'} transition-colors`} />
                
                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="font-medium text-sm whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Active indicator */}
                {isActive && !isCollapsed && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute right-3 w-1.5 h-1.5 rounded-full bg-[#8400ff] dark:bg-white/80"
                  />
                )}

                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-2 bg-white dark:bg-[#0d0d1a]/90 backdrop-blur-md border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl">
                    {item.label}
                  </div>
                )}
              </div>
            </AnimatedListItem>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className={`p-3 border-t border-slate-200 dark:border-white/10 space-y-1 ${isCollapsed ? 'px-2' : ''}`}>
        {/* Theme Toggle */}
        <motion.button
          whileHover={{ x: isCollapsed ? 0 : 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white transition-all ${isCollapsed ? 'justify-center px-2' : ''}`}
          title={isCollapsed ? 'Toggle Theme' : ''}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-500" />
          ) : (
            <Moon className="w-5 h-5 text-[#8400ff]" />
          )}
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-medium text-sm"
              >
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Settings */}
        <motion.button
          whileHover={{ x: isCollapsed ? 0 : 4 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white transition-all ${isCollapsed ? 'justify-center px-2' : ''}`}
          title={isCollapsed ? 'Settings' : ''}
        >
          <Settings className="w-5 h-5" />
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-medium text-sm"
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Logout */}
        <motion.button
          whileHover={{ x: isCollapsed ? 0 : 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-500 dark:text-red-400/80 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-all ${isCollapsed ? 'justify-center px-2' : ''}`}
          title={isCollapsed ? 'Logout' : ''}
        >
          <LogOut className="w-5 h-5" />
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-medium text-sm"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.aside>
  );
}
