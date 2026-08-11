"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { motion } from 'framer-motion';
import { Settings, User, Shield, Bell, Palette, Globe, ChevronRight } from 'lucide-react';

interface SettingsPageProps {
  onMenuChange: (id: string) => void;
}

export default function SettingsPage({ onMenuChange }: SettingsPageProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const settingsSections = [
    {
      title: 'Account',
      description: 'Manage your profile and account settings',
      icon: User,
      color: 'bg-blue-600',
      items: [
        { label: 'Profile Information', detail: user?.name || 'User' },
        { label: 'Email', detail: user?.email || 'Not set' },
        { label: 'Role', detail: user?.role || 'Guest' },
      ],
    },
    {
      title: 'Security',
      description: 'Password and authentication settings',
      icon: Shield,
      color: 'bg-indigo-600',
      items: [
        { label: 'Change Password', detail: 'Update your password' },
        { label: 'Login Sessions', detail: 'Manage active sessions' },
      ],
    },
    {
      title: 'Notifications',
      description: 'Configure notification preferences',
      icon: Bell,
      color: 'bg-teal-600',
      items: [
        { label: 'Email Notifications', detail: 'Enabled' },
        { label: 'Push Notifications', detail: 'Disabled' },
      ],
    },
    {
      title: 'Appearance',
      description: 'Customize the look and feel',
      icon: Palette,
      color: 'bg-violet-600',
      items: [
        { label: 'Theme', detail: theme === 'dark' ? 'Dark' : 'Light', onClick: toggleTheme },
        { label: 'Sidebar', detail: 'Expanded' },
      ],
    },
    {
      title: 'System',
      description: 'General system information',
      icon: Globe,
      color: 'bg-emerald-600',
      items: [
        { label: 'Version', detail: 'v1.0.0' },
        { label: 'Department', detail: 'CSE, KUET' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-zinc-100">Settings</h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-1">Manage your account and system preferences</p>
        </div>
        <button
          onClick={() => onMenuChange('dashboard')}
          className="px-4 py-2 text-sm text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Back to Dashboard
        </button>
      </motion.div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {settingsSections.map((section, i) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg ${section.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-zinc-100">{section.title}</h2>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">{section.description}</p>
                </div>
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <div
                    key={item.label}
                    onClick={item.onClick}
                    className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400 dark:text-zinc-500">{item.detail}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-zinc-600" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
