"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { DBRoom, DBRoomType, isSupabaseConfigured } from '@/lib/supabase';
import { getAllRooms, addRoom, updateRoom, deleteRoom } from '@/services/roomService';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Plus, X, Loader2, Trash2, Edit } from 'lucide-react';

export default function RoomAllocationPage() {
  const [rooms, setRooms] = useState<DBRoom[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<DBRoom | null>(null);
  const [formData, setFormData] = useState({
    room_number: '',
    building_name: '',
    capacity: '',
    room_type: 'classroom' as DBRoomType,
    facilities: '',
  });

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    setLoading(true);
    const data = await getAllRooms();
    setRooms(data);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({ room_number: '', building_name: '', capacity: '', room_type: 'classroom', facilities: '' });
    setEditingRoom(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const roomInput = {
      room_number: formData.room_number,
      building_name: formData.building_name || undefined,
      capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
      room_type: formData.room_type,
      facilities: formData.facilities ? formData.facilities.split(',').map(f => f.trim()) : undefined,
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
  };

  const handleEdit = (room: DBRoom) => {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number,
      building_name: room.building_name || '',
      capacity: room.capacity?.toString() || '',
      room_type: room.room_type || 'classroom',
      facilities: room.facilities?.join(', ') || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (room_number: string) => {
    if (!confirm('Delete this room?')) return;
    const result = await deleteRoom(room_number);
    if (result.success) loadRooms();
    else setError(result.error || 'Failed to delete');
  };

  const toggleActive = async (room: DBRoom) => {
    const result = await updateRoom(room.room_number, { is_active: !room.is_active } as any);
    if (result.success) loadRooms();
  };

  const filteredRooms = rooms.filter(r => {
    const matchesType = filterType === 'all' || r.room_type === filterType;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'available' && r.is_active) ||
      (filterStatus === 'occupied' && !r.is_active);
    return matchesType && matchesStatus;
  });

  const getRoomTypeIcon = (type: DBRoomType | null) => {
    switch (type) {
      case 'classroom': return '🏫';
      case 'lab': return '💻';
      case 'seminar': return '🎤';
      case 'research': return '🔬';
      default: return '🏢';
    }
  };

  const getRoomTypeColor = (type: DBRoomType | null) => {
    switch (type) {
      case 'classroom': return 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30';
      case 'lab': return 'bg-[#8400ff]/20 text-[#a855f7] border border-[#8400ff]/30';
      case 'seminar': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'research': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      default: return 'bg-white/10 text-white/70 border border-white/20';
    }
  };

  const stats = {
    total: rooms.length,
    available: rooms.filter(r => r.is_active).length,
    occupied: rooms.filter(r => !r.is_active).length,
    classrooms: rooms.filter(r => r.room_type === 'classroom').length,
    labs: rooms.filter(r => r.room_type === 'lab').length,
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#8B7355] dark:text-white/60">Supabase not configured. Please set up environment variables.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-300">×</button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => resetForm()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#FAF7F3] dark:bg-[#0d0d1a] rounded-xl p-6 w-full max-w-md border border-[#DCC5B2] dark:border-[#392e4e]"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-[#5D4E37] dark:text-white">
                  {editingRoom ? 'Edit Room' : 'Add New Room'}
                </h2>
                <button onClick={() => resetForm()} className="p-1 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-[#8B7355] dark:text-white/60" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-[#8B7355] dark:text-white/60">Room Number *</label>
                  <input
                    type="text"
                    value={formData.room_number}
                    onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                    disabled={!!editingRoom}
                    required
                    className="w-full px-3 py-2 mt-1 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-white dark:bg-white/5 text-[#5D4E37] dark:text-white disabled:opacity-50"
                    placeholder="e.g., Room 301"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#8B7355] dark:text-white/60">Building</label>
                  <input
                    type="text"
                    value={formData.building_name}
                    onChange={(e) => setFormData({ ...formData, building_name: e.target.value })}
                    className="w-full px-3 py-2 mt-1 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-white dark:bg-white/5 text-[#5D4E37] dark:text-white"
                    placeholder="e.g., CSE Building"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[#8B7355] dark:text-white/60">Capacity</label>
                    <input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      className="w-full px-3 py-2 mt-1 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-white dark:bg-white/5 text-[#5D4E37] dark:text-white"
                      placeholder="60"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[#8B7355] dark:text-white/60">Room Type</label>
                    <select
                      value={formData.room_type}
                      onChange={(e) => setFormData({ ...formData, room_type: e.target.value as DBRoomType })}
                      className="w-full px-3 py-2 mt-1 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-white dark:bg-white/5 text-[#5D4E37] dark:text-white"
                    >
                      <option value="classroom">Classroom</option>
                      <option value="lab">Lab</option>
                      <option value="seminar">Seminar</option>
                      <option value="research">Research</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#8B7355] dark:text-white/60">Facilities (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.facilities}
                    onChange={(e) => setFormData({ ...formData, facilities: e.target.value })}
                    className="w-full px-3 py-2 mt-1 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-white dark:bg-white/5 text-[#5D4E37] dark:text-white"
                    placeholder="Projector, AC, Whiteboard"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#8400ff] dark:to-[#a855f7] text-white rounded-lg font-medium"
                >
                  {editingRoom ? 'Update Room' : 'Add Room'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5D4E37] dark:text-white">Room Allocation</h1>
          <p className="text-[#8B7355] dark:text-white/60 mt-1">Manage classroom and lab allocations</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#8400ff] dark:to-[#a855f7] text-white rounded-lg hover:from-[#C88989] hover:to-[#CCB5A2] dark:hover:from-[#9933ff] dark:hover:to-[#b366ff] transition-all flex items-center gap-2 shadow-lg shadow-[#D9A299]/25 dark:shadow-[#8400ff]/25"
        >
          <Plus className="w-5 h-5" />
          Add Room
        </motion.button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#D9A299] dark:text-[#8400ff]" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <SpotlightCard className="rounded-xl p-4 bg-[#FAF7F3] dark:bg-transparent border border-[#DCC5B2] dark:border-[#392e4e]" spotlightColor="rgba(217, 162, 153, 0.2)">
              <p className="text-sm text-[#8B7355] dark:text-white/50">Total Rooms</p>
              <p className="text-2xl font-bold text-[#5D4E37] dark:text-white">{stats.total}</p>
            </SpotlightCard>
            <SpotlightCard className="rounded-xl p-4 bg-[#FAF7F3] dark:bg-transparent border border-[#DCC5B2] dark:border-[#392e4e]" spotlightColor="rgba(217, 162, 153, 0.2)">
              <p className="text-sm text-[#8B7355] dark:text-white/50">Available</p>
              <p className="text-2xl font-bold text-[#D9A299] dark:text-[#00e5ff]">{stats.available}</p>
            </SpotlightCard>
            <SpotlightCard className="rounded-xl p-4 bg-[#FAF7F3] dark:bg-transparent border border-[#DCC5B2] dark:border-[#392e4e]" spotlightColor="rgba(217, 162, 153, 0.2)">
              <p className="text-sm text-[#8B7355] dark:text-white/50">Occupied</p>
              <p className="text-2xl font-bold text-red-500 dark:text-red-400">{stats.occupied}</p>
            </SpotlightCard>
            <SpotlightCard className="rounded-xl p-4 bg-[#FAF7F3] dark:bg-transparent border border-[#DCC5B2] dark:border-[#392e4e]" spotlightColor="rgba(217, 162, 153, 0.2)">
              <p className="text-sm text-[#8B7355] dark:text-white/50">Classrooms</p>
              <p className="text-2xl font-bold text-[#D9A299] dark:text-[#00e5ff]">{stats.classrooms}</p>
            </SpotlightCard>
            <SpotlightCard className="rounded-xl p-4 bg-[#FAF7F3] dark:bg-transparent border border-[#DCC5B2] dark:border-[#392e4e]" spotlightColor="rgba(217, 162, 153, 0.2)">
              <p className="text-sm text-[#8B7355] dark:text-white/50">Labs</p>
              <p className="text-2xl font-bold text-[#D9A299] dark:text-[#8400ff]">{stats.labs}</p>
            </SpotlightCard>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-white/5 text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent"
            >
              <option value="all" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">All Types</option>
              <option value="classroom" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Classrooms</option>
              <option value="lab" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Labs</option>
              <option value="seminar" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Seminar Halls</option>
              <option value="research" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Research Labs</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-[#DCC5B2] dark:border-[#392e4e] rounded-lg bg-[#FAF7F3] dark:bg-white/5 text-[#5D4E37] dark:text-white focus:ring-2 focus:ring-[#D9A299] dark:focus:ring-[#8400ff] focus:border-transparent"
            >
              <option value="all" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">All Status</option>
              <option value="available" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Available</option>
              <option value="occupied" className="bg-[#FAF7F3] dark:bg-[#0d0d1a]">Occupied</option>
            </select>
          </div>

      {/* Rooms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRooms.map((room, index) => (
              <motion.div
                key={room.room_number}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-[#FAF7F3] dark:bg-[#0d0d1a] rounded-xl p-5 border-2 transition-all ${
                  room.is_active
                    ? 'border-emerald-400/40 dark:border-emerald-500/30 hover:border-emerald-500/60 dark:hover:border-emerald-500/50'
                    : 'border-red-400/40 dark:border-red-500/30 hover:border-red-500/60 dark:hover:border-red-500/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{getRoomTypeIcon(room.room_type)}</span>
                    <div>
                      <h3 className="font-semibold text-[#5D4E37] dark:text-white">{room.room_number}</h3>
                      <p className="text-sm text-[#8B7355] dark:text-white/50">{room.building_name || 'N/A'}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoomTypeColor(room.room_type)}`}>
                    {room.room_type || 'unknown'}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#8B7355] dark:text-white/50">Capacity</span>
                    <span className="font-medium text-[#5D4E37] dark:text-white">{room.capacity || '—'} seats</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#8B7355] dark:text-white/50">Status</span>
                    <span className={`font-medium ${room.is_active ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {room.is_active ? 'Available' : 'Occupied'}
                    </span>
                  </div>
                </div>

                {room.facilities && room.facilities.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#DCC5B2] dark:border-[#392e4e]">
                    <div className="flex flex-wrap gap-1">
                      {room.facilities.map((facility) => (
                        <span
                          key={facility}
                          className="px-2 py-0.5 bg-[#F0E4D3] dark:bg-white/5 text-[#5D4E37] dark:text-white/60 rounded text-xs border border-[#DCC5B2] dark:border-[#392e4e]"
                        >
                          {facility}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleEdit(room)}
                    className="p-2 rounded-lg text-[#8B7355] dark:text-white/60 hover:bg-[#F0E4D3] dark:hover:bg-white/10 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleActive(room)}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors text-sm ${
                      room.is_active
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                    }`}
                  >
                    {room.is_active ? 'Mark Occupied' : 'Mark Available'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDelete(room.room_number)}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
