"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { TermUpgradeRequestWithStudent } from '@/lib/supabase';
import { motion } from 'framer-motion';
import {
    ArrowUpCircle,
    Bell,
    BookOpen,
    Building2,
    Calendar,
    CheckCircle,
    Clock,
    GraduationCap,
    Loader2,
    Sparkles,
    TrendingUp,
    Users
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface DashboardOverviewProps {
  onMenuChange?: (menuId: string) => void;
}

interface DashboardStats {
  totalStudents: number;
  totalFaculty: number;
  totalRooms: number;
  activeCourses: number;
  pendingUpgrades: number;
  recentUpgrades: TermUpgradeRequestWithStudent[];
}

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
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalFaculty: 0,
    totalRooms: 0,
    activeCourses: 0,
    pendingUpgrades: 0,
    recentUpgrades: [],
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsRes, teachersRes, roomsRes, coursesRes, upgradesRes] = await Promise.all([
        fetch('/api/students').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/teachers').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/rooms').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/courses').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/term-upgrades').then(r => r.ok ? r.json() : []).catch(() => []),
      ]);

      const activeRooms = Array.isArray(roomsRes)
        ? roomsRes.filter((r: any) => r.is_active !== false)
        : [];

      const pendingUpgrades = Array.isArray(upgradesRes)
        ? upgradesRes.filter((u: any) => u.status === 'pending')
        : [];

      setStats({
        totalStudents: Array.isArray(studentsRes) ? studentsRes.length : 0,
        totalFaculty: Array.isArray(teachersRes) ? teachersRes.length : 0,
        totalRooms: activeRooms.length,
        activeCourses: Array.isArray(coursesRes) ? coursesRes.length : 0,
        pendingUpgrades: pendingUpgrades.length,
        recentUpgrades: Array.isArray(upgradesRes) ? upgradesRes.slice(0, 5) : [],
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const statCards = [
    {
      label: 'Total Students',
      value: stats.totalStudents,
      icon: Users,
      color: 'from-[#ba181b] to-[#660708]',
      spotlightColor: 'rgba(186, 24, 27, 0.25)',
      menuId: 'add-student',
    },
    {
      label: 'Faculty Members',
      value: stats.totalFaculty,
      icon: GraduationCap,
      color: 'from-[#5D4037] to-[#3E2723]',
      spotlightColor: 'rgba(93, 64, 55, 0.25)',
      menuId: 'faculty-info',
    },
    {
      label: 'Available Rooms',
      value: stats.totalRooms,
      icon: Building2,
      color: 'from-[#D9A299] to-[#c49088]',
      spotlightColor: 'rgba(217, 162, 153, 0.25)',
      menuId: 'room-allocation',
    },
    {
      label: 'Active Courses',
      value: stats.activeCourses,
      icon: BookOpen,
      color: 'from-[#e5383b] to-[#ba181b]',
      spotlightColor: 'rgba(229, 56, 59, 0.25)',
      menuId: 'course-info',
    },
  ];

  const getUpgradeStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-emerald-500';
      case 'rejected': return 'text-red-500';
      default: return 'text-amber-500';
    }
  };

  const getUpgradeStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'rejected': return <Bell className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-amber-500" />;
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
        className="bg-gradient-to-r from-[#D9A299] via-[#DCC5B2] to-[#D9A299] dark:from-[#ba181b] dark:via-[#660708] dark:to-[#ba181b] rounded-2xl p-6 text-white relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-[#5D4E37] dark:text-[#d3d3d3]" />
            <h1 className="text-2xl font-bold">
              Welcome back, {user?.name?.split(' ')[0] || 'User'}!
            </h1>
          </div>
          <p className="text-white/70 text-sm">
            Here&apos;s what&apos;s happening in the CSE Department today.
          </p>
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
          <Clock className="w-4 h-4 text-[#5D4E37] dark:text-[#d3d3d3]" />
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
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              onClick={() => onMenuChange?.(stat.menuId)}
              className="cursor-pointer"
            >
              <SpotlightCard spotlightColor={stat.spotlightColor as `rgba(${number}, ${number}, ${number}, ${number})`} className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="mt-4">
                  {loading ? (
                    <Loader2 className="w-6 h-6 text-[#D9A299] dark:text-[#ba181b] animate-spin" />
                  ) : (
                    <p className="text-3xl font-bold text-[#5D4E37] dark:text-white">{stat.value}</p>
                  )}
                  <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6] mt-1">{stat.label}</p>
                </div>
              </SpotlightCard>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Pending Upgrades Banner + Recent Upgrades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Term Upgrades */}
        <motion.div variants={itemVariants}>
          <SpotlightCard spotlightColor="rgba(245, 158, 11, 0.2)" className="p-0 overflow-hidden">
            <div className="p-5 border-b border-[#DCC5B2] dark:border-[#3d4951]/50 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#5D4E37] dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                Term Upgrade Requests
              </h2>
              {!loading && stats.pendingUpgrades > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                  {stats.pendingUpgrades} pending
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 text-[#D9A299] dark:text-[#ba181b] animate-spin" />
              </div>
            ) : stats.recentUpgrades.length === 0 ? (
              <div className="p-8 text-center">
                <TrendingUp className="w-8 h-8 mx-auto text-[#DCC5B2] dark:text-white/20 mb-2" />
                <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6]/70">No upgrade requests yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#DCC5B2] dark:divide-white/10">
                {stats.recentUpgrades.map((req, index) => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 hover:bg-[#F0E4D3] dark:hover:bg-[#0b090a] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="mt-0.5">{getUpgradeStatusIcon(req.status)}</div>
                        <div>
                          <p className="text-sm font-medium text-[#5D4E37] dark:text-[#f5f3f4]">
                            {req.students?.full_name || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-[#8B7355] dark:text-[#b1a7a6]/70">
                              {req.students?.roll_no}
                            </span>
                            <span className="text-xs text-[#8B7355] dark:text-[#b1a7a6]/70">•</span>
                            <span className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">
                              Term {req.current_term}
                            </span>
                            <ArrowUpCircle className="w-3 h-3 text-[#D9A299] dark:text-[#ba181b]" />
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              Term {req.requested_term}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs font-medium capitalize ${getUpgradeStatusColor(req.status)}`}>
                        {req.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="p-4 border-t border-[#DCC5B2] dark:border-[#3d4951]/50">
              <button
                onClick={() => onMenuChange?.('term-upgrade')}
                className="text-sm text-[#D9A299] font-medium hover:text-[#c49088] transition-colors"
              >
                Manage upgrades →
              </button>
            </div>
          </SpotlightCard>
        </motion.div>

        {/* Department Summary */}
        <motion.div variants={itemVariants}>
          <SpotlightCard spotlightColor="rgba(220, 197, 178, 0.3)" className="p-0 overflow-hidden">
            <div className="p-5 border-b border-[#DCC5B2] dark:border-[#3d4951]/50">
              <h2 className="text-lg font-semibold text-[#5D4E37] dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#DCC5B2]" />
                Department Overview
              </h2>
            </div>

            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 text-[#D9A299] dark:text-[#ba181b] animate-spin" />
              </div>
            ) : (
              <div className="divide-y divide-[#DCC5B2] dark:divide-white/10">
                {[
                  { label: 'Total Students Enrolled', value: stats.totalStudents, icon: Users, color: 'text-[#ba181b]' },
                  { label: 'Faculty Members', value: stats.totalFaculty, icon: GraduationCap, color: 'text-[#5D4037]' },
                  { label: 'Classrooms & Labs', value: stats.totalRooms, icon: Building2, color: 'text-[#D9A299]' },
                  { label: 'Courses in Curriculum', value: stats.activeCourses, icon: BookOpen, color: 'text-[#8B6914]' },
                  { label: 'Pending Upgrades', value: stats.pendingUpgrades, icon: TrendingUp, color: 'text-amber-500' },
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 hover:bg-[#F0E4D3] dark:hover:bg-[#0b090a] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${item.color}`} />
                          <span className="text-sm text-[#5D4E37] dark:text-[#d3d3d3]">{item.label}</span>
                        </div>
                        <span className="text-sm font-bold text-[#5D4E37] dark:text-white">{item.value}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </SpotlightCard>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <SpotlightCard className="rounded-2xl p-5" spotlightColor="rgba(217, 162, 153, 0.2)">
        <motion.div variants={itemVariants}>
          <h2 className="text-lg font-semibold text-[#5D4E37] dark:text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Add Student', icon: Users, color: 'from-[#D9A299] to-[#DCC5B2]', menuId: 'add-student' },
              { label: 'Schedule', icon: Calendar, color: 'from-[#DCC5B2] to-[#F0E4D3]', menuId: 'schedule' },
              { label: 'Room Allocation', icon: Building2, color: 'from-[#D9A299] to-[#F0E4D3]', menuId: 'room-allocation' },
              { label: 'Courses', icon: BookOpen, color: 'from-[#DCC5B2] to-[#D9A299]', menuId: 'course-allocation' },
              { label: 'Term Upgrade', icon: TrendingUp, color: 'from-[#ba181b] to-[#660708]', menuId: 'term-upgrade' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.label}
                  onClick={() => onMenuChange?.(action.menuId)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#F0E4D3] dark:bg-[#0b090a] hover:bg-[#DCC5B2] dark:hover:bg-[#3d4951]/30 border border-[#DCC5B2] dark:border-[#3d4951]/50 transition-colors group"
                >
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${action.color} shadow-lg group-hover:shadow-xl group-hover:shadow-[#D9A299]/30 transition-shadow`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-[#5D4E37] dark:text-[#f5f3f4]">{action.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </SpotlightCard>
    </motion.div>
  );
}
