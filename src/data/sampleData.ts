// ==========================================
// KUET CSE Automation - Sample Data
// Only keeping data not yet migrated to API
// ==========================================

import { Room, ClassSchedule, Announcement } from '@/types';

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
