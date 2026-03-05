"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { requestRoom, getMyRoomRequests, type RoomRequest } from '@/services/teacherPortalService';
import { getAllRooms } from '@/services/roomService';
import type { DBRoom } from '@/types/database';
import { Plus, Loader2, AlertCircle, CheckCircle2, Clock, DoorOpen } from 'lucide-react';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function RoomRequestTab() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RoomRequest[]>([]);
  const [rooms, setRooms] = useState<DBRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    room_number: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '10:00',
    purpose: '',
  });

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const [reqs, roomList] = await Promise.all([
      getMyRoomRequests(user.id),
      getAllRooms(),
    ]);
    setRequests(reqs);
    setRooms(roomList.filter(r => r.is_active));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.room_number || !form.purpose) return;
    setSaving(true);
    setMessage(null);

    const result = await requestRoom({
      ...form,
      teacher_user_id: user?.id,
      teacher_name: user?.name,
    });

    setSaving(false);
    if (result.success) {
      setMessage({ type: 'success', text: 'Room request submitted' });
      setForm({ room_number: '', date: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '10:00', purpose: '' });
      setShowForm(false);
      loadData();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to submit request' });
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
        <h3 className="font-semibold text-[#2C1810] dark:text-white">Room Requests</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#5D4037] dark:bg-[#ba181b] text-white rounded-lg text-sm font-medium hover:bg-[#4E342E] dark:hover:bg-[#e5383b] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Room *</label>
              <select value={form.room_number} onChange={e => updateField('room_number', e.target.value)} className={inputClass} required>
                <option value="">Select a room</option>
                {rooms.map(r => (
                  <option key={r.room_number} value={r.room_number}>
                    {r.room_number} ({r.room_type || 'room'}{r.capacity ? `, ${r.capacity} seats` : ''})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => updateField('date', e.target.value)} className={inputClass} required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Start Time *</label>
              <input type="time" value={form.start_time} onChange={e => updateField('start_time', e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">End Time *</label>
              <input type="time" value={form.end_time} onChange={e => updateField('end_time', e.target.value)} className={inputClass} required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Purpose *</label>
            <textarea value={form.purpose} onChange={e => updateField('purpose', e.target.value)} placeholder="Extra class, seminar, meeting, etc." rows={2} className={`${inputClass} resize-none`} required />
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-[#DCC5B2] dark:border-[#3d4951] text-[#5D4E37] dark:text-[#b1a7a6] rounded-lg text-sm hover:bg-[#F0E4D3] dark:hover:bg-[#3d4951]/30 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.room_number || !form.purpose} className="px-4 py-2 bg-[#5D4037] dark:bg-[#ba181b] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Request
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

      {/* Requests List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#8B7355] dark:text-[#b1a7a6]" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-8 text-center">
          <DoorOpen className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
          <p className="text-[#8B7355] dark:text-[#b1a7a6]">No room requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-[#2C1810] dark:text-white">Room {r.room_number}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[r.status || 'pending']}`}>
                      {r.status || 'pending'}
                    </span>
                  </div>
                  <p className="text-sm text-[#6B5744] dark:text-[#b1a7a6]">{r.purpose}</p>
                  <div className="flex gap-3 mt-2 text-xs text-[#8B7355] dark:text-[#b1a7a6]">
                    <span>{r.date}</span>
                    <span>{r.start_time} — {r.end_time}</span>
                  </div>
                </div>
                <Clock className="w-4 h-4 text-[#8B7355] dark:text-[#b1a7a6]" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
