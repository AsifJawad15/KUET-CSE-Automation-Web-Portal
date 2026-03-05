"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { changePassword } from '@/services/teacherPortalService';
import { Loader2, AlertCircle, CheckCircle2, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function ChangePasswordTab() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (form.new_password !== form.confirm_password) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (form.new_password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const result = await changePassword(user.id, {
      current_password: form.current_password,
      new_password: form.new_password,
    });

    setSaving(false);
    if (result.success) {
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to change password' });
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setMessage(null);
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-[#DCC5B2] dark:border-[#3d4951] bg-[#FAF7F3] dark:bg-[#0b090a] text-[#2C1810] dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#5D4037] dark:focus:ring-[#ba181b]';

  return (
    <div className="max-w-md">
      <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#5D4037] dark:bg-[#ba181b] flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-[#2C1810] dark:text-white">Change Password</h3>
            <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">Update your login password</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Current Password *</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={form.current_password}
                onChange={e => updateField('current_password', e.target.value)}
                className={inputClass}
                required
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#8B7355] dark:text-[#b1a7a6]">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">New Password *</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={form.new_password}
                onChange={e => updateField('new_password', e.target.value)}
                className={inputClass}
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#8B7355] dark:text-[#b1a7a6]">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6] mb-1">Confirm New Password *</label>
            <input
              type="password"
              value={form.confirm_password}
              onChange={e => updateField('confirm_password', e.target.value)}
              className={inputClass}
              required
              minLength={6}
            />
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
            disabled={saving || !form.current_password || !form.new_password || !form.confirm_password}
            className="w-full px-4 py-2 bg-[#5D4037] dark:bg-[#ba181b] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#4E342E] dark:hover:bg-[#e5383b] transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Change Password
          </button>
        </form>
      </div>
    </div>
  );
}
