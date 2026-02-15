"use client";

import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { AddStudentPage } from '@/modules/AddStudent';
import { ClassRoutinePage } from '@/modules/ClassRoutine';
import { CourseAllocationPage } from '@/modules/CourseAllocation';
import { CourseInfoPage } from '@/modules/CourseInfo';
import { DashboardOverview } from '@/modules/Dashboard';
import { FacultyInfoPage } from '@/modules/FacultyInfo';
import { ResultPage } from '@/modules/Result';
import { RoomAllocationPage } from '@/modules/RoomAllocation';
import { SchedulePage } from '@/modules/Schedule';
import { TermUpgradePage } from '@/modules/TermUpgrade';
import { TVDisplayPage } from '@/modules/TVDisplay';
import { WebsiteCMSPage } from '@/modules/WebsiteCMS';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  // Persist active menu across refreshes using localStorage
  const [activeMenu, setActiveMenu] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dashboard_activeMenu') || 'dashboard';
    }
    return 'dashboard';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  // Save active menu to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard_activeMenu', activeMenu);
    }
  }, [activeMenu]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      localStorage.removeItem('dashboard_activeMenu');
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F3] dark:bg-[#0b090a] flex items-center justify-center transition-colors">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.img
            src="/kuet-logo.png"
            alt="KUET"
            className="w-16 h-16 object-contain"
            animate={{ y: [0, -14, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          />
          <p className="text-[#8B7355] dark:text-[#b1a7a6] font-medium">Loading dashboard...</p>
        </motion.div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  const renderContent = () => {
    const content = (() => {
      switch (activeMenu) {
        case 'dashboard':
          return <DashboardOverview onMenuChange={setActiveMenu} />;
        case 'tv-display':
          return <TVDisplayPage />;
        case 'faculty-info':
          return <FacultyInfoPage />;
        case 'room-allocation':
          return <RoomAllocationPage />;
        case 'course-info':
          return <CourseInfoPage />;
        case 'course-allocation':
          return <CourseAllocationPage />;
        case 'class-routine':
          return <ClassRoutinePage />;
        case 'schedule':
          return <SchedulePage />;
        case 'add-student':
          // Only admin can access
          if (user?.role !== 'admin') {
            return (
              <div className="bg-[#161a1d] rounded-2xl shadow-lg p-8 border border-[#3d4951] text-center">
                <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
                <p className="text-white/60">
                  This section is only accessible to administrators.
                </p>
              </div>
            );
          }
          return <AddStudentPage />;
        case 'term-upgrade':
          return <TermUpgradePage />;
        case 'result':
          return <ResultPage />;
        case 'website-cms':
          if (user?.role !== 'admin') {
            return (
              <div className="bg-white dark:bg-[#161a1d] rounded-2xl shadow-lg p-8 border border-[#DCC5B2] dark:border-[#161a1d] text-center">
                <h2 className="text-xl font-bold text-[#2C1810] dark:text-white mb-2">Access Restricted</h2>
                <p className="text-[#6B5744] dark:text-[#b1a7a6]">Website CMS is only accessible to administrators.</p>
              </div>
            );
          }
          return <WebsiteCMSPage />;
        default:
          return <DashboardOverview />;
      }
    })();

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeMenu}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF7F3] dark:bg-[#0b090a] transition-colors duration-300">
      <Sidebar 
        activeItem={activeMenu} 
        onMenuChange={setActiveMenu}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      {/* Main Content Area */}
      <motion.main 
        animate={{ 
          marginLeft: sidebarCollapsed ? 80 : 280,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="min-h-screen"
      >
        <div className="p-6">
          {renderContent()}
        </div>
      </motion.main>
    </div>
  );
}
