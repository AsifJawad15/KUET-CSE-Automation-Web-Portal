"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import FileUploadModal from '@/components/upload/FileUploadModal';
import { Upload, FileSpreadsheet, Loader2, GraduationCap, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { attendanceUploadConfig, examMarksUploadConfig } from './uploadConfigs';
import { getMyCourses, type TeacherCourse } from '@/services/teacherPortalService';

type UploadType = 'attendance' | 'marks';

export default function UploadCSVTab() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<TeacherCourse | null>(null);
  const [uploadType, setUploadType] = useState<UploadType>('attendance');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  const loadCourses = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const data = await getMyCourses(user.id);
    setCourses(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  const configMap: Record<UploadType, typeof attendanceUploadConfig> = {
    attendance: attendanceUploadConfig,
    marks: examMarksUploadConfig,
  };

  const handleImportComplete = () => {
    setShowUpload(false);
    setUploadDone(true);
  };

  const resetUpload = () => {
    setUploadDone(false);
    setShowUpload(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#8B7355] dark:text-[#b1a7a6]" />
      </div>
    );
  }

  // Step 1: Select a course
  if (!selectedCourse) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[#2C1810] dark:text-white">Upload CSV</h2>
          <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6] mt-1">Select a course to upload attendance or marks</p>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-8 text-center">
            <GraduationCap className="w-10 h-10 mx-auto text-[#DCC5B2] dark:text-[#3d4951] mb-3" />
            <p className="text-[#8B7355] dark:text-[#b1a7a6]">No courses assigned yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c) => (
              <button
                key={c.offering_id}
                onClick={() => { setSelectedCourse(c); setUploadDone(false); }}
                className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-5 text-left hover:border-[#5D4037] dark:hover:border-[#ba181b] transition-colors group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-[#5D4037]/10 dark:bg-[#ba181b]/20 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-[#5D4037] dark:text-[#e5383b]" />
                  </div>
                  <div>
                    <p className="font-bold text-[#2C1810] dark:text-white text-sm">{c.course_code}</p>
                    <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">
                      {c.term} &middot; {c.course_type}
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

  // Step 2: Select type + upload for the selected course
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedCourse(null); resetUpload(); }}
            className="p-2 rounded-lg border border-[#DCC5B2] dark:border-[#3d4951] text-[#5D4E37] dark:text-[#b1a7a6] hover:bg-[#F0E4D3] dark:hover:bg-[#3d4951]/30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#2C1810] dark:text-white">
              Upload CSV — {selectedCourse.course_code}
            </h2>
            <p className="text-sm text-[#8B7355] dark:text-[#b1a7a6]">
              {selectedCourse.course_title} &middot; Term {selectedCourse.term}
            </p>
          </div>
        </div>
      </div>

      {/* Upload Type Selector */}
      <div className="bg-white dark:bg-[#161a1d] rounded-xl border border-[#E8DDD1] dark:border-[#3d4951]/50 p-5">
        <label className="block text-sm font-medium text-[#5D4E37] dark:text-[#b1a7a6] mb-3">What do you want to upload?</label>
        <div className="flex gap-3">
          <button
            onClick={() => { setUploadType('attendance'); resetUpload(); }}
            className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              uploadType === 'attendance'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-[#E8DDD1] dark:border-[#3d4951]/50 hover:border-[#DCC5B2] dark:hover:border-[#3d4951]'
            }`}
          >
            <Upload className={`w-5 h-5 ${uploadType === 'attendance' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#8B7355] dark:text-[#b1a7a6]'}`} />
            <div className="text-left">
              <p className={`font-medium text-sm ${uploadType === 'attendance' ? 'text-emerald-700 dark:text-emerald-300' : 'text-[#2C1810] dark:text-white'}`}>Attendance</p>
              <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">Roll, Date, Status</p>
            </div>
          </button>
          <button
            onClick={() => { setUploadType('marks'); resetUpload(); }}
            className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              uploadType === 'marks'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-[#E8DDD1] dark:border-[#3d4951]/50 hover:border-[#DCC5B2] dark:hover:border-[#3d4951]'
            }`}
          >
            <FileSpreadsheet className={`w-5 h-5 ${uploadType === 'marks' ? 'text-blue-600 dark:text-blue-400' : 'text-[#8B7355] dark:text-[#b1a7a6]'}`} />
            <div className="text-left">
              <p className={`font-medium text-sm ${uploadType === 'marks' ? 'text-blue-700 dark:text-blue-300' : 'text-[#2C1810] dark:text-white'}`}>Exam Marks</p>
              <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6]">Roll, Exam Type, Marks</p>
            </div>
          </button>
        </div>
      </div>

      {/* Upload Done Message */}
      {uploadDone && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-5 flex items-center gap-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-medium text-emerald-800 dark:text-emerald-300">Upload Successful!</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
              {uploadType === 'attendance' ? 'Attendance' : 'Exam marks'} data has been imported for {selectedCourse.course_code}.
            </p>
          </div>
          <button
            onClick={resetUpload}
            className="ml-auto px-3 py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
          >
            Upload Another
          </button>
        </div>
      )}

      {/* Upload Button */}
      {!uploadDone && (
        <button
          onClick={() => setShowUpload(true)}
          className={`w-full py-4 rounded-xl font-medium text-white transition-colors ${
            uploadType === 'attendance'
              ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600'
              : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600'
          }`}
        >
          Upload {uploadType === 'attendance' ? 'Attendance' : 'Exam Marks'} CSV for {selectedCourse.course_code}
        </button>
      )}

      {showUpload && (
        <FileUploadModal
          show={showUpload}
          onClose={() => setShowUpload(false)}
          onImportComplete={handleImportComplete}
          config={configMap[uploadType]}
        />
      )}
    </div>
  );
}
