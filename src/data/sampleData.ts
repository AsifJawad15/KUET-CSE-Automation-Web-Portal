// ==========================================
// KUET CSE Automation - Sample Data
// This will be replaced with database later
// ==========================================

import { Faculty, Student, Course, Room, ClassSchedule, Announcement } from '@/types';

// ==========================================
// Sample Faculty Data
// ==========================================
export const sampleFaculty: Faculty[] = [
  {
    id: 'F001',
    name: 'Dr. M. M. A. Hashem',
    email: 'hashem@cse.kuet.ac.bd',
    phone: '+880 1711-123456',
    designation: 'Professor',
    department: 'Computer Science & Engineering',
    officeRoom: 'Room 301, CSE Building',
    experience: 15,
    assignedCourses: ['CSE 2101', 'CSE 3201'],
  },
  {
    id: 'F002',
    name: 'Dr. K. M. Azharul Hasan',
    email: 'azharul@cse.kuet.ac.bd',
    phone: '+880 1712-234567',
    designation: 'Professor',
    department: 'Computer Science & Engineering',
    officeRoom: 'Room 302, CSE Building',
    experience: 18,
    assignedCourses: ['CSE 4101', 'CSE 3201'],
  },
  {
    id: 'F003',
    name: 'Dr. Muhammad Sheikh Sadi',
    email: 'sadi@cse.kuet.ac.bd',
    designation: 'Associate Professor',
    department: 'Computer Science & Engineering',
    experience: 12,
    assignedCourses: ['CSE 3203'],
  },
  {
    id: 'F004',
    name: 'Dr. Md. Milon Islam',
    email: 'milonislam@cse.kuet.ac.bd',
    designation: 'Assistant Professor',
    department: 'Computer Science & Engineering',
    experience: 8,
    assignedCourses: ['CSE 2103'],
  },
  {
    id: 'F005',
    name: 'Dola Das',
    email: 'dola.das@cse.kuet.ac.bd',
    designation: 'Assistant Professor',
    department: 'Computer Science & Engineering',
    experience: 5,
    assignedCourses: ['CSE 2105'],
  },
  {
    id: 'F006',
    name: 'Md Mehrab Hossain Opi',
    email: 'opi@cse.kuet.ac.bd',
    designation: 'Lecturer',
    department: 'Computer Science & Engineering',
    experience: 2,
    assignedCourses: ['CSE 2102'],
  },
];

// ==========================================
// Sample Students Data
// ==========================================
export const sampleStudents: Student[] = [
  {
    id: 'S001',
    roll: '2107001',
    name: 'Asif Jawad',
    email: '2107001@stud.kuet.ac.bd',
    batch: '21',
    section: 'A',
    currentYear: 3,
    currentTerm: 2,
    department: 'Computer Science & Engineering',
  },
  {
    id: 'S002',
    roll: '2107002',
    name: 'Abdullah Md. Shahporan',
    email: '2107002@stud.kuet.ac.bd',
    batch: '21',
    section: 'A',
    currentYear: 3,
    currentTerm: 2,
    department: 'Computer Science & Engineering',
  },
  {
    id: 'S003',
    roll: '2107061',
    name: 'Rahul Ahmed',
    email: '2107061@stud.kuet.ac.bd',
    batch: '21',
    section: 'B',
    currentYear: 3,
    currentTerm: 2,
    department: 'Computer Science & Engineering',
  },
];

// ==========================================
// Sample Courses Data
// ==========================================
export const sampleCourses: Course[] = [
  {
    id: 'C001',
    code: 'CSE 3201',
    title: 'Software Engineering',
    credits: 3.0,
    type: 'theory',
    year: 3,
    term: 2,
    teachers: ['F001', 'F002'],
    sections: ['A', 'B'],
  },
  {
    id: 'C002',
    code: 'CSE 3203',
    title: 'Computer Networks',
    credits: 3.0,
    type: 'theory',
    year: 3,
    term: 2,
    teachers: ['F003'],
    sections: ['A', 'B'],
  },
  {
    id: 'C003',
    code: 'CSE 3202',
    title: 'Software Engineering Lab',
    credits: 1.5,
    type: 'lab',
    year: 3,
    term: 2,
    teachers: ['F001'],
    groups: ['A1', 'A2', 'B1', 'B2'],
  },
  {
    id: 'C004',
    code: 'CSE 2101',
    title: 'Data Structures',
    credits: 3.0,
    type: 'theory',
    year: 2,
    term: 1,
    teachers: ['F001', 'F002'],
    sections: ['A', 'B'],
  },
];

// ==========================================
// Sample Rooms Data
// ==========================================
export const sampleRooms: Room[] = [
  {
    id: 'R001',
    name: 'Room 301',
    building: 'CSE Building',
    capacity: 60,
    type: 'classroom',
    isAvailable: true,
    facilities: ['Projector', 'AC', 'Whiteboard'],
  },
  {
    id: 'R002',
    name: 'Room 302',
    building: 'CSE Building',
    capacity: 60,
    type: 'classroom',
    isAvailable: false,
    occupiedBy: 'CSE 4101',
    facilities: ['Projector', 'AC'],
  },
  {
    id: 'R003',
    name: 'Lab 201',
    building: 'CSE Building',
    capacity: 30,
    type: 'lab',
    isAvailable: true,
    facilities: ['Computers', 'Projector', 'AC'],
  },
  {
    id: 'R004',
    name: 'Seminar Hall',
    building: 'CSE Building',
    capacity: 100,
    type: 'seminar',
    isAvailable: true,
    facilities: ['Projector', 'AC', 'Sound System', 'Stage'],
  },
];

// ==========================================
// Sample Schedules Data
// ==========================================
export const sampleSchedules: ClassSchedule[] = [
  {
    id: 'SCH001',
    courseCode: 'CSE 3201',
    courseName: 'Software Engineering',
    teacherId: 'F001',
    teacherName: 'Dr. M. M. A. Hashem',
    roomId: 'R001',
    roomName: 'Room 301',
    day: 'Sunday',
    startTime: '09:00',
    endTime: '10:00',
    section: 'A',
  },
  {
    id: 'SCH002',
    courseCode: 'CSE 3201',
    courseName: 'Software Engineering',
    teacherId: 'F001',
    teacherName: 'Dr. M. M. A. Hashem',
    roomId: 'R001',
    roomName: 'Room 301',
    day: 'Sunday',
    startTime: '11:00',
    endTime: '12:00',
    section: 'B',
  },
  {
    id: 'SCH003',
    courseCode: 'CSE 3202',
    courseName: 'Software Engineering Lab',
    teacherId: 'F001',
    teacherName: 'Dr. M. M. A. Hashem',
    roomId: 'R003',
    roomName: 'Lab 201',
    day: 'Monday',
    startTime: '10:00',
    endTime: '13:00',
    group: 'A1',
  },
  {
    id: 'SCH004',
    courseCode: 'CSE 3203',
    courseName: 'Computer Networks',
    teacherId: 'F003',
    teacherName: 'Dr. Muhammad Sheikh Sadi',
    roomId: 'R002',
    roomName: 'Room 302',
    day: 'Tuesday',
    startTime: '09:00',
    endTime: '10:30',
    section: 'A',
  },
];

// ==========================================
// Sample Announcements Data
// ==========================================
export const sampleAnnouncements: Announcement[] = [
  {
    id: 'A001',
    title: 'CT-1 Scheduled for CSE 3201',
    content: 'Class Test 1 for Software Engineering will be held on January 25, 2026. Syllabus: Chapter 1-3.',
    type: 'class-test',
    courseCode: 'CSE 3201',
    createdBy: 'Dr. M. M. A. Hashem',
    createdAt: '2026-01-18',
    scheduledDate: '2026-01-25',
    isActive: true,
    priority: 'high',
  },
  {
    id: 'A002',
    title: 'Mid-Term Exam Schedule Published',
    content: 'The mid-term examination schedule for Spring 2026 semester has been published. Please check your respective class groups.',
    type: 'notice',
    createdBy: 'Admin',
    createdAt: '2026-01-12',
    isActive: true,
    priority: 'high',
  },
  {
    id: 'A003',
    title: 'Assignment Submission Deadline',
    content: 'Submit your UML diagrams assignment by January 20, 2026.',
    type: 'assignment',
    courseCode: 'CSE 3201',
    createdBy: 'Dr. M. M. A. Hashem',
    createdAt: '2026-01-15',
    scheduledDate: '2026-01-20',
    isActive: true,
    priority: 'medium',
  },
];
