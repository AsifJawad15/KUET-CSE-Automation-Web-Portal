"use client";

import { useState } from 'react';
import { sampleRooms } from '@/data/sampleData';
import { Room, RoomType } from '@/types';

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
      case 'classroom': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'lab': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'seminar': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'research': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-700';
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Room Allocation</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage classroom and lab allocations</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Room
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Rooms</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Available</p>
          <p className="text-2xl font-bold text-green-600">{stats.available}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Occupied</p>
          <p className="text-2xl font-bold text-red-600">{stats.occupied}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Classrooms</p>
          <p className="text-2xl font-bold text-blue-600">{stats.classrooms}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Labs</p>
          <p className="text-2xl font-bold text-purple-600">{stats.labs}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">All Types</option>
          <option value="classroom">Classrooms</option>
          <option value="lab">Labs</option>
          <option value="seminar">Seminar Halls</option>
          <option value="research">Research Labs</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="occupied">Occupied</option>
        </select>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRooms.map((room) => (
          <div
            key={room.id}
            className={`bg-white dark:bg-gray-800 rounded-xl p-5 border-2 transition-all ${
              room.isAvailable 
                ? 'border-green-200 dark:border-green-800' 
                : 'border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getRoomTypeIcon(room.type)}</span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{room.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{room.building}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoomTypeColor(room.type)}`}>
                {room.type}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Capacity</span>
                <span className="font-medium text-gray-900 dark:text-white">{room.capacity} seats</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Status</span>
                <span className={`font-medium ${room.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                  {room.isAvailable ? 'Available' : 'Occupied'}
                </span>
              </div>
              {!room.isAvailable && room.occupiedBy && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Occupied by: </span>
                  <span className="text-gray-900 dark:text-white">{room.occupiedBy}</span>
                </div>
              )}
            </div>

            {room.facilities && room.facilities.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap gap-1">
                  {room.facilities.map((facility) => (
                    <span
                      key={facility}
                      className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs"
                    >
                      {facility}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => toggleAvailability(room.id)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  room.isAvailable
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                }`}
              >
                {room.isAvailable ? 'Mark Occupied' : 'Mark Available'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
