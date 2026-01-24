"use client";

import { useState } from 'react';
import { sampleStudents, sampleCourses } from '@/data/sampleData';

interface TheoryResultEntry {
  studentId: string;
  courseCode: string;
  ct1: number;
  ct2: number;
  ct3: number;
  attendance: number;
  assignment: number;
}

export default function ResultPage() {
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('A');
  const [results, setResults] = useState<TheoryResultEntry[]>([]);
  const [viewMode, setViewMode] = useState<'input' | 'view'>('input');

  const filteredStudents = sampleStudents.filter(s => s.section === selectedSection);

  const handleResultChange = (studentId: string, field: keyof TheoryResultEntry, value: number) => {
    setResults(prev => {
      const existing = prev.find(r => r.studentId === studentId && r.courseCode === selectedCourse);
      if (existing) {
        return prev.map(r => 
          r.studentId === studentId && r.courseCode === selectedCourse
            ? { ...r, [field]: value }
            : r
        );
      }
      return [...prev, {
        studentId,
        courseCode: selectedCourse,
        ct1: 0,
        ct2: 0,
        ct3: 0,
        attendance: 0,
        assignment: 0,
        [field]: value,
      }];
    });
  };

  const getResultValue = (studentId: string, field: keyof TheoryResultEntry): number => {
    const result = results.find(r => r.studentId === studentId && r.courseCode === selectedCourse);
    return result ? (result[field] as number) : 0;
  };

  const calculateTotal = (studentId: string): number => {
    const r = results.find(res => res.studentId === studentId && res.courseCode === selectedCourse);
    if (!r) return 0;
    return r.ct1 + r.ct2 + r.ct3 + r.attendance + r.assignment;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Result Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Enter and manage student results</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('input')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              viewMode === 'input' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' 
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Input Results
          </button>
          <button
            onClick={() => setViewMode('view')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              viewMode === 'view' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' 
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            View Results
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">Select Course</option>
          {sampleCourses.filter(c => c.type === 'theory').map(course => (
            <option key={course.id} value={course.code}>{course.code} - {course.title}</option>
          ))}
        </select>
        <select
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="A">Section A</option>
          <option value="B">Section B</option>
        </select>
      </div>

      {/* Results Table */}
      {selectedCourse && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {sampleCourses.find(c => c.code === selectedCourse)?.title} - Section {selectedSection}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Roll</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Name</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">CT-1 (20)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">CT-2 (20)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">CT-3 (20)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Attendance (10)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Assignment (5)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{student.roll}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{student.name}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={getResultValue(student.id, 'ct1') || ''}
                        onChange={(e) => handleResultChange(student.id, 'ct1', parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={getResultValue(student.id, 'ct2') || ''}
                        onChange={(e) => handleResultChange(student.id, 'ct2', parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={getResultValue(student.id, 'ct3') || ''}
                        onChange={(e) => handleResultChange(student.id, 'ct3', parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={getResultValue(student.id, 'attendance') || ''}
                        onChange={(e) => handleResultChange(student.id, 'attendance', parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={getResultValue(student.id, 'assignment') || ''}
                        onChange={(e) => handleResultChange(student.id, 'assignment', parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">
                      {calculateTotal(student.id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Save Results
            </button>
          </div>
        </div>
      )}

      {!selectedCourse && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a Course</h3>
          <p className="text-gray-500 dark:text-gray-400">Choose a course from the dropdown to start entering results</p>
        </div>
      )}
    </div>
  );
}
