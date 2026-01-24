"use client";

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { TVDisplayPage } from '@/modules/TVDisplay';
import { FacultyInfoPage } from '@/modules/FacultyInfo';
import { RoomAllocationPage } from '@/modules/RoomAllocation';
import { CourseAllocationPage } from '@/modules/CourseAllocation';
import { SchedulePage } from '@/modules/Schedule';
import { AddStudentPage } from '@/modules/AddStudent';
import { AddFacultyPage } from '@/modules/AddFaculty';
import { ResultPage } from '@/modules/Result';

export default function Dashboard() {
  const [activeMenu, setActiveMenu] = useState('tv-display');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderContent = () => {
    switch (activeMenu) {
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
        return <AddStudentPage />;
      case 'add-faculty':
        return <AddFacultyPage />;
      case 'result':
        return <ResultPage />;
      default:
        return (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-800">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
              Welcome to KUET CSE Automation
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Select an option from the sidebar to get started.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      <Sidebar 
        activeItem={activeMenu} 
        onMenuChange={setActiveMenu}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      {/* Main Content Area */}
      <main className={`min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
