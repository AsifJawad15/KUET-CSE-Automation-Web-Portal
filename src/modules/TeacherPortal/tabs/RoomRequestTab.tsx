"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { requestRoom, getMyRoomRequests, getRoomAvailability, getMyCourses, type RoomRequest, type RoomAvailabilitySlot, type TeacherCourse } from '@/services/teacherPortalService';
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
  const today = new Date().toISOString().split('T')[0];
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [requests, setRequests] = useState<RoomRequest[]>([]);
  const [rooms, setRooms] = useState<DBRoom[]>([]);
  const [availableSlots, setAvailableSlots] = useState<RoomAvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    offering_id: '',
    room_number: '',
    date: today,
    start_time: '',
    end_time: '',
    purpose: '',
  });

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const [reqs, roomList, myCourses] = await Promise.all([
      getMyRoomRequests(user.id),
      getAllRooms(),
      getMyCourses(user.id),
    ]);
    setRequests(reqs);
    setRooms(roomList.filter(r => r.is_active));
    setCourses(myCourses);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedCourse = courses.find((course) => course.offering_id === form.offering_id);
    if (!form.offering_id || !form.room_number || !form.purpose || !selectedCourse) return;
    setSaving(true);
    setMessage(null);

    const result = await requestRoom({
      ...form,
      course_code: selectedCourse.course_code,
      course_title: selectedCourse.course_title,
      section: selectedCourse.section,
      teacher_user_id: user?.id,
      teacher_name: user?.name,
    });

    setSaving(false);
    if (result.success) {
      setMessage({ type: 'success', text: 'Room request submitted' });
      setForm({ offering_id: '', room_number: '', date: today, start_time: '', end_time: '', purpose: '' });
      setAvailableSlots([]);
      setShowForm(false);
      loadData();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to submit request' });
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (!showForm || !form.room_number || !form.date) {
      setAvailableSlots([]);
      return;
    }

    let cancelled = false;

    const loadAvailability = async () => {
      setLoadingSlots(true);
      const slots = await getRoomAvailability(form.room_number, form.date);
      if (cancelled) return;

      setAvailableSlots(slots);
      setForm((prev) => {
        const selectedStillValid = slots.some((slot) => (
          slot.start_time === prev.start_time && slot.end_time === prev.end_time
        ));

        if (selectedStillValid) return prev;

        const firstSlot = slots[0];
        return {
          ...prev,
          start_time: firstSlot?.start_time || '',
          end_time: firstSlot?.end_time || '',
        };
      });
      setLoadingSlots(false);
    };

    loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [showForm, form.room_number, form.date]);

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#3d4951] bg-white dark:bg-[#0b090a] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:focus:ring-red-400';

  const selectedSlotValue = form.start_time && form.end_time
    ? `${form.start_time}|${form.end_time}`
    : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 dark:text-white">Room Requests</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-gray-600 dark:bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-[#4E342E] dark:hover:bg-[#e5383b] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 dark:text-[#b1a7a6] mb-1">Course *</label>
              <select value={form.offering_id} onChange={e => updateField('offering_id', e.target.value)} className={inputClass} required>
                <option value="">Select a course</option>
                {courses.map(course => (
                  <option key={course.offering_id} value={course.offering_id}>
                    {course.course_code} - {course.course_title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 dark:text-[#b1a7a6] mb-1">Room *</label>
              <select value={form.room_number} onChange={e => updateField('room_number', e.target.value)} className={inputClass} required>
                <option value="">Select a room</option>
                {rooms.map(r => (
                  <option key={r.room_number} value={r.room_number}>
                    {r.room_number} ({r.room_type || 'room'}{r.capacity ? `, ${r.capacity} seats` : ''})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-400 dark:text-[#b1a7a6] mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => updateField('date', e.target.value)} className={inputClass} required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 dark:text-[#b1a7a6] mb-1">Available Time Slot *</label>
            <select
              value={selectedSlotValue}
              onChange={(e) => {
                const [start_time, end_time] = e.target.value.split('|');
                setForm(prev => ({ ...prev, start_time, end_time }));
              }}
              className={inputClass}
              disabled={!form.room_number || !form.date || loadingSlots || availableSlots.length === 0}
              required
            >
              <option value="">
                {loadingSlots ? 'Loading available slots...' : 'Select a free slot'}
              </option>
              {availableSlots.map((slot) => (
                <option key={`${slot.start_time}-${slot.end_time}`} value={`${slot.start_time}|${slot.end_time}`}>
                  {slot.label}
                </option>
              ))}
            </select>
            {!loadingSlots && form.room_number && form.date && availableSlots.length === 0 && (
              <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                No blank slots are available for this room on the selected date.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 dark:text-[#b1a7a6] mb-1">Purpose *</label>
            <textarea value={form.purpose} onChange={e => updateField('purpose', e.target.value)} placeholder="Extra class, seminar, meeting, etc." rows={2} className={`${inputClass} resize-none`} required />
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 dark:border-[#3d4951] text-gray-700 dark:text-[#b1a7a6] rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-[#3d4951]/30 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.offering_id || !form.room_number || !form.purpose || !form.start_time || !form.end_time} className="px-4 py-2 bg-gray-600 dark:bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
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
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-[#b1a7a6]" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 p-8 text-center">
          <DoorOpen className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
          <p className="text-gray-400 dark:text-[#b1a7a6]">No room requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white">Room {r.room_number}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[r.status || 'pending']}`}>
                      {r.status || 'pending'}
                    </span>
                  </div>
                  {!!r.course_code && (
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{r.course_code}{r.course_title ? ` - ${r.course_title}` : ''}</p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-[#b1a7a6]">{r.purpose}</p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-400 dark:text-[#b1a7a6]">
                    <span>{r.date}</span>
                    <span>{r.start_time} — {r.end_time}</span>
                  </div>
                </div>
                <Clock className="w-4 h-4 text-gray-400 dark:text-[#b1a7a6]" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
