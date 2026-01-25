"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import { sampleRooms } from '@/data/sampleData';
import { Room, RoomType } from '@/types';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function RoomAllocationPage() {
  const [rooms, setRooms] = useState<Room[]>(sampleRooms);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredRooms = rooms.filter(r => {
    const matchesType = filterType === 'all' || r.type === filterType;
    const matchesStatus = filterStatus === 'all' || 
                          (filterStatus === 'available' && r.isAvailable) ||
                          (filterStatus === 'occupied' && !r.isAvailable);
    return matchesType && matchesStatus;
  });

  const toggleAvailability = (id: string) => {
    setRooms(prev => prev.map(r => 
      r.id === id ? { ...r, isAvailable: !r.isAvailable, occupiedBy: r.isAvailable ? 'Manual Override' : undefined } : r
    ));
  };

  const getRoomTypeIcon = (type: RoomType) => {
    switch (type) {
      case 'classroom': return '🏫';
      case 'lab': return '💻';
      case 'seminar': return '🎤';
      case 'research': return '🔬';
      default: return '🏢';
    }
  };

  const getRoomTypeColor = (type: RoomType) => {
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
    available: rooms.filter(r => r.isAvailable).length,
    occupied: rooms.filter(r => !r.isAvailable).length,
    classrooms: rooms.filter(r => r.type === 'classroom').length,
    labs: rooms.filter(r => r.type === 'lab').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Room Allocation</h1>
          <p className="text-white/60 mt-1">Manage classroom and lab allocations</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-[#8400ff] to-[#a855f7] text-white rounded-lg hover:from-[#9933ff] hover:to-[#b366ff] transition-all flex items-center gap-2 shadow-lg shadow-[#8400ff]/25"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Room
        </motion.button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SpotlightCard className="rounded-xl p-4 border border-[#392e4e]" spotlightColor="rgba(132, 0, 255, 0.15)">
          <p className="text-sm text-white/50">Total Rooms</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </SpotlightCard>
        <SpotlightCard className="rounded-xl p-4 border border-[#392e4e]" spotlightColor="rgba(0, 229, 255, 0.15)">
          <p className="text-sm text-white/50">Available</p>
          <p className="text-2xl font-bold text-[#00e5ff]">{stats.available}</p>
        </SpotlightCard>
        <SpotlightCard className="rounded-xl p-4 border border-[#392e4e]" spotlightColor="rgba(239, 68, 68, 0.15)">
          <p className="text-sm text-white/50">Occupied</p>
          <p className="text-2xl font-bold text-red-400">{stats.occupied}</p>
        </SpotlightCard>
        <SpotlightCard className="rounded-xl p-4 border border-[#392e4e]" spotlightColor="rgba(0, 229, 255, 0.15)">
          <p className="text-sm text-white/50">Classrooms</p>
          <p className="text-2xl font-bold text-[#00e5ff]">{stats.classrooms}</p>
        </SpotlightCard>
        <SpotlightCard className="rounded-xl p-4 border border-[#392e4e]" spotlightColor="rgba(132, 0, 255, 0.15)">
          <p className="text-sm text-white/50">Labs</p>
          <p className="text-2xl font-bold text-[#8400ff]">{stats.labs}</p>
        </SpotlightCard>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-[#392e4e] rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-[#8400ff] focus:border-transparent"
        >
          <option value="all" className="bg-[#0d0d1a]">All Types</option>
          <option value="classroom" className="bg-[#0d0d1a]">Classrooms</option>
          <option value="lab" className="bg-[#0d0d1a]">Labs</option>
          <option value="seminar" className="bg-[#0d0d1a]">Seminar Halls</option>
          <option value="research" className="bg-[#0d0d1a]">Research Labs</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-[#392e4e] rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-[#8400ff] focus:border-transparent"
        >
          <option value="all" className="bg-[#0d0d1a]">All Status</option>
          <option value="available" className="bg-[#0d0d1a]">Available</option>
          <option value="occupied" className="bg-[#0d0d1a]">Occupied</option>
        </select>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRooms.map((room, index) => (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`bg-[#0d0d1a] rounded-xl p-5 border-2 transition-all ${
              room.isAvailable 
                ? 'border-emerald-500/30 hover:border-emerald-500/50' 
                : 'border-red-500/30 hover:border-red-500/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getRoomTypeIcon(room.type)}</span>
                <div>
                  <h3 className="font-semibold text-white">{room.name}</h3>
                  <p className="text-sm text-white/50">{room.building}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoomTypeColor(room.type)}`}>
                {room.type}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Capacity</span>
                <span className="font-medium text-white">{room.capacity} seats</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Status</span>
                <span className={`font-medium ${room.isAvailable ? 'text-emerald-400' : 'text-red-400'}`}>
                  {room.isAvailable ? 'Available' : 'Occupied'}
                </span>
              </div>
              {!room.isAvailable && room.occupiedBy && (
                <div className="text-sm">
                  <span className="text-white/50">Occupied by: </span>
                  <span className="text-white">{room.occupiedBy}</span>
                </div>
              )}
            </div>

            {room.facilities && room.facilities.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#392e4e]">
                <div className="flex flex-wrap gap-1">
                  {room.facilities.map((facility) => (
                    <span
                      key={facility}
                      className="px-2 py-0.5 bg-white/5 text-white/60 rounded text-xs border border-[#392e4e]"
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
                onClick={() => toggleAvailability(room.id)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  room.isAvailable
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                }`}
              >
                {room.isAvailable ? 'Mark Occupied' : 'Mark Available'}
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
