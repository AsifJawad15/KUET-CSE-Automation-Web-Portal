"use client";

import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { AddFacultyPage } from '@/modules/AddFaculty';
import { AddStudentPage } from '@/modules/AddStudent';
import { CourseAllocationPage } from '@/modules/CourseAllocation';
import { DashboardOverview } from '@/modules/Dashboard';
import { FacultyInfoPage } from '@/modules/FacultyInfo';
import { ResultPage } from '@/modules/Result';
import { RoomAllocationPage } from '@/modules/RoomAllocation';
import { SchedulePage } from '@/modules/Schedule';
import { TVDisplayPage } from '@/modules/TVDisplay';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#060010] flex items-center justify-center transition-colors">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-10 h-10 text-[#8400ff] animate-spin" />
          <p className="text-slate-600 dark:text-white/60 font-medium">Loading dashboard...</p>
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
        case 'course-allocation':
          return <CourseAllocationPage />;
        case 'schedule':
          return <SchedulePage />;
        case 'add-student':
          // Only admin can access
          if (user?.role !== 'admin') {
            return (
              <div className="bg-[#0d0d1a] rounded-2xl shadow-lg p-8 border border-[#392e4e] text-center">
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
        case 'add-faculty':
          if (user?.role !== 'admin') {
            return (
              <div className="bg-[#0d0d1a] rounded-2xl shadow-lg p-8 border border-[#392e4e] text-center">
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
          return <AddFacultyPage />;
        case 'result':
          return <ResultPage />;
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#060010] transition-colors duration-300">
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
