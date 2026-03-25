"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import {
  createAnnouncement,
  getMyAnnouncements,
  deleteAnnouncement,
  getMyCourses,
  type TeacherAnnouncement,
  type TeacherCourse,
} from '@/services/teacherPortalService';
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle2, Megaphone } from 'lucide-react';

const TYPES = ['notice', 'class-test', 'assignment', 'lab-test', 'quiz', 'event', 'other'] as const;
const PRIORITIES = ['low', 'medium', 'high'] as const;

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const typeLabels: Record<string, string> = {
  'notice': 'Notice',
  'class-test': 'Class Test',
  'assignment': 'Assignment',
  'lab-test': 'Lab Test',
  'quiz': 'Quiz',
  'event': 'Event',
  'other': 'Other',
};

export default function AnnouncementTab() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<TeacherAnnouncement[]>([]);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    title: '',
    content: '',
    type: 'notice' as typeof TYPES[number],
    course_code: '',
    priority: 'medium' as typeof PRIORITIES[number],
    scheduled_date: '',
  });

  const loadAnnouncements = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const data = await getMyAnnouncements(user.id);
    setAnnouncements(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadAnnouncements(); }, [loadAnnouncements]);

  useEffect(() => {
    if (!user?.id) return;
    getMyCourses(user.id).then(setCourses);
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) return;
    setSaving(true);
    setMessage(null);

    const result = await createAnnouncement({
      ...form,
      course_code: form.course_code || undefined,
      scheduled_date: form.scheduled_date || undefined,
      created_by: user?.id,
    });

    setSaving(false);
    if (result.success) {
      setMessage({ type: 'success', text: 'Announcement created successfully' });
      setForm({ title: '', content: '', type: 'notice', course_code: '', priority: 'medium', scheduled_date: '' });
      setShowForm(false);
      loadAnnouncements();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to create announcement' });
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteAnnouncement(id);
    if (result.success) {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#3d4951] bg-[#FAF7F3] dark:bg-[#0b090a] text-[#2C1810] dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#5D4037] dark:focus:ring-[#ba181b]';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-[#2C1810] dark:text-white">My Announcements</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#5D4037] dark:bg-[#ba181b] text-white rounded-lg text-sm font-medium hover:bg-[#4E342E] dark:hover:bg-[#e5383b] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Announcement
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Title *</label>
              <input type="text" value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="Announcement title" className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Course</label>
              <select value={form.course_code} onChange={e => updateField('course_code', e.target.value)} className={inputClass}>
                <option value="">All my students (no course filter)</option>
                {courses.map(c => (
                  <option key={c.offering_id} value={c.course_code}>
                    {c.course_code} – {c.course_title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Content *</label>
            <textarea value={form.content} onChange={e => updateField('content', e.target.value)} placeholder="Announcement details..." rows={3} className={`${inputClass} resize-none`} required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Type *</label>
              <select value={form.type} onChange={e => updateField('type', e.target.value)} className={inputClass}>
                {TYPES.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Priority</label>
              <select value={form.priority} onChange={e => updateField('priority', e.target.value)} className={inputClass}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Scheduled Date</label>
              <input type="date" value={form.scheduled_date} onChange={e => updateField('scheduled_date', e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] text-[#5D4E37] dark:text-[#b1a7a6] rounded-lg text-sm hover:bg-[#F0E4D3] dark:hover:bg-[#3d4951]/30 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.title || !form.content} className="px-4 py-2 bg-[#5D4037] dark:bg-[#ba181b] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      )}

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
          message.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Announcements List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#8B7355] dark:text-[#b1a7a6]" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-8 text-center">
          <Megaphone className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
          <p className="text-[#8B7355] dark:text-[#b1a7a6]">No announcements yet. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-[#2C1810] dark:text-white">{a.title}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[a.priority]}`}>
                      {a.priority}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#F0E4D3] dark:bg-[#0b090a] text-[#5D4E37] dark:text-[#b1a7a6]">
                      {typeLabels[a.type] || a.type}
                    </span>
                  </div>
                  <p className="text-sm text-[#6B5744] dark:text-[#b1a7a6]">{a.content}</p>
                  <div className="flex gap-3 mt-2 text-xs text-[#8B7355] dark:text-[#b1a7a6]">
                    {a.course_code && <span>Course: {a.course_code}</span>}
                    {a.scheduled_date && <span>Scheduled: {a.scheduled_date}</span>}
                    {a.created_at && <span>Created: {new Date(a.created_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <button
                  onClick={() => a.id && handleDelete(a.id)}
                  className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
