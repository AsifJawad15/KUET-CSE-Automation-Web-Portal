"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import {
    createAnnouncement,
    createEvent,
    createTicker,
    deleteAnnouncement,
    deleteEvent,
    deleteTicker,
    fetchAllAnnouncements,
    fetchAllEvents,
    fetchAllTicker,
    fetchTvSettings,
    toggleAnnouncement,
    toggleEvent,
    toggleTicker,
    updateAnnouncement,
    updateEvent,
    updateSetting,
    updateTicker,
} from '@/services/tvDisplayService';
import type { CmsTvAnnouncement, CmsTvEvent, CmsTvTicker, TvAnnouncementPriority, TvAnnouncementType } from '@/types/cms';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Bell, Calendar, ExternalLink, Monitor, Settings, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type AdminTab = 'announcements' | 'ticker' | 'events' | 'settings';

export default function TVDisplayPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('announcements');
  const [announcements, setAnnouncements] = useState<CmsTvAnnouncement[]>([]);
  const [tickerItems, setTickerItems] = useState<CmsTvTicker[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Announcement form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'notice' as TvAnnouncementType,
    course_code: '',
    priority: 'medium' as TvAnnouncementPriority,
    scheduled_date: '',
  });

  // Ticker form
  const [showTickerForm, setShowTickerForm] = useState(false);
  const [editingTickerId, setEditingTickerId] = useState<string | null>(null);
  const [tickerFormData, setTickerFormData] = useState({
    label: 'SPECIAL UPDATE',
    text: '',
    type: 'notice' as TvAnnouncementType,
    course_code: '',
    sort_order: 0,
  });

  // Events
  const [eventItems, setEventItems] = useState<CmsTvEvent[]>([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventFormData, setEventFormData] = useState({
    title: '',
    subtitle: '',
    description: '',
    image_url: '',
    speaker_name: '',
    speaker_image_url: '',
    event_date: '',
    event_time: '',
    location: '',
    badge_text: '',
    display_order: 0,
  });

  // ── Fetch all data ──
  const loadData = useCallback(async () => {
    try {
      const [annData, tickData, settData, evtData] = await Promise.all([
        fetchAllAnnouncements(),
        fetchAllTicker(),
        fetchTvSettings(),
        fetchAllEvents(),
      ]);
      setAnnouncements(annData);
      setTickerItems(tickData);
      setSettings(settData);
      setEventItems(evtData);
    } catch (err) {
      console.error('Failed to load TV display data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Announcement CRUD ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await updateAnnouncement(editingId, {
          title: formData.title,
          content: formData.content,
          type: formData.type,
          course_code: formData.course_code || null,
          priority: formData.priority,
          scheduled_date: formData.scheduled_date || null,
        });
      } else {
        await createAnnouncement({
          title: formData.title,
          content: formData.content,
          type: formData.type,
          course_code: formData.course_code || null,
          priority: formData.priority,
          scheduled_date: formData.scheduled_date || null,
          is_active: true,
          created_by: 'Admin',
        });
      }
      resetForm();
      await loadData();
    } catch (err) {
      console.error('Failed to save announcement:', err);
      alert('Failed to save announcement. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', content: '', type: 'notice', course_code: '', priority: 'medium', scheduled_date: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (a: CmsTvAnnouncement) => {
    setFormData({
      title: a.title,
      content: a.content,
      type: a.type as TvAnnouncementType,
      course_code: a.course_code || '',
      priority: a.priority as TvAnnouncementPriority,
      scheduled_date: a.scheduled_date || '',
    });
    setEditingId(a.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      await deleteAnnouncement(id);
      await loadData();
    }
  };

  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    await toggleAnnouncement(id, !currentlyActive);
    await loadData();
  };

  // ── Ticker CRUD ──
  const handleTickerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingTickerId) {
        await updateTicker(editingTickerId, {
          label: tickerFormData.label,
          text: tickerFormData.text,
          type: tickerFormData.type,
          course_code: tickerFormData.course_code || null,
          sort_order: tickerFormData.sort_order,
        });
      } else {
        await createTicker({
          label: tickerFormData.label,
          text: tickerFormData.text,
          type: tickerFormData.type,
          course_code: tickerFormData.course_code || null,
          announcement_id: null,
          sort_order: tickerFormData.sort_order,
          is_active: true,
        });
      }
      resetTickerForm();
      await loadData();
    } catch (err) {
      console.error('Failed to save ticker item:', err);
      alert('Failed to save ticker item.');
    } finally {
      setSaving(false);
    }
  };

  const resetTickerForm = () => {
    setTickerFormData({ label: 'SPECIAL UPDATE', text: '', type: 'notice', course_code: '', sort_order: 0 });
    setShowTickerForm(false);
    setEditingTickerId(null);
  };

  const handleEditTicker = (t: CmsTvTicker) => {
    setTickerFormData({
      label: t.label,
      text: t.text,
      type: t.type as TvAnnouncementType,
      course_code: t.course_code || '',
      sort_order: t.sort_order,
    });
    setEditingTickerId(t.id);
    setShowTickerForm(true);
  };

  const handleDeleteTicker = async (id: string) => {
    if (confirm('Delete this ticker item?')) {
      await deleteTicker(id);
      await loadData();
    }
  };

  const handleToggleTicker = async (id: string, currentlyActive: boolean) => {
    await toggleTicker(id, !currentlyActive);
    await loadData();
  };

  // ── Event CRUD ──
  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingEventId) {
        await updateEvent(editingEventId, {
          title: eventFormData.title,
          subtitle: eventFormData.subtitle || null,
          description: eventFormData.description || null,
          image_url: eventFormData.image_url || null,
          speaker_name: eventFormData.speaker_name || null,
          speaker_image_url: eventFormData.speaker_image_url || null,
          event_date: eventFormData.event_date || null,
          event_time: eventFormData.event_time || null,
          location: eventFormData.location || null,
          badge_text: eventFormData.badge_text || null,
          display_order: eventFormData.display_order,
        });
      } else {
        await createEvent({
          title: eventFormData.title,
          subtitle: eventFormData.subtitle || null,
          description: eventFormData.description || null,
          image_url: eventFormData.image_url || null,
          speaker_name: eventFormData.speaker_name || null,
          speaker_image_url: eventFormData.speaker_image_url || null,
          event_date: eventFormData.event_date || null,
          event_time: eventFormData.event_time || null,
          location: eventFormData.location || null,
          badge_text: eventFormData.badge_text || null,
          display_order: eventFormData.display_order,
          is_active: true,
        });
      }
      resetEventForm();
      await loadData();
    } catch (err) {
      console.error('Failed to save event:', err);
      alert('Failed to save event.');
    } finally {
      setSaving(false);
    }
  };

  const resetEventForm = () => {
    setEventFormData({ title: '', subtitle: '', description: '', image_url: '', speaker_name: '', speaker_image_url: '', event_date: '', event_time: '', location: '', badge_text: '', display_order: 0 });
    setShowEventForm(false);
    setEditingEventId(null);
  };

  const handleEditEvent = (ev: CmsTvEvent) => {
    setEventFormData({
      title: ev.title,
      subtitle: ev.subtitle || '',
      description: ev.description || '',
      image_url: ev.image_url || '',
      speaker_name: ev.speaker_name || '',
      speaker_image_url: ev.speaker_image_url || '',
      event_date: ev.event_date || '',
      event_time: ev.event_time || '',
      location: ev.location || '',
      badge_text: ev.badge_text || '',
      display_order: ev.display_order,
    });
    setEditingEventId(ev.id);
    setShowEventForm(true);
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirm('Delete this event?')) {
      await deleteEvent(id);
      await loadData();
    }
  };

  const handleToggleEvent = async (id: string, currentlyActive: boolean) => {
    await toggleEvent(id, !currentlyActive);
    await loadData();
  };

  // ── Settings ──
  const handleSaveSetting = async (key: string, value: string) => {
    await updateSetting(key, value);
    await loadData();
  };

  // ── Badge helpers ──
  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      'class-test': 'bg-[#ba181b]/20 text-[#e5383b] border border-[#ba181b]/30',
      'assignment': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      'notice': 'bg-white/10 text-white/70 border border-white/20',
      'event': 'bg-pink-500/20 text-pink-400 border border-pink-500/30',
      'lab-test': 'bg-[#d3d3d3]/20 text-[#d3d3d3] border border-[#d3d3d3]/30',
      'quiz': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    };
    return styles[type] || 'bg-white/10 text-white/70 border border-white/20';
  };

  const formatType = (type: string) => {
    return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <Monitor className="w-10 h-10 text-[#D9A299] dark:text-[#ba181b] animate-pulse" />
          <p className="text-[#8B7355] dark:text-[#b1a7a6]">Loading TV Display data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Page Header */}
      <SpotlightCard className="rounded-2xl border border-[#DCC5B2] dark:border-[#3d4951] bg-[#FAF7F3] dark:bg-transparent p-6 mb-6" spotlightColor="rgba(217, 162, 153, 0.2)">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white">TV Display Management</h1>
            <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6] mt-1">
              Manage announcements, ticker & settings for department TV screens
            </p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => window.open('/tv-display', '_blank')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-[#DCC5B2] dark:border-[#3d4951] text-[#5D4E37] dark:text-[#d3d3d3] hover:bg-[#F0E4D3] dark:hover:bg-[#0b090a] font-medium rounded-lg transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              Open TV Display
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setActiveTab('announcements'); setShowForm(true); }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] hover:from-[#C88989] hover:to-[#CCB5A2] dark:hover:from-[#e32a2d] dark:hover:to-[#ea5f62] text-white font-medium rounded-lg transition-all shadow-lg shadow-[#D9A299]/25 dark:shadow-[#ba181b]/25"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Announcement
            </motion.button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6 pt-6 border-t border-[#DCC5B2] dark:border-[#3d4951]">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#5D4E37] dark:text-white">{announcements.length}</p>
            <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[#D9A299] dark:text-[#d3d3d3]">{announcements.filter(a => a.is_active).length}</p>
            <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">Active</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500 dark:text-red-400">{announcements.filter(a => a.priority === 'high').length}</p>
            <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">High Priority</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-500 dark:text-blue-400">{tickerItems.length}</p>
            <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">Ticker Items</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-teal-500 dark:text-teal-400">{eventItems.length}</p>
            <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">Events</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[#D9A299] dark:text-[#ba181b]">{announcements.filter(a => a.scheduled_date).length}</p>
            <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">Scheduled</p>
          </div>
        </div>
      </SpotlightCard>

      {/* ── Tab Navigation ── */}
      <div className="flex items-center gap-2 mb-6 border-b border-[#DCC5B2] dark:border-[#3d4951] pb-3">
        {([
          { id: 'announcements' as AdminTab, label: 'Announcements', icon: Bell },
          { id: 'ticker' as AdminTab, label: 'Ticker Items', icon: Zap },
          { id: 'events' as AdminTab, label: 'Events', icon: Calendar },
          { id: 'settings' as AdminTab, label: 'Settings', icon: Settings },
        ]).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white shadow-md'
                  : 'text-[#8B7355] dark:text-[#b1a7a6] hover:bg-[#F0E4D3] dark:hover:bg-[#0b090a]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ══════ Announcement Form Modal ══════ */}
      <AnimatePresence>
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#FAF7F3] dark:bg-[#161a1d] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#DCC5B2] dark:border-[#3d4951]"
          >
            <div className="p-6 border-b border-[#DCC5B2] dark:border-[#3d4951]">
              <h2 className="text-xl font-bold text-[#5D4E37] dark:text-white">
                {editingId ? 'Edit Announcement' : 'Create New Announcement'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter announcement title"
                  className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Content *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter announcement details"
                  rows={4}
                  className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all resize-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as TvAnnouncementType })}
                    className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all"
                  >
                    <option value="notice" className="bg-[#FAF7F3] dark:bg-[#161a1d]">Notice</option>
                    <option value="class-test" className="bg-[#FAF7F3] dark:bg-[#161a1d]">Class Test</option>
                    <option value="assignment" className="bg-[#FAF7F3] dark:bg-[#161a1d]">Assignment</option>
                    <option value="lab-test" className="bg-[#FAF7F3] dark:bg-[#161a1d]">Lab Test</option>
                    <option value="quiz" className="bg-[#FAF7F3] dark:bg-[#161a1d]">Quiz</option>
                    <option value="event" className="bg-[#FAF7F3] dark:bg-[#161a1d]">Event</option>
                    <option value="other" className="bg-[#FAF7F3] dark:bg-[#161a1d]">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as TvAnnouncementPriority })}
                    className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all"
                  >
                    <option value="low" className="bg-[#161a1d]">Low</option>
                    <option value="medium" className="bg-[#161a1d]">Medium</option>
                    <option value="high" className="bg-[#161a1d]">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Course Code</label>
                  <input
                    type="text"
                    value={formData.course_code}
                    onChange={(e) => setFormData({ ...formData, course_code: e.target.value })}
                    placeholder="e.g., CSE 3201"
                    className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Scheduled Date</label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-[#DCC5B2] dark:border-[#3d4951]">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg text-[#5D4E37] dark:text-[#d3d3d3] hover:bg-[#F0E4D3] dark:hover:bg-[#0b090a] font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white rounded-lg hover:from-[#C88989] hover:to-[#CCB5A2] dark:hover:from-[#e32a2d] dark:hover:to-[#ea5f62] font-medium transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* ══════ Ticker Form Modal ══════ */}
      <AnimatePresence>
      {showTickerForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#FAF7F3] dark:bg-[#161a1d] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#DCC5B2] dark:border-[#3d4951]"
          >
            <div className="p-6 border-b border-[#DCC5B2] dark:border-[#3d4951]">
              <h2 className="text-xl font-bold text-[#5D4E37] dark:text-white">
                {editingTickerId ? 'Edit Ticker Item' : 'Create New Ticker Item'}
              </h2>
            </div>
            <form onSubmit={handleTickerSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Label *</label>
                <input
                  type="text"
                  value={tickerFormData.label}
                  onChange={(e) => setTickerFormData({ ...tickerFormData, label: e.target.value })}
                  placeholder="e.g., SPECIAL UPDATE"
                  className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Text *</label>
                <textarea
                  value={tickerFormData.text}
                  onChange={(e) => setTickerFormData({ ...tickerFormData, text: e.target.value })}
                  placeholder="Ticker scrolling text"
                  rows={3}
                  className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all resize-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Type</label>
                  <select
                    value={tickerFormData.type}
                    onChange={(e) => setTickerFormData({ ...tickerFormData, type: e.target.value as TvAnnouncementType })}
                    className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all"
                  >
                    <option value="notice">Notice</option>
                    <option value="class-test">Class Test</option>
                    <option value="assignment">Assignment</option>
                    <option value="lab-test">Lab Test</option>
                    <option value="quiz">Quiz</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Sort Order</label>
                  <input
                    type="number"
                    value={tickerFormData.sort_order}
                    onChange={(e) => setTickerFormData({ ...tickerFormData, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Course Code</label>
                <input
                  type="text"
                  value={tickerFormData.course_code}
                  onChange={(e) => setTickerFormData({ ...tickerFormData, course_code: e.target.value })}
                  placeholder="e.g., CSE 3201"
                  className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-[#DCC5B2] dark:border-[#3d4951]">
                <button type="button" onClick={resetTickerForm} className="flex-1 px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg text-[#5D4E37] dark:text-[#d3d3d3] hover:bg-[#F0E4D3] dark:hover:bg-[#0b090a] font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-3 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white rounded-lg font-medium transition-all disabled:opacity-50">
                  {saving ? 'Saving...' : editingTickerId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* ══════ Event Form Modal ══════ */}
      <AnimatePresence>
      {showEventForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#FAF7F3] dark:bg-[#161a1d] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[#DCC5B2] dark:border-[#3d4951]"
          >
            <div className="p-6 border-b border-[#DCC5B2] dark:border-[#3d4951]">
              <h2 className="text-xl font-bold text-[#5D4E37] dark:text-white">
                {editingEventId ? 'Edit Event' : 'Create New Event'}
              </h2>
            </div>
            <form onSubmit={handleEventSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Title *</label>
                <input type="text" value={eventFormData.title} onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })} placeholder="Event title" className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Subtitle</label>
                  <input type="text" value={eventFormData.subtitle} onChange={(e) => setEventFormData({ ...eventFormData, subtitle: e.target.value })} placeholder="e.g., Annual Workshop" className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Badge Text</label>
                  <input type="text" value={eventFormData.badge_text} onChange={(e) => setEventFormData({ ...eventFormData, badge_text: e.target.value })} placeholder="e.g., KEYNOTE, NEW" className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Description</label>
                <textarea value={eventFormData.description} onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })} placeholder="Event description" rows={3} className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Speaker Name</label>
                  <input type="text" value={eventFormData.speaker_name} onChange={(e) => setEventFormData({ ...eventFormData, speaker_name: e.target.value })} placeholder="Speaker full name" className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Location</label>
                  <input type="text" value={eventFormData.location} onChange={(e) => setEventFormData({ ...eventFormData, location: e.target.value })} placeholder="e.g., Seminar Room 301" className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Event Date</label>
                  <input type="date" value={eventFormData.event_date} onChange={(e) => setEventFormData({ ...eventFormData, event_date: e.target.value })} className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Event Time</label>
                  <input type="text" value={eventFormData.event_time} onChange={(e) => setEventFormData({ ...eventFormData, event_time: e.target.value })} placeholder="e.g., 10:00 AM" className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Display Order</label>
                  <input type="number" value={eventFormData.display_order} onChange={(e) => setEventFormData({ ...eventFormData, display_order: parseInt(e.target.value) || 0 })} className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Image URL</label>
                  <input type="url" value={eventFormData.image_url} onChange={(e) => setEventFormData({ ...eventFormData, image_url: e.target.value })} placeholder="https://..." className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] mb-2">Speaker Image URL</label>
                  <input type="url" value={eventFormData.speaker_image_url} onChange={(e) => setEventFormData({ ...eventFormData, speaker_image_url: e.target.value })} placeholder="https://..." className="w-full px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white placeholder-[#8B7355] dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all" />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-[#DCC5B2] dark:border-[#3d4951]">
                <button type="button" onClick={resetEventForm} className="flex-1 px-4 py-3 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg text-[#5D4E37] dark:text-[#d3d3d3] hover:bg-[#F0E4D3] dark:hover:bg-[#0b090a] font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-3 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white rounded-lg font-medium transition-all disabled:opacity-50">
                  {saving ? 'Saving...' : editingEventId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* ══════ TAB: Announcements ══════ */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <SpotlightCard className="rounded-2xl border border-[#DCC5B2] dark:border-[#3d4951] bg-[#FAF7F3] dark:bg-transparent p-12 text-center" spotlightColor="rgba(217, 162, 153, 0.2)">
              <div className="w-16 h-16 bg-[#F0E4D3] dark:bg-[#0b090a] rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-[#8B7355] dark:text-[#b1a7a6]/70" />
              </div>
              <h3 className="text-lg font-medium text-[#5D4E37] dark:text-white mb-2">No Announcements</h3>
              <p className="text-[#8B7355] dark:text-[#b1a7a6]">Create your first announcement to display on department TVs</p>
            </SpotlightCard>
          ) : (
            announcements.map((announcement) => (
              <motion.div
                key={announcement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-[#FAF7F3] dark:bg-[#161a1d] rounded-xl border border-[#DCC5B2] dark:border-[#3d4951] overflow-hidden transition-all hover:border-[#D9A299] dark:hover:border-[#ba181b]/30 ${
                  !announcement.is_active && 'opacity-60'
                }`}
              >
                <div className="flex">
                  {/* Left Priority Strip */}
                  <div className={`w-1.5 flex-shrink-0 ${
                    announcement.is_active 
                      ? announcement.priority === 'high' 
                        ? 'bg-red-500' 
                        : announcement.priority === 'medium'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                      : 'bg-white/20'
                  }`} />
                  
                  {/* Priority Info Section */}
                  <div className={`w-24 flex-shrink-0 flex flex-col items-center justify-center gap-2 border-r border-[#DCC5B2] dark:border-[#3d4951] ${
                    announcement.is_active 
                      ? announcement.priority === 'high' 
                        ? 'bg-red-500/10' 
                        : announcement.priority === 'medium'
                        ? 'bg-amber-500/10'
                        : 'bg-emerald-500/10'
                      : 'bg-[#F0E4D3] dark:bg-[#0b090a]'
                  }`}>
                    <div className={`p-2.5 rounded-lg ${
                      announcement.is_active 
                        ? announcement.priority === 'high' 
                          ? 'bg-red-500/20' 
                          : announcement.priority === 'medium'
                          ? 'bg-amber-500/20'
                          : 'bg-emerald-500/20'
                        : 'bg-[#F0E4D3] dark:bg-[#3d4951]/30'
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
                      announcement.is_active 
                        ? announcement.priority === 'high' 
                          ? 'text-red-400' 
                          : announcement.priority === 'medium'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                        : 'text-[#8B7355] dark:text-[#b1a7a6]/70'
                    }`}>
                      {announcement.priority}
                    </span>
                  </div>
                  
                  {/* Main Content Area */}
                  <div className="flex-1 p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-[#5D4E37] dark:text-white">
                            {announcement.title}
                          </h3>
                          {!announcement.is_active && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#F0E4D3] dark:bg-[#3d4951]/30 text-[#8B7355] dark:text-[#b1a7a6]">
                              INACTIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center flex-wrap gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${getTypeBadge(announcement.type)}`}>
                            {formatType(announcement.type)}
                          </span>
                          {announcement.course_code && (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#ba181b]/20 text-[#e5383b] border border-[#ba181b]/30">
                              {announcement.course_code}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleActive(announcement.id, announcement.is_active)}
                          className={`p-2 rounded-lg transition-colors ${
                            announcement.is_active 
                              ? 'text-emerald-400 hover:bg-emerald-500/10' 
                              : 'text-white/40 hover:bg-white/5'
                          }`}
                          title={announcement.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {announcement.is_active ? (
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
                          className="p-2 rounded-lg text-[#d3d3d3] hover:bg-[#d3d3d3]/10 transition-colors"
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
                    
                    <p className="text-[#8B7355] dark:text-[#b1a7a6] text-sm mb-4 line-clamp-2">
                      {announcement.content}
                    </p>
                    
                    <div className="flex items-center gap-6 text-xs text-[#8B7355] dark:text-[#b1a7a6]/70">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Created: {new Date(announcement.created_at).toLocaleDateString()}
                      </span>
                      {announcement.scheduled_date && (
                        <span className="flex items-center gap-1.5 text-[#D9A299] dark:text-[#d3d3d3] font-medium">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Scheduled: {new Date(announcement.scheduled_date).toLocaleDateString()}
                        </span>
                      )}
                      {announcement.created_by && (
                        <span className="text-[#8B7355] dark:text-[#b1a7a6]/50">by {announcement.created_by}</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ══════ TAB: Ticker Items ══════ */}
      {activeTab === 'ticker' && (
        <div className="space-y-4">
          <div className="flex justify-end mb-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowTickerForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white font-medium rounded-lg transition-all text-sm"
            >
              <Zap className="w-4 h-4" />
              New Ticker Item
            </motion.button>
          </div>

          {tickerItems.length === 0 ? (
            <SpotlightCard className="rounded-2xl border border-[#DCC5B2] dark:border-[#3d4951] bg-[#FAF7F3] dark:bg-transparent p-12 text-center" spotlightColor="rgba(217, 162, 153, 0.2)">
              <Zap className="w-12 h-12 text-[#8B7355] dark:text-[#b1a7a6]/70 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[#5D4E37] dark:text-white mb-2">No Ticker Items</h3>
              <p className="text-[#8B7355] dark:text-[#b1a7a6]">Add ticker items that scroll at the bottom of the TV display</p>
            </SpotlightCard>
          ) : (
            tickerItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-[#FAF7F3] dark:bg-[#161a1d] rounded-xl border border-[#DCC5B2] dark:border-[#3d4951] p-5 transition-all hover:border-[#D9A299] dark:hover:border-[#ba181b]/30 ${
                  !item.is_active && 'opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {item.label}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${getTypeBadge(item.type)}`}>
                        {formatType(item.type)}
                      </span>
                      {item.course_code && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#ba181b]/20 text-[#e5383b] border border-[#ba181b]/30">
                          {item.course_code}
                        </span>
                      )}
                      {!item.is_active && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#F0E4D3] dark:bg-[#3d4951]/30 text-[#8B7355] dark:text-[#b1a7a6]">
                          INACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[#5D4E37] dark:text-white font-medium">{item.text}</p>
                    <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]/50 mt-2">Sort order: {item.sort_order}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleTicker(item.id, item.is_active)}
                      className={`p-2 rounded-lg transition-colors ${item.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-white/40 hover:bg-white/5'}`}
                      title={item.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {item.is_active ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
                        )}
                      </svg>
                    </button>
                    <button onClick={() => handleEditTicker(item)} className="p-2 rounded-lg text-[#d3d3d3] hover:bg-[#d3d3d3]/10 transition-colors" title="Edit">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDeleteTicker(item.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ══════ TAB: Events ══════ */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex justify-end mb-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowEventForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white font-medium rounded-lg transition-all text-sm"
            >
              <Calendar className="w-4 h-4" />
              New Event
            </motion.button>
          </div>

          {eventItems.length === 0 ? (
            <SpotlightCard className="rounded-2xl border border-[#DCC5B2] dark:border-[#3d4951] bg-[#FAF7F3] dark:bg-transparent p-12 text-center" spotlightColor="rgba(217, 162, 153, 0.2)">
              <Calendar className="w-12 h-12 text-[#8B7355] dark:text-[#b1a7a6]/70 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[#5D4E37] dark:text-white mb-2">No Events</h3>
              <p className="text-[#8B7355] dark:text-[#b1a7a6]">Create events to show on the TV display info board</p>
            </SpotlightCard>
          ) : (
            eventItems.map((ev) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-[#FAF7F3] dark:bg-[#161a1d] rounded-xl border border-[#DCC5B2] dark:border-[#3d4951] p-5 transition-all hover:border-[#D9A299] dark:hover:border-[#ba181b]/30 ${
                  !ev.is_active && 'opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-[#5D4E37] dark:text-white">{ev.title}</h3>
                      {ev.badge_text && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30">
                          {ev.badge_text}
                        </span>
                      )}
                      {!ev.is_active && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#F0E4D3] dark:bg-[#3d4951]/30 text-[#8B7355] dark:text-[#b1a7a6]">INACTIVE</span>
                      )}
                    </div>
                    {ev.subtitle && <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6] mb-1">{ev.subtitle}</p>}
                    {ev.description && <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6] line-clamp-2 mb-2">{ev.description}</p>}
                    <div className="flex items-center flex-wrap gap-3 text-xs text-[#8B7355] dark:text-[#b1a7a6]/70">
                      {ev.speaker_name && <span>Speaker: <strong className="text-[#5D4E37] dark:text-[#d3d3d3]">{ev.speaker_name}</strong></span>}
                      {ev.event_date && <span>Date: {new Date(ev.event_date + 'T00:00:00').toLocaleDateString()}</span>}
                      {ev.event_time && <span>Time: {ev.event_time}</span>}
                      {ev.location && <span>Location: {ev.location}</span>}
                      <span>Order: {ev.display_order}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleEvent(ev.id, ev.is_active)}
                      className={`p-2 rounded-lg transition-colors ${ev.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-white/40 hover:bg-white/5'}`}
                      title={ev.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {ev.is_active ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
                        )}
                      </svg>
                    </button>
                    <button onClick={() => handleEditEvent(ev)} className="p-2 rounded-lg text-[#d3d3d3] hover:bg-[#d3d3d3]/10 transition-colors" title="Edit">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDeleteEvent(ev.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ══════ TAB: Settings ══════ */}
      {activeTab === 'settings' && (
        <SettingsTab settings={settings} onSave={handleSaveSetting} />
      )}
    </div>
  );
}

// ══════════════════════════════════════
// Settings Tab Component
// ══════════════════════════════════════

function SettingsTab({ settings, onSave }: { settings: Record<string, string>; onSave: (key: string, value: string) => Promise<void> }) {
  const [editMap, setEditMap] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    setEditMap({ ...settings });
  }, [settings]);

  const handleSave = async (key: string) => {
    setSavingKey(key);
    await onSave(key, editMap[key]);
    setSavingKey(null);
  };

  const settingGroups = [
    {
      title: 'Display Settings',
      icon: Monitor,
      keys: ['scroll_speed', 'rotation_interval_sec', 'theme'],
    },
    {
      title: 'Content Labels',
      icon: BarChart3,
      keys: ['semester_label', 'department_short', 'headline_prefix'],
    },
    {
      title: 'TV Room & Events',
      icon: Calendar,
      keys: ['tv_room_number', 'tv_class_label', 'event_rotation_sec'],
    },
    {
      title: 'Features',
      icon: Settings,
      keys: ['show_routine', 'show_stats', 'show_ticker'],
    },
  ];

  const labelMap: Record<string, string> = {
    scroll_speed: 'Marquee Scroll Speed',
    rotation_interval_sec: 'Tab Auto-Rotation (seconds)',
    theme: 'Theme',
    semester_label: 'Semester Label',
    department_short: 'Department Short Name',
    headline_prefix: 'Headlines Prefix',
    show_routine: 'Show Routine Tab',
    show_stats: 'Show Stats Tab',
    show_ticker: 'Show Ticker Bar',
    tv_room_number: 'TV Room Number (e.g., ROOM 301)',
    tv_class_label: 'Class Label (e.g., CLASS 4B)',
    event_rotation_sec: 'Event Carousel Rotation (seconds)',
  };

  return (
    <div className="space-y-6">
      {settingGroups.map(group => {
        const Icon = group.icon;
        return (
          <SpotlightCard key={group.title} className="rounded-2xl border border-[#DCC5B2] dark:border-[#3d4951] bg-[#FAF7F3] dark:bg-transparent p-6" spotlightColor="rgba(217, 162, 153, 0.2)">
            <h3 className="text-lg font-bold text-[#5D4E37] dark:text-white flex items-center gap-2 mb-5">
              <Icon className="w-5 h-5 text-[#D9A299] dark:text-[#ba181b]" />
              {group.title}
            </h3>
            <div className="space-y-4">
              {group.keys.filter(k => editMap[k] !== undefined).map(key => (
                <div key={key} className="flex items-center gap-4">
                  <label className="w-48 text-sm font-medium text-[#5D4E37] dark:text-[#d3d3d3] flex-shrink-0">
                    {labelMap[key] || key}
                  </label>
                  <input
                    type="text"
                    value={editMap[key] || ''}
                    onChange={(e) => setEditMap({ ...editMap, [key]: e.target.value })}
                    className="flex-1 px-4 py-2.5 border border-[#DCC5B2] dark:border-[#3d4951] rounded-lg bg-[#FAF7F3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-white text-sm focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#ba181b] focus:border-transparent transition-all"
                  />
                  <button
                    onClick={() => handleSave(key)}
                    disabled={savingKey === key}
                    className="px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 hover:from-[#C88989] hover:to-[#CCB5A2] dark:hover:from-[#e32a2d] dark:hover:to-[#ea5f62]"
                  >
                    {savingKey === key ? 'Saving...' : 'Save'}
                  </button>
                </div>
              ))}
            </div>
          </SpotlightCard>
        );
      })}
    </div>
  );
}
