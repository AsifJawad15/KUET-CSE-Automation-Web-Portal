"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    Bell,
    BookOpen,
    Building2,
    Calendar,
    CheckCircle,
    Clock,
    GraduationCap,
    Sparkles,
    TrendingUp,
    Users
} from 'lucide-react';

interface DashboardOverviewProps {
  onMenuChange?: (menuId: string) => void;
}

// Stats data
const stats = [
  { 
    label: 'Total Students', 
    value: '486', 
    change: '+12', 
    changeType: 'increase',
    icon: Users, 
    color: 'from-[#8400ff] to-[#5c00b3]',
    spotlightColor: 'rgba(132, 0, 255, 0.25)'
  },
  { 
    label: 'Faculty Members', 
    value: '24', 
    change: '+2', 
    changeType: 'increase',
    icon: GraduationCap, 
    color: 'from-[#00e5ff] to-[#00b3cc]',
    spotlightColor: 'rgba(0, 229, 255, 0.25)'
  },
  { 
    label: 'Available Rooms', 
    value: '18', 
    change: '-3', 
    changeType: 'decrease',
    icon: Building2, 
    color: 'from-[#8400ff] to-[#5c00b3]',
    spotlightColor: 'rgba(132, 0, 255, 0.25)'
  },
  { 
    label: 'Active Courses', 
    value: '32', 
    change: '0', 
    changeType: 'neutral',
    icon: BookOpen, 
    color: 'from-[#00e5ff] to-[#00b3cc]',
    spotlightColor: 'rgba(0, 229, 255, 0.25)'
  },
];

const recentActivities = [
  { id: 1, text: 'New student registered: Asif Jawad (2107001)', time: '2 mins ago', type: 'success' },
  { id: 2, text: 'Room 301 marked as occupied for CSE 3201', time: '15 mins ago', type: 'info' },
  { id: 3, text: 'Exam schedule updated for 3rd Year', time: '1 hour ago', type: 'warning' },
  { id: 4, text: 'Faculty meeting scheduled for tomorrow', time: '2 hours ago', type: 'info' },
  { id: 5, text: 'Results published for CSE 2101', time: '3 hours ago', type: 'success' },
];

const upcomingEvents = [
  { id: 1, title: 'Faculty Meeting', date: 'Jan 26, 2026', time: '10:00 AM', type: 'meeting' },
  { id: 2, title: 'CT - CSE 3201', date: 'Jan 27, 2026', time: '09:00 AM', type: 'exam' },
  { id: 3, title: 'Lab Viva - CSE 3202', date: 'Jan 28, 2026', time: '02:00 PM', type: 'exam' },
  { id: 4, title: 'Department Seminar', date: 'Jan 30, 2026', time: '11:00 AM', type: 'event' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export default function DashboardOverview({ onMenuChange }: DashboardOverviewProps) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <Bell className="w-4 h-4 text-blue-500" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'exam': return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'meeting': return 'bg-[#8400ff]/10 text-[#8400ff] border border-[#8400ff]/20';
      default: return 'bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/20';
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Welcome Header */}
      <motion.div 
        variants={itemVariants}
        className="bg-gradient-to-r from-[#8400ff] via-[#5c00b3] to-[#8400ff] rounded-2xl p-6 text-white relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-[#00e5ff]" />
            <h1 className="text-2xl font-bold">
              Welcome back, {user?.name?.split(' ')[0] || 'User'}!
            </h1>
          </div>
          <p className="text-white/70 text-sm">
            Here&apos;s what&apos;s happening in the CSE Department today.
          </p>
        </div>
        
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
          <Clock className="w-4 h-4 text-[#00e5ff]" />
          <span className="text-sm font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div 
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <SpotlightCard spotlightColor={stat.spotlightColor as `rgba(${number}, ${number}, ${number}, ${number})`} className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium ${
                    stat.changeType === 'increase' ? 'text-emerald-500' : 
                    stat.changeType === 'decrease' ? 'text-red-500' : 'text-slate-400 dark:text-white/50'
                  }`}>
                    {stat.changeType !== 'neutral' && (
                      <TrendingUp className={`w-3 h-3 ${stat.changeType === 'decrease' ? 'rotate-180' : ''}`} />
                    )}
                    {stat.change}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-slate-800 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-slate-500 dark:text-white/60 mt-1">{stat.label}</p>
                </div>
              </SpotlightCard>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Activity & Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <motion.div variants={itemVariants}>
          <SpotlightCard spotlightColor="rgba(132, 0, 255, 0.2)" className="p-0 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-white/10">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#8400ff]" />
                Recent Activity
              </h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {recentActivities.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 dark:text-white/80">{activity.text}</p>
                      <p className="text-xs text-slate-400 dark:text-white/40 mt-1">{activity.time}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-white/10">
              <button className="text-sm text-[#8400ff] font-medium hover:text-[#b366ff] transition-colors">
                View all activity →
              </button>
            </div>
          </SpotlightCard>
        </motion.div>

        {/* Upcoming Events */}
        <motion.div variants={itemVariants}>
          <SpotlightCard spotlightColor="rgba(0, 229, 255, 0.2)" className="p-0 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-white/10">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#00e5ff]" />
                Upcoming Events
              </h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {upcomingEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-white">{event.title}</p>
                      <p className="text-xs text-slate-500 dark:text-white/50 mt-1">
                        {event.date} • {event.time}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEventColor(event.type)}`}>
                      {event.type}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-white/10">
              <button className="text-sm text-[#00e5ff] font-medium hover:text-[#66efff] transition-colors">
                View calendar →
              </button>
            </div>
          </SpotlightCard>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <SpotlightCard className="rounded-2xl p-5" spotlightColor="rgba(132, 0, 255, 0.15)">
        <motion.div variants={itemVariants}>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Add Student', icon: Users, color: 'from-[#8400ff]/80 to-[#a855f7]/80', menuId: 'add-student' },
              { label: 'Schedule', icon: Calendar, color: 'from-[#00e5ff]/80 to-[#06b6d4]/80', menuId: 'schedule' },
              { label: 'Room Allocation', icon: Building2, color: 'from-[#8400ff]/80 to-[#00e5ff]/80', menuId: 'room-allocation' },
              { label: 'Courses', icon: BookOpen, color: 'from-[#a855f7]/80 to-[#8400ff]/80', menuId: 'course-allocation' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.label}
                  onClick={() => onMenuChange?.(action.menuId)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-colors group"
                >
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${action.color} shadow-lg group-hover:shadow-xl group-hover:shadow-[#8400ff]/20 transition-shadow`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-white/80">{action.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </SpotlightCard>
    </motion.div>
  );
}
