"use client";

import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  ClipboardCheck,
  Megaphone,
  DoorOpen,
  CalendarDays,
  Users,
  UserCog,
  KeyRound,
  MapPin,
} from 'lucide-react';
import { useState } from 'react';
import UploadCSVTab from './tabs/UploadCSVTab';
import TakeAttendanceTab from './tabs/TakeAttendanceTab';
import AnnouncementTab from './tabs/AnnouncementTab';
import RoomRequestTab from './tabs/RoomRequestTab';
import MyScheduleTab from './tabs/MyScheduleTab';
import CourseStudentsTab from './tabs/CourseStudentsTab';
import EditProfileTab from './tabs/EditProfileTab';
import ChangePasswordTab from './tabs/ChangePasswordTab';
import GeoAttendanceTab from './tabs/GeoAttendanceTab';

// ── Tab Registry ───────────────────────────────────────

interface TabEntry {
  id: string;
  label: string;
  icon: React.ElementType;
  render: () => React.ReactNode;
}

export default function TeacherPortalPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('upload-csv');

  const tabs: TabEntry[] = [
    { id: 'upload-csv',       label: 'Upload CSV',       icon: Upload,         render: () => <UploadCSVTab /> },
    { id: 'take-attendance',  label: 'Take Attendance',  icon: ClipboardCheck, render: () => <TakeAttendanceTab /> },
    { id: 'geo-attendance',    label: 'Geo-Attendance',   icon: MapPin,         render: () => <GeoAttendanceTab /> },
    { id: 'announcements',    label: 'Announcements',    icon: Megaphone,      render: () => <AnnouncementTab /> },
    { id: 'room-request',     label: 'Room Request',     icon: DoorOpen,       render: () => <RoomRequestTab /> },
    { id: 'my-schedule',      label: 'My Schedule',      icon: CalendarDays,   render: () => <MyScheduleTab /> },
    { id: 'course-students',  label: 'Course Students',  icon: Users,          render: () => <CourseStudentsTab /> },
    { id: 'edit-profile',     label: 'Edit Profile',     icon: UserCog,        render: () => <EditProfileTab /> },
    { id: 'change-password',  label: 'Change Password',  icon: KeyRound,       render: () => <ChangePasswordTab /> },
  ];

  const currentTab = tabs.find(t => t.id === activeTab) ?? tabs[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#2C1810] dark:text-white">
          Teacher Portal
        </h1>
        <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6] mt-1">
          Welcome, {user?.name || 'Teacher'}. Manage your courses, attendance, and more.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-1.5 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#5D4037] dark:bg-[#ba181b] text-white shadow-sm'
                    : 'text-[#6B5744] dark:text-[#b1a7a6] hover:bg-[#F5EDE4] dark:hover:bg-[#0b090a]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {currentTab.render()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
