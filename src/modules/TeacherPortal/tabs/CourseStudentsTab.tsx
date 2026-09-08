"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { getMyCourses, getCourseStudents, type TeacherCourse, type CourseStudent } from '@/services/teacherPortalService';
import { Loader2, Users, Download, GraduationCap } from 'lucide-react';

// Group courses by term
function groupByTerm(courses: TeacherCourse[]): Record<string, TeacherCourse[]> {
  const groups: Record<string, TeacherCourse[]> = {};
  for (const c of courses) {
    const key = c.term || 'Unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  return groups;
}

const TERM_ORDER = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'];

export default function CourseStudentsTab() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<TeacherCourse | null>(null);
  const [students, setStudents] = useState<CourseStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const loadCourses = useCallback(async () => {
    if (!user?.id) return;
    setLoadingCourses(true);
    const data = await getMyCourses(user.id);
    setCourses(data);
    setLoadingCourses(false);
  }, [user?.id]);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  const selectCourse = async (course: TeacherCourse) => {
    setSelectedCourse(course);
    setLoadingStudents(true);
    const data = await getCourseStudents(course.course_code, course.term, course.section || undefined, course.offering_id);
    setStudents(data);
    setLoadingStudents(false);
  };

  const handleExportCSV = () => {
    if (!selectedCourse || students.length === 0) return;
    const header = 'Roll No,Name,Email,Phone,Section,Term,Session\n';
    const rows = students.map(s =>
      `${s.roll_no},${s.full_name},${s.email},${s.phone},${s.section || ''},${s.term},${s.session}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedCourse.course_code}_students.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingCourses) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-[#b1a7a6]" />
      </div>
    );
  }

  // Step 1: Show courses grouped by term
  if (!selectedCourse) {
    const grouped = groupByTerm(courses);
    const sortedTerms = Object.keys(grouped).sort(
      (a, b) => TERM_ORDER.indexOf(a) - TERM_ORDER.indexOf(b)
    );

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Course Students</h2>
          <p className="text-sm text-gray-400 dark:text-[#b1a7a6] mt-1">View students by course, organized by term</p>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 p-8 text-center">
            <Users className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
            <p className="text-gray-400 dark:text-[#b1a7a6]">No courses assigned yet.</p>
          </div>
        ) : (
          sortedTerms.map(term => (
            <div key={term}>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-[#e5383b] mb-3 uppercase tracking-wider">
                Term {term}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped[term].map((c) => (
                  <button
                    key={c.offering_id}
                    onClick={() => selectCourse(c)}
                    className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 p-4 text-left hover:border-gray-300 dark:hover:border-red-400 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-600/10 dark:bg-red-600/20 flex items-center justify-center">
                        <GraduationCap className="w-4 h-4 text-gray-600 dark:text-[#e5383b]" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{c.course_code}</p>
                        <p className="text-xs text-gray-400 dark:text-[#b1a7a6] line-clamp-1">{c.course_title}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 dark:bg-[#0b090a] text-gray-700 dark:text-[#b1a7a6]">{c.course_type}</span>
                      {c.section && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 dark:bg-[#0b090a] text-gray-700 dark:text-[#b1a7a6]">Sec {c.section}</span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 dark:bg-[#0b090a] text-gray-700 dark:text-[#b1a7a6]">{c.credit} cr</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  // Step 2: Show students for selected course
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {selectedCourse.course_code} — Students
          </h2>
          <p className="text-sm text-gray-400 dark:text-[#b1a7a6] mt-1">
            {selectedCourse.course_title} &middot; Term {selectedCourse.term}
            {selectedCourse.section ? ` &middot; Sec ${selectedCourse.section}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {students.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 text-xs border border-gray-200 dark:border-[#3d4951] text-gray-700 dark:text-[#b1a7a6] rounded-lg hover:bg-gray-50 dark:hover:bg-[#3d4951]/30 transition-colors flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Export CSV
            </button>
          )}
          <button
            onClick={() => { setSelectedCourse(null); setStudents([]); }}
            className="px-4 py-2 border border-gray-200 dark:border-[#3d4951] text-gray-700 dark:text-[#b1a7a6] rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-[#3d4951]/30 transition-colors"
          >
            Back to Courses
          </button>
        </div>
      </div>

      {loadingStudents ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-[#b1a7a6]" />
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 p-8 text-center">
          <Users className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
          <p className="text-gray-400 dark:text-[#b1a7a6]">No students found for this course.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-gray-200 dark:border-[#3d4951]/50 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-[#0b090a] border-b border-gray-200 dark:border-[#3d4951]/50">
            <span className="text-sm font-medium text-gray-700 dark:text-white">
              {students.length} student{students.length !== 1 ? 's' : ''} enrolled
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white dark:bg-[#0b090a]/50">
                <tr>
                  <th className="p-3 text-left text-xs font-medium text-gray-400 dark:text-[#b1a7a6]">#</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-400 dark:text-[#b1a7a6]">Roll</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-400 dark:text-[#b1a7a6]">Name</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-400 dark:text-[#b1a7a6]">Email</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-400 dark:text-[#b1a7a6]">Phone</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-400 dark:text-[#b1a7a6]">Section</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DDD1] dark:divide-[#3d4951]/50">
                {students.map((s, i) => (
                  <tr key={s.roll_no} className="hover:bg-gray-50 dark:hover:bg-[#0b090a]/30 transition-colors">
                    <td className="p-3 text-gray-400 dark:text-[#b1a7a6]">{i + 1}</td>
                    <td className="p-3 font-medium text-gray-900 dark:text-white">{s.roll_no}</td>
                    <td className="p-3 text-gray-900 dark:text-white">{s.full_name}</td>
                    <td className="p-3 text-gray-500 dark:text-[#b1a7a6]">{s.email}</td>
                    <td className="p-3 text-gray-500 dark:text-[#b1a7a6]">{s.phone}</td>
                    <td className="p-3 text-gray-500 dark:text-[#b1a7a6]">{s.section || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
