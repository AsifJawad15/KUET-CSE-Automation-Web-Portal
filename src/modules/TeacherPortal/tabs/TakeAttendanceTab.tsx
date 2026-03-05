"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMyCourses, getCourseStudents, saveAttendance, getAttendance, type TeacherCourse, type AttendanceRecord, type CourseStudent } from '@/services/teacherPortalService';
import { CheckCircle2, Loader2, AlertCircle, ClipboardCheck, ArrowLeft, GraduationCap, Eye } from 'lucide-react';

const STATUSES = ['present', 'absent', 'late'] as const;
type Status = typeof STATUSES[number];

const statusBadge: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  absent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  late: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

// Extract last digits of a roll number (e.g., "2107056" → 56)
function rollSuffix(roll: string): number {
  const match = roll.match(/(\d{1,3})$/);
  return match ? parseInt(match[1], 10) : 0;
}

type ViewMode = 'take' | 'preview';

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

  // Load assigned courses
  const loadCourses = useCallback(async () => {
    if (!user?.id) return;
    setLoadingCourses(true);
    const data = await getMyCourses(user.id);
    setCourses(data);
    setLoadingCourses(false);
  }, [user?.id]);

  useEffect(() => { loadCourses(); }, [loadCourses]);

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
    const result = await saveAttendance(sectionRecords);
    setSaving(false);
    if (result.success) {
      setMessage({ type: 'success', text: `Saved ${sectionRecords.length} students — ${g.label}` });
      if (selectedCourse) {
        getAttendance(selectedCourse.course_code).then(setPreviewData);
      }
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to save attendance' });
    }
  };

  // Load preview data
  const loadPreview = useCallback(async () => {
    if (!selectedCourse) return;
    setLoadingPreview(true);
    const data = await getAttendance(selectedCourse.course_code);
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
    setViewMode('take');
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
        <Loader2 className="w-6 h-6 animate-spin text-[#8B7355] dark:text-[#b1a7a6]" />
      </div>
    );
  }

  // Step 1: Course selection
  if (!selectedCourse) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[#2C1810] dark:text-white">Take Attendance</h2>
          <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6] mt-1">Select a course to take attendance</p>
        </div>
        {courses.length === 0 ? (
          <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-8 text-center">
            <ClipboardCheck className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
            <p className="text-[#8B7355] dark:text-[#b1a7a6]">No courses assigned yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c) => (
              <button
                key={c.offering_id}
                onClick={() => selectCourse(c)}
                className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-5 text-left hover:border-[#5D4037] dark:hover:border-[#ba181b] transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-bold text-[#2C1810] dark:text-white text-sm">{c.course_code}</p>
                    <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">
                      {c.term} &middot; {c.credit} cr &middot; {c.course_type}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-[#6B5744] dark:text-[#b1a7a6] line-clamp-1">{c.course_title}</p>
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
          <button onClick={goBack} className="p-2 rounded-lg border border-[#DCC5B2] dark:border-[#3d4951] text-[#5D4E37] dark:text-[#b1a7a6] hover:bg-[#F0E4D3] dark:hover:bg-[#3d4951]/30 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#2C1810] dark:text-white">{selectedCourse.course_code}</h2>
            <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6]">
              {selectedCourse.course_title} &middot; {selectedCourse.term} &middot; {selectedCourse.course_type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-[#DCC5B2] dark:border-[#3d4951] overflow-hidden text-sm">
            <button
              onClick={() => setViewMode('take')}
              className={`px-3 py-1.5 font-medium transition-colors ${viewMode === 'take' ? 'bg-[#5D4037] dark:bg-[#ba181b] text-white' : 'text-[#5D4E37] dark:text-[#b1a7a6] hover:bg-[#F0E4D3] dark:hover:bg-[#3d4951]/30'}`}
            >
              Take
            </button>
            <button
              onClick={switchToPreview}
              className={`px-3 py-1.5 font-medium transition-colors flex items-center gap-1 ${viewMode === 'preview' ? 'bg-[#5D4037] dark:bg-[#ba181b] text-white' : 'text-[#5D4E37] dark:text-[#b1a7a6] hover:bg-[#F0E4D3] dark:hover:bg-[#3d4951]/30'}`}
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
          </div>
          {viewMode === 'take' && (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[#DCC5B2] dark:border-[#3d4951] bg-[#FAF7F3] dark:bg-[#0b090a] text-[#2C1810] dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#5D4037] dark:focus:ring-[#ba181b]"
            />
          )}
        </div>
      </div>

      {/* ── Preview Mode ── Attendance Sheet Style ── */}
      {viewMode === 'preview' && (
        loadingPreview ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#8B7355] dark:text-[#b1a7a6]" /></div>
        ) : (
          <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 overflow-hidden">
            {/* ── Sheet Header ── */}
            <div className="px-5 py-4 border-b border-[#E8DDD1] dark:border-[#3d4951]/50 bg-[#FAF7F3] dark:bg-[#0b090a]">
              <p className="text-center text-xs text-[#8B7355] dark:text-[#b1a7a6] font-medium tracking-wide uppercase">
                Department of Computer Science and Engineering
              </p>
              <p className="text-center text-xs text-[#8B7355] dark:text-[#b1a7a6] mb-2">
                Khulna University of Engineering &amp; Technology
              </p>
              <h3 className="text-center text-base font-bold text-[#2C1810] dark:text-white tracking-wide">
                Attendance Sheet &mdash; {selectedCourse.term}
              </h3>
              <div className="flex justify-between mt-2 text-sm text-[#5D4E37] dark:text-[#b1a7a6]">
                <span><strong>Subject Code:</strong> {selectedCourse.course_code}</span>
                <span><strong>Subject Name:</strong> {selectedCourse.course_title}</span>
              </div>
              <div className="flex justify-between mt-1 text-sm text-[#5D4E37] dark:text-[#b1a7a6]">
                <span><strong>Session:</strong> {selectedCourse.session || '—'}</span>
                <span><strong>Type:</strong> {selectedCourse.course_type}</span>
              </div>
            </div>

            {/* ── Section/Group Tabs ── */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F5EDE4] dark:bg-[#0b090a]/80 border-b border-[#E8DDD1] dark:border-[#3d4951]/50 flex-wrap">
              {groups.map((g, gi) => (
                <button
                  key={gi}
                  onClick={() => setPreviewGroup(gi)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    previewGroup === gi
                      ? 'bg-[#5D4037] dark:bg-[#ba181b] text-white'
                      : 'text-[#5D4E37] dark:text-[#b1a7a6] hover:bg-[#DCC5B2]/30 dark:hover:bg-[#3d4951]/30'
                  }`}
                >
                  {g.label}
                </button>
              ))}
              {previewTable.dates.length > 0 && (
                <span className="ml-auto text-xs text-[#8B7355] dark:text-[#b1a7a6]">
                  {previewTable.dates.length} class{previewTable.dates.length !== 1 ? 'es' : ''} recorded
                </span>
              )}
            </div>

            {/* ── Attendance Table ── */}
            {previewTable.dates.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardCheck className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
                <p className="text-[#8B7355] dark:text-[#b1a7a6]">No attendance records found yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#F5EDE4] dark:bg-[#0b090a]/60">
                      <th className="border border-[#DCC5B2] dark:border-[#3d4951] px-2 py-2 text-center text-xs font-semibold text-[#5D4E37] dark:text-white whitespace-nowrap w-10 sticky left-0 bg-[#F5EDE4] dark:bg-[#0b090a] z-10">
                        SL<br/>No.
                      </th>
                      <th className="border border-[#DCC5B2] dark:border-[#3d4951] px-2 py-2 text-center text-xs font-semibold text-[#5D4E37] dark:text-white whitespace-nowrap w-20 sticky left-10 bg-[#F5EDE4] dark:bg-[#0b090a] z-10">
                        Class<br/>Roll No.
                      </th>
                      <th className="border border-[#DCC5B2] dark:border-[#3d4951] px-3 py-2 text-left text-xs font-semibold text-[#5D4E37] dark:text-white whitespace-nowrap min-w-[160px] sticky left-[7.5rem] bg-[#F5EDE4] dark:bg-[#0b090a] z-10">
                        Name
                      </th>
                      {previewTable.dates.map(d => (
                        <th key={d} className="border border-[#DCC5B2] dark:border-[#3d4951] px-1.5 py-2 text-center text-[10px] font-semibold text-[#5D4E37] dark:text-white whitespace-nowrap min-w-[42px]">
                          {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewTable.rows.length === 0 ? (
                      <tr>
                        <td colSpan={3 + previewTable.dates.length} className="border border-[#DCC5B2] dark:border-[#3d4951] p-6 text-center text-[#8B7355] dark:text-[#b1a7a6]">
                          No students in this {isLab ? 'group' : 'section'}
                        </td>
                      </tr>
                    ) : previewTable.rows.map((row, i) => (
                      <tr key={row.roll} className="hover:bg-[#FAF7F3] dark:hover:bg-[#0b090a]/20">
                        <td className="border border-[#DCC5B2] dark:border-[#3d4951] px-2 py-1.5 text-center text-xs text-[#5D4E37] dark:text-[#b1a7a6] sticky left-0 bg-white dark:bg-[#161a1d]">
                          {i + 1}
                        </td>
                        <td className="border border-[#DCC5B2] dark:border-[#3d4951] px-2 py-1.5 text-center text-xs font-medium text-[#2C1810] dark:text-white sticky left-10 bg-white dark:bg-[#161a1d]">
                          {row.roll}
                        </td>
                        <td className="border border-[#DCC5B2] dark:border-[#3d4951] px-3 py-1.5 text-xs text-[#2C1810] dark:text-white whitespace-nowrap sticky left-[7.5rem] bg-white dark:bg-[#161a1d]">
                          {row.name}
                        </td>
                        {previewTable.dates.map(d => {
                          const s = row.statuses[d];
                          return (
                            <td key={d} className="border border-[#DCC5B2] dark:border-[#3d4951] px-1 py-1.5 text-center">
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

      {/* ── Take Attendance Mode ────────────────────── */}
      {viewMode === 'take' && (
        <>
          {loadingStudents ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#8B7355] dark:text-[#b1a7a6]" /></div>
          ) : records.length === 0 ? (
            <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-8 text-center">
              <ClipboardCheck className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
              <p className="text-[#8B7355] dark:text-[#b1a7a6]">No students found for this course/term.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 overflow-hidden">
              {/* Group/Section tabs */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#F5EDE4] dark:bg-[#0b090a] border-b border-[#E8DDD1] dark:border-[#3d4951]/50 flex-wrap gap-2">
                <div className="flex gap-1">
                  {groups.map((g, gi) => (
                    <button
                      key={gi}
                      onClick={() => setActiveGroup(gi)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeGroup === gi
                          ? 'bg-[#5D4037] dark:bg-[#ba181b] text-white'
                          : 'text-[#5D4E37] dark:text-[#b1a7a6] hover:bg-[#DCC5B2]/30 dark:hover:bg-[#3d4951]/30'
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
                  <thead className="bg-[#FAF7F3] dark:bg-[#0b090a]/50">
                    <tr>
                      <th className="p-3 text-left text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6]">#</th>
                      <th className="p-3 text-left text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6]">Roll</th>
                      <th className="p-3 text-left text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6]">Name</th>
                      <th className="p-3 text-center text-xs font-medium text-[#8B7355] dark:text-[#b1a7a6]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8DDD1] dark:divide-[#3d4951]/50">
                    {filteredIndices.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-[#8B7355] dark:text-[#b1a7a6]">
                          No students in this {isLab ? 'group' : 'section'}
                        </td>
                      </tr>
                    ) : (
                      filteredIndices.map((gi, seq) => {
                        const student = students[gi];
                        const record = records[gi];
                        return (
                          <tr key={gi} className="hover:bg-[#F5EDE4] dark:hover:bg-[#0b090a]/30 transition-colors">
                            <td className="p-3 text-[#8B7355] dark:text-[#b1a7a6]">{seq + 1}</td>
                            <td className="p-3 font-medium text-[#2C1810] dark:text-white">{student.roll_no}</td>
                            <td className="p-3 text-[#2C1810] dark:text-white">{student.full_name}</td>
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

              <div className="px-4 py-2 text-xs text-[#8B7355] dark:text-[#b1a7a6] border-t border-[#E8DDD1] dark:border-[#3d4951]/50">
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
