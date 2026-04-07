"use client";

import SpotlightCard from '@/components/ui/SpotlightCard';
import {
    AddGeoRoomInput,
    addGeoRoomLocation,
    deleteGeoRoomLocation,
    GeoRoomLocation,
    getAllGeoRoomLocations,
    updateGeoRoomLocation,
} from '@/services/geoRoomLocationService';
import { decodePlusCode } from '@/lib/plusCode';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit, Loader2, MapPin, Navigation, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function GeoRoomManagementPage() {
  const [rooms, setRooms] = useState<GeoRoomLocation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<GeoRoomLocation | null>(null);
  const [formData, setFormData] = useState<AddGeoRoomInput>({
    room_name: '',
    latitude: 0,
    longitude: 0,
    plus_code: '',
    building_name: 'CSE Building',
    floor_number: '',
  });

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    setLoading(true);
    const data = await getAllGeoRoomLocations();
    setRooms(data);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      room_name: '',
      latitude: 0,
      longitude: 0,
      plus_code: '',
      building_name: 'CSE Building',
      floor_number: '',
    });
    setEditingRoom(null);
    setShowForm(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.room_name.trim()) {
      setError('Room name is required');
      return;
    }
    if (!Number.isFinite(formData.latitude) || !Number.isFinite(formData.longitude)) {
      setError('Valid latitude and longitude are required');
      return;
    }
    if (formData.latitude === 0 && formData.longitude === 0) {
      setError('Latitude and longitude cannot both be 0 — use Decode or enter coordinates manually');
      return;
    }

    const result = editingRoom
      ? await updateGeoRoomLocation(editingRoom.id, formData)
      : await addGeoRoomLocation(formData);

    if (result.success) {
      await loadRooms();
      resetForm();
    } else {
      setError(result.error || 'Operation failed');
    }
  };

  const handleEdit = (room: GeoRoomLocation) => {
    setEditingRoom(room);
    setFormData({
      room_name: room.room_name,
      latitude: room.latitude,
      longitude: room.longitude,
      plus_code: room.plus_code || '',
      building_name: room.building_name || 'CSE Building',
      floor_number: room.floor_number || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (room: GeoRoomLocation) => {
    if (!confirm(`Delete room "${room.room_name}"? This will not affect past attendance records.`)) return;
    const result = await deleteGeoRoomLocation(room.id);
    if (result.success) loadRooms();
    else setError(result.error || 'Failed to delete');
  };

  const activeRooms = rooms.filter(r => r.is_active);
  const inactiveRooms = rooms.filter(r => !r.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-7 h-7 text-teal-500" />
            Geo Room Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage room coordinates for geo-attendance. Teachers select these rooms when opening attendance.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Room
        </button>
      </div>

      {/* Form Modal Overlay */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <SpotlightCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">
                    {editingRoom ? 'Edit Room' : 'Add New Room'}
                  </h2>
                  <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Room Name */}
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">
                        Room Name *
                      </label>
                      <input
                        type="text"
                        value={formData.room_name}
                        onChange={(e) => setFormData({ ...formData, room_name: e.target.value })}
                        placeholder="e.g. CSE-104, 202, 502"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-foreground"
                        required
                      />
                    </div>

                    {/* Plus Code */}
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">
                        Plus Code (optional — auto-fills coordinates)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.plus_code}
                          onChange={(e) => {
                            const val = e.target.value;
                            const coords = decodePlusCode(val);
                            setFormData({
                              ...formData,
                              plus_code: val,
                              ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
                            });
                          }}
                          placeholder="e.g. VGX2+QJQ Khulna"
                          className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-foreground"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const coords = decodePlusCode(formData.plus_code ?? '');
                            if (coords) setFormData({ ...formData, latitude: coords.lat, longitude: coords.lng });
                            else setError('Could not decode Plus Code. Use format: VGX2+QJQ Khulna');
                          }}
                          className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                        >
                          Decode
                        </button>
                      </div>
                    </div>

                    {/* Latitude */}
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">
                        Latitude *
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={formData.latitude || ''}
                        onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                        placeholder="e.g. 22.899484"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-foreground"
                        required
                      />
                    </div>

                    {/* Longitude */}
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">
                        Longitude *
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={formData.longitude || ''}
                        onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                        placeholder="e.g. 89.501513"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-foreground"
                        required
                      />
                    </div>

                    {/* Building Name */}
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">
                        Building
                      </label>
                      <input
                        type="text"
                        value={formData.building_name}
                        onChange={(e) => setFormData({ ...formData, building_name: e.target.value })}
                        placeholder="CSE Building"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-foreground"
                      />
                    </div>

                    {/* Floor */}
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">
                        Floor
                      </label>
                      <input
                        type="text"
                        value={formData.floor_number}
                        onChange={(e) => setFormData({ ...formData, floor_number: e.target.value })}
                        placeholder="e.g. 1st, 2nd, 5th"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-foreground"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors font-medium"
                    >
                      {editingRoom ? 'Update Room' : 'Add Room'}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-6 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </SpotlightCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        </div>
      ) : (
        <>
          {/* Active Rooms */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-teal-500" />
              Active Rooms ({activeRooms.length})
            </h2>

            {activeRooms.length === 0 ? (
              <SpotlightCard className="p-8 text-center">
                <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No rooms configured yet.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add rooms with GPS coordinates so teachers can use them for geo-attendance.
                </p>
              </SpotlightCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Inactive Rooms */}
          {inactiveRooms.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-muted-foreground mb-3">
                Inactive Rooms ({inactiveRooms.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                {inactiveRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RoomCard({
  room,
  onEdit,
  onDelete,
}: {
  room: GeoRoomLocation;
  onEdit: (room: GeoRoomLocation) => void;
  onDelete: (room: GeoRoomLocation) => void;
}) {
  return (
    <SpotlightCard className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">{room.room_name}</h3>
          <p className="text-xs text-muted-foreground">
            {room.building_name}{room.floor_number ? ` • ${room.floor_number} Floor` : ''}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(room)}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(room)}
            className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-muted-foreground hover:text-red-500"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4 text-teal-500 shrink-0" />
          <span className="font-mono text-xs">
            {room.latitude.toFixed(6)}, {room.longitude.toFixed(6)}
          </span>
        </div>
        {room.plus_code && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Navigation className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-xs">{room.plus_code}</span>
          </div>
        )}
      </div>

      <a
        href={`https://maps.google.com/?q=${room.latitude},${room.longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs text-teal-500 hover:text-teal-400 transition-colors"
      >
        <MapPin className="w-3 h-3" />
        View on Google Maps
      </a>
    </SpotlightCard>
  );
}
