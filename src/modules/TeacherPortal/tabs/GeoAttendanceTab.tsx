"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import {
  getMyCourses,
  openGeoAttendanceRoom,
  getGeoAttendanceRooms,
  closeGeoAttendanceRoom,
  getGeoRoomLogs,
  type TeacherCourse,
  type GeoAttendanceRoom,
  type GeoAttendanceLog,
} from '@/services/teacherPortalService';
import {
  MapPin,
  Loader2,
  AlertCircle,
  Radio,
  XCircle,
  Clock,
  Users,
  CheckCircle2,
  DoorOpen,
  Eye,
} from 'lucide-react';

// Room limits
const MAX_THEORY_ROOMS = 2;
const MAX_LAB_ROOMS = 4;

export default function GeoAttendanceTab() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<TeacherCourse | null>(null);
  const [activeRooms, setActiveRooms] = useState<GeoAttendanceRoom[]>([]);
  const [recentRooms, setRecentRooms] = useState<GeoAttendanceRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state for opening a room
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [roomNumber, setRoomNumber] = useState('');
  const [sectionGroup, setSectionGroup] = useState('');

  // Logs modal state
  const [viewingLogsRoomId, setViewingLogsRoomId] = useState<string | null>(null);
  const [roomLogs, setRoomLogs] = useState<GeoAttendanceLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const teacherId = user?.id;

  // Section/group definitions based on course type
  const isLab = selectedCourse?.course_type?.toLowerCase() !== 'theory';
  const geoGroups = isLab
    ? [
        { label: 'Group A1 (01–30)', min: 1, max: 30 },
        { label: 'Group A2 (31–60)', min: 31, max: 60 },
        { label: 'Group B1 (61–90)', min: 61, max: 90 },
        { label: 'Group B2 (91–120)', min: 91, max: 120 },
      ]
    : [
        { label: 'Section A (01–60)', min: 1, max: 60 },
        { label: 'Section B (61–120)', min: 61, max: 120 },
      ];

  // Load courses
  useEffect(() => {
    if (!teacherId) return;
    setLoadingCourses(true);
    getMyCourses(teacherId)
      .then(setCourses)
      .finally(() => setLoadingCourses(false));
  }, [teacherId]);

  // Load geo-attendance rooms
  const loadRooms = useCallback(async () => {
    if (!teacherId) return;
    setLoadingRooms(true);
    try {
      const all = await getGeoAttendanceRooms(teacherId);
      setActiveRooms(all.filter(r => r.is_active));
      setRecentRooms(all.filter(r => !r.is_active).slice(0, 10));
    } finally {
      setLoadingRooms(false);
    }
  }, [teacherId]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  // Auto-refresh active rooms every 15 seconds (more frequent for live monitoring)
  useEffect(() => {
    if (activeRooms.length === 0) return;
    const interval = setInterval(loadRooms, 15000);
    return () => clearInterval(interval);
  }, [activeRooms.length, loadRooms]);

  // Auto-refresh logs when viewing a room
  useEffect(() => {
    if (!viewingLogsRoomId) return;
    const interval = setInterval(() => {
      getGeoRoomLogs(viewingLogsRoomId).then(setRoomLogs);
    }, 10000);
    return () => clearInterval(interval);
  }, [viewingLogsRoomId]);

  // Load logs for a room
  const handleViewLogs = async (roomId: string) => {
    setViewingLogsRoomId(roomId);
    setLoadingLogs(true);
    try {
      const logs = await getGeoRoomLogs(roomId);
      setRoomLogs(logs);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Open a room
  const handleOpenRoom = async () => {
    if (!selectedCourse || !teacherId || !sectionGroup) return;
    setOpening(true);
    setMessage(null);

    try {
      const now = new Date();
      const endTime = new Date(now.getTime() + durationMinutes * 60000);

      const result = await openGeoAttendanceRoom({
        offering_id: selectedCourse.offering_id,
        teacher_user_id: teacherId,
        room_number: roomNumber || undefined,
        section: sectionGroup,
        start_time: now.toISOString(),
        end_time: endTime.toISOString(),
      });

      if (result.success) {
        setMessage({ type: 'success', text: `Room opened for ${selectedCourse.course_code} (${sectionGroup})! Students within 200m can now submit attendance.` });
        setSelectedCourse(null);
        setRoomNumber('');
        setSectionGroup('');
        await loadRooms();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to open room' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to open room' });
    } finally {
      setOpening(false);
    }
  };

  // Close a room
  const handleCloseRoom = async (roomId: string) => {
    try {
      const result = await closeGeoAttendanceRoom(roomId, teacherId);
      if (result.success) {
        setMessage({ type: 'success', text: 'Room closed successfully' });
        if (viewingLogsRoomId === roomId) setViewingLogsRoomId(null);
        await loadRooms();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to close room' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to close room' });
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const timeRemaining = (endTime: string) => {
    const diff = new Date(endTime).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m remaining`;
    return `${mins}m remaining`;
  };

  // Check room limits
  const canOpenMore = (() => {
    if (!selectedCourse) return true;
    const courseType = selectedCourse.course_type?.toLowerCase();
    const maxRooms = courseType === 'lab' ? MAX_LAB_ROOMS : MAX_THEORY_ROOMS;
    return activeRooms.length < maxRooms;
  })();

  const roomLimitText = (() => {
    if (!selectedCourse) return '';
    const courseType = selectedCourse.course_type?.toLowerCase();
    const maxRooms = courseType === 'lab' ? MAX_LAB_ROOMS : MAX_THEORY_ROOMS;
    return `${activeRooms.length}/${maxRooms} rooms active`;
  })();

  if (loadingCourses) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        <span className="ml-2 text-gray-500">Loading courses...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
          <MapPin className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Geo-Attendance</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Open a room for proximity-based attendance (200m from CSE Building).
            Max {MAX_THEORY_ROOMS} rooms for theory, {MAX_LAB_ROOMS} for lab.
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
            : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Active Rooms */}
      {activeRooms.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Radio className="h-4 w-4 text-green-500 animate-pulse" />
            Active Rooms ({activeRooms.length})
          </h3>
          {activeRooms.map(room => (
            <div
              key={room.id}
              className="rounded-xl border-2 border-green-200 bg-green-50 px-5 py-4 dark:border-green-800 dark:bg-green-900/20"
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                    <DoorOpen className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {room.course_offerings?.courses?.code ?? 'Course'} — {room.course_offerings?.courses?.title ?? ''}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTime(room.start_time)} – {formatTime(room.end_time)}
                      </span>
                      {room.room_number && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {room.room_number}
                        </span>
                      )}
                      {room.section && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {room.section}
                        </span>
                      )}
                      <span className="rounded-full bg-green-200 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-800 dark:text-green-200">
                        {timeRemaining(room.end_time)}
                      </span>
                      <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        <Users className="h-3 w-3" />
                        {room.submission_count ?? 0} submitted
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewLogs(room.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                  >
                    <Eye className="h-4 w-4" />
                    View Logs
                  </button>
                  <button
                    onClick={() => handleCloseRoom(room.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                  >
                    <XCircle className="h-4 w-4" />
                    Close Room
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attendance Logs Panel */}
      {viewingLogsRoomId && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <Users className="h-4 w-4 text-purple-500" />
              Attendance Submissions ({roomLogs.length})
              {activeRooms.some(r => r.id === viewingLogsRoomId) && (
                <span className="ml-2 text-xs text-green-600 dark:text-green-400 animate-pulse">Live</span>
              )}
            </h3>
            <button
              onClick={() => setViewingLogsRoomId(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
          {loadingLogs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : roomLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No submissions yet. Waiting for students...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">#</th>
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Roll No</th>
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Name</th>
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Distance</th>
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Time</th>
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {roomLogs.map((log, i) => (
                    <tr key={log.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {log.students?.roll_no ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {log.students?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {log.distance_meters}m
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {formatTime(log.submitted_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Open Room Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Open New Room</h3>
          {selectedCourse && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              canOpenMore
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {roomLimitText}
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Course Selection */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Course
            </label>
            <select
              value={selectedCourse?.offering_id || ''}
              onChange={(e) => {
                const course = courses.find(c => c.offering_id === e.target.value);
                setSelectedCourse(course || null);
                setSectionGroup('');
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select course...</option>
              {courses.map(c => (
                <option key={c.offering_id} value={c.offering_id}>
                  {c.course_code} — {c.course_title}
                </option>
              ))}
            </select>
          </div>

          {/* Section / Group */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Section / Group <span className="text-red-500">*</span>
            </label>
            <select
              value={sectionGroup}
              onChange={(e) => setSectionGroup(e.target.value)}
              disabled={!selectedCourse}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50"
            >
              <option value="">Select {selectedCourse ? (isLab ? 'group' : 'section') : '...'}...</option>
              {selectedCourse && geoGroups.map((g, gi) => (
                <option key={gi} value={g.label}>{g.label}</option>
              ))}
            </select>
          </div>

          {/* Room Number */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Room Number (optional)
            </label>
            <input
              type="text"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g. 301"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Duration (minutes)
            </label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value={30}>30 min</option>
              <option value={50}>50 min (1 period)</option>
              <option value={80}>80 min</option>
              <option value={100}>100 min (2 periods)</option>
              <option value={150}>150 min (3 periods)</option>
            </select>
          </div>

          {/* Open Button */}
          <div className="flex items-end">
            <button
              onClick={handleOpenRoom}
              disabled={!selectedCourse || !sectionGroup || opening || !canOpenMore}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-700 dark:hover:bg-teal-600"
            >
              {opening ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <Radio className="h-4 w-4" />
                  Open Room
                </>
              )}
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          <MapPin className="inline h-3 w-3 mr-1" />
          Students must be within 200 meters of the CSE Building (KUET) to submit attendance.
          The room will auto-close after the specified duration.
          {!canOpenMore && (
            <span className="text-red-500 font-medium ml-1">
              Room limit reached — close an existing room first.
            </span>
          )}
        </p>
      </div>

      {/* Recent Rooms History */}
      {loadingRooms ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : recentRooms.length > 0 ? (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Clock className="h-4 w-4 text-gray-400" />
            Recent Sessions
          </h3>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Course</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Section</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Time</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Room</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Submissions</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentRooms.map(room => (
                  <tr key={room.id} className="bg-white dark:bg-gray-900">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {room.course_offerings?.courses?.code ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {room.section ? (
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {room.section}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{room.date}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatTime(room.start_time)} – {formatTime(room.end_time)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{room.room_number || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium text-xs">
                        <Users className="h-3 w-3" />
                        {room.submission_count ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewLogs(room.id)}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        View Logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
