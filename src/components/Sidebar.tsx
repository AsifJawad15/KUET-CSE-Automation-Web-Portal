"use client";

import { useAuth } from '@/contexts/AuthContext';
import {
    BookOpen,
    Building2,
    Calendar,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Clock,
    Crown,
    DoorOpen,
    FileText,
    Globe,
    GraduationCap,
    KeyRound,
    LayoutDashboard,
    LogOut,
    Megaphone,
    Monitor,
    Settings,
    ShieldCheck,
    Sparkles,
    TrendingUp,
    Upload,
    UserCog,
    UserPlus,
    Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface SidebarProps {
  activeItem: string;
  onMenuChange: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ activeItem, onMenuChange, isCollapsed, onToggleCollapse }: SidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const isAdminLike = user?.role === 'admin' || user?.role === 'head';

  const adminMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tv-display', label: 'TV Display', icon: Monitor },
    { id: 'faculty-info', label: 'Faculty Info', icon: Users },
    { id: 'room-info', label: 'Room Info', icon: Building2 },
    { id: 'course-info', label: 'Course Info', icon: GraduationCap },
    { id: 'course-allocation', label: 'Course Allocation', icon: BookOpen },
    { id: 'class-routine', label: 'Class Routine', icon: Clock },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'add-faculty', label: 'Add Faculty', icon: UserCog },
    { id: 'add-student', label: 'Add Student', icon: UserPlus },
    { id: 'staff-management', label: 'Staff Admins', icon: ShieldCheck },
    { id: 'cr-management', label: 'CR Management', icon: Crown },
    { id: 'optional-courses', label: 'Optional Courses', icon: Sparkles },
    { id: 'term-upgrade', label: 'Term Upgrade', icon: TrendingUp },
    { id: 'result', label: 'Result', icon: FileText },
    { id: 'website-cms', label: 'Website CMS', icon: Globe },
  ];

  const teacherMenuItems: MenuItem[] = [
    { id: 'tp-upload-csv', label: 'Upload CSV', icon: Upload },
    { id: 'tp-take-attendance', label: 'Take Attendance', icon: ClipboardCheck },
    { id: 'tp-announcements', label: 'Announcements', icon: Megaphone },
    { id: 'tp-room-request', label: 'Room Request', icon: DoorOpen },
    { id: 'tp-my-schedule', label: 'My Schedule', icon: CalendarDays },
    { id: 'tp-course-students', label: 'Course Students', icon: Users },
    { id: 'tp-edit-profile', label: 'Edit Profile', icon: UserCog },
    { id: 'tp-change-password', label: 'Change Password', icon: KeyRound },
  ];

  const isTeacher = user?.role === 'teacher';
  const filteredMenuItems = isTeacher && !isAdminLike ? teacherMenuItems : adminMenuItems;

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <aside 
      style={{ width: isCollapsed ? 80 : 260 }}
      className="bg-[#2C1503] h-screen fixed left-0 top-0 flex flex-col z-40 transition-[width] duration-200"
    >
      {/* Header */}
      <div className={`p-4 border-b border-[#3B1F12] ${isCollapsed ? 'px-3' : ''}`}>
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#5D4037] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#E8D5C4]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#F5E6D3]">KUET CSE</h2>
                <p className="text-[11px] text-[#A89279]">Automation Portal</p>
              </div>
            </div>
          )}
          
          <button
            onClick={onToggleCollapse}
            className={`p-1.5 rounded-md bg-[#3B1F12] text-[#A89279] transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* User Info */}
      <div className={`p-4 border-b border-[#3B1F12] ${isCollapsed ? 'px-3' : ''}`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-[#5D4037] flex items-center justify-center text-[#E8D5C4] font-semibold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#2C1503] ${user?.role === 'admin' ? 'bg-emerald-400' : 'bg-[#A89279]'}`} />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#F5E6D3] truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-[#A89279] capitalize">
                {user?.role || 'Guest'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#5D4037] [&::-webkit-scrollbar-thumb]:rounded-full">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          
          return (
            <button 
              key={item.id} 
              onClick={() => onMenuChange(item.id)}
              className="w-full"
            >
              <div
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors duration-100 relative ${
                  isActive
                    ? 'bg-[#5D4037] text-[#F5E6D3] font-semibold'
                    : 'text-[#A89279]'
                } ${isCollapsed ? 'justify-center px-2' : ''}`}
              >
                <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-[#F5E6D3]' : 'text-[#A89279]'}`} />
                
                {!isCollapsed && (
                  <span className="text-[13px] whitespace-nowrap overflow-hidden">
                    {item.label}
                  </span>
                )}

                {isActive && !isCollapsed && (
                  <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-gray-100" />
                )}

                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[#2C1503] border border-[#5D4037] text-[#F5E6D3] text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className={`p-2 border-t border-[#3B1F12] space-y-0.5 ${isCollapsed ? 'px-2' : ''}`}>
        <button
          onClick={() => onMenuChange('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[#A89279] transition-colors ${isCollapsed ? 'justify-center px-2' : ''}`}
          title={isCollapsed ? 'Settings' : ''}
        >
          <Settings className="w-[18px] h-[18px]" />
          {!isCollapsed && <span className="text-[13px]">Settings</span>}
        </button>

        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-red-400 transition-colors ${isCollapsed ? 'justify-center px-2' : ''}`}
          title={isCollapsed ? 'Logout' : ''}
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!isCollapsed && <span className="text-[13px]">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
