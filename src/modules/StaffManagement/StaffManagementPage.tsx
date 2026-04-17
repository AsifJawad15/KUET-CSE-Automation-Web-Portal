"use client";

import { addStaff, deactivateStaff, getAllStaffs, setStaffAdmin } from '@/services/staffService';
import type { StaffWithAuth } from '@/types/database';
import { AlertCircle, Loader2, ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export default function StaffManagementPage() {
  const [staffs, setStaffs] = useState<StaffWithAuth[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    designation: 'Administrative Staff',
    is_admin: true,
  });

  useEffect(() => {
    void loadStaffs();
  }, []);

  async function loadStaffs() {
    setLoading(true);
    setStaffs(await getAllStaffs());
    setLoading(false);
  }

  const filteredStaffs = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return staffs;
    return staffs.filter((staff) =>
      staff.full_name.toLowerCase().includes(needle) ||
      staff.profile.email.toLowerCase().includes(needle) ||
      staff.designation.toLowerCase().includes(needle)
    );
  }, [searchTerm, staffs]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await addStaff(formData);
    if (result.success) {
      if (result.generatedPassword) {
        await navigator.clipboard.writeText(result.generatedPassword).catch(() => {});
        setSuccess(`Staff added. Temporary password copied: ${result.generatedPassword}`);
      } else {
        setSuccess('Staff added successfully.');
      }
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        designation: 'Administrative Staff',
        is_admin: true,
      });
      setShowForm(false);
      await loadStaffs();
    } else {
      setError(result.error || 'Failed to add staff');
    }

    setLoading(false);
  }

  async function handleAdminToggle(staff: StaffWithAuth) {
    const next = !staff.is_admin;
    const message = next
      ? `Allow ${staff.full_name} to login and manage the portal as admin?`
      : `Remove admin access for ${staff.full_name}?`;
    if (!confirm(message)) return;

    setLoading(true);
    const result = await setStaffAdmin(staff.user_id, next);
    if (result.success) {
      setSuccess(next ? 'Admin access granted.' : 'Admin access removed.');
      await loadStaffs();
    } else {
      setError(result.error || 'Failed to update admin access');
    }
    setLoading(false);
  }

  async function handleDeactivate(staff: StaffWithAuth) {
    if (!confirm(`Deactivate ${staff.full_name}?`)) return;
    setLoading(true);
    const result = await deactivateStaff(staff.user_id);
    if (result.success) {
      setSuccess('Staff account deactivated.');
      await loadStaffs();
    } else {
      setError(result.error || 'Failed to deactivate staff');
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff & Admin Access</h1>
          <p className="mt-1 text-sm text-gray-500">
            Add department staff and grant admin access only when needed.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
        >
          <UserPlus className="h-4 w-4" />
          Add Staff
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
              <input
                value={formData.full_name}
                onChange={(event) => setFormData({ ...formData, full_name: event.target.value })}
                className="input-primary"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                className="input-primary"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <input
                value={formData.phone}
                onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                className="input-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Designation</label>
              <input
                value={formData.designation}
                onChange={(event) => setFormData({ ...formData, designation: event.target.value })}
                className="input-primary"
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={formData.is_admin}
                onChange={(event) => setFormData({ ...formData, is_admin: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              Allow this staff member to login as admin
            </label>
            <div className="flex justify-end gap-3 md:col-span-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Staff
              </button>
            </div>
          </form>
        </div>
      )}

      <input
        type="text"
        placeholder="Search staff..."
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        className="input-primary max-w-md"
      />

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[760px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Email</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Designation</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Access</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading && staffs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-500">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </td>
              </tr>
            ) : filteredStaffs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">
                  No staff accounts found.
                </td>
              </tr>
            ) : filteredStaffs.map((staff) => (
              <tr key={staff.user_id}>
                <td className="px-5 py-4 text-sm font-semibold text-gray-900">{staff.full_name}</td>
                <td className="px-5 py-4 text-sm text-gray-600">{staff.profile.email}</td>
                <td className="px-5 py-4 text-sm text-gray-600">{staff.designation}</td>
                <td className="px-5 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    staff.is_admin
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {staff.is_admin ? 'Admin' : 'Staff'}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-gray-600">
                  {staff.profile.is_active ? 'Active' : 'Inactive'}
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAdminToggle(staff)}
                      disabled={loading || !staff.profile.is_active}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
                    >
                      {staff.is_admin ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      {staff.is_admin ? 'Remove Admin' : 'Make Admin'}
                    </button>
                    <button
                      onClick={() => handleDeactivate(staff)}
                      disabled={loading || !staff.profile.is_active}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
