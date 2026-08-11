"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { DBRoom, DBRoomType, isSupabaseConfigured } from '@/lib/supabase';
import { getAllRooms, addRoom, updateRoom, deleteRoom } from '@/services/roomService';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Loader2, Trash2, Edit, Upload, MapPin, Building2, Users, FlaskConical, School, Search } from 'lucide-react';
import { FileUploadModal, roomUploadConfig } from '@/components/upload';
import { Select } from '@/components/ui/FormPicker';

export default function RoomAllocationPage() {
  const [rooms, setRooms] = useState<DBRoom[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<DBRoom | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [formData, setFormData] = useState({
    room_number: '',
    building_name: '',
    capacity: '',
    room_type: 'classroom' as DBRoomType,
    facilities: '',
    plus_code: '',
    floor_number: '',
  });

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllRooms();
      setRooms(data);
    } catch {
      setError('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const resetForm = () => {
    setFormData({
      room_number: '', building_name: '', capacity: '', room_type: 'classroom',
      facilities: '', plus_code: '', floor_number: '',
    });
    setEditingRoom(null);
    setShowForm(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const roomInput = {
        room_number: formData.room_number.trim(),
        building_name: formData.building_name.trim() || undefined,
        capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
        room_type: formData.room_type,
        facilities: formData.facilities ? formData.facilities.split(',').map(f => f.trim()).filter(Boolean) : undefined,
        plus_code: formData.plus_code.trim() || undefined,
        floor_number: formData.floor_number.trim() || undefined,
      };

      const result = editingRoom
        ? await updateRoom(editingRoom.room_number, roomInput)
        : await addRoom(roomInput);

      if (result.success) {
        await loadRooms();
        resetForm();
      } else {
        setError(result.error || 'Operation failed');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (room: DBRoom) => {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number,
      building_name: room.building_name || '',
      capacity: room.capacity?.toString() || '',
      room_type: room.room_type || 'classroom',
      facilities: room.facilities?.join(', ') || '',
      plus_code: room.plus_code || '',
      floor_number: room.floor_number || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (room_number: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;
    const result = await deleteRoom(room_number);
    if (result.success) loadRooms();
    else setError(result.error || 'Failed to delete');
  };

  const getRoomTypeIcon = (type: DBRoomType | null) => {
    switch (type) {
      case 'classroom': return <School className="w-5 h-5" />;
      case 'lab': return <FlaskConical className="w-5 h-5" />;
      case 'seminar': return <Users className="w-5 h-5" />;
      case 'research': return <FlaskConical className="w-5 h-5" />;
      default: return <Building2 className="w-5 h-5" />;
    }
  };

  const getRoomTypeBadge = (type: DBRoomType | null) => {
    switch (type) {
      case 'classroom': return 'bg-gray-600/10 text-gray-600 border-gray-300/20';
      case 'lab': return 'bg-amber-500/10 text-amber-600 border-[#8B6914]/20';
      case 'seminar': return 'bg-[#D4A574]/20 text-amber-600 border-[#D4A574]/30';
      case 'research': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const filteredRooms = rooms.filter(r => {
    const matchesType = filterType === 'all' || r.room_type === filterType;
    const matchesSearch = !searchQuery ||
      r.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.building_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const stats = {
    total: rooms.length,
    classrooms: rooms.filter(r => r.room_type === 'classroom').length,
    labs: rooms.filter(r => r.room_type === 'lab').length,
    withLocation: rooms.filter(r => r.plus_code).length,
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Supabase not configured. Please set up environment variables.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between"
          >
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700 font-bold text-lg leading-none">&times;</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => resetForm()}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-2xl border border-gray-200 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[#3E2723]">
                    {editingRoom ? 'Edit Room' : 'Add New Room'}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {editingRoom ? 'Update room details and location' : 'Enter room details and optional location info'}
                  </p>
                </div>
                <button onClick={() => resetForm()} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Basic Info Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Room Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Room Number <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={formData.room_number}
                        onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                        disabled={!!editingRoom}
                        required
                        className="w-full px-4 py-2.5 mt-1.5 border border-gray-200 rounded-xl bg-[#FEFCFA] text-[#3E2723] disabled:opacity-50 focus:ring-2 focus:ring-indigo-300 focus:border-transparent outline-none transition-all placeholder:text-[#BCAAA4]"
                        placeholder="e.g., CSE-104, 202"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Building</label>
                      <input
                        type="text"
                        value={formData.building_name}
                        onChange={(e) => setFormData({ ...formData, building_name: e.target.value })}
                        className="w-full px-4 py-2.5 mt-1.5 border border-gray-200 rounded-xl bg-[#FEFCFA] text-[#3E2723] focus:ring-2 focus:ring-indigo-300 focus:border-transparent outline-none transition-all placeholder:text-[#BCAAA4]"
                        placeholder="e.g., CSE Building"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Capacity</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.capacity}
                        onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                        className="w-full px-4 py-2.5 mt-1.5 border border-gray-200 rounded-xl bg-[#FEFCFA] text-[#3E2723] focus:ring-2 focus:ring-indigo-300 focus:border-transparent outline-none transition-all placeholder:text-[#BCAAA4]"
                        placeholder="60"
                      />
                    </div>
                    <div>
                      <Select
                        label="Room Type"
                        labelClassName="text-sm font-medium text-gray-700 normal-case mb-1.5"
                        value={formData.room_type}
                        onChange={(e) => setFormData({ ...formData, room_type: e.target.value as DBRoomType })}
                      >
                        <option value="classroom">Classroom</option>
                        <option value="lab">Lab</option>
                        <option value="seminar">Seminar</option>
                        <option value="research">Research</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Floor</label>
                      <input
                        type="text"
                        value={formData.floor_number}
                        onChange={(e) => setFormData({ ...formData, floor_number: e.target.value })}
                        className="w-full px-4 py-2.5 mt-1.5 border border-gray-200 rounded-xl bg-[#FEFCFA] text-[#3E2723] focus:ring-2 focus:ring-indigo-300 focus:border-transparent outline-none transition-all placeholder:text-[#BCAAA4]"
                        placeholder="e.g., 1st, 2nd, 5th"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Facilities (comma-separated)</label>
                      <input
                        type="text"
                        value={formData.facilities}
                        onChange={(e) => setFormData({ ...formData, facilities: e.target.value })}
                        className="w-full px-4 py-2.5 mt-1.5 border border-gray-200 rounded-xl bg-[#FEFCFA] text-[#3E2723] focus:ring-2 focus:ring-indigo-300 focus:border-transparent outline-none transition-all placeholder:text-[#BCAAA4]"
                        placeholder="Projector, AC, Whiteboard"
                      />
                    </div>
                  </div>
                </div>

                {/* Location Section */}
                <div className="pt-2">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Location Info
                  </h3>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Plus Code</label>
                    <input
                      type="text"
                      value={formData.plus_code}
                      onChange={(e) => setFormData({ ...formData, plus_code: e.target.value })}
                      className="w-full px-4 py-2.5 mt-1.5 border border-gray-200 rounded-xl bg-[#FEFCFA] text-[#3E2723] focus:ring-2 focus:ring-indigo-300 focus:border-transparent outline-none transition-all placeholder:text-[#BCAAA4]"
                      placeholder="e.g., VGX2+QJQ Khulna"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-gray-600 text-white rounded-xl font-medium hover:bg-[#4E342E] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingRoom ? 'Update Room' : 'Add Room'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#3E2723]">Room Info</h1>
          <p className="text-gray-400 mt-1 text-sm">Manage room details and location information</p>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowUpload(true)}
            className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl transition-all flex items-center gap-2 hover:bg-gray-50 text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            Upload CSV
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 bg-gray-600 text-white rounded-xl hover:bg-[#4E342E] transition-all flex items-center gap-2 shadow-md shadow-gray-600/20 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Room
          </motion.button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
            <p className="text-sm text-gray-400">Loading rooms...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SpotlightCard className="rounded-xl p-4 bg-white border border-gray-200" spotlightColor="rgba(93, 64, 55, 0.08)">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Rooms</p>
                  <p className="text-2xl font-bold text-[#3E2723] mt-1">{stats.total}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gray-600/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            </SpotlightCard>
            <SpotlightCard className="rounded-xl p-4 bg-white border border-gray-200" spotlightColor="rgba(93, 64, 55, 0.08)">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Classrooms</p>
                  <p className="text-2xl font-bold text-[#3E2723] mt-1">{stats.classrooms}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#D4A574]/15 flex items-center justify-center">
                  <School className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </SpotlightCard>
            <SpotlightCard className="rounded-xl p-4 bg-white border border-gray-200" spotlightColor="rgba(93, 64, 55, 0.08)">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Labs</p>
                  <p className="text-2xl font-bold text-[#3E2723] mt-1">{stats.labs}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <FlaskConical className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </SpotlightCard>
            <SpotlightCard className="rounded-xl p-4 bg-white border border-gray-200" spotlightColor="rgba(93, 64, 55, 0.08)">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">With Location</p>
                  <p className="text-2xl font-bold text-[#3E2723] mt-1">{stats.withLocation}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#BCAAA4]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rooms..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-[#3E2723] focus:ring-2 focus:ring-indigo-300 focus:border-transparent outline-none transition-all text-sm placeholder:text-[#BCAAA4]"
              />
            </div>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              wrapperClassName="w-full sm:w-48"
            >
              <option value="all">All Types</option>
              <option value="classroom">Classrooms</option>
              <option value="lab">Labs</option>
              <option value="seminar">Seminar Halls</option>
              <option value="research">Research Labs</option>
            </Select>
          </div>

          {/* Empty State */}
          {filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-[#BCAAA4]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700">No rooms found</h3>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery || filterType !== 'all' ? 'Try adjusting your filters' : 'Add your first room to get started'}
              </p>
            </div>
          ) : (
            /* Rooms Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room, index) => (
                <motion.div
                  key={room.room_number}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-white rounded-xl border border-gray-200 hover:border-[#D4A574] hover:shadow-lg hover:shadow-gray-600/5 transition-all duration-300 group"
                >
                  {/* Card Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getRoomTypeBadge(room.room_type)}`}>
                          {getRoomTypeIcon(room.room_type)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-[#3E2723]">{room.room_number}</h3>
                          <p className="text-xs text-gray-400">{room.building_name || 'N/A'}</p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getRoomTypeBadge(room.room_type)}`}>
                        {room.room_type || 'unknown'}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="px-5 pb-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Capacity</span>
                      <span className="font-medium text-[#3E2723]">{room.capacity || '—'} seats</span>
                    </div>
                    {room.floor_number && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Floor</span>
                        <span className="font-medium text-[#3E2723]">{room.floor_number}</span>
                      </div>
                    )}
                    {room.plus_code && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Plus Code
                        </span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(room.plus_code)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-gray-600 hover:text-[#3E2723] underline underline-offset-2 bg-gray-50 px-2 py-0.5 rounded"
                        >
                          {room.plus_code}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Facilities */}
                  {room.facilities && room.facilities.length > 0 && (
                    <div className="px-5 pb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {room.facilities.map((facility) => (
                          <span
                            key={facility}
                            className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded-md text-xs font-medium"
                          >
                            {facility}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card Actions */}
                  <div className="px-5 py-3 border-t border-[#F0E4D3] flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleEdit(room)}
                      className="flex-1 py-2 rounded-lg font-medium text-sm text-gray-600 bg-gray-50 hover:bg-[#E8DDD1] transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleDelete(room.room_number)}
                      className="py-2 px-3 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Bulk Upload Modal */}
      <FileUploadModal
        show={showUpload}
        onClose={() => setShowUpload(false)}
        onImportComplete={loadRooms}
        config={roomUploadConfig}
      />
    </div>
  );
}

