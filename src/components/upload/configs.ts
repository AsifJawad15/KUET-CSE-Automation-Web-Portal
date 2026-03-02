// ==========================================
// Per-Entity Upload Configurations
// Each config implements UploadEntityConfig
// Used by FileUploadModal to customize behavior per entity
// ==========================================

import type { UploadEntityConfig, ParsedRecord } from './types';

// ── Course Upload Config ───────────────────────────────

export const courseUploadConfig: UploadEntityConfig = {
  entityName: 'Course',
  entityNamePlural: 'Courses',
  columns: [
    {
      key: 'code',
      label: 'Course Code',
      required: true,
      aliases: ['code', 'course_code', 'course code', 'coursecode'],
      transform: (v) => v.toUpperCase().trim(),
      validate: (v, row) => (!v ? `Row ${row}: Course code is required` : null),
    },
    {
      key: 'title',
      label: 'Title',
      required: true,
      aliases: ['title', 'course_title', 'course title', 'name', 'course_name', 'course name'],
      validate: (v, row) => (!v ? `Row ${row}: Title is required` : null),
    },
    {
      key: 'credit',
      label: 'Credit',
      required: true,
      aliases: ['credit', 'credits', 'credit_hour', 'credit hour', 'credit_hours'],
      validate: (v, row) => {
        const n = parseFloat(v);
        if (isNaN(n) || n <= 0) return `Row ${row}: Credit must be a positive number`;
        return null;
      },
    },
    {
      key: 'course_type',
      label: 'Type',
      required: false,
      aliases: ['type', 'course_type', 'course type', 'category'],
      defaultValue: 'Theory',
      transform: (v) => {
        const lower = v.toLowerCase().trim();
        if (lower.includes('lab') || lower.includes('sessional')) return 'Lab';
        if (lower.includes('theory')) return 'Theory';
        if (lower.includes('project') || lower.includes('thesis')) return 'Project/Thesis';
        return v || 'Theory';
      },
    },
    {
      key: 'description',
      label: 'Description',
      required: false,
      aliases: ['description', 'desc', 'details', 'about'],
      defaultValue: '',
    },
  ],
  bulkEndpoint: '/api/courses/bulk',
  generateTemplate: () =>
    'Course Code,Title,Credit,Type,Description\nCSE 1101,Structured Programming,3,Theory,Introduction to C programming\nCSE 1102,Structured Programming Lab,1.5,Lab,Hands-on C programming',
  transformForApi: (records: ParsedRecord[]) => {
    const items: Record<string, unknown>[] = [];
    const errors: string[] = [];
    for (const r of records) {
      const credit = parseFloat(r.credit);
      if (isNaN(credit) || credit <= 0) {
        errors.push(`Skipping "${r.code}": invalid credit "${r.credit}"`);
        continue;
      }
      items.push({
        code: r.code,
        title: r.title,
        credit,
        course_type: r.course_type || 'Theory',
        description: r.description || null,
      });
    }
    return { items, errors };
  },
};

// ── Teacher/Faculty Upload Config ──────────────────────

export const teacherUploadConfig: UploadEntityConfig = {
  entityName: 'Faculty',
  entityNamePlural: 'Faculty Members',
  columns: [
    {
      key: 'full_name',
      label: 'Full Name',
      required: true,
      aliases: ['name', 'full_name', 'full name', 'teacher_name', 'teacher name', 'faculty_name', 'faculty name'],
      validate: (v, row) => (!v ? `Row ${row}: Name is required` : null),
    },
    {
      key: 'email',
      label: 'Email',
      required: true,
      aliases: ['email', 'email_address', 'email address', 'mail'],
      transform: (v) => v.toLowerCase().trim(),
      validate: (v, row) => {
        if (!v) return `Row ${row}: Email is required`;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `Row ${row}: Invalid email "${v}"`;
        return null;
      },
    },
    {
      key: 'phone',
      label: 'Phone',
      required: false,
      aliases: ['phone', 'phone_number', 'phone number', 'mobile', 'contact'],
      defaultValue: '',
    },
    {
      key: 'designation',
      label: 'Designation',
      required: false,
      aliases: ['designation', 'position', 'rank', 'title', 'role'],
      defaultValue: 'LECTURER',
      transform: (v) => {
        const lower = v.toLowerCase().replace(/[^a-z]/g, '');
        if (lower.includes('professor') && lower.includes('associate')) return 'ASSOCIATE_PROFESSOR';
        if (lower.includes('professor') && lower.includes('assistant')) return 'ASSISTANT_PROFESSOR';
        if (lower.includes('professor')) return 'PROFESSOR';
        return 'LECTURER';
      },
    },
  ],
  bulkEndpoint: '/api/teachers/bulk',
  generateTemplate: () =>
    'Full Name,Email,Phone,Designation\nDr. John Doe,john.doe@kuet.ac.bd,01712345678,PROFESSOR\nJane Smith,jane.smith@kuet.ac.bd,01798765432,LECTURER',
  transformForApi: (records: ParsedRecord[]) => {
    const items: Record<string, unknown>[] = [];
    const errors: string[] = [];
    for (const r of records) {
      if (!r.full_name || !r.email) {
        errors.push(`Skipping row: missing name or email`);
        continue;
      }
      items.push({
        full_name: r.full_name,
        email: r.email,
        phone: r.phone || '',
        designation: r.designation || 'LECTURER',
      });
    }
    return { items, errors };
  },
};

// ── Student Upload Config ──────────────────────────────

export const studentUploadConfig: UploadEntityConfig = {
  entityName: 'Student',
  entityNamePlural: 'Students',
  columns: [
    {
      key: 'full_name',
      label: 'Full Name',
      required: true,
      aliases: ['name', 'full_name', 'full name', 'student_name', 'student name'],
      validate: (v, row) => (!v ? `Row ${row}: Name is required` : null),
    },
    {
      key: 'email',
      label: 'Email',
      required: true,
      aliases: ['email', 'email_address', 'email address', 'mail'],
      transform: (v) => v.toLowerCase().trim(),
      validate: (v, row) => {
        if (!v) return `Row ${row}: Email is required`;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `Row ${row}: Invalid email "${v}"`;
        return null;
      },
    },
    {
      key: 'phone',
      label: 'Phone',
      required: false,
      aliases: ['phone', 'phone_number', 'phone number', 'mobile', 'contact'],
      defaultValue: '',
    },
    {
      key: 'roll_no',
      label: 'Roll No',
      required: true,
      aliases: ['roll', 'roll_no', 'roll no', 'roll_number', 'roll number', 'student_id', 'id'],
      validate: (v, row) => (!v ? `Row ${row}: Roll number is required` : null),
    },
    {
      key: 'term',
      label: 'Term',
      required: true,
      aliases: ['term', 'semester', 'year_term', 'year-term'],
      transform: (v) => {
        // Accept formats: "1-1", "1/1", "11", "1st year 1st term"
        const cleaned = v.replace(/\s/g, '');
        if (/^\d-\d$/.test(cleaned)) return cleaned;
        if (/^\d\/\d$/.test(cleaned)) return cleaned.replace('/', '-');
        if (/^\d{2}$/.test(cleaned)) return `${cleaned[0]}-${cleaned[1]}`;
        return v;
      },
      validate: (v, row) => {
        if (!v) return `Row ${row}: Term is required`;
        if (!/^[1-4]-[1-2]$/.test(v)) return `Row ${row}: Invalid term format "${v}" (expected X-Y like 1-1, 2-2)`;
        return null;
      },
    },
    {
      key: 'session',
      label: 'Session',
      required: true,
      aliases: ['session', 'academic_year', 'batch', 'year'],
      transform: (v) => {
        // Accept: "2024", "2024-2025", "24"
        const trimmed = v.trim();
        if (/^\d{4}-\d{4}$/.test(trimmed)) return trimmed;
        if (/^\d{4}$/.test(trimmed)) return `${trimmed}-${parseInt(trimmed) + 1}`;
        if (/^\d{2}$/.test(trimmed)) return `20${trimmed}-20${parseInt(trimmed) + 1}`;
        return trimmed;
      },
      validate: (v, row) => {
        if (!v) return `Row ${row}: Session is required`;
        return null;
      },
    },
  ],
  bulkEndpoint: '/api/students/bulk',
  generateTemplate: () =>
    'Full Name,Email,Phone,Roll No,Term,Session\nMd. Rahman,rahman@kuet.ac.bd,01712345678,2107001,1-1,2021-2022\nAisha Begum,aisha@kuet.ac.bd,01798765432,2107002,1-1,2021-2022',
  transformForApi: (records: ParsedRecord[]) => {
    const items: Record<string, unknown>[] = [];
    const errors: string[] = [];
    for (const r of records) {
      if (!r.full_name || !r.email || !r.roll_no || !r.term || !r.session) {
        errors.push(`Skipping row: missing required fields (name, email, roll, term, or session)`);
        continue;
      }
      items.push({
        full_name: r.full_name,
        email: r.email,
        phone: r.phone || '',
        roll_no: r.roll_no,
        term: r.term,
        session: r.session,
      });
    }
    return { items, errors };
  },
};

// ── Room Upload Config ─────────────────────────────────

export const roomUploadConfig: UploadEntityConfig = {
  entityName: 'Room',
  entityNamePlural: 'Rooms',
  columns: [
    {
      key: 'room_number',
      label: 'Room Number',
      required: true,
      aliases: ['room', 'room_number', 'room number', 'room_no', 'room no', 'number'],
      validate: (v, row) => (!v ? `Row ${row}: Room number is required` : null),
    },
    {
      key: 'building_name',
      label: 'Building',
      required: false,
      aliases: ['building', 'building_name', 'building name', 'block'],
      defaultValue: '',
    },
    {
      key: 'capacity',
      label: 'Capacity',
      required: false,
      aliases: ['capacity', 'seats', 'size', 'max_capacity'],
      defaultValue: '40',
      validate: (v, row) => {
        if (v && isNaN(parseInt(v))) return `Row ${row}: Capacity must be a number`;
        return null;
      },
    },
    {
      key: 'room_type',
      label: 'Room Type',
      required: false,
      aliases: ['type', 'room_type', 'room type', 'category'],
      defaultValue: 'classroom',
      transform: (v) => {
        const lower = v.toLowerCase().trim();
        if (lower.includes('lab')) return 'lab';
        if (lower.includes('seminar')) return 'seminar';
        if (lower.includes('research')) return 'research';
        return 'classroom';
      },
    },
  ],
  bulkEndpoint: '/api/rooms/bulk',
  generateTemplate: () =>
    'Room Number,Building,Capacity,Room Type\n101,ECE Building,60,classroom\n201,CSE Building,30,lab\n301,Main Building,80,seminar',
  transformForApi: (records: ParsedRecord[]) => {
    const items: Record<string, unknown>[] = [];
    const errors: string[] = [];
    for (const r of records) {
      if (!r.room_number) {
        errors.push(`Skipping row: missing room number`);
        continue;
      }
      items.push({
        room_number: r.room_number,
        building_name: r.building_name || null,
        capacity: r.capacity ? parseInt(r.capacity) : 40,
        room_type: r.room_type || 'classroom',
      });
    }
    return { items, errors };
  },
};

// ── Course Allocation Upload Config ────────────────────

export const courseAllocationUploadConfig: UploadEntityConfig = {
  entityName: 'Course Allocation',
  entityNamePlural: 'Course Allocations',
  columns: [
    {
      key: 'course_code',
      label: 'Course Code',
      required: true,
      aliases: ['course', 'course_code', 'course code', 'code'],
      transform: (v) => v.toUpperCase().trim(),
      validate: (v, row) => (!v ? `Row ${row}: Course code is required` : null),
    },
    {
      key: 'teacher_name',
      label: 'Teacher Name',
      required: true,
      aliases: ['teacher', 'teacher_name', 'teacher name', 'faculty', 'instructor', 'name'],
      validate: (v, row) => (!v ? `Row ${row}: Teacher name is required` : null),
    },
    {
      key: 'term',
      label: 'Term',
      required: false,
      aliases: ['term', 'semester'],
      defaultValue: '',
    },
    {
      key: 'session',
      label: 'Session',
      required: false,
      aliases: ['session', 'academic_year', 'year'],
      defaultValue: '',
    },
    {
      key: 'section',
      label: 'Section',
      required: false,
      aliases: ['section', 'sec', 'group'],
      defaultValue: '',
    },
  ],
  bulkEndpoint: '/api/course-offerings/bulk',
  generateTemplate: () =>
    'Course Code,Teacher Name,Term,Session,Section\nCSE 1101,Dr. John Doe,1-1,2024-2025,A\nCSE 1102,Jane Smith,1-1,2024-2025,A',
  transformForApi: (records: ParsedRecord[]) => {
    const items: Record<string, unknown>[] = [];
    const errors: string[] = [];
    for (const r of records) {
      if (!r.course_code || !r.teacher_name) {
        errors.push(`Skipping row: missing course code or teacher name`);
        continue;
      }
      items.push({
        course_code: r.course_code,
        teacher_name: r.teacher_name,
        term: r.term || undefined,
        session: r.session || undefined,
        section: r.section || undefined,
      });
    }
    return { items, errors };
  },
};

// ── Routine Slots Upload Config ────────────────────────

/**
 * Factory function for routine upload config.
 * Requires term/session/section context from the ClassRoutinePage.
 */
export function createRoutineUploadConfig(
  term: string,
  session: string,
  section: string,
): UploadEntityConfig {
  return {
    entityName: 'Routine Slot',
    entityNamePlural: 'Routine Slots',
    columns: [
      {
        key: 'day_of_week',
        label: 'Day',
        required: true,
        aliases: ['day', 'day_of_week', 'day of week', 'weekday'],
        transform: (v) => {
          const dayMap: Record<string, string> = {
            sun: '0', sunday: '0',
            mon: '1', monday: '1',
            tue: '2', tuesday: '2',
            wed: '3', wednesday: '3',
            thu: '4', thursday: '4',
            fri: '5', friday: '5',
            sat: '6', saturday: '6',
          };
          return dayMap[v.toLowerCase().trim()] ?? v;
        },
      },
      {
        key: 'start_time',
        label: 'Start Time',
        required: true,
        aliases: ['start', 'start_time', 'start time', 'from', 'begin'],
      },
      {
        key: 'end_time',
        label: 'End Time',
        required: true,
        aliases: ['end', 'end_time', 'end time', 'to', 'until'],
      },
      {
        key: 'course_code',
        label: 'Course Code',
        required: true,
        aliases: ['course', 'course_code', 'course code', 'code', 'subject'],
        transform: (v) => v.toUpperCase().trim(),
      },
      {
        key: 'course_title',
        label: 'Course Title',
        required: false,
        aliases: ['title', 'course_title', 'course title', 'course_name'],
        defaultValue: '',
      },
      {
        key: 'course_type',
        label: 'Course Type',
        required: false,
        aliases: ['type', 'course_type', 'course type'],
        defaultValue: 'Theory',
      },
      {
        key: 'teacher_name',
        label: 'Teacher',
        required: true,
        aliases: ['teacher', 'teacher_name', 'teacher name', 'instructor', 'faculty'],
      },
      {
        key: 'room_number',
        label: 'Room',
        required: true,
        aliases: ['room', 'room_number', 'room number', 'venue', 'location'],
      },
    ],
    bulkEndpoint: '/api/routine-slots/bulk',
    parseEndpoint: '/api/routine-slots/parse',
    contextFields: [
      { label: 'Term', value: term },
      { label: 'Session', value: session },
      { label: 'Section', value: section },
    ],
    generateTemplate: () =>
      'Day,Start Time,End Time,Course Code,Course Title,Course Type,Teacher,Room\n' +
      'Sunday,09:00,09:50,CSE 3201,Computer Architecture,Theory,Dr. John Doe,301\n' +
      'Monday,10:00,12:50,CSE 3202,Database Lab,Lab,Jane Smith,Lab-1',
    transformForApi: (records: ParsedRecord[]) => {
      const items: Record<string, unknown>[] = [];
      const errors: string[] = [];
      for (const r of records) {
        if (!r.course_code || !r.teacher_name || !r.room_number) {
          errors.push(`Skipping row: missing course, teacher, or room`);
          continue;
        }
        items.push({
          day_of_week: parseInt(r.day_of_week) || 0,
          start_time: r.start_time,
          end_time: r.end_time,
          course_code: r.course_code,
          course_title: r.course_title || r.course_code,
          course_type: r.course_type || 'Theory',
          teacher_name: r.teacher_name,
          room_number: r.room_number,
          section: section,
          term: term,
          session: session,
        });
      }
      return { items, errors };
    },
  };
}
