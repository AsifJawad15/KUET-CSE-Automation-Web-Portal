"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { sampleAnnouncements } from '@/data/sampleData';
import { Announcement } from '@/types';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function TVDisplayPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(sampleAnnouncements);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'notice' as Announcement['type'],
    courseCode: '',
    priority: 'medium' as Announcement['priority'],
    scheduledDate: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      setAnnouncements(prev => prev.map(a => 
        a.id === editingId ? { ...a, ...formData, isActive: true } : a
      ));
    } else {
      const newAnnouncement: Announcement = {
        id: `A${Date.now()}`,
        ...formData,
        createdBy: 'Admin',
        createdAt: new Date().toISOString().split('T')[0],
        isActive: true,
      };
      setAnnouncements(prev => [newAnnouncement, ...prev]);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({ title: '', content: '', type: 'notice', courseCode: '', priority: 'medium', scheduledDate: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (announcement: Announcement) => {
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      courseCode: announcement.courseCode || '',
      priority: announcement.priority,
      scheduledDate: announcement.scheduledDate || '',
    });
    setEditingId(announcement.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    }
  };

  const toggleActive = (id: string) => {
    setAnnouncements(prev => prev.map(a => 
      a.id === id ? { ...a, isActive: !a.isActive } : a
    ));
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      high: 'bg-red-500/20 text-red-400 border border-red-500/30',
      medium: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      low: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    };
    return styles[priority as keyof typeof styles] || 'bg-gray-500/20 text-gray-400';
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      'class-test': 'bg-[#8400ff]/20 text-[#a855f7] border border-[#8400ff]/30',
      'assignment': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      'notice': 'bg-white/10 text-white/70 border border-white/20',
      'event': 'bg-pink-500/20 text-pink-400 border border-pink-500/30',
      'lab-test': 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30',
      'quiz': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    };
    return styles[type] || 'bg-white/10 text-white/70 border border-white/20';
  };

  const formatType = (type: string) => {
    return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="h-full">
      {/* Page Header */}
      <SpotlightCard className="rounded-2xl border border-[#392e4e] p-6 mb-6" spotlightColor="rgba(132, 0, 255, 0.15)">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">TV Display Management</h1>
            <p className="text-sm text-white/60 mt-1">
              Manage announcements displayed on department TV screens
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8400ff] to-[#a855f7] hover:from-[#9933ff] hover:to-[#b366ff] text-white font-medium rounded-lg transition-all shadow-lg shadow-[#8400ff]/25"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Announcement
          </motion.button>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#392e4e]">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{announcements.length}</p>
            <p className="text-xs text-white/50">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[#00e5ff]">{announcements.filter(a => a.isActive).length}</p>
            <p className="text-xs text-white/50">Active</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">{announcements.filter(a => a.priority === 'high').length}</p>
            <p className="text-xs text-white/50">High Priority</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[#8400ff]">{announcements.filter(a => a.scheduledDate).length}</p>
            <p className="text-xs text-white/50">Scheduled</p>
          </div>
        </div>
      </SpotlightCard>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0d0d1a] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#392e4e]"
          >
            <div className="p-6 border-b border-[#392e4e]">
              <h2 className="text-xl font-bold text-white">
                {editingId ? 'Edit Announcement' : 'Create New Announcement'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter announcement title"
                  className="w-full px-4 py-3 border border-[#392e4e] rounded-lg bg-white/5 text-white placeholder-white/40 focus:ring-2 focus:ring-[#8400ff] focus:border-transparent transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Content *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter announcement details"
                  rows={4}
                  className="w-full px-4 py-3 border border-[#392e4e] rounded-lg bg-white/5 text-white placeholder-white/40 focus:ring-2 focus:ring-[#8400ff] focus:border-transparent transition-all resize-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Announcement['type'] })}
                    className="w-full px-4 py-3 border border-[#392e4e] rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-[#8400ff] focus:border-transparent transition-all"
                  >
                    <option value="notice" className="bg-[#0d0d1a]">Notice</option>
                    <option value="class-test" className="bg-[#0d0d1a]">Class Test</option>
                    <option value="assignment" className="bg-[#0d0d1a]">Assignment</option>
                    <option value="lab-test" className="bg-[#0d0d1a]">Lab Test</option>
                    <option value="quiz" className="bg-[#0d0d1a]">Quiz</option>
                    <option value="event" className="bg-[#0d0d1a]">Event</option>
                    <option value="other" className="bg-[#0d0d1a]">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as Announcement['priority'] })}
                    className="w-full px-4 py-3 border border-[#392e4e] rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-[#8400ff] focus:border-transparent transition-all"
                  >
                    <option value="low" className="bg-[#0d0d1a]">Low</option>
                    <option value="medium" className="bg-[#0d0d1a]">Medium</option>
                    <option value="high" className="bg-[#0d0d1a]">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Course Code</label>
                  <input
                    type="text"
                    value={formData.courseCode}
                    onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
                    placeholder="e.g., CSE 3201"
                    className="w-full px-4 py-3 border border-[#392e4e] rounded-lg bg-white/5 text-white placeholder-white/40 focus:ring-2 focus:ring-[#8400ff] focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Scheduled Date</label>
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    className="w-full px-4 py-3 border border-[#392e4e] rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-[#8400ff] focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-[#392e4e]">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-3 border border-[#392e4e] rounded-lg text-white/70 hover:bg-white/5 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[#8400ff] to-[#a855f7] text-white rounded-lg hover:from-[#9933ff] hover:to-[#b366ff] font-medium transition-all"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <SpotlightCard className="rounded-2xl border border-[#392e4e] p-12 text-center" spotlightColor="rgba(132, 0, 255, 0.1)">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No Announcements</h3>
            <p className="text-white/50">Create your first announcement to display on department TVs</p>
          </SpotlightCard>
        ) : (
          announcements.map((announcement) => (
            <motion.div
              key={announcement.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-[#0d0d1a] rounded-xl border border-[#392e4e] overflow-hidden transition-all hover:border-[#8400ff]/30 ${
                !announcement.isActive && 'opacity-60'
              }`}
            >
              <div className="flex">
                {/* Left Priority Strip */}
                <div className={`w-1.5 flex-shrink-0 ${
                  announcement.isActive 
                    ? announcement.priority === 'high' 
                      ? 'bg-red-500' 
                      : announcement.priority === 'medium'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                    : 'bg-white/20'
                }`} />
                
                {/* Priority Info Section */}
                <div className={`w-24 flex-shrink-0 flex flex-col items-center justify-center gap-2 border-r border-[#392e4e] ${
                  announcement.isActive 
                    ? announcement.priority === 'high' 
                      ? 'bg-red-500/10' 
                      : announcement.priority === 'medium'
                      ? 'bg-amber-500/10'
                      : 'bg-emerald-500/10'
                    : 'bg-white/5'
                }`}>
                  <div className={`p-2.5 rounded-lg ${
                    announcement.isActive 
                      ? announcement.priority === 'high' 
                        ? 'bg-red-500/20' 
                        : announcement.priority === 'medium'
                        ? 'bg-amber-500/20'
                        : 'bg-emerald-500/20'
                      : 'bg-white/10'
                  }`}>
                    {announcement.priority === 'high' && (
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    {announcement.priority === 'medium' && (
                      <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {announcement.priority === 'low' && (
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-wide ${
                    announcement.isActive 
                      ? announcement.priority === 'high' 
                        ? 'text-red-400' 
                        : announcement.priority === 'medium'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                      : 'text-white/40'
                  }`}>
                    {announcement.priority}
                  </span>
                </div>
                
                {/* Main Content Area */}
                <div className="flex-1 p-5">
                  {/* Top Row: Title & Actions */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white">
                          {announcement.title}
                        </h3>
                        {!announcement.isActive && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/50">
                            INACTIVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center flex-wrap gap-2">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${getTypeBadge(announcement.type)}`}>
                          {formatType(announcement.type)}
                        </span>
                        {announcement.courseCode && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#8400ff]/20 text-[#a855f7] border border-[#8400ff]/30">
                            {announcement.courseCode}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleActive(announcement.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          announcement.isActive 
                            ? 'text-emerald-400 hover:bg-emerald-500/10' 
                            : 'text-white/40 hover:bg-white/5'
                        }`}
                        title={announcement.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {announcement.isActive ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(announcement)}
                        className="p-2 rounded-lg text-[#00e5ff] hover:bg-[#00e5ff]/10 transition-colors"
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(announcement.id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <p className="text-white/60 text-sm mb-4 line-clamp-2">
                    {announcement.content}
                  </p>
                  
                  {/* Footer: Dates */}
                  <div className="flex items-center gap-6 text-xs text-white/40">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Created: {announcement.createdAt}
                    </span>
                    {announcement.scheduledDate && (
                      <span className="flex items-center gap-1.5 text-[#00e5ff] font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Scheduled: {announcement.scheduledDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
