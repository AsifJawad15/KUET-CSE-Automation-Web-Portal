"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { updateMyProfile } from '@/services/teacherPortalService';
import { Loader2, AlertCircle, CheckCircle2, UserCog } from 'lucide-react';

const DESIGNATIONS = ['PROFESSOR', 'ASSOCIATE_PROFESSOR', 'ASSISTANT_PROFESSOR', 'LECTURER'] as const;

const designationLabels: Record<string, string> = {
  PROFESSOR: 'Professor',
  ASSOCIATE_PROFESSOR: 'Associate Professor',
  ASSISTANT_PROFESSOR: 'Assistant Professor',
  LECTURER: 'Lecturer',
};

export default function EditProfileTab() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.name || '',
    phone: '',
    designation: user?.designation || '',
    office_room: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSaving(true);
    setMessage(null);

    const updates: Record<string, string> = {};
    if (form.full_name.trim()) updates.full_name = form.full_name.trim();
    if (form.phone.trim()) updates.phone = form.phone.trim();
    if (form.designation) updates.designation = form.designation;
    if (form.office_room.trim()) updates.office_room = form.office_room.trim();

    if (Object.keys(updates).length === 0) {
      setMessage({ type: 'error', text: 'No changes to save' });
      setSaving(false);
      return;
    }

    const result = await updateMyProfile(user.id, updates);
    setSaving(false);

    if (result.success) {
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to update profile' });
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setMessage(null);
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#3d4951] bg-[#FAF7F3] dark:bg-[#0b090a] text-[#2C1810] dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#5D4037] dark:focus:ring-[#ba181b]';

  return (
    <div className="max-w-2xl">
      <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#5D4037] dark:bg-[#ba181b] flex items-center justify-center">
            <UserCog className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-[#2C1810] dark:text-white">Edit Profile</h3>
            <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Full Name</label>
              <input type="text" value={form.full_name} onChange={e => updateField('full_name', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="01XXXXXXXXX" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Designation</label>
              <select value={form.designation} onChange={e => updateField('designation', e.target.value)} className={inputClass}>
                <option value="">Select</option>
                {DESIGNATIONS.map(d => <option key={d} value={d}>{designationLabels[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Office Room</label>
              <input type="text" value={form.office_room} onChange={e => updateField('office_room', e.target.value)} placeholder="Room 405" className={inputClass} />
            </div>
          </div>

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

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-[#5D4037] dark:bg-[#ba181b] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#4E342E] dark:hover:bg-[#e5383b] transition-colors flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
