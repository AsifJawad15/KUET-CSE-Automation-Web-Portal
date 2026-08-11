"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { cmsSupabase } from '@/services/cmsService';
import {
    createAnnouncement,
    createDevice,
    createEvent,
    createTicker,
    deleteAnnouncement,
    deleteDevice,
    deleteEvent,
    deleteTicker,
    fetchActiveDevices,
    fetchAllAnnouncements,
    fetchAllDevices,
    fetchAllEvents,
    fetchAllTicker,
    fetchTvSettings,
    toggleAnnouncement,
    toggleDevice,
    toggleDeviceRoomSchedule,
    toggleEvent,
    toggleTicker,
    updateAnnouncement,
    updateDevice,
    updateEvent,
    updateSetting,
    upsertSetting,
    updateTicker,
    upsertLayoutSettings,
    DEFAULT_LAYOUT,
    type LayoutSettings,
} from '@/services/tvDisplayService';
import type { CmsTvAnnouncement, CmsTvDevice, CmsTvEvent, CmsTvTicker, TvAnnouncementPriority, TvAnnouncementType, TvTarget } from '@/types/cms';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  Clock as ClockIcon,
  Eye,
  MapPin,
  Megaphone,
  Monitor,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Tv,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type AdminTab = 'announcements' | 'ticker' | 'events' | 'devices' | 'settings';
type UiNotice = {
  tone: 'success' | 'error' | 'warning';
  title: string;
  message?: string;
};

export default function TVDisplayPage({ onMenuChange }: { onMenuChange?: (id: string) => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('announcements');
  const [contentSearch, setContentSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [announcements, setAnnouncements] = useState<CmsTvAnnouncement[]>([]);
  const [tickerItems, setTickerItems] = useState<CmsTvTicker[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [devices, setDevices] = useState<CmsTvDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [notice, setNotice] = useState<UiNotice | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const notify = useCallback((nextNotice: UiNotice) => setNotice(nextNotice), []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function uploadImage(file: File, field: 'image_url' | 'speaker_image_url') {
    setUploading(prev => ({ ...prev, [field]: true }));
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `tv-events/${Date.now()}-${field}.${ext}`;
      const { error } = await cmsSupabase.storage
        .from('cms-images')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = cmsSupabase.storage.from('cms-images').getPublicUrl(path);
      setEventFormData(prev => ({ ...prev, [field]: data.publicUrl }));
      notify({ tone: 'success', title: 'Image uploaded', message: 'The event media is ready to publish.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err);
      console.error('Image upload failed:', err);
      notify({ tone: 'error', title: 'Image upload failed', message: msg });
    } finally {
      setUploading(prev => ({ ...prev, [field]: false }));
    }
  }

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
    target: 'all' as TvTarget,
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
    target: 'all' as TvTarget,
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
    target: 'all' as TvTarget,
  });

  // ── Fetch all data ──
  const loadData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        fetchAllAnnouncements(),
        fetchAllTicker(),
        fetchTvSettings(),
        fetchAllEvents(),
        fetchAllDevices(),
      ]);

      const [annData, tickData, settData, evtData, devData] = results;
      if (annData.status === 'fulfilled') setAnnouncements(annData.value);
      if (tickData.status === 'fulfilled') setTickerItems(tickData.value);
      if (settData.status === 'fulfilled') setSettings(settData.value);
      if (evtData.status === 'fulfilled') setEventItems(evtData.value);
      if (devData.status === 'fulfilled') setDevices(devData.value);

      const failed = results.filter((result) => result.status === 'rejected').length;
      const succeeded = results.length - failed;
      setLoadError(
        failed > 0
          ? `${failed} data ${failed === 1 ? 'source is' : 'sources are'} temporarily unavailable. Last-known data is preserved.`
          : null,
      );
      if (succeeded > 0) setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load TV display data:', err);
      setLoadError('TV Display data could not be refreshed. Last-known data is preserved.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Announcement CRUD ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wasEditing = Boolean(editingId);
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
          target: formData.target,
        });
      } else {
        await createAnnouncement({
          title: formData.title,
          content: formData.content,
          type: formData.type,
          course_code: formData.course_code || null,
          priority: formData.priority,
          scheduled_date: formData.scheduled_date || null,
          target: formData.target,
          is_active: true,
          created_by: 'Admin',
        });
      }
      resetForm();
      await loadData();
      notify({
        tone: 'success',
        title: wasEditing ? 'Announcement updated' : 'Announcement published',
        message: 'The latest content is now available to its selected screens.',
      });
    } catch (err) {
      console.error('Failed to save announcement:', err);
      notify({ tone: 'error', title: 'Announcement was not saved', message: 'Check your connection and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', content: '', type: 'notice', course_code: '', priority: 'medium', scheduled_date: '', target: 'all' });
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
      target: (a.target || 'all') as TvTarget,
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
    await toggleAnnouncement(id, currentlyActive);
    await loadData();
  };

  // ── Ticker CRUD ──
  const handleTickerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wasEditing = Boolean(editingTickerId);
    setSaving(true);
    try {
      if (editingTickerId) {
        await updateTicker(editingTickerId, {
          label: tickerFormData.label,
          text: tickerFormData.text,
          type: tickerFormData.type,
          course_code: tickerFormData.course_code || null,
          sort_order: tickerFormData.sort_order,
          target: tickerFormData.target,
        });
      } else {
        await createTicker({
          label: tickerFormData.label,
          text: tickerFormData.text,
          type: tickerFormData.type,
          course_code: tickerFormData.course_code || null,
          announcement_id: null,
          sort_order: tickerFormData.sort_order,
          target: tickerFormData.target,
          is_active: true,
        });
      }
      resetTickerForm();
      await loadData();
      notify({
        tone: 'success',
        title: wasEditing ? 'Ticker item updated' : 'Ticker item published',
        message: 'The ticker queue has been refreshed.',
      });
    } catch (err) {
      console.error('Failed to save ticker item:', err);
      notify({ tone: 'error', title: 'Ticker item was not saved', message: 'Check your connection and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const resetTickerForm = () => {
    setTickerFormData({ label: 'SPECIAL UPDATE', text: '', type: 'notice', course_code: '', sort_order: 0, target: 'all' });
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
      target: (t.target || 'all') as TvTarget,
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
    await toggleTicker(id, currentlyActive);
    await loadData();
  };

  // ── Event CRUD ──
  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wasEditing = Boolean(editingEventId);
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
          target: eventFormData.target,
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
          target: eventFormData.target,
          is_active: true,
        });
      }
      resetEventForm();
      await loadData();
      notify({
        tone: 'success',
        title: wasEditing ? 'Event updated' : 'Event published',
        message: 'The event carousel has been refreshed.',
      });
    } catch (err) {
      console.error('Failed to save event:', err);
      notify({ tone: 'error', title: 'Event was not saved', message: 'Check your connection and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const resetEventForm = () => {
    setEventFormData({ title: '', subtitle: '', description: '', image_url: '', speaker_name: '', speaker_image_url: '', event_date: '', event_time: '', location: '', badge_text: '', display_order: 0, target: 'all' });
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
      target: (ev.target || 'all') as TvTarget,
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
    await toggleEvent(id, currentlyActive);
    await loadData();
  };

  // ── Settings ──
  const handleSaveSetting = async (key: string, value: string) => {
    await updateSetting(key, value);
    await loadData();
  };

  // ── Breaking News (per-TV target) ──
  const [breakingNewsText, setBreakingNewsText] = useState('');
  const [breakingNewsDurationInput, setBreakingNewsDurationInput] = useState('10');
  const [breakingNewsTarget, setBreakingNewsTarget] = useState<string>('all');
  const [activatingBreaking, setActivatingBreaking] = useState(false);
  const [breakingClock, setBreakingClock] = useState(() => Date.now());

  // Collect all active breaking news across all targets
  const activeBreakingTargets = (() => {
    const targets: { target: string; text: string; expires: string; timeLeft: string }[] = [];
    const allTargets = ['all', ...devices.filter(d => d.is_active).map(d => d.name)];
    for (const t of allTargets) {
      const suffix = `_${t}`;
      const expires = settings[`breaking_news_expires_at${suffix}`];
      if (!expires) continue;
      const diff = new Date(expires).getTime() - breakingClock;
      if (diff <= 0) continue;
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      targets.push({
        target: t,
        text: settings[`breaking_news_text${suffix}`] || '',
        expires,
        timeLeft: `${mins}m ${String(secs).padStart(2, '0')}s`,
      });
    }
    return targets;
  })();

  const breakingNewsActive = activeBreakingTargets.length > 0;

  useEffect(() => {
    if (!breakingNewsActive) return;
    const interval = window.setInterval(() => setBreakingClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [breakingNewsActive]);

  const handleActivateBreakingNews = async () => {
    if (!breakingNewsText.trim()) return;
    const durationMinutes = Number.parseInt(breakingNewsDurationInput.trim(), 10);
    if (Number.isNaN(durationMinutes) || durationMinutes <= 0) {
      notify({ tone: 'warning', title: 'Enter a valid duration', message: 'Use a duration of at least one minute.' });
      return;
    }
    setActivatingBreaking(true);
    try {
      const suffix = `_${breakingNewsTarget}`;
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      await upsertSetting(`breaking_news_text${suffix}`, breakingNewsText.trim());
      await upsertSetting(`breaking_news_expires_at${suffix}`, expiresAt);
      setBreakingNewsText('');
      await loadData();
      notify({ tone: 'success', title: 'Urgent broadcast is live', message: 'Targeted screens will refresh automatically.' });
    } catch (err) {
      console.error('Failed to activate breaking news:', err);
      notify({ tone: 'error', title: 'Broadcast could not be published', message: 'The previous screen content remains unchanged.' });
    } finally {
      setActivatingBreaking(false);
    }
  };

  const handleDeactivateBreakingNews = async (target: string) => {
    setActivatingBreaking(true);
    try {
      await upsertSetting(`breaking_news_expires_at_${target}`, '');
      await loadData();
      notify({ tone: 'success', title: 'Urgent broadcast ended', message: 'Normal ticker and headline programming will resume.' });
    } catch (err) {
      console.error('Failed to deactivate breaking news:', err);
    } finally {
      setActivatingBreaking(false);
    }
  };

  // ── Badge helpers ──
  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      'class-test': 'border border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300',
      'assignment': 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
      'notice': 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-white/15 dark:bg-white/10 dark:text-slate-200',
      'event': 'border border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-500/30 dark:bg-pink-500/15 dark:text-pink-300',
      'lab-test': 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300',
      'quiz': 'border border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300',
    };
    return styles[type] || 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-white/15 dark:bg-white/10 dark:text-slate-200';
  };

  const formatType = (type: string) => {
    return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const activeAnnouncements = announcements.filter((item) => item.is_active).length;
  const activeTicker = tickerItems.filter((item) => item.is_active).length;
  const activeEvents = eventItems.filter((item) => item.is_active).length;
  const activeDevices = devices.filter((item) => item.is_active).length;
  const highPriorityAnnouncements = announcements.filter(
    (item) => item.is_active && item.priority === 'high',
  ).length;
  const totalPublished = activeAnnouncements + activeTicker + activeEvents;

  const adminTabs: Array<{
    id: AdminTab;
    label: string;
    shortLabel: string;
    icon: typeof Bell;
    count: number;
  }> = [
    { id: 'announcements', label: 'Announcements', shortLabel: 'Announcements', icon: Bell, count: announcements.length },
    { id: 'ticker', label: 'Ticker items', shortLabel: 'Ticker', icon: Zap, count: tickerItems.length },
    { id: 'events', label: 'Events', shortLabel: 'Events', icon: Calendar, count: eventItems.length },
    { id: 'devices', label: 'TV devices', shortLabel: 'Devices', icon: Tv, count: devices.length },
  ];

  const normalizedSearch = contentSearch.trim().toLocaleLowerCase();
  const matchesVisibility = (isActive: boolean) =>
    visibilityFilter === 'all' ||
    (visibilityFilter === 'active' && isActive) ||
    (visibilityFilter === 'inactive' && !isActive);
  const filteredAnnouncements = announcements.filter((item) =>
    matchesVisibility(item.is_active) &&
    (!normalizedSearch ||
      `${item.title} ${item.content} ${item.course_code ?? ''} ${item.target ?? ''}`
        .toLocaleLowerCase()
        .includes(normalizedSearch)),
  );
  const filteredTickerItems = tickerItems.filter((item) =>
    matchesVisibility(item.is_active) &&
    (!normalizedSearch ||
      `${item.label} ${item.text} ${item.course_code ?? ''} ${item.target ?? ''}`
        .toLocaleLowerCase()
        .includes(normalizedSearch)),
  );
  const filteredEvents = eventItems.filter((item) =>
    matchesVisibility(item.is_active) &&
    (!normalizedSearch ||
      `${item.title} ${item.subtitle ?? ''} ${item.description ?? ''} ${item.speaker_name ?? ''} ${item.location ?? ''} ${item.target ?? ''}`
        .toLocaleLowerCase()
        .includes(normalizedSearch)),
  );

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-[#3d4951] dark:bg-[#111418]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0f2947] text-white shadow-lg shadow-[#0f2947]/15">
            <Monitor className="h-7 w-7 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Preparing TV control center</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-[#b1a7a6]">
            Loading screens, broadcasts, events and display settings.
          </p>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[#0b7f72]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full pb-10">
      <div className="mx-auto max-w-[1680px] space-y-5">
        <AnimatePresence>
          {notice && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              className={`fixed right-4 top-4 z-[70] flex w-[min(420px,calc(100vw-32px))] items-start gap-3 rounded-2xl border bg-white p-4 shadow-2xl dark:bg-[#15191d] ${
                notice.tone === 'success'
                  ? 'border-emerald-200 dark:border-emerald-500/30'
                  : notice.tone === 'warning'
                    ? 'border-amber-200 dark:border-amber-500/30'
                    : 'border-red-200 dark:border-red-500/30'
              }`}
            >
              <div className={`mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl ${
                notice.tone === 'success'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : notice.tone === 'warning'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
              }`}>
                {notice.tone === 'success'
                  ? <CheckCircle2 className="h-5 w-5" />
                  : <AlertTriangle className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{notice.title}</p>
                {notice.message && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{notice.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Dismiss notification"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Operational header */}
        <section className="relative overflow-hidden rounded-3xl border border-[#183d63] bg-[#0f2947] text-white shadow-[0_18px_45px_-28px_rgba(15,41,71,0.8)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#d7a928]" />
          <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border border-white/10 bg-white/[0.035]" />
          <div className="relative px-5 py-6 sm:px-7 lg:px-8 lg:py-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#9fd4cf]">
                  <span>KUET CSE</span>
                  <span className="h-1 w-1 rounded-full bg-[#d7a928]" />
                  <span>Digital signage operations</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">TV Display Control Center</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                  Publish department updates, coordinate screen-specific content and keep every display ready for unattended operation.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                    </span>
                    Data services connected
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-slate-200">
                    <ClockIcon className="h-3.5 w-3.5" />
                    {lastUpdated
                      ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Awaiting first refresh'}
                  </span>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-[#9fd4cf] disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing' : 'Refresh data'}
                </button>
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ y: 0 }}
                  onClick={() => onMenuChange?.('tv-viewer')}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#0f2947] shadow-sm transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#d7a928]"
                >
                  <Eye className="h-4 w-4" />
                  Open TV viewer
                </motion.button>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-2.5 border-t border-white/10 pt-5 md:grid-cols-3 xl:grid-cols-6">
              {[
                { label: 'Published', value: totalPublished, detail: 'active content', icon: Radio, tone: 'text-[#9fd4cf]' },
                { label: 'Announcements', value: activeAnnouncements, detail: `${announcements.length} total`, icon: Bell, tone: 'text-[#f0c94d]' },
                { label: 'High priority', value: highPriorityAnnouncements, detail: 'active alerts', icon: AlertTriangle, tone: 'text-[#ff9b9b]' },
                { label: 'Ticker', value: activeTicker, detail: `${tickerItems.length} total`, icon: Zap, tone: 'text-[#7dd3fc]' },
                { label: 'Events', value: activeEvents, detail: `${eventItems.length} total`, icon: Calendar, tone: 'text-[#7ee0c3]' },
                { label: 'TV screens', value: activeDevices, detail: `${devices.length} registered`, icon: Tv, tone: 'text-[#c4b5fd]' },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-3.5 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <Icon className={`h-4 w-4 ${metric.tone}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{metric.label}</span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <span className="text-2xl font-bold tabular-nums">{metric.value}</span>
                      <span className="pb-0.5 text-[11px] text-slate-400">{metric.detail}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {loadError && (
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
            <div className="flex-1">
              <p className="text-sm font-bold">Some information could not be refreshed</p>
              <p className="mt-0.5 text-xs leading-5 opacity-80">{loadError}</p>
            </div>
            <button type="button" onClick={handleRefresh} className="rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-amber-100 dark:hover:bg-white/10">
              Try again
            </button>
          </div>
        )}

        {/* Urgent broadcast control */}
        <section className={`overflow-hidden rounded-3xl border bg-white shadow-sm dark:bg-[#111418] ${
          breakingNewsActive
            ? 'border-red-300 dark:border-red-500/40'
            : 'border-slate-200 dark:border-[#3d4951]'
        }`}>
          <div className={`h-1 ${breakingNewsActive ? 'bg-red-500' : 'bg-[#0b7f72]'}`} />
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3.5">
                <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-2xl ${
                  breakingNewsActive
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/15'
                    : 'bg-[#e7f5f2] text-[#0b7f72] dark:bg-[#0b7f72]/20 dark:text-[#77d3c9]'
                }`}>
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Urgent broadcast</h2>
                    {breakingNewsActive && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-700 dark:bg-red-500/15 dark:text-red-300">
                        <Activity className="h-3 w-3" />
                        Live on {activeBreakingTargets.length} {activeBreakingTargets.length === 1 ? 'target' : 'targets'}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500 dark:text-[#b1a7a6]">
                    {breakingNewsActive
                      ? 'The urgent message temporarily replaces ticker and headline content on each selected screen.'
                      : 'Use only for time-sensitive department notices that must immediately take priority on screen.'}
                  </p>
                </div>
              </div>
              {breakingNewsActive && (
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  <Radio className="h-3.5 w-3.5" />
                  Broadcast active
                </div>
              )}
            </div>

            {activeBreakingTargets.length > 0 && (
              <div className="mt-5 grid gap-2">
                {activeBreakingTargets.map((item) => (
                  <div key={item.target} className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 sm:flex-row sm:items-center dark:border-red-500/20 dark:bg-red-500/10">
                    <span className="w-fit rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                      {item.target === 'all' ? 'All TVs' : item.target}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-red-900 dark:text-red-100">{item.text}</p>
                    <span className="font-mono text-xs font-bold tabular-nums text-red-600 dark:text-red-300">{item.timeLeft}</span>
                    <button
                      type="button"
                      onClick={() => handleDeactivateBreakingNews(item.target)}
                      disabled={activatingBreaking}
                      className="min-h-9 rounded-lg border border-red-300 bg-white px-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 dark:border-red-500/30 dark:bg-transparent dark:text-red-200 dark:hover:bg-red-500/10"
                    >
                      End broadcast
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 lg:grid-cols-[minmax(0,1fr)_220px_150px_140px] dark:border-white/10">
              <label className="min-w-0">
                <span className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                  Message
                  <span className="font-medium text-slate-400">{breakingNewsText.length}/180</span>
                </span>
                <input
                  type="text"
                  value={breakingNewsText}
                  maxLength={180}
                  onChange={(e) => setBreakingNewsText(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && breakingNewsText.trim() && breakingNewsDurationInput.trim()) {
                      void handleActivateBreakingNews();
                    }
                  }}
                  placeholder="Type a concise, actionable headline…"
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100 dark:border-[#3d4951] dark:bg-[#0b0d10] dark:text-white dark:focus:ring-red-500/10"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">Target screens</span>
                <select
                  value={breakingNewsTarget}
                  onChange={(e) => setBreakingNewsTarget(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100 dark:border-[#3d4951] dark:bg-[#0b0d10] dark:text-white dark:focus:ring-red-500/10"
                >
                  <option value="all">All active TVs</option>
                  {devices.filter((device) => device.is_active).map((device) => (
                    <option key={device.id} value={device.name}>
                      {device.name}{device.label ? ` — ${device.label}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">Duration</span>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={breakingNewsDurationInput}
                    onChange={(e) => setBreakingNewsDurationInput(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-12 text-sm font-semibold tabular-nums text-slate-900 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100 dark:border-[#3d4951] dark:bg-[#0b0d10] dark:text-white dark:focus:ring-red-500/10"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-slate-400">min</span>
                </div>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleActivateBreakingNews}
                  disabled={activatingBreaking || !breakingNewsText.trim() || !breakingNewsDurationInput.trim()}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-45 dark:focus:ring-red-500/20"
                >
                  <Radio className="h-4 w-4" />
                  {activatingBreaking ? 'Publishing…' : 'Go live'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Content navigation */}
        <nav aria-label="TV content sections" className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-[#3d4951] dark:bg-[#111418]">
          <div role="tablist" className="flex gap-1 overflow-x-auto">
            {adminTabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setContentSearch('');
                    setVisibilityFilter('all');
                  }}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#0b7f72] focus:ring-offset-2 dark:focus:ring-offset-[#111418] ${
                    selected
                      ? 'bg-[#0f2947] text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${selected ? 'text-[#85d5cc]' : ''}`} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                    selected ? 'bg-white/12 text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {activeTab !== 'devices' && (
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center dark:border-[#3d4951] dark:bg-[#111418]">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search {activeTab}</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={contentSearch}
                onChange={(event) => setContentSearch(event.target.value)}
                placeholder={`Search ${activeTab} by title, message or target…`}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-[#0b7f72] focus:bg-white focus:ring-4 focus:ring-[#0b7f72]/10 dark:border-[#3d4951] dark:bg-[#0b0d10] dark:text-white dark:focus:border-[#38a99d]"
              />
              {contentSearch && (
                <button
                  type="button"
                  onClick={() => setContentSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Visibility</span>
              <select
                value={visibilityFilter}
                onChange={(event) => setVisibilityFilter(event.target.value as typeof visibilityFilter)}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#0b7f72] focus:ring-4 focus:ring-[#0b7f72]/10 dark:border-[#3d4951] dark:bg-[#0b0d10] dark:text-white"
              >
                <option value="all">All content</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </label>
          </div>
        )}

      {/* ══════ Announcement Form Modal ══════ */}
      <AnimatePresence>
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-[#161a1d] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-[#3d4951]"
          >
            <div className="p-6 border-b border-gray-200 dark:border-[#3d4951]">
              <h2 className="text-xl font-bold text-gray-700 dark:text-white">
                {editingId ? 'Edit Announcement' : 'Create New Announcement'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter announcement title"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Content *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter announcement details"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all resize-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as TvAnnouncementType })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
                  >
                    <option value="notice" className="bg-white dark:bg-[#161a1d]">Notice</option>
                    <option value="class-test" className="bg-white dark:bg-[#161a1d]">Class Test</option>
                    <option value="assignment" className="bg-white dark:bg-[#161a1d]">Assignment</option>
                    <option value="lab-test" className="bg-white dark:bg-[#161a1d]">Lab Test</option>
                    <option value="quiz" className="bg-white dark:bg-[#161a1d]">Quiz</option>
                    <option value="event" className="bg-white dark:bg-[#161a1d]">Event</option>
                    <option value="other" className="bg-white dark:bg-[#161a1d]">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as TvAnnouncementPriority })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
                  >
                    <option value="low" className="bg-[#161a1d]">Low</option>
                    <option value="medium" className="bg-[#161a1d]">Medium</option>
                    <option value="high" className="bg-[#161a1d]">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Course Code</label>
                  <input
                    type="text"
                    value={formData.course_code}
                    onChange={(e) => setFormData({ ...formData, course_code: e.target.value })}
                    placeholder="e.g., CSE 3201"
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Scheduled Date</label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">TV Target</label>
                  <select
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: e.target.value as TvTarget })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
                  >
                    <option value="all" className="bg-white dark:bg-[#161a1d]">All TVs</option>
                    {devices.filter(d => d.is_active).map(d => (
                      <option key={d.id} value={d.name} className="bg-white dark:bg-[#161a1d]">
                        {d.name}{d.label ? ` — ${d.label}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-[#3d4951]">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg text-gray-700 dark:text-[#d3d3d3] hover:bg-gray-50 dark:hover:bg-[#0b090a] font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
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
            className="bg-white dark:bg-[#161a1d] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-[#3d4951]"
          >
            <div className="p-6 border-b border-gray-200 dark:border-[#3d4951]">
              <h2 className="text-xl font-bold text-gray-700 dark:text-white">
                {editingTickerId ? 'Edit Ticker Item' : 'Create New Ticker Item'}
              </h2>
            </div>
            <form onSubmit={handleTickerSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Label *</label>
                <input
                  type="text"
                  value={tickerFormData.label}
                  onChange={(e) => setTickerFormData({ ...tickerFormData, label: e.target.value })}
                  placeholder="e.g., SPECIAL UPDATE"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Text *</label>
                <textarea
                  value={tickerFormData.text}
                  onChange={(e) => setTickerFormData({ ...tickerFormData, text: e.target.value })}
                  placeholder="Ticker scrolling text"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all resize-none"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Type</label>
                  <select
                    value={tickerFormData.type}
                    onChange={(e) => setTickerFormData({ ...tickerFormData, type: e.target.value as TvAnnouncementType })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Sort Order</label>
                  <input
                    type="number"
                    value={tickerFormData.sort_order}
                    onChange={(e) => setTickerFormData({ ...tickerFormData, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">TV Target</label>
                  <select
                    value={tickerFormData.target}
                    onChange={(e) => setTickerFormData({ ...tickerFormData, target: e.target.value as TvTarget })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
                  >
                    <option value="all">All TVs</option>
                    {devices.filter(d => d.is_active).map(d => (
                      <option key={d.id} value={d.name}>{d.name}{d.label ? ` — ${d.label}` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Course Code</label>
                <input
                  type="text"
                  value={tickerFormData.course_code}
                  onChange={(e) => setTickerFormData({ ...tickerFormData, course_code: e.target.value })}
                  placeholder="e.g., CSE 3201"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-[#3d4951]">
                <button type="button" onClick={resetTickerForm} className="flex-1 px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg text-gray-700 dark:text-[#d3d3d3] hover:bg-gray-50 dark:hover:bg-[#0b090a] font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
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
            className="bg-white dark:bg-[#161a1d] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-[#3d4951]"
          >
            <div className="p-6 border-b border-gray-200 dark:border-[#3d4951]">
              <h2 className="text-xl font-bold text-gray-700 dark:text-white">
                {editingEventId ? 'Edit Event' : 'Create New Event'}
              </h2>
            </div>
            <form onSubmit={handleEventSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Title *</label>
                <input type="text" value={eventFormData.title} onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })} placeholder="Event title" className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Subtitle</label>
                  <input type="text" value={eventFormData.subtitle} onChange={(e) => setEventFormData({ ...eventFormData, subtitle: e.target.value })} placeholder="e.g., Annual Workshop" className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Badge Text</label>
                  <input type="text" value={eventFormData.badge_text} onChange={(e) => setEventFormData({ ...eventFormData, badge_text: e.target.value })} placeholder="e.g., KEYNOTE, NEW" className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Description</label>
                <textarea value={eventFormData.description} onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })} placeholder="Event description" rows={3} className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Speaker Name</label>
                  <input type="text" value={eventFormData.speaker_name} onChange={(e) => setEventFormData({ ...eventFormData, speaker_name: e.target.value })} placeholder="Speaker full name" className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Location</label>
                  <input type="text" value={eventFormData.location} onChange={(e) => setEventFormData({ ...eventFormData, location: e.target.value })} placeholder="e.g., Seminar Room 301" className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Event Date</label>
                  <input type="date" value={eventFormData.event_date} onChange={(e) => setEventFormData({ ...eventFormData, event_date: e.target.value })} className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Event Time</label>
                  <input type="text" value={eventFormData.event_time} onChange={(e) => setEventFormData({ ...eventFormData, event_time: e.target.value })} placeholder="e.g., 10:00 AM" className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Display Order</label>
                  <input type="number" value={eventFormData.display_order} onChange={(e) => setEventFormData({ ...eventFormData, display_order: parseInt(e.target.value) || 0 })} className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">TV Target</label>
                  <select value={eventFormData.target} onChange={(e) => setEventFormData({ ...eventFormData, target: e.target.value as TvTarget })} className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all">
                    <option value="all">All TVs</option>
                    {devices.filter(d => d.is_active).map(d => (
                      <option key={d.id} value={d.name}>{d.name}{d.label ? ` — ${d.label}` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Event Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'image_url'); }}
                    className="w-full text-sm text-gray-700 dark:text-white file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-100 dark:file:bg-red-600 file:text-white hover:file:opacity-80 cursor-pointer"
                  />
                  {uploading['image_url'] && <p className="text-xs mt-1 text-gray-400 dark:text-[#b1a7a6]">Uploading...</p>}
                  {eventFormData.image_url && !uploading['image_url'] && (
                    <img src={eventFormData.image_url} alt="Preview" className="mt-2 h-20 w-auto rounded-lg object-cover border border-gray-200 dark:border-[#3d4951]" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Speaker Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'speaker_image_url'); }}
                    className="w-full text-sm text-gray-700 dark:text-white file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-100 dark:file:bg-red-600 file:text-white hover:file:opacity-80 cursor-pointer"
                  />
                  {uploading['speaker_image_url'] && <p className="text-xs mt-1 text-gray-400 dark:text-[#b1a7a6]">Uploading...</p>}
                  {eventFormData.speaker_image_url && !uploading['speaker_image_url'] && (
                    <img src={eventFormData.speaker_image_url} alt="Preview" className="mt-2 h-16 w-16 rounded-full object-cover border-2 border-slate-400" />
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-[#3d4951]">
                <button type="button" onClick={resetEventForm} className="flex-1 px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg text-gray-700 dark:text-[#d3d3d3] hover:bg-gray-50 dark:hover:bg-[#0b090a] font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
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
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-[#3d4951] dark:bg-[#111418]">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#0b7f72]" />
                <h2 className="font-bold text-slate-900 dark:text-white">Announcement library</h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-[#b1a7a6]">
                {activeAnnouncements} active of {announcements.length} announcements across all screens.
              </p>
            </div>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              onClick={() => setShowForm(true)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0f2947] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#163a61] focus:outline-none focus:ring-4 focus:ring-[#0f2947]/15"
            >
              <Plus className="w-4 h-4" />
              New Announcement
            </motion.button>
          </div>

          {filteredAnnouncements.length === 0 ? (
            <SpotlightCard className="rounded-2xl border border-gray-200 dark:border-[#3d4951] bg-white dark:bg-transparent p-12 text-center" spotlightColor="rgba(217, 162, 153, 0.2)">
              <div className="w-16 h-16 bg-gray-50 dark:bg-[#0b090a] rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-gray-400 dark:text-[#b1a7a6]/70" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 dark:text-white mb-2">
                {announcements.length === 0 ? 'No announcements yet' : 'No matching announcements'}
              </h3>
              <p className="text-gray-400 dark:text-[#b1a7a6]">
                {announcements.length === 0
                  ? 'Create your first announcement to display on department TVs.'
                  : 'Try a different search or visibility filter.'}
              </p>
            </SpotlightCard>
          ) : (
            filteredAnnouncements.map((announcement) => (
              <motion.div
                key={announcement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951] overflow-hidden transition-all hover:border-indigo-400 dark:hover:border-red-400/30 ${
                  !announcement.is_active && 'opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row">
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
                  <div className={`flex w-full flex-shrink-0 items-center justify-start gap-2 border-b border-gray-200 px-4 py-3 sm:w-24 sm:flex-col sm:justify-center sm:border-b-0 sm:border-r sm:px-2 sm:py-5 dark:border-[#3d4951] ${
                    announcement.is_active 
                      ? announcement.priority === 'high' 
                        ? 'bg-red-500/10' 
                        : announcement.priority === 'medium'
                        ? 'bg-amber-500/10'
                        : 'bg-emerald-500/10'
                      : 'bg-gray-50 dark:bg-[#0b090a]'
                  }`}>
                    <div className={`p-2.5 rounded-lg ${
                      announcement.is_active 
                        ? announcement.priority === 'high' 
                          ? 'bg-red-500/20' 
                          : announcement.priority === 'medium'
                          ? 'bg-amber-500/20'
                          : 'bg-emerald-500/20'
                        : 'bg-gray-50 dark:bg-[#3d4951]/30'
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
                        : 'text-gray-400 dark:text-[#b1a7a6]/70'
                    }`}>
                      {announcement.priority}
                    </span>
                  </div>
                  
                  {/* Main Content Area */}
                  <div className="flex-1 p-5">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-700 dark:text-white">
                            {announcement.title}
                          </h3>
                          {!announcement.is_active && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-50 dark:bg-[#3d4951]/30 text-gray-400 dark:text-[#b1a7a6]">
                              INACTIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center flex-wrap gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${getTypeBadge(announcement.type)}`}>
                            {formatType(announcement.type)}
                          </span>
                          {announcement.course_code && (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-600/20 text-[#e5383b] border border-red-400/30">
                              {announcement.course_code}
                            </span>
                          )}
                          {announcement.target && announcement.target !== 'all' && (
                            <span className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-300">
                              📺 {announcement.target}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 self-end sm:self-start">
                        <button
                          onClick={() => handleToggleActive(announcement.id, announcement.is_active)}
                          className={`p-2 rounded-lg transition-colors ${
                            announcement.is_active 
                              ? 'text-emerald-400 hover:bg-emerald-500/10' 
                              : 'text-slate-400 hover:bg-slate-100 dark:text-white/40 dark:hover:bg-white/5'
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
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-[#d3d3d3] dark:hover:bg-[#d3d3d3]/10"
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
                    
                    <p className="text-gray-400 dark:text-[#b1a7a6] text-sm mb-4 line-clamp-2">
                      {announcement.content}
                    </p>
                    
                    <div className="flex items-center gap-6 text-xs text-gray-400 dark:text-[#b1a7a6]/70">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Created: {new Date(announcement.created_at).toLocaleDateString()}
                      </span>
                      {announcement.scheduled_date && (
                        <span className="flex items-center gap-1.5 text-indigo-500 dark:text-[#d3d3d3] font-medium">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Scheduled: {new Date(announcement.scheduled_date).toLocaleDateString()}
                        </span>
                      )}
                      {announcement.created_by && (
                        <span className="text-gray-400 dark:text-[#b1a7a6]/50">by {announcement.created_by}</span>
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
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-[#3d4951] dark:bg-[#111418]">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#d7a928]" />
                <h2 className="font-bold text-slate-900 dark:text-white">Ticker queue</h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-[#b1a7a6]">
                {activeTicker} active of {tickerItems.length} messages, displayed in sort order.
              </p>
            </div>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              onClick={() => setShowTickerForm(true)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0f2947] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#163a61] focus:outline-none focus:ring-4 focus:ring-[#0f2947]/15"
            >
              <Zap className="w-4 h-4" />
              New Ticker Item
            </motion.button>
          </div>

          {filteredTickerItems.length === 0 ? (
            <SpotlightCard className="rounded-2xl border border-gray-200 dark:border-[#3d4951] bg-white dark:bg-transparent p-12 text-center" spotlightColor="rgba(217, 162, 153, 0.2)">
              <Zap className="w-12 h-12 text-gray-400 dark:text-[#b1a7a6]/70 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 dark:text-white mb-2">
                {tickerItems.length === 0 ? 'No ticker items yet' : 'No matching ticker items'}
              </h3>
              <p className="text-gray-400 dark:text-[#b1a7a6]">
                {tickerItems.length === 0
                  ? 'Add ticker items that scroll at the bottom of the TV display.'
                  : 'Try a different search or visibility filter.'}
              </p>
            </SpotlightCard>
          ) : (
            filteredTickerItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951] p-5 transition-all hover:border-indigo-400 dark:hover:border-red-400/30 ${
                  !item.is_active && 'opacity-60'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300">
                        {item.label}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${getTypeBadge(item.type)}`}>
                        {formatType(item.type)}
                      </span>
                      {item.course_code && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-600/20 text-[#e5383b] border border-red-400/30">
                          {item.course_code}
                        </span>
                      )}
                      {item.target && item.target !== 'all' && (
                        <span className="rounded border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-bold text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-300">
                          📺 {item.target}
                        </span>
                      )}
                      {!item.is_active && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-50 dark:bg-[#3d4951]/30 text-gray-400 dark:text-[#b1a7a6]">
                          INACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 dark:text-white font-medium">{item.text}</p>
                    <p className="text-xs text-gray-400 dark:text-[#b1a7a6]/50 mt-2">Sort order: {item.sort_order}</p>
                  </div>
                  <div className="flex items-center gap-1 self-end sm:self-start">
                    <button
                      onClick={() => handleToggleTicker(item.id, item.is_active)}
                      className={`p-2 rounded-lg transition-colors ${item.is_active ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-100 dark:text-white/40 dark:hover:bg-white/5'}`}
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
                    <button onClick={() => handleEditTicker(item)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-[#d3d3d3] dark:hover:bg-[#d3d3d3]/10" title="Edit">
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
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-[#3d4951] dark:bg-[#111418]">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#0b7f72]" />
                <h2 className="font-bold text-slate-900 dark:text-white">Events carousel</h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-[#b1a7a6]">
                {activeEvents} active of {eventItems.length} event slides available to the displays.
              </p>
            </div>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              onClick={() => setShowEventForm(true)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0f2947] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#163a61] focus:outline-none focus:ring-4 focus:ring-[#0f2947]/15"
            >
              <Calendar className="w-4 h-4" />
              New Event
            </motion.button>
          </div>

          {filteredEvents.length === 0 ? (
            <SpotlightCard className="rounded-2xl border border-gray-200 dark:border-[#3d4951] bg-white dark:bg-transparent p-12 text-center" spotlightColor="rgba(217, 162, 153, 0.2)">
              <Calendar className="w-12 h-12 text-gray-400 dark:text-[#b1a7a6]/70 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 dark:text-white mb-2">
                {eventItems.length === 0 ? 'No events yet' : 'No matching events'}
              </h3>
              <p className="text-gray-400 dark:text-[#b1a7a6]">
                {eventItems.length === 0
                  ? 'Create events to show on the TV display info board.'
                  : 'Try a different search or visibility filter.'}
              </p>
            </SpotlightCard>
          ) : (
            filteredEvents.map((ev) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951] p-5 transition-all hover:border-indigo-400 dark:hover:border-red-400/30 ${
                  !ev.is_active && 'opacity-60'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-700 dark:text-white">{ev.title}</h3>
                      {ev.badge_text && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30">
                          {ev.badge_text}
                        </span>
                      )}
                      {ev.target && ev.target !== 'all' && (
                        <span className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-300">
                          📺 {ev.target}
                        </span>
                      )}
                      {!ev.is_active && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-50 dark:bg-[#3d4951]/30 text-gray-400 dark:text-[#b1a7a6]">INACTIVE</span>
                      )}
                    </div>
                    {ev.subtitle && <p className="text-sm text-gray-400 dark:text-[#b1a7a6] mb-1">{ev.subtitle}</p>}
                    {ev.description && <p className="text-sm text-gray-400 dark:text-[#b1a7a6] line-clamp-2 mb-2">{ev.description}</p>}
                    <div className="flex items-center flex-wrap gap-3 text-xs text-gray-400 dark:text-[#b1a7a6]/70">
                      {ev.speaker_name && <span>Speaker: <strong className="text-gray-700 dark:text-[#d3d3d3]">{ev.speaker_name}</strong></span>}
                      {ev.event_date && <span>Date: {new Date(ev.event_date + 'T00:00:00').toLocaleDateString()}</span>}
                      {ev.event_time && <span>Time: {ev.event_time}</span>}
                      {ev.location && <span>Location: {ev.location}</span>}
                      <span>Order: {ev.display_order}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 self-end sm:self-start">
                    <button
                      onClick={() => handleToggleEvent(ev.id, ev.is_active)}
                      className={`p-2 rounded-lg transition-colors ${ev.is_active ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-100 dark:text-white/40 dark:hover:bg-white/5'}`}
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
                    <button onClick={() => handleEditEvent(ev)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-[#d3d3d3] dark:hover:bg-[#d3d3d3]/10" title="Edit">
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



      {/* ══════ TAB: TV Devices ══════ */}
      {activeTab === 'devices' && (
        <DevicesTab devices={devices} settings={settings} onReload={loadData} onNotice={notify} />
      )}
      </div>
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
          <SpotlightCard key={group.title} className="rounded-2xl border border-gray-200 dark:border-[#3d4951] bg-white dark:bg-transparent p-6" spotlightColor="rgba(217, 162, 153, 0.2)">
            <h3 className="text-lg font-bold text-gray-700 dark:text-white flex items-center gap-2 mb-5">
              <Icon className="w-5 h-5 text-indigo-500 dark:text-red-600" />
              {group.title}
            </h3>
            <div className="space-y-4">
              {group.keys.filter(k => editMap[k] !== undefined).map(key => (
                <div key={key} className="flex items-center gap-4">
                  <label className="w-48 text-sm font-medium text-gray-700 dark:text-[#d3d3d3] flex-shrink-0">
                    {labelMap[key] || key}
                  </label>
                  <input
                    type="text"
                    value={editMap[key] || ''}
                    onChange={(e) => setEditMap({ ...editMap, [key]: e.target.value })}
                    className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
                  />
                  <button
                    onClick={() => handleSave(key)}
                    disabled={savingKey === key}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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


// ══════════════════════════════════════
// Devices Tab Component
// ══════════════════════════════════════

function DevicesTab({
  devices,
  settings,
  onReload,
  onNotice,
}: {
  devices: CmsTvDevice[];
  settings: Record<string, string>;
  onReload: () => Promise<void>;
  onNotice: (notice: UiNotice) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', label: '', location: '' });

  const getDeviceSectionEnabled = (
    deviceName: string,
    section: 'events' | 'ticker' | 'headlines'
  ) => {
    const value = settings[`tv_show_${section}_${deviceName}`];
    if (!value) return true;
    return value !== 'false' && value !== '0';
  };

  const handleToggleDeviceSection = async (
    deviceName: string,
    section: 'events' | 'ticker' | 'headlines',
    currentValue: boolean
  ) => {
    await upsertSetting(`tv_show_${section}_${deviceName}`, (!currentValue).toString());
    await onReload();
  };

  const resetForm = () => {
    setFormData({ name: '', label: '', location: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wasEditing = Boolean(editingId);
    setSaving(true);
    try {
      if (editingId) {
        const res = await updateDevice(editingId, {
          name: formData.name,
          label: formData.label || null,
          location: formData.location || null,
        });
        if (!res.success) {
          onNotice({ tone: 'error', title: 'Device was not updated', message: res.error });
          return;
        }
      } else {
        const res = await createDevice({
          name: formData.name,
          label: formData.label || undefined,
          location: formData.location || undefined,
        });
        if (!res.success) {
          onNotice({ tone: 'error', title: 'Device was not added', message: res.error });
          return;
        }
      }
      resetForm();
      await onReload();
      onNotice({ tone: 'success', title: wasEditing ? 'Device updated' : 'Device added', message: 'The screen registry is now up to date.' });
    } catch (err) {
      console.error('Failed to save device:', err);
      onNotice({ tone: 'error', title: 'Device was not saved', message: 'Check your connection and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (d: CmsTvDevice) => {
    setFormData({ name: d.name, label: d.label || '', location: d.location || '' });
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this TV device? Content targeting it will need to be updated.')) {
      await deleteDevice(id);
      await onReload();
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await toggleDevice(id, !isActive);
    await onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-[#3d4951] dark:bg-[#111418]">
        <div>
          <div className="flex items-center gap-2">
            <Tv className="h-4 w-4 text-[#0b7f72]" />
            <h2 className="font-bold text-slate-900 dark:text-white">Screen registry</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-[#b1a7a6]">
            {devices.filter((device) => device.is_active).length} active of {devices.length} registered screens. Configure content visibility and room schedules per device.
          </p>
        </div>
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ y: 0 }}
          onClick={() => setShowForm(true)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0f2947] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#163a61] focus:outline-none focus:ring-4 focus:ring-[#0f2947]/15"
        >
          <Plus className="w-4 h-4" />
          Add TV Device
        </motion.button>
      </div>

      {/* Global Layout Sizing Config */}
      <LayoutConfigPanel devices={devices} settings={settings} onReload={onReload} onNotice={onNotice} />

      {/* Device form modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#161a1d] rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-[#3d4951]"
            >
              <div className="p-6 border-b border-gray-200 dark:border-[#3d4951]">
                <h2 className="text-xl font-bold text-gray-700 dark:text-white">
                  {editingId ? 'Edit TV Device' : 'Add New TV Device'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Device Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                    placeholder="e.g., TV3"
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all font-mono"
                    required
                  />
                  <p className="text-xs text-gray-400 dark:text-[#b1a7a6] mt-1">Unique identifier (uppercase, no spaces)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Label</label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="e.g., Seminar Room TV"
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#d3d3d3] mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., 3rd Floor Corridor"
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#b1a7a6]/60 focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-[#3d4951]">
                  <button type="button" onClick={resetForm} className="flex-1 px-4 py-3 border border-gray-200 dark:border-[#3d4951] rounded-lg text-gray-700 dark:text-[#d3d3d3] hover:bg-gray-50 dark:hover:bg-[#0b090a] font-medium transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                    {saving ? 'Saving...' : editingId ? 'Update' : 'Add Device'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Device list */}
      {devices.length === 0 ? (
        <SpotlightCard className="rounded-2xl border border-gray-200 dark:border-[#3d4951] bg-white dark:bg-transparent p-12 text-center" spotlightColor="rgba(217, 162, 153, 0.2)">
          <Tv className="w-12 h-12 text-gray-400 dark:text-[#b1a7a6]/70 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 dark:text-white mb-2">No TV Devices</h3>
          <p className="text-gray-400 dark:text-[#b1a7a6]">Add TV devices to target content to specific screens</p>
        </SpotlightCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {devices.map((device) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#0b7f72]/50 hover:shadow-md dark:border-[#3d4951] dark:bg-[#161a1d] dark:hover:border-[#0b7f72]/60 ${
                !device.is_active && 'opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    device.is_active
                      ? 'bg-slate-800'
                      : 'bg-gray-50 dark:bg-[#3d4951]/30'
                  }`}>
                    <Tv className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-700 dark:text-white font-mono">{device.name}</h3>
                    {device.label && <p className="text-sm text-gray-400 dark:text-[#b1a7a6]">{device.label}</p>}
                  </div>
                </div>
                {!device.is_active && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-50 dark:bg-[#3d4951]/30 text-gray-400 dark:text-[#b1a7a6]">
                    INACTIVE
                  </span>
                )}
              </div>

              {device.location && (
                <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-[#b1a7a6] mb-4">
                  <MapPin className="w-4 h-4" />
                  {device.location}
                </div>
              )}

              {/* Room Schedule Toggle */}
              <div className="flex items-center justify-between mb-4 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#3d4951] bg-white/50 dark:bg-[#0b090a]/50">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400 dark:text-[#b1a7a6]" />
                  <span className="text-sm text-gray-700 dark:text-[#d3d3d3]">Room Schedule</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={device.show_room_schedule}
                  aria-label={`Show room schedule on ${device.name}`}
                  onClick={async () => {
                    await toggleDeviceRoomSchedule(device.id, !device.show_room_schedule);
                    await onReload();
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    device.show_room_schedule
                      ? 'bg-emerald-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    device.show_room_schedule ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="mb-4 px-3 py-3 rounded-lg border border-gray-200 dark:border-[#3d4951] bg-white/50 dark:bg-[#0b090a]/50 space-y-2.5">
                <p className="text-xs font-medium text-gray-400 dark:text-[#b1a7a6] uppercase tracking-wide">
                  Display Content
                </p>

                {(['events', 'ticker', 'headlines'] as const).map((section) => {
                  const enabled = getDeviceSectionEnabled(device.name, section);
                  const label = section === 'events' ? 'Events Panel' : section === 'ticker' ? 'Ticker Bar' : 'Headlines Bar';

                  return (
                    <div key={section} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-[#d3d3d3]">{label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={`${enabled ? 'Hide' : 'Show'} ${label} on ${device.name}`}
                        onClick={async () => {
                          await handleToggleDeviceSection(device.name, section, enabled);
                        }}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                          enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            enabled ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>



              <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-[#3d4951]">
                <button
                  onClick={() => handleToggle(device.id, device.is_active)}
                  className={`p-2 rounded-lg transition-colors ${device.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-400 dark:text-white/40 hover:bg-white/5'}`}
                  title={device.is_active ? 'Deactivate' : 'Activate'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {device.is_active ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
                    )}
                  </svg>
                </button>
                <button onClick={() => handleEdit(device)} className="p-2 rounded-lg text-gray-400 dark:text-[#d3d3d3] hover:bg-gray-50 dark:hover:bg-[#d3d3d3]/10 transition-colors" title="Edit">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={() => handleDelete(device.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
// Layout Configuration Panel Component
// ══════════════════════════════════════

function LayoutConfigPanel({
  devices,
  settings,
  onReload,
  onNotice,
}: {
  devices: CmsTvDevice[];
  settings: Record<string, string>;
  onReload: () => Promise<void>;
  onNotice: (notice: UiNotice) => void;
}) {
  const [target, setTarget] = useState<string>('all');
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Device values inherit global defaults before falling back to code defaults.
  const inheritedSetting = (key: string, fallback: number) =>
    parseInt(
      settings[`${key}_${target}`] ||
      (target === 'all' ? '' : settings[`${key}_all`]) ||
      String(fallback),
      10,
    );
  const eventsFlex = inheritedSetting('events_flex', DEFAULT_LAYOUT.events_flex);
  const currentFlex = inheritedSetting('current_flex', DEFAULT_LAYOUT.current_flex);
  const tickerHeight = inheritedSetting('ticker_height', DEFAULT_LAYOUT.ticker_height);
  const headlinesHeight = inheritedSetting('headlines_height', DEFAULT_LAYOUT.headlines_height);
  const breakingHeight = inheritedSetting('breaking_height', DEFAULT_LAYOUT.breaking_height);

  const [localEvents, setLocalEvents] = useState(eventsFlex);
  const [localCurrent, setLocalCurrent] = useState(currentFlex);
  const [localTicker, setLocalTicker] = useState(tickerHeight);
  const [localHeadlines, setLocalHeadlines] = useState(headlinesHeight);
  const [localBreaking, setLocalBreaking] = useState(breakingHeight);

  // Sync state when settings or target changes
  useEffect(() => {
    setLocalEvents(eventsFlex);
    setLocalCurrent(currentFlex);
    setLocalTicker(tickerHeight);
    setLocalHeadlines(headlinesHeight);
    setLocalBreaking(breakingHeight);
  }, [target, eventsFlex, currentFlex, tickerHeight, headlinesHeight, breakingHeight, settings]);

  const scheduleFlex = 100 - localEvents;
  const upcomingFlex = 100 - localCurrent;

  const isDefault =
    localEvents === DEFAULT_LAYOUT.events_flex &&
    localCurrent === DEFAULT_LAYOUT.current_flex &&
    localTicker === DEFAULT_LAYOUT.ticker_height &&
    localHeadlines === DEFAULT_LAYOUT.headlines_height &&
    localBreaking === DEFAULT_LAYOUT.breaking_height;

  const hasChanges =
    localEvents !== eventsFlex ||
    localCurrent !== currentFlex ||
    localTicker !== tickerHeight ||
    localHeadlines !== headlinesHeight ||
    localBreaking !== breakingHeight;

  const handleSave = async () => {
    setSaving(true);
    try {
      const layout: LayoutSettings = {
        events_flex: localEvents,
        schedule_flex: scheduleFlex,
        current_flex: localCurrent,
        upcoming_flex: upcomingFlex,
        ticker_height: localTicker,
        headlines_height: localHeadlines,
        breaking_height: localBreaking,
      };
      const res = await upsertLayoutSettings(target, layout);
      if (!res.success) {
        onNotice({ tone: 'error', title: 'Layout was not saved', message: res.error || 'Check your connection and try again.' });
        return;
      }
      await onReload();
      onNotice({ tone: 'success', title: 'Layout configuration saved', message: `${getTargetLabel()} will use the new sizing values.` });
    } catch (err) {
      console.error('Failed to save layout:', err);
      onNotice({ tone: 'error', title: 'Layout was not saved', message: 'Check your connection and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setLocalEvents(DEFAULT_LAYOUT.events_flex);
    setLocalCurrent(DEFAULT_LAYOUT.current_flex);
    setLocalTicker(DEFAULT_LAYOUT.ticker_height);
    setLocalHeadlines(DEFAULT_LAYOUT.headlines_height);
    setLocalBreaking(DEFAULT_LAYOUT.breaking_height);
    setSaving(true);
    try {
      await upsertLayoutSettings(target, DEFAULT_LAYOUT);
      await onReload();
      onNotice({ tone: 'success', title: 'Layout defaults restored', message: `${getTargetLabel()} is using the standard proportions.` });
    } catch (err) {
      console.error('Failed to reset layout:', err);
      onNotice({ tone: 'error', title: 'Defaults could not be restored', message: 'Check your connection and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const getTargetLabel = () => {
    if (target === 'all') return 'All TVs (Global Defaults)';
    const dev = devices.find((d) => d.name === target);
    return dev ? `${dev.name} ${dev.label ? `(${dev.label})` : ''}` : target;
  };

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 dark:border-[#3d4951] bg-white dark:bg-transparent overflow-hidden shadow-sm backdrop-blur-md">
      {/* Header / Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 dark:hover:bg-[#161a1d]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-5 h-5 text-indigo-500 dark:text-red-600" />
          <div className="text-left">
            <span className="text-sm font-bold text-gray-700 dark:text-white">
              Layout Sizing Configuration ({target === 'all' ? 'Global' : target})
            </span>
            <p className="text-xs text-gray-400 dark:text-[#b1a7a6]">
              Resize Events, Schedule, Ticker, Headlines, and Breaking News per TV or globally
            </p>
          </div>
          {!isDefault && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-red-500/20 text-indigo-600 dark:text-red-400">
              CUSTOM
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable Content */}
      {expanded && (
        <div className="px-6 pb-6 space-y-5 border-t border-gray-200 dark:border-[#3d4951] pt-6">
          {/* Target TV Selector */}
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#161a1d] p-3 rounded-xl border border-gray-200 dark:border-[#3d4951] max-w-sm">
            <label className="text-xs font-bold text-gray-500 dark:text-[#b1a7a6] whitespace-nowrap">
              Configure Target:
            </label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-400 focus:border-transparent transition-all outline-none"
            >
              <option value="all">All TVs (Global Defaults)</option>
              {devices.map((dev) => (
                <option key={dev.id} value={dev.name}>
                  {dev.name} {dev.label ? `(${dev.label})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Events vs Schedule Width */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 dark:text-[#b1a7a6]">
                  Events Panel Width
                </label>
                <span className="text-xs font-mono font-bold text-indigo-500 dark:text-red-400">
                  {localEvents}% / {scheduleFlex}%
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={90}
                value={localEvents}
                onChange={(e) => setLocalEvents(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-indigo-500 dark:accent-red-600"
                style={{ background: `linear-gradient(to right, #6366f1 ${localEvents}%, #e5e7eb ${localEvents}%)` }}
              />
              {/* Preview bar */}
              <div className="flex rounded-lg overflow-hidden h-4 border border-gray-200 dark:border-[#3d4951]">
                <div
                  className="flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ width: `${localEvents}%`, background: '#091428' }}
                >
                  Events ({localEvents}%)
                </div>
                <div
                  className="flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ width: `${scheduleFlex}%`, background: '#00796b' }}
                >
                  Schedule ({scheduleFlex}%)
                </div>
              </div>
            </div>

            {/* Current vs Upcoming Height */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 dark:text-[#b1a7a6]">
                  Current Period Height
                </label>
                <span className="text-xs font-mono font-bold text-emerald-500 dark:text-emerald-400">
                  {localCurrent}% / {upcomingFlex}%
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={80}
                value={localCurrent}
                onChange={(e) => setLocalCurrent(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-emerald-500"
                style={{ background: `linear-gradient(to right, #10b981 ${localCurrent}%, #e5e7eb ${localCurrent}%)` }}
              />
              {/* Preview bar */}
              <div className="flex rounded-lg overflow-hidden h-4 border border-gray-200 dark:border-[#3d4951]">
                <div
                  className="flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ width: `${localCurrent}%`, background: '#004d40' }}
                >
                  NOW ({localCurrent}%)
                </div>
                <div
                  className="flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ width: `${upcomingFlex}%`, background: '#132e4f' }}
                >
                  Upcoming ({upcomingFlex}%)
                </div>
              </div>
            </div>

            {/* Ticker Bar Height */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 dark:text-[#b1a7a6]">
                  Ticker Bar Height
                </label>
                <span className="text-xs font-mono font-bold text-teal-500 dark:text-teal-400">
                  {localTicker}px
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={80}
                value={localTicker}
                onChange={(e) => setLocalTicker(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-teal-500"
                style={{ background: `linear-gradient(to right, #00796b ${((localTicker - 20) / 60) * 100}%, #e5e7eb ${((localTicker - 20) / 60) * 100}%)` }}
              />
              {/* Visual preview slot */}
              <div 
                className="rounded-lg flex items-center justify-center text-[9px] font-bold text-white border border-gray-200 dark:border-[#3d4951] transition-all"
                style={{ height: `${Math.max(16, localTicker * 0.6)}px`, background: 'linear-gradient(135deg, #00796b, #004d40)' }}
              >
                Ticker Preview ({localTicker}px)
              </div>
            </div>

            {/* Headlines Bar Height */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 dark:text-[#b1a7a6]">
                  Headlines Bar Height
                </label>
                <span className="text-xs font-mono font-bold text-amber-500 dark:text-amber-400">
                  {localHeadlines}px
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={80}
                value={localHeadlines}
                onChange={(e) => setLocalHeadlines(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500"
                style={{ background: `linear-gradient(to right, #d97706 ${((localHeadlines - 20) / 60) * 100}%, #e5e7eb ${((localHeadlines - 20) / 60) * 100}%)` }}
              />
              {/* Visual preview slot */}
              <div 
                className="rounded-lg flex items-center justify-center text-[9px] font-bold text-[#091428] border border-gray-200 dark:border-[#3d4951] transition-all"
                style={{ height: `${Math.max(16, localHeadlines * 0.6)}px`, background: 'linear-gradient(135deg, #ffc107, #ffb300)' }}
              >
                Headlines Preview ({localHeadlines}px)
              </div>
            </div>

            {/* Breaking News Height */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 dark:text-[#b1a7a6]">
                  Breaking News Height
                </label>
                <span className="text-xs font-mono font-bold text-rose-500 dark:text-rose-400">
                  {localBreaking}px
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={120}
                value={localBreaking}
                onChange={(e) => setLocalBreaking(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-rose-500"
                style={{ background: `linear-gradient(to right, #f43f5e ${((localBreaking - 30) / 90) * 100}%, #e5e7eb ${((localBreaking - 30) / 90) * 100}%)` }}
              />
              {/* Visual preview slot */}
              <div 
                className="rounded-lg flex items-center justify-center text-[9px] font-bold text-white border border-rose-300 dark:border-rose-900/40 transition-all animate-breaking-pulse"
                style={{ height: `${Math.max(16, localBreaking * 0.6)}px`, background: 'linear-gradient(135deg, #e11d48, #be123c)' }}
              >
                Breaking Preview ({localBreaking}px)
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-[#3d4951]/50">
            <button
              onClick={handleReset}
              disabled={saving || isDefault}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-[#3d4951] text-gray-500 dark:text-[#b1a7a6] hover:bg-gray-50 dark:hover:bg-[#161a1d] rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
              title="Reset to defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center justify-center gap-1.5 px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : `Save Layout Configuration`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
