"use client";

import { useAuth } from '@/contexts/AuthContext';
import { TermUpgradeRequestWithStudent } from '@/lib/supabase';
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

export default function DashboardOverview({ onMenuChange }: DashboardOverviewProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    try {
      const fetchList = async (path: string): Promise<any[]> => {
        const response = await fetch(path, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to load ${path} (${response.status})`);
        }
        if (Array.isArray(payload)) return payload;
        if (payload?.success && Array.isArray(payload.data)) return payload.data;
        throw new Error(`Unexpected response from ${path}`);
      };

      const [studentsRes, teachersRes, roomsRes, coursesRes, upgradesRes] = await Promise.all([
        fetchList('/api/students'),
        fetchList('/api/teachers'),
        fetchList('/api/rooms'),
        fetchList('/api/courses'),
        fetchList('/api/term-upgrades'),
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
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: Users, bg: 'bg-blue-600', menuId: 'add-student' },
    { label: 'Faculty Members', value: stats.totalFaculty, icon: GraduationCap, bg: 'bg-indigo-600', menuId: 'faculty-info' },
    { label: 'Available Rooms', value: stats.totalRooms, icon: Building2, bg: 'bg-teal-600', menuId: 'room-info' },
    { label: 'Active Courses', value: stats.activeCourses, icon: BookOpen, bg: 'bg-violet-600', menuId: 'course-info' },
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
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          Could not load department data: {error}. Refresh the page or sign in again.
        </div>
      )}
      {/* Welcome Header */}
      <div className="bg-slate-800 rounded-lg p-5 text-white relative">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              Welcome back, {user?.name?.split(' ')[0] || 'User'}!
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Here&apos;s what&apos;s happening in the CSE Department today.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-700 rounded-md px-3 py-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-300">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              onClick={() => onMenuChange?.(stat.menuId)}
              className="bg-white border border-gray-200 rounded-lg p-4 text-left"
            >
              <div className={`inline-flex p-2.5 rounded-lg ${stat.bg}`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className="mt-3">
                {loading ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{error ? '—' : stat.value}</p>
                )}
                <p className="text-xs text-gray-500 font-medium mt-0.5">{stat.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Pending Upgrades + Department Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Term Upgrade Requests */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              Term Upgrade Requests
            </h2>
            {!loading && stats.pendingUpgrades > 0 && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                {stats.pendingUpgrades} pending
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
            </div>
          ) : stats.recentUpgrades.length === 0 ? (
            <div className="p-6 text-center">
              <TrendingUp className="w-6 h-6 mx-auto text-gray-400 mb-2" />
              <p className="text-xs text-gray-500">No upgrade requests yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {stats.recentUpgrades.map((req) => (
                <div key={req.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="mt-0.5">{getUpgradeStatusIcon(req.status)}</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {req.students?.full_name || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-gray-500">{req.students?.roll_no}</span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500">Term {req.current_term}</span>
                          <ArrowUpCircle className="w-3 h-3 text-gray-600" />
                          <span className="text-xs font-semibold text-emerald-700">Term {req.requested_term}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs font-medium capitalize ${getUpgradeStatusColor(req.status)}`}>
                      {req.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => onMenuChange?.('term-upgrade')}
              className="text-xs text-gray-600 font-semibold"
            >
              Manage upgrades →
            </button>
          </div>
        </div>

        {/* Department Overview */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-600" />
              Department Overview
            </h2>
          </div>

          {loading ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {[
                { label: 'Total Students Enrolled', value: stats.totalStudents, icon: Users, color: 'text-blue-600' },
                { label: 'Faculty Members', value: stats.totalFaculty, icon: GraduationCap, color: 'text-indigo-600' },
                { label: 'Classrooms & Labs', value: stats.totalRooms, icon: Building2, color: 'text-teal-600' },
                { label: 'Courses in Curriculum', value: stats.activeCourses, icon: BookOpen, color: 'text-violet-600' },
                { label: 'Pending Upgrades', value: stats.pendingUpgrades, icon: TrendingUp, color: 'text-emerald-600' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${item.color}`} />
                        <span className="text-sm text-gray-900">{item.label}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{error ? '—' : item.value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Add Student', icon: Users, bg: 'bg-blue-600', menuId: 'add-student' },
            { label: 'Schedule', icon: Calendar, bg: 'bg-indigo-600', menuId: 'schedule' },
            { label: 'Room Info', icon: Building2, bg: 'bg-teal-600', menuId: 'room-info' },
            { label: 'Courses', icon: BookOpen, bg: 'bg-violet-600', menuId: 'course-allocation' },
            { label: 'Term Upgrade', icon: TrendingUp, bg: 'bg-emerald-600', menuId: 'term-upgrade' },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => onMenuChange?.(action.menuId)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200"
              >
                <div className={`p-2.5 rounded-lg ${action.bg}`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-semibold text-gray-900">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
