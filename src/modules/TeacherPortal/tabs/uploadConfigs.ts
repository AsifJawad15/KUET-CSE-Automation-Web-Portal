// ==========================================
// Upload Configs for Teacher Portal
// Extends UploadEntityConfig — same pattern as configs.ts
// ==========================================

import type { UploadEntityConfig, ParsedRecord } from '@/components/upload/types';

// ── Attendance Upload Config ───────────────────────────

export const attendanceUploadConfig: UploadEntityConfig = {
  entityName: 'Attendance',
  entityNamePlural: 'Attendance Records',
  columns: [
    {
      key: 'course_code',
      label: 'Course Code',
      required: true,
      aliases: ['course_code', 'course code', 'course', 'code'],
      transform: (v) => v.toUpperCase().trim(),
      validate: (v, row) => (!v ? `Row ${row}: Course code is required` : null),
    },
    {
      key: 'student_roll',
      label: 'Student Roll',
      required: true,
      aliases: ['student_roll', 'roll', 'roll_no', 'roll no', 'student roll', 'id'],
      validate: (v, row) => (!v ? `Row ${row}: Student roll is required` : null),
    },
    {
      key: 'date',
      label: 'Date',
      required: true,
      aliases: ['date', 'attendance_date', 'attendance date', 'class_date'],
      validate: (v, row) => {
        if (!v) return `Row ${row}: Date is required`;
        if (isNaN(Date.parse(v))) return `Row ${row}: Invalid date "${v}"`;
        return null;
      },
    },
    {
      key: 'status',
      label: 'Status',
      required: true,
      aliases: ['status', 'attendance_status', 'attendance', 'present'],
      transform: (v) => {
        const lower = v.toLowerCase().trim();
        if (lower === 'p' || lower === 'present' || lower === '1' || lower === 'yes') return 'present';
        if (lower === 'l' || lower === 'late') return 'late';
        return 'absent';
      },
      validate: (v, row) => {
        if (!['present', 'absent', 'late'].includes(v)) {
          return `Row ${row}: Status must be present, absent, or late`;
        }
        return null;
      },
    },
    {
      key: 'section_or_group',
      label: 'Section/Group',
      required: false,
      aliases: ['section', 'group', 'section_or_group', 'sec'],
      defaultValue: '',
    },
  ],
  bulkEndpoint: '/api/teacher-portal/attendance',
  generateTemplate: () =>
    'Course Code,Student Roll,Date,Status,Section\nCSE 3201,2107001,2026-03-05,present,A\nCSE 3201,2107002,2026-03-05,absent,A',
  transformForApi: (records: ParsedRecord[]) => {
    const items: Record<string, unknown>[] = [];
    const errors: string[] = [];
    for (const r of records) {
      if (!r.course_code || !r.student_roll || !r.date || !r.status) {
        errors.push(`Skipping roll ${r.student_roll || '?'}: missing required fields`);
        continue;
      }
      items.push({
        course_code: r.course_code,
        student_roll: r.student_roll,
        date: r.date,
        status: r.status,
        section_or_group: r.section_or_group || null,
      });
    }
    // API expects { records: [...] }
    return { items, errors };
  },
};

// ── Exam Marks Upload Config ───────────────────────────

export const examMarksUploadConfig: UploadEntityConfig = {
  entityName: 'Exam Marks',
  entityNamePlural: 'Exam Marks Records',
  columns: [
    {
      key: 'course_code',
      label: 'Course Code',
      required: true,
      aliases: ['course_code', 'course code', 'course', 'code'],
      transform: (v) => v.toUpperCase().trim(),
      validate: (v, row) => (!v ? `Row ${row}: Course code is required` : null),
    },
    {
      key: 'student_roll',
      label: 'Student Roll',
      required: true,
      aliases: ['student_roll', 'roll', 'roll_no', 'roll no', 'student roll', 'id'],
      validate: (v, row) => (!v ? `Row ${row}: Student roll is required` : null),
    },
    {
      key: 'exam_type',
      label: 'Exam Type',
      required: true,
      aliases: ['exam_type', 'exam type', 'type', 'exam', 'assessment'],
      transform: (v) => {
        const lower = v.toLowerCase().trim();
        if (lower.includes('ct') || lower.includes('class test')) return 'CT';
        if (lower.includes('quiz')) return 'Quiz';
        if (lower.includes('mid')) return 'Mid-Term';
        if (lower.includes('final')) return 'Final';
        if (lower.includes('viva')) return 'Viva';
        if (lower.includes('assignment')) return 'Assignment';
        if (lower.includes('lab')) return 'Lab';
        return v.trim();
      },
      validate: (v, row) => (!v ? `Row ${row}: Exam type is required` : null),
    },
    {
      key: 'marks',
      label: 'Marks',
      required: true,
      aliases: ['marks', 'obtained', 'obtained_marks', 'score', 'obtained marks'],
      validate: (v, row) => {
        const n = parseFloat(v);
        if (isNaN(n) || n < 0) return `Row ${row}: Marks must be a non-negative number`;
        return null;
      },
    },
    {
      key: 'total_marks',
      label: 'Total Marks',
      required: true,
      aliases: ['total_marks', 'total marks', 'total', 'max_marks', 'max marks', 'out_of', 'out of'],
      validate: (v, row) => {
        const n = parseFloat(v);
        if (isNaN(n) || n <= 0) return `Row ${row}: Total marks must be positive`;
        return null;
      },
    },
  ],
  bulkEndpoint: '/api/teacher-portal/marks',
  generateTemplate: () =>
    'Course Code,Student Roll,Exam Type,Marks,Total Marks\nCSE 3201,2107001,CT,18,20\nCSE 3201,2107002,CT,15,20\nCSE 3201,2107001,Quiz,8,10',
  transformForApi: (records: ParsedRecord[]) => {
    const items: Record<string, unknown>[] = [];
    const errors: string[] = [];
    for (const r of records) {
      const marks = parseFloat(r.marks);
      const totalMarks = parseFloat(r.total_marks);
      if (isNaN(marks) || isNaN(totalMarks)) {
        errors.push(`Skipping roll ${r.student_roll || '?'}: invalid marks`);
        continue;
      }
      if (marks > totalMarks) {
        errors.push(`Roll ${r.student_roll}: Marks (${marks}) exceed total (${totalMarks})`);
        continue;
      }
      items.push({
        course_code: r.course_code,
        student_roll: r.student_roll,
        exam_type: r.exam_type,
        marks,
        total_marks: totalMarks,
      });
    }
    return { items, errors };
  },
};
