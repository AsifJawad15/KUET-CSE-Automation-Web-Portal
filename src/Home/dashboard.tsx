// ==========================================
// Dashboard Shell
// Single Responsibility: Orchestrates sidebar + page content
// Open/Closed: New pages are added to the registry — no switch changes
// ==========================================

"use client";

import AccessRestricted from '@/components/AccessRestricted';
import Sidebar from '@/components/Sidebar';
import { useAuth, UserRole } from '@/contexts/AuthContext';
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
import { TeacherPortalPage, UploadCSVTab, TakeAttendanceTab, AnnouncementTab, RoomRequestTab, MyScheduleTab, CourseStudentsTab, EditProfileTab, ChangePasswordTab } from '@/modules/TeacherPortal';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

// ── Page Registry ──────────────────────────────────────
// Open/Closed: Add a new page by adding a single entry here.

interface PageEntry {
  /** React element factory. Receives `onMenuChange` for dashboard. */
  render: (onMenuChange: (id: string) => void) => React.ReactNode;
  /** If set, only users with this role can access the page. */
  requiredRole?: UserRole;
}

const PAGE_REGISTRY: Record<string, PageEntry> = {
  'dashboard':          { render: (onMenuChange) => <DashboardOverview onMenuChange={onMenuChange} /> },
  'tv-display':         { render: () => <TVDisplayPage /> },
  'faculty-info':       { render: () => <FacultyInfoPage /> },
  'room-allocation':    { render: () => <RoomAllocationPage /> },
  'course-info':        { render: () => <CourseInfoPage /> },
  'course-allocation':  { render: () => <CourseAllocationPage /> },
  'class-routine':      { render: () => <ClassRoutinePage /> },
  'schedule':           { render: () => <SchedulePage /> },
  'add-student':        { render: () => <AddStudentPage />,       requiredRole: 'admin' },
  'term-upgrade':       { render: () => <TermUpgradePage /> },
  'result':             { render: () => <ResultPage /> },
  'teacher-portal':     { render: () => <TeacherPortalPage />,    requiredRole: 'teacher' },
  'website-cms':        { render: () => <WebsiteCMSPage />,       requiredRole: 'admin' },
  // Teacher Portal individual tabs (sidebar-driven)
  'tp-upload-csv':      { render: () => <UploadCSVTab />,         requiredRole: 'teacher' },
  'tp-take-attendance': { render: () => <TakeAttendanceTab />,    requiredRole: 'teacher' },
  'tp-announcements':   { render: () => <AnnouncementTab />,      requiredRole: 'teacher' },
  'tp-room-request':    { render: () => <RoomRequestTab />,       requiredRole: 'teacher' },
  'tp-my-schedule':     { render: () => <MyScheduleTab />,        requiredRole: 'teacher' },
  'tp-course-students': { render: () => <CourseStudentsTab />,    requiredRole: 'teacher' },
  'tp-edit-profile':    { render: () => <EditProfileTab />,       requiredRole: 'teacher' },
  'tp-change-password': { render: () => <ChangePasswordTab />,    requiredRole: 'teacher' },
};

// ── Constants ──────────────────────────────────────────

const STORAGE_KEY = 'dashboard_activeMenu';
const DEFAULT_PAGE = 'dashboard';
const TEACHER_DEFAULT_PAGE = 'tp-upload-csv';

const PAGE_VARIANTS = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
} as const;

// ── Component ──────────────────────────────────────────

export default function Dashboard() {
  const [activeMenu, setActiveMenu] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_PAGE;
    }
    return DEFAULT_PAGE;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  // Persist active menu
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeMenu);
  }, [activeMenu]);

  // Redirect teachers to teacher pages if on admin page
  useEffect(() => {
    if (!isLoading && user?.role === 'teacher' && !activeMenu.startsWith('tp-')) {
      setActiveMenu(TEACHER_DEFAULT_PAGE);
    }
  }, [isLoading, user?.role, activeMenu]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      localStorage.removeItem(STORAGE_KEY);
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const toggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), []);

  // Resolve current page from registry
  const pageContent = useMemo(() => {
    const entry = PAGE_REGISTRY[activeMenu] ?? PAGE_REGISTRY[DEFAULT_PAGE];

    // Role guard
    if (entry.requiredRole && user?.role !== entry.requiredRole) {
      return <AccessRestricted />;
    }

    return entry.render(setActiveMenu);
  }, [activeMenu, user?.role]);

  // ── Loading state ──
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

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#FAF7F3] dark:bg-[#0b090a] transition-colors duration-300">
      <Sidebar
        activeItem={activeMenu}
        onMenuChange={setActiveMenu}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      {/* Main Content Area */}
      <motion.main
        animate={{ marginLeft: sidebarCollapsed ? 80 : 280 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="min-h-screen"
      >
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeMenu}
              variants={PAGE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
            >
              {pageContent}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>
    </div>
  );
}
