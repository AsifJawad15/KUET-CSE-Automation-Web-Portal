"use client";

import { useAuth } from '@/contexts/AuthContext';
import {
  GEO_ATTENDANCE_DEFAULTS,
  GEO_ATTENDANCE_LIMITS,
} from '@/lib/geoAttendanceConfig';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getMyCourses,
  getCourseStudents,
  saveAttendance,
  getAttendance,
  openGeoAttendanceRoom,
  getGeoAttendanceRooms,
  closeGeoAttendanceRoom,
  getGeoRoomLogs,
  type TeacherCourse,
  type AttendanceRecord,
  type CourseStudent,
  type GeoAttendanceRoom,
  type GeoAttendanceLog,
} from '@/services/teacherPortalService';
import { getAllRooms } from '@/services/roomService';
import type { DBRoom } from '@/types/database';
import { CheckCircle2, Loader2, AlertCircle, ClipboardCheck, ArrowLeft, GraduationCap, Eye, MapPin, Radio, XCircle, Clock, DoorOpen, Users, Download } from 'lucide-react';
import { downloadAttendancePDF } from '@/lib/pdfGenerator';

const MAX_THEORY_ROOMS = 2;
const MAX_LAB_ROOMS = 4;

const STATUSES = ['present', 'absent', 'late'] as const;
type Status = typeof STATUSES[number];

const statusBadge: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  absent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  late: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

function isWholeNumberInRange(
  value: number,
  bounds: { min: number; max: number },
): boolean {
  return Number.isInteger(value) && value >= bounds.min && value <= bounds.max;
}

function geoStatusClass(status?: string): string {
  switch ((status || '').toUpperCase()) {
    case 'ABSENT':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'LATE':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    default:
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  }
}

// Extract last digits of a roll number (e.g., "2107056" → 56)
function rollSuffix(roll: string): number {
  const match = roll.match(/(\d{1,3})$/);
  return match ? parseInt(match[1], 10) : 0;
}

type ViewMode = 'take' | 'preview' | 'geo';

// Section/group definitions
interface GroupDef { label: string; min: number; max: number; }

const THEORY_GROUPS: GroupDef[] = [
  { label: 'Section A (01–60)', min: 1, max: 60 },
  { label: 'Section B (61–120)', min: 61, max: 120 },
];

const LAB_GROUPS: GroupDef[] = [
  { label: 'Group A1 (01–30)', min: 1, max: 30 },
  { label: 'Group A2 (31–60)', min: 31, max: 60 },
  { label: 'Group B1 (61–90)', min: 61, max: 90 },
  { label: 'Group B2 (91–120)', min: 91, max: 120 },
];

export default function TakeAttendanceTab() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<TeacherCourse | null>(null);

  // Attendance state
  const [students, setStudents] = useState<CourseStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Group/section filter
  const [activeGroup, setActiveGroup] = useState(0);

  // View mode: take attendance vs preview
  const [viewMode, setViewMode] = useState<ViewMode>('take');

  // Preview state
  const [previewData, setPreviewData] = useState<AttendanceRecord[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Geo-attendance state
  const [activeRooms, setActiveRooms] = useState<GeoAttendanceRoom[]>([]);
  const [recentRooms, setRecentRooms] = useState<GeoAttendanceRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [openingRoom, setOpeningRoom] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number>(
    GEO_ATTENDANCE_DEFAULTS.durationMinutes,
  );
  const [geoRoomNumber, setGeoRoomNumber] = useState('');
  const [geoSectionGroup, setGeoSectionGroup] = useState('');
  const [geoRangeMeters, setGeoRangeMeters] = useState<number>(
    GEO_ATTENDANCE_DEFAULTS.rangeMeters,
  );
  const [geoAbsenceGraceMinutes, setGeoAbsenceGraceMinutes] = useState<number>(
    GEO_ATTENDANCE_DEFAULTS.absenceGraceMinutes,
  );
  const [geoAvailableRooms, setGeoAvailableRooms] = useState<DBRoom[]>([]);

  // Geo logs state
  const [geoViewingRoomId, setGeoViewingRoomId] = useState<string | null>(null);
  const [geoRoomLogs, setGeoRoomLogs] = useState<GeoAttendanceLog[]>([]);
  const [geoLoadingLogs, setGeoLoadingLogs] = useState(false);

  // Load assigned courses
  const loadCourses = useCallback(async () => {
    if (!user?.id) return;
    setLoadingCourses(true);
    const data = await getMyCourses(user.id);
    setCourses(data);
    setLoadingCourses(false);
  }, [user?.id]);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  useEffect(() => {
    getAllRooms()
      .then((rooms) => setGeoAvailableRooms(
        rooms.filter((room) => room.is_active && room.latitude != null && room.longitude != null),
      ))
      .catch(() => setGeoAvailableRooms([]));
  }, []);

  // Determine groups based on course type
  const isLab = selectedCourse?.course_type?.toLowerCase() !== 'theory';
  const groups = isLab ? LAB_GROUPS : THEORY_GROUPS;

  // Filter students by active group
  const filteredIndices = useMemo(() => {
    if (!students.length) return [];
    const g = groups[activeGroup];
    return students
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => {
        const suf = rollSuffix(s.roll_no);
        return suf >= g.min && suf <= g.max;
      })
      .map(({ i }) => i);
  }, [students, activeGroup, groups]);

  // When a course is selected
  const selectCourse = useCallback(async (course: TeacherCourse) => {
    setSelectedCourse(course);
    setLoadingStudents(true);
    setMessage(null);
    setActiveGroup(0);
    setViewMode('take');
    setPreviewData([]);
    const studentList = await getCourseStudents(course.course_code, course.term);
    setStudents(studentList);
    setRecords(studentList.map(s => ({
      course_code: course.course_code,
      student_roll: s.roll_no,
      date,
      status: 'present' as const,
      section_or_group: undefined,
    })));
    setLoadingStudents(false);
  }, [date]);

  // Update date on all records
  useEffect(() => {
    if (records.length > 0) {
      setRecords(prev => prev.map(r => ({ ...r, date })));
    }
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = (globalIndex: number, status: Status) => {
    setRecords(prev => prev.map((r, i) => i === globalIndex ? { ...r, status } : r));
  };

  const markAllInGroup = (status: Status) => {
    setRecords(prev => prev.map((r, i) => filteredIndices.includes(i) ? { ...r, status } : r));
  };

  // Save only the active section/group
  const handleSave = async () => {
    if (filteredIndices.length === 0) return;
    setSaving(true);
    setMessage(null);
    const g = groups[activeGroup];
    const sectionRecords = filteredIndices.map(i => ({
      ...records[i],
      section_or_group: g.label,
    }));
    const result = await saveAttendance(sectionRecords, selectedCourse?.offering_id, user?.id);
    setSaving(false);
    if (result.success) {
      setMessage({ type: 'success', text: `Saved ${sectionRecords.length} students — ${g.label}` });
      if (selectedCourse) {
        getAttendance(selectedCourse.course_code, undefined, selectedCourse.offering_id).then(setPreviewData);
      }
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to save attendance' });
    }
  };

  // Load preview data
  const loadPreview = useCallback(async () => {
    if (!selectedCourse) return;
    setLoadingPreview(true);
    const data = await getAttendance(selectedCourse.course_code, undefined, selectedCourse.offering_id);
    setPreviewData(data);
    setLoadingPreview(false);
  }, [selectedCourse]);

  const switchToPreview = () => {
    setViewMode('preview');
    loadPreview();
  };

  const goBack = () => {
    setSelectedCourse(null);
    setStudents([]);
    setRecords([]);
    setMessage(null);
    setPreviewData([]);
    setActiveRooms([]);
    setRecentRooms([]);
    setViewMode('take');
  };

  // ── Geo-Attendance Helpers ──

  const loadGeoRooms = useCallback(async () => {
    if (!user?.id) return;
    setLoadingRooms(true);
    try {
      const all = await getGeoAttendanceRooms(user.id);
      // Filter rooms for the selected course only
      const courseRooms = selectedCourse
        ? all.filter(r => r.offering_id === selectedCourse.offering_id)
        : all;
      setActiveRooms(courseRooms.filter(r => r.is_active));
      setRecentRooms(courseRooms.filter(r => !r.is_active).slice(0, 10));
    } finally {
      setLoadingRooms(false);
    }
  }, [user?.id, selectedCourse]);

  const switchToGeo = () => {
    setViewMode('geo');
    loadGeoRooms();
  };

  // Auto-refresh active rooms every 15s when in geo mode
  useEffect(() => {
    if (viewMode !== 'geo' || activeRooms.length === 0) return;
    const interval = setInterval(loadGeoRooms, 15000);
    return () => clearInterval(interval);
  }, [viewMode, activeRooms.length, loadGeoRooms]);

  // Auto-refresh logs when viewing a room
  useEffect(() => {
    if (!geoViewingRoomId) return;
    const interval = setInterval(() => {
      getGeoRoomLogs(geoViewingRoomId).then(setGeoRoomLogs);
    }, 10000);
    return () => clearInterval(interval);
  }, [geoViewingRoomId]);

  const handleViewGeoLogs = async (roomId: string) => {
    setGeoViewingRoomId(roomId);
    setGeoLoadingLogs(true);
    try {
      const logs = await getGeoRoomLogs(roomId);
      setGeoRoomLogs(logs);
    } finally {
      setGeoLoadingLogs(false);
    }
  };

  // Room limits for geo mode
  const geoMaxRooms = isLab ? MAX_LAB_ROOMS : MAX_THEORY_ROOMS;
  const geoCanOpenMore = activeRooms.length < geoMaxRooms;
  const geoRangeValid = isWholeNumberInRange(
    geoRangeMeters,
    GEO_ATTENDANCE_LIMITS.rangeMeters,
  );
  const geoDurationValid = isWholeNumberInRange(
    durationMinutes,
    GEO_ATTENDANCE_LIMITS.durationMinutes,
  );
  const geoAbsenceGraceValid = isWholeNumberInRange(geoAbsenceGraceMinutes, {
    min: GEO_ATTENDANCE_LIMITS.absenceGraceMinutes.min,
    max: Math.min(
      GEO_ATTENDANCE_LIMITS.absenceGraceMinutes.max,
      Math.max(durationMinutes, GEO_ATTENDANCE_LIMITS.absenceGraceMinutes.min),
    ),
  });

  const handleOpenGeoRoom = async () => {
    if (!selectedCourse || !user?.id || !geoSectionGroup || !geoRoomNumber) {
      setMessage({
        type: 'error',
        text: 'Please choose a section/group and a GPS-enabled room.',
      });
      return;
    }

    if (!geoRangeValid) {
      setMessage({
        type: 'error',
        text: `Radius must be between ${GEO_ATTENDANCE_LIMITS.rangeMeters.min} and ${GEO_ATTENDANCE_LIMITS.rangeMeters.max} meters.`,
      });
      return;
    }

    if (!geoDurationValid) {
      setMessage({
        type: 'error',
        text: `Open time must be between ${GEO_ATTENDANCE_LIMITS.durationMinutes.min} and ${GEO_ATTENDANCE_LIMITS.durationMinutes.max} minutes.`,
      });
      return;
    }

    if (!geoAbsenceGraceValid) {
      setMessage({
        type: 'error',
        text: `Absent-after time must be between ${GEO_ATTENDANCE_LIMITS.absenceGraceMinutes.min} and ${durationMinutes} minutes.`,
      });
      return;
    }

    setOpeningRoom(true);
    setMessage(null);
    try {
      const now = new Date();
      const result = await openGeoAttendanceRoom({
        offering_id: selectedCourse.offering_id,
        teacher_user_id: user.id,
        room_number: geoRoomNumber,
        section: geoSectionGroup,
        start_time: now.toISOString(),
        range_meters: geoRangeMeters,
        duration_minutes: durationMinutes,
        absence_grace_minutes: geoAbsenceGraceMinutes,
      });
      if (result.success) {
        setMessage({
          type: 'success',
          text:
            `Geo room opened for ${selectedCourse.course_code} (${geoSectionGroup}). ` +
            `Students must stay within ${geoRangeMeters}m, the room stays open for ${durationMinutes} min, ` +
            `and leaving the area for ${geoAbsenceGraceMinutes} min marks them absent.`,
        });
        setGeoRoomNumber('');
        setGeoRangeMeters(GEO_ATTENDANCE_DEFAULTS.rangeMeters);
        setDurationMinutes(GEO_ATTENDANCE_DEFAULTS.durationMinutes);
        setGeoAbsenceGraceMinutes(GEO_ATTENDANCE_DEFAULTS.absenceGraceMinutes);
        await loadGeoRooms();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to open room' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to open geo room' });
    } finally {
      setOpeningRoom(false);
    }
  };

  const handleCloseGeoRoom = async (roomId: string) => {
    try {
      const result = await closeGeoAttendanceRoom(roomId, user?.id);
      if (result.success) {
        setMessage({ type: 'success', text: 'Geo room closed' });
        if (geoViewingRoomId === roomId) setGeoViewingRoomId(null);
        await loadGeoRooms();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to close room' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to close room' });
    }
  };

  const formatGeoTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const geoTimeRemaining = (endTime: string) => {
    const diff = new Date(endTime).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m remaining`;
    return `${mins}m remaining`;
  };

  // Preview active group
  const [previewGroup, setPreviewGroup] = useState(0);

  // Build preview tables per section
  const previewTable = useMemo(() => {
    if (!previewData.length || !students.length) return { dates: [] as string[], rows: [] as { roll: string; name: string; statuses: Record<string, Status> }[] };
    const dates = [...new Set(previewData.map(r => r.date))].sort();
    const rollMap = new Map<string, Record<string, Status>>();
    for (const r of previewData) {
      if (!rollMap.has(r.student_roll)) rollMap.set(r.student_roll, {});
      rollMap.get(r.student_roll)![r.date] = r.status;
    }
    const g = groups[previewGroup];
    const rows = students
      .filter(s => { const suf = rollSuffix(s.roll_no); return suf >= g.min && suf <= g.max; })
      .map(s => ({
        roll: s.roll_no,
        name: s.full_name,
        statuses: rollMap.get(s.roll_no) || {},
      }));
    return { dates, rows };
  }, [previewData, students, previewGroup, groups]);

  if (loadingCourses) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-[#b1a7a6]" />
      </div>
    );
  }

  // Step 1: Course selection
  if (!selectedCourse) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Take Attendance</h2>
          <p className="text-sm text-gray-400 dark:text-[#b1a7a6] mt-1">Select a course to take attendance</p>
        </div>
        {courses.length === 0 ? (
          <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 p-8 text-center">
            <ClipboardCheck className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
            <p className="text-gray-400 dark:text-[#b1a7a6]">No courses assigned yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c) => (
              <button
                key={c.offering_id}
                onClick={() => selectCourse(c)}
                className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 p-5 text-left hover:border-gray-300 dark:hover:border-red-400 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">{c.course_code}</p>
                    <p className="text-xs text-gray-400 dark:text-[#b1a7a6]">
                      {c.term} &middot; {c.credit} cr &middot; {c.course_type}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-[#b1a7a6] line-clamp-1">{c.course_title}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 2: Attendance view
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg border border-gray-200 dark:border-[#3d4951] text-gray-700 dark:text-[#b1a7a6] hover:bg-gray-50 dark:hover:bg-[#3d4951]/30 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedCourse.course_code}</h2>
            <p className="text-sm text-gray-400 dark:text-[#b1a7a6]">
              {selectedCourse.course_title} &middot; {selectedCourse.term} &middot; {selectedCourse.course_type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-[#3d4951] overflow-hidden text-sm">
            <button
              onClick={() => setViewMode('take')}
              className={`px-3 py-1.5 font-medium transition-colors ${viewMode === 'take' ? 'bg-gray-600 dark:bg-red-600 text-white' : 'text-gray-700 dark:text-[#b1a7a6] hover:bg-gray-50 dark:hover:bg-[#3d4951]/30'}`}
            >
              Take
            </button>
            <button
              onClick={switchToPreview}
              className={`px-3 py-1.5 font-medium transition-colors flex items-center gap-1 ${viewMode === 'preview' ? 'bg-gray-600 dark:bg-red-600 text-white' : 'text-gray-700 dark:text-[#b1a7a6] hover:bg-gray-50 dark:hover:bg-[#3d4951]/30'}`}
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
            <button
              onClick={switchToGeo}
              className={`px-3 py-1.5 font-medium transition-colors flex items-center gap-1 ${viewMode === 'geo' ? 'bg-teal-600 dark:bg-teal-700 text-white' : 'text-gray-700 dark:text-[#b1a7a6] hover:bg-gray-50 dark:hover:bg-[#3d4951]/30'}`}
            >
              <MapPin className="w-3.5 h-3.5" /> Geo Attendance
            </button>
          </div>
          {viewMode === 'take' && (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#3d4951] bg-white dark:bg-[#0b090a] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:focus:ring-red-400"
            />
          )}
        </div>
      </div>

      {/* ── Preview Mode ── Attendance Sheet Style ── */}
      {viewMode === 'preview' && (
        loadingPreview ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-[#b1a7a6]" /></div>
        ) : (
          <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 overflow-hidden">
            {/* ── Sheet Header ── */}
            <div className="px-5 py-4 border-b border-gray-200 dark:border-[#3d4951]/50 bg-white dark:bg-[#0b090a]">
              <p className="text-center text-xs text-gray-400 dark:text-[#b1a7a6] font-medium tracking-wide uppercase">
                Department of Computer Science and Engineering
              </p>
              <p className="text-center text-xs text-gray-400 dark:text-[#b1a7a6] mb-2">
                Khulna University of Engineering &amp; Technology
              </p>
              <h3 className="text-center text-base font-bold text-gray-900 dark:text-white tracking-wide">
                Attendance Sheet &mdash; {selectedCourse.term}
              </h3>
              <div className="flex justify-between mt-2 text-sm text-gray-700 dark:text-[#b1a7a6]">
                <span><strong>Subject Code:</strong> {selectedCourse.course_code}</span>
                <span><strong>Subject Name:</strong> {selectedCourse.course_title}</span>
              </div>
              <div className="flex justify-between mt-1 text-sm text-gray-700 dark:text-[#b1a7a6]">
                <span><strong>Session:</strong> {selectedCourse.session || '—'}</span>
                <span><strong>Type:</strong> {selectedCourse.course_type}</span>
              </div>
            </div>

            {/* ── Section/Group Tabs ── */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-[#0b090a]/80 border-b border-gray-200 dark:border-[#3d4951]/50 flex-wrap">
              {groups.map((g, gi) => (
                <button
                  key={gi}
                  onClick={() => setPreviewGroup(gi)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    previewGroup === gi
                      ? 'bg-gray-600 dark:bg-red-600 text-white'
                      : 'text-gray-700 dark:text-[#b1a7a6] hover:bg-[#DCC5B2]/30 dark:hover:bg-[#3d4951]/30'
                  }`}
                >
                  {g.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                {previewTable.dates.length > 0 && (
                  <span className="text-xs text-gray-400 dark:text-[#b1a7a6]">
                    {previewTable.dates.length} class{previewTable.dates.length !== 1 ? 'es' : ''} recorded
                  </span>
                )}
              </div>
              <button
                onClick={() =>
                  downloadAttendancePDF({
                    courseCode: selectedCourse.course_code,
                    courseTitle: selectedCourse.course_title,
                    term: selectedCourse.term,
                    session: selectedCourse.session,
                    courseType: selectedCourse.course_type,
                    sectionLabel: groups[previewGroup].label,
                    dates: previewTable.dates,
                    rows: previewTable.rows,
                  })
                }
                disabled={previewTable.dates.length === 0}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-600 dark:bg-red-600 text-white text-xs font-medium hover:bg-[#4E342E] dark:hover:bg-[#e5191e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>

            {/* ── Attendance Table ── */}
            {previewTable.dates.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardCheck className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
                <p className="text-gray-400 dark:text-[#b1a7a6]">No attendance records found yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-[#0b090a]/60">
                      <th className="border border-gray-200 dark:border-[#3d4951] px-2 py-2 text-center text-xs font-semibold text-gray-700 dark:text-white whitespace-nowrap w-10 sticky left-0 bg-gray-50 dark:bg-[#0b090a] z-10">
                        SL<br/>No.
                      </th>
                      <th className="border border-gray-200 dark:border-[#3d4951] px-2 py-2 text-center text-xs font-semibold text-gray-700 dark:text-white whitespace-nowrap w-20 sticky left-10 bg-gray-50 dark:bg-[#0b090a] z-10">
                        Class<br/>Roll No.
                      </th>
                      <th className="border border-gray-200 dark:border-[#3d4951] px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-white whitespace-nowrap min-w-[160px] sticky left-[7.5rem] bg-gray-50 dark:bg-[#0b090a] z-10">
                        Name
                      </th>
                      {previewTable.dates.map(d => (
                        <th key={d} className="border border-gray-200 dark:border-[#3d4951] px-1.5 py-2 text-center text-[10px] font-semibold text-gray-700 dark:text-white whitespace-nowrap min-w-[42px]">
                          {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewTable.rows.length === 0 ? (
                      <tr>
                        <td colSpan={3 + previewTable.dates.length} className="border border-gray-200 dark:border-[#3d4951] p-6 text-center text-gray-400 dark:text-[#b1a7a6]">
                          No students in this {isLab ? 'group' : 'section'}
                        </td>
                      </tr>
                    ) : previewTable.rows.map((row, i) => (
                      <tr key={row.roll} className="hover:bg-white dark:hover:bg-[#0b090a]/20">
                        <td className="border border-gray-200 dark:border-[#3d4951] px-2 py-1.5 text-center text-xs text-gray-700 dark:text-[#b1a7a6] sticky left-0 bg-white dark:bg-[#161a1d]">
                          {i + 1}
                        </td>
                        <td className="border border-gray-200 dark:border-[#3d4951] px-2 py-1.5 text-center text-xs font-medium text-gray-900 dark:text-white sticky left-10 bg-white dark:bg-[#161a1d]">
                          {row.roll}
                        </td>
                        <td className="border border-gray-200 dark:border-[#3d4951] px-3 py-1.5 text-xs text-gray-900 dark:text-white whitespace-nowrap sticky left-[7.5rem] bg-white dark:bg-[#161a1d]">
                          {row.name}
                        </td>
                        {previewTable.dates.map(d => {
                          const s = row.statuses[d];
                          return (
                            <td key={d} className="border border-gray-200 dark:border-[#3d4951] px-1 py-1.5 text-center">
                              {s ? (
                                <span className={`text-xs font-bold ${
                                  s === 'present' ? 'text-emerald-600 dark:text-emerald-400'
                                  : s === 'absent' ? 'text-red-600 dark:text-red-400'
                                  : 'text-amber-600 dark:text-amber-400'
                                }`}>
                                  {s === 'present' ? 'P' : s === 'absent' ? 'A' : 'L'}
                                </span>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Geo Attendance Mode ────────────────────── */}
      {viewMode === 'geo' && (
        <div className="space-y-5">
          {/* Active Rooms for this course */}
          {activeRooms.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Radio className="h-4 w-4 text-green-500 animate-pulse" />
                Active Room{activeRooms.length > 1 ? 's' : ''} ({activeRooms.length}/{geoMaxRooms})
              </h3>
              {activeRooms.map(room => (
                <div
                  key={room.id}
                  className="bg-white dark:bg-[#161a1d] rounded-xl border-2 border-green-300 dark:border-green-800 p-5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                        <DoorOpen className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedCourse.course_code} — {selectedCourse.course_title}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-[#b1a7a6] mt-0.5">
                          {selectedCourse.term} &middot; {selectedCourse.course_type} &middot; {selectedCourse.credit} cr
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm text-gray-500 dark:text-[#b1a7a6]">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatGeoTime(room.start_time)} – {formatGeoTime(room.end_time)}
                          </span>
                          {room.room_number && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              Room {room.room_number}
                            </span>
                          )}
                          {room.section && (
                            <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                              {room.section}
                            </span>
                          )}
                          <span className="rounded-full bg-green-100 dark:bg-green-900/40 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                            {geoTimeRemaining(room.end_time)}
                          </span>
                          <span className="rounded-full bg-teal-100 dark:bg-teal-900/40 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                            {room.range_meters}m radius
                          </span>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                            {room.duration_minutes}m open
                          </span>
                          <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                            {room.absence_grace_minutes}m absent
                          </span>
                          <span className="flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/40 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300">
                            <Users className="h-3 w-3" />
                            {room.submission_count ?? 0} submitted
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewGeoLogs(room.id)}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 transition hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      >
                        <Eye className="h-4 w-4" />
                        View Logs
                      </button>
                      <button
                        onClick={() => handleCloseGeoRoom(room.id)}
                        className="flex items-center gap-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 transition hover:bg-red-200 dark:hover:bg-red-900/50"
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

          {/* Geo Attendance Logs Panel */}
          {geoViewingRoomId && (
            <div className="rounded-xl border border-gray-200 dark:border-[#3d4951]/50 bg-white dark:bg-[#161a1d] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-[#0b090a]/50 border-b border-gray-200 dark:border-[#3d4951]/50">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <Users className="h-4 w-4 text-purple-500" />
                  Attendance Submissions ({geoRoomLogs.length})
                  {activeRooms.some(r => r.id === geoViewingRoomId) && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-400 animate-pulse">Live</span>
                  )}
                </h3>
                <button onClick={() => setGeoViewingRoomId(null)} className="text-gray-400 hover:text-gray-900 dark:text-[#b1a7a6] dark:hover:text-white">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
              {geoLoadingLogs ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
              ) : geoRoomLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-400 dark:text-[#b1a7a6]">No submissions yet. Waiting for students...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white dark:bg-[#0b090a]/50">
                      <tr>
                        <th className="px-4 py-3 font-medium text-gray-400 dark:text-[#b1a7a6]">#</th>
                        <th className="px-4 py-3 font-medium text-gray-400 dark:text-[#b1a7a6]">Roll No</th>
                        <th className="px-4 py-3 font-medium text-gray-400 dark:text-[#b1a7a6]">Name</th>
                        <th className="px-4 py-3 font-medium text-gray-400 dark:text-[#b1a7a6]">Distance</th>
                        <th className="px-4 py-3 font-medium text-gray-400 dark:text-[#b1a7a6]">Time</th>
                        <th className="px-4 py-3 font-medium text-gray-400 dark:text-[#b1a7a6]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8DDD1] dark:divide-[#3d4951]/50">
                      {geoRoomLogs.map((log, i) => (
                        <tr key={log.id} className="bg-white dark:bg-[#161a1d] hover:bg-gray-50 dark:hover:bg-[#0b090a]/30">
                          <td className="px-4 py-3 text-gray-400 dark:text-[#b1a7a6]">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{log.students?.roll_no ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-[#b1a7a6]">{log.students?.full_name ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-[#b1a7a6]">{log.distance_meters}m</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-[#b1a7a6]">{formatGeoTime(log.submitted_at)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${geoStatusClass(log.attendance_status ?? log.status)}`}>{log.attendance_status ?? log.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Create Room Form */}
          <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 p-6">
            <h3 className="flex items-center justify-between mb-4 text-sm font-semibold text-gray-900 dark:text-white">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Create Geo-Attendance Room
              </span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                geoCanOpenMore
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {activeRooms.length}/{geoMaxRooms} rooms active
              </span>
            </h3>

            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-white dark:bg-[#0b090a] border border-gray-200 dark:border-[#3d4951]/50">
              <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">{selectedCourse.course_code} — {selectedCourse.course_title}</p>
                <p className="text-xs text-gray-400 dark:text-[#b1a7a6]">{selectedCourse.term} &middot; {selectedCourse.course_type} &middot; {selectedCourse.credit} cr</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              {/* Section / Group */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-[#b1a7a6]">
                  Section / Group <span className="text-red-500">*</span>
                </label>
                <select
                  value={geoSectionGroup}
                  onChange={(e) => setGeoSectionGroup(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-[#3d4951] bg-white dark:bg-[#0b090a] px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">Select {isLab ? 'group' : 'section'}...</option>
                  {groups.map((g, gi) => (
                    <option key={gi} value={g.label}>{g.label}</option>
                  ))}
                </select>
              </div>

              {/* Room Number */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-[#b1a7a6]">
                  Room <span className="text-red-500">*</span>
                </label>
                <select
                  value={geoRoomNumber}
                  onChange={(e) => setGeoRoomNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-[#3d4951] bg-white dark:bg-[#0b090a] px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">Select GPS-enabled room...</option>
                  {geoAvailableRooms.map((room) => (
                    <option key={room.room_number} value={room.room_number}>
                      {room.room_number}{room.building_name ? ` — ${room.building_name}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-gray-400 dark:text-[#b1a7a6]">
                  Only rooms with saved GPS coordinates are shown here.
                </p>
              </div>

              {/* Radius */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-[#b1a7a6]">
                  Radius (meters)
                </label>
                <input
                  type="number"
                  min={GEO_ATTENDANCE_LIMITS.rangeMeters.min}
                  max={GEO_ATTENDANCE_LIMITS.rangeMeters.max}
                  step={1}
                  value={geoRangeMeters}
                  onChange={(e) => setGeoRangeMeters(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 dark:border-[#3d4951] bg-white dark:bg-[#0b090a] px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <p className={`mt-1 text-[10px] ${geoRangeValid ? 'text-gray-400 dark:text-[#b1a7a6]' : 'text-red-500'}`}>
                  Allowed: {GEO_ATTENDANCE_LIMITS.rangeMeters.min}-{GEO_ATTENDANCE_LIMITS.rangeMeters.max} meters.
                </p>
              </div>

              {/* Duration */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-[#b1a7a6]">
                  Open Time (minutes)
                </label>
                <input
                  type="number"
                  min={GEO_ATTENDANCE_LIMITS.durationMinutes.min}
                  max={GEO_ATTENDANCE_LIMITS.durationMinutes.max}
                  step={1}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 dark:border-[#3d4951] bg-white dark:bg-[#0b090a] px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <p className={`mt-1 text-[10px] ${geoDurationValid ? 'text-gray-400 dark:text-[#b1a7a6]' : 'text-red-500'}`}>
                  Allowed: {GEO_ATTENDANCE_LIMITS.durationMinutes.min}-{GEO_ATTENDANCE_LIMITS.durationMinutes.max} minutes.
                </p>
              </div>

              {/* Absent Grace */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-[#b1a7a6]">
                  Make Absent After (minutes)
                </label>
                <input
                  type="number"
                  min={GEO_ATTENDANCE_LIMITS.absenceGraceMinutes.min}
                  max={Math.max(
                    GEO_ATTENDANCE_LIMITS.absenceGraceMinutes.min,
                    durationMinutes,
                  )}
                  step={1}
                  value={geoAbsenceGraceMinutes}
                  onChange={(e) => setGeoAbsenceGraceMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 dark:border-[#3d4951] bg-white dark:bg-[#0b090a] px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <p className={`mt-1 text-[10px] ${geoAbsenceGraceValid ? 'text-gray-400 dark:text-[#b1a7a6]' : 'text-red-500'}`}>
                  Student is marked absent after staying outside the radius for this long.
                </p>
              </div>

              {/* Open Button */}
              <div className="flex items-end">
                <button
                  onClick={handleOpenGeoRoom}
                  disabled={
                    openingRoom ||
                    !geoSectionGroup ||
                    !geoRoomNumber ||
                    !geoCanOpenMore ||
                    !geoRangeValid ||
                    !geoDurationValid ||
                    !geoAbsenceGraceValid
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 dark:bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {openingRoom ? (
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

            <p className="mt-3 text-xs text-gray-400 dark:text-[#b1a7a6]">
              <MapPin className="inline h-3 w-3 mr-1" />
              Students must submit within <strong>{geoRangeMeters}m</strong> of the selected room, the room stays open for <strong>{durationMinutes} min</strong>, and leaving the area for <strong>{geoAbsenceGraceMinutes} min</strong> marks them absent.
              {!geoCanOpenMore && (
                <span className="text-red-500 font-medium ml-1">Room limit reached — close an existing room first.</span>
              )}
            </p>
          </div>

          {/* Recent Sessions for this course */}
          {loadingRooms ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-[#b1a7a6]" />
            </div>
          ) : recentRooms.length > 0 ? (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Clock className="h-4 w-4 text-gray-400 dark:text-[#b1a7a6]" />
                Recent Geo Sessions
              </h3>
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-[#3d4951]/50">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white dark:bg-[#0b090a]/50">
                    <tr>
                      <th className="px-4 py-3 font-medium text-gray-400 dark:text-[#b1a7a6]">Date</th>
                      <th className="px-4 py-3 font-medium text-gray-400 dark:text-[#b1a7a6]">Section</th>
                      <th className="px-4 py-3 font-medium text-gray-400 dark:text-[#b1a7a6]">Time Slot</th>
                      <th className="px-4 py-3 font-medium text-gray-400 dark:text-[#b1a7a6]">Room</th>
                      <th className="px-4 py-3 font-medium text-gray-400 dark:text-[#b1a7a6]">Rules</th>
                      <th className="px-4 py-3 font-medium text-gray-400 dark:text-[#b1a7a6]">Submissions</th>
                      <th className="px-4 py-3 font-medium text-gray-400 dark:text-[#b1a7a6]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8DDD1] dark:divide-[#3d4951]/50">
                    {recentRooms.map(room => (
                      <tr key={room.id} className="bg-white dark:bg-[#161a1d] hover:bg-gray-50 dark:hover:bg-[#0b090a]/30">
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{room.date}</td>
                        <td className="px-4 py-3">
                          {room.section ? (
                            <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                              {room.section}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-[#b1a7a6]">
                          {formatGeoTime(room.start_time)} – {formatGeoTime(room.end_time)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-[#b1a7a6]">{room.room_number || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-[#b1a7a6]">
                          {room.range_meters}m radius • {room.duration_minutes}m open • {room.absence_grace_minutes}m absent
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium text-xs">
                            <Users className="h-3 w-3" />
                            {room.submission_count ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleViewGeoLogs(room.id)}
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
          ) : (
            <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 p-8 text-center">
              <MapPin className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
              <p className="text-gray-400 dark:text-[#b1a7a6]">No geo-attendance sessions for this course yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Take Attendance Mode ────────────────────── */}
      {viewMode === 'take' && (
        <>
          {loadingStudents ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-[#b1a7a6]" /></div>
          ) : records.length === 0 ? (
            <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 p-8 text-center">
              <ClipboardCheck className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
              <p className="text-gray-400 dark:text-[#b1a7a6]">No students found for this course/term.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 overflow-hidden">
              {/* Group/Section tabs */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#0b090a] border-b border-gray-200 dark:border-[#3d4951]/50 flex-wrap gap-2">
                <div className="flex gap-1">
                  {groups.map((g, gi) => (
                    <button
                      key={gi}
                      onClick={() => setActiveGroup(gi)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeGroup === gi
                          ? 'bg-gray-600 dark:bg-red-600 text-white'
                          : 'text-gray-700 dark:text-[#b1a7a6] hover:bg-[#DCC5B2]/30 dark:hover:bg-[#3d4951]/30'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() => markAllInGroup(s)}
                        className={`px-2 py-1 rounded text-xs font-medium ${statusBadge[s]} hover:opacity-80 transition-opacity`}
                      >
                        All {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Save Attendance
                  </button>
                </div>
              </div>

              {/* Student table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white dark:bg-[#0b090a]/50">
                    <tr>
                      <th className="p-3 text-left text-xs font-medium text-gray-400 dark:text-[#b1a7a6]">#</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-400 dark:text-[#b1a7a6]">Roll</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-400 dark:text-[#b1a7a6]">Name</th>
                      <th className="p-3 text-center text-xs font-medium text-gray-400 dark:text-[#b1a7a6]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8DDD1] dark:divide-[#3d4951]/50">
                    {filteredIndices.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-gray-400 dark:text-[#b1a7a6]">
                          No students in this {isLab ? 'group' : 'section'}
                        </td>
                      </tr>
                    ) : (
                      filteredIndices.map((gi, seq) => {
                        const student = students[gi];
                        const record = records[gi];
                        return (
                          <tr key={gi} className="hover:bg-gray-50 dark:hover:bg-[#0b090a]/30 transition-colors">
                            <td className="p-3 text-gray-400 dark:text-[#b1a7a6]">{seq + 1}</td>
                            <td className="p-3 font-medium text-gray-900 dark:text-white">{student.roll_no}</td>
                            <td className="p-3 text-gray-900 dark:text-white">{student.full_name}</td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                {(['present', 'absent', 'late'] as Status[]).map(s => (
                                  <button
                                    key={s}
                                    onClick={() => setStatus(gi, s)}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                      record.status === s
                                        ? s === 'present' ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 scale-110'
                                        : s === 'absent'  ? 'bg-red-600 text-white ring-2 ring-red-400 scale-110'
                                        :                   'bg-amber-500 text-white ring-2 ring-amber-300 scale-110'
                                        : 'bg-gray-100 dark:bg-[#2a2e32] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#3d4951]'
                                    }`}
                                  >
                                    {s === 'present' ? 'P' : s === 'absent' ? 'A' : 'L'}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-2 text-xs text-gray-400 dark:text-[#b1a7a6] border-t border-gray-200 dark:border-[#3d4951]/50">
                Showing {filteredIndices.length} of {students.length} students &middot; Click P (Present), A (Absent), or L (Late)
              </div>
            </div>
          )}

        </>
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
    </div>
  );
}
