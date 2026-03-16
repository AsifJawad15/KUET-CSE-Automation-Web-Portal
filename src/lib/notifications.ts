// ==========================================
// lib/notifications.ts
// Centralized helper to create notifications from any API route.
// Call createNotification() after any significant event.
// ==========================================

import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const notificationClient =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : supabase;

export type NotificationTargetType = 'ALL' | 'ROLE' | 'YEAR_TERM' | 'SECTION' | 'COURSE' | 'USER';

export type NotificationType =
  | 'room_allocated'
  | 'room_request_approved'
  | 'room_request_rejected'
  | 'notice_posted'
  | 'exam_scheduled'
  | 'class_cancelled'
  | 'class_rescheduled'
  | 'assignment_due'
  | 'attendance_low'
  | 'announcement'
  | 'term_upgrade'
  | 'makeup_class'
  | 'geo_attendance_open'
  | 'optional_course';

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  target_type: NotificationTargetType;
  target_value?: string;
  target_year_term?: string;
  created_by?: string | null;
  created_by_role?: 'STUDENT_CR' | 'TEACHER' | 'ADMIN';
  metadata?: Record<string, unknown>;
  expires_at?: string | null;
}

/**
 * Insert a notification into the notifications table.
 * Errors are silently logged — caller's primary flow should never break for notifications.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const { error } = await notificationClient.from('notifications').insert({
      type: input.type,
      title: input.title,
      body: input.body,
      target_type: input.target_type,
      target_value: input.target_value ?? null,
      target_year_term: input.target_year_term ?? null,
      created_by: input.created_by ?? null,
      created_by_role: input.created_by_role ?? null,
      metadata: input.metadata ?? {},
      expires_at: input.expires_at ?? null,
    });

    if (error) {
      console.error('[NotificationHelper] Failed to create notification:', error.message);
    }
  } catch (err) {
    console.error('[NotificationHelper] Unexpected error:', err);
  }
}

// ── Pre-built factory functions for common events ──────────────────────────────

/** CR allocated a room for their section */
export function notifyCRRoomAllocated(opts: {
  createdBy: string;
  courseCode: string;
  roomNumber: string;
  dayName: string;
  startTime: string;
  endTime: string;
  term: string;
  section?: string | null;
}): Promise<void> {
  const normalizedTerm = opts.term.trim();
  const normalizedSection = opts.section?.trim();
  const hasSection = !!normalizedSection;

  return createNotification({
    type: 'room_allocated',
    title: `Room ${opts.roomNumber} Allocated — ${opts.courseCode}`,
    body: `CR booked Room ${opts.roomNumber} for ${opts.courseCode} on ${opts.dayName} (${opts.startTime}–${opts.endTime}).`,
    target_type: hasSection ? 'SECTION' : 'YEAR_TERM',
    target_value: hasSection ? normalizedSection : normalizedTerm,
    target_year_term: hasSection ? normalizedTerm : undefined,
    created_by: opts.createdBy,
    created_by_role: 'STUDENT_CR',
    metadata: {
      course_code: opts.courseCode,
      room_number: opts.roomNumber,
      day: opts.dayName,
      start_time: opts.startTime,
      end_time: opts.endTime,
    },
  });
}

/** Teacher room booking request auto-approved */
export function notifyTeacherRoomApproved(opts: {
  teacherUserId: string;
  courseCode: string;
  roomNumber: string;
  period: string;
  dayName: string;
}): Promise<void> {
  return createNotification({
    type: 'room_request_approved',
    title: `Room Request Approved — ${opts.courseCode}`,
    body: `Your room booking for ${opts.courseCode} in Room ${opts.roomNumber} on ${opts.dayName} (${opts.period}) was approved.`,
    target_type: 'USER',
    target_value: opts.teacherUserId,
    created_by: null,
    created_by_role: 'ADMIN',
    metadata: {
      course_code: opts.courseCode,
      room_number: opts.roomNumber,
      period: opts.period,
      day: opts.dayName,
    },
  });
}

/** Teacher room booking rejected (conflict) */
export function notifyTeacherRoomRejected(opts: {
  teacherUserId: string;
  courseCode: string;
  roomNumber: string;
  period: string;
  dayName: string;
  reason: string;
}): Promise<void> {
  return createNotification({
    type: 'room_request_rejected',
    title: `Room Request Rejected — ${opts.courseCode}`,
    body: `Room booking for ${opts.courseCode} on ${opts.dayName} (${opts.period}) was rejected. ${opts.reason}`,
    target_type: 'USER',
    target_value: opts.teacherUserId,
    created_by: null,
    created_by_role: 'ADMIN',
    metadata: {
      course_code: opts.courseCode,
      room: opts.roomNumber,
      period: opts.period,
      day: opts.dayName,
      reason: opts.reason,
    },
  });
}

/** Teacher / Admin posted a notice to a year-term */
export function notifyNoticePosted(opts: {
  createdBy: string;
  createdByRole: 'TEACHER' | 'ADMIN';
  title: string;
  bodyText: string;
  targetType: NotificationTargetType;
  targetValue?: string;
  targetYearTerm?: string;
  courseCode?: string;
}): Promise<void> {
  return createNotification({
    type: 'notice_posted',
    title: opts.title,
    body: opts.bodyText,
    target_type: opts.targetType,
    target_value: opts.targetValue,
    target_year_term: opts.targetYearTerm,
    created_by: opts.createdBy,
    created_by_role: opts.createdByRole,
    metadata: opts.courseCode ? { course_code: opts.courseCode } : {},
  });
}

/** Exam / class test scheduled */
export function notifyExamScheduled(opts: {
  createdBy: string;
  createdByRole: 'TEACHER' | 'ADMIN';
  courseCode: string;
  examType: 'Class Test' | 'Mid Term' | 'Final' | 'Lab Exam' | string;
  date: string;           // e.g. "March 20, 2026"
  venue: string;
  term: string;
  section?: string;
}): Promise<void> {
  const targetType: NotificationTargetType = opts.section ? 'SECTION' : 'YEAR_TERM';
  return createNotification({
    type: 'exam_scheduled',
    title: `${opts.examType} Scheduled — ${opts.courseCode}`,
    body: `${opts.examType} for ${opts.courseCode} on ${opts.date} at ${opts.venue}.`,
    target_type: targetType,
    target_value: opts.section ?? opts.term,
    target_year_term: opts.section ? opts.term : undefined,
    created_by: opts.createdBy,
    created_by_role: opts.createdByRole,
    metadata: {
      course_code: opts.courseCode,
      exam_type: opts.examType,
      date: opts.date,
      venue: opts.venue,
    },
  });
}

/** Announcement to all students or all teachers */
export function notifyAnnouncement(opts: {
  createdBy: string;
  createdByRole: 'TEACHER' | 'ADMIN' | 'STUDENT_CR';
  title: string;
  bodyText: string;
  targetRole?: 'STUDENT' | 'TEACHER';
  term?: string;
  section?: string;
  courseCode?: string;
}): Promise<void> {
  let targetType: NotificationTargetType = 'ALL';
  let targetValue: string | undefined;
  let targetYearTerm: string | undefined;

  if (opts.courseCode) {
    targetType = 'COURSE';
    targetValue = opts.courseCode;
  } else if (opts.term && opts.section) {
    targetType = 'SECTION';
    targetValue = opts.section;
    targetYearTerm = opts.term;
  } else if (opts.term) {
    targetType = 'YEAR_TERM';
    targetValue = opts.term;
  } else if (opts.targetRole) {
    targetType = 'ROLE';
    targetValue = opts.targetRole;
  }

  return createNotification({
    type: 'announcement',
    title: opts.title,
    body: opts.bodyText,
    target_type: targetType,
    target_value: targetValue,
    target_year_term: targetYearTerm,
    created_by: opts.createdBy,
    created_by_role: opts.createdByRole,
    metadata: opts.courseCode ? { course_code: opts.courseCode } : {},
  });
}

/** Term upgrade approved/rejected */
export function notifyTermUpgrade(opts: {
  studentUserId: string;
  approved: boolean;
  newTerm?: string;
  remarks?: string;
}): Promise<void> {
  return createNotification({
    type: 'term_upgrade',
    title: opts.approved ? 'Term Upgrade Approved' : 'Term Upgrade Request Update',
    body: opts.approved
      ? `Your term upgrade to ${opts.newTerm} has been approved!`
      : `Your term upgrade request was not approved. ${opts.remarks ?? ''}`,
    target_type: 'USER',
    target_value: opts.studentUserId,
    created_by: null,
    created_by_role: 'ADMIN',
    metadata: { new_term: opts.newTerm, approved: opts.approved },
  });
}

/** Teacher opened a geo-attendance room for a section/year-term */
export function notifyGeoAttendanceOpened(opts: {
  teacherUserId: string;
  courseCode: string;
  term: string;
  section?: string | null;
  roomNumber?: string | null;
  durationMinutes: number;
  endTime: string;
}): Promise<void> {
  const normalizedTerm = opts.term.trim();
  const rawSection = opts.section?.trim() ?? '';

  // Web geo-attendance uses labels like "Section A (01–60)"; extract canonical section key.
  const extractedSection = (() => {
    if (!rawSection) return null;

    const single = rawSection.match(/^[A-Za-z]$/);
    if (single) return single[0].toUpperCase();

    const named = rawSection.match(/section\s+([A-Za-z])/i);
    if (named) return named[1].toUpperCase();

    return null;
  })();

  const targetType: NotificationTargetType = extractedSection ? 'SECTION' : 'YEAR_TERM';
  const targetValue = extractedSection ?? normalizedTerm;
  const sectionLabel = opts.section ? ` (Section ${opts.section})` : '';
  return createNotification({
    type: 'geo_attendance_open',
    title: `Attendance Open — ${opts.courseCode}${sectionLabel}`,
    body: `Your attendance for ${opts.courseCode} is now open. Submit within ${opts.durationMinutes} minutes (before ${opts.endTime}).`,
    target_type: targetType,
    target_value: targetValue,
    target_year_term: extractedSection ? normalizedTerm : undefined,
    created_by: opts.teacherUserId,
    created_by_role: 'TEACHER',
    metadata: {
      course_code: opts.courseCode,
      ...(opts.roomNumber ? { room_number: opts.roomNumber } : {}),
      duration_minutes: opts.durationMinutes,
    },
  });
}

/** Student assigned to an optional/elective course */
export function notifyOptionalCourseAssigned(opts: {
  studentUserId: string;
  courseCode: string;
  courseTitle: string;
  assignedBy?: string | null;
}): Promise<void> {
  return createNotification({
    type: 'optional_course',
    title: `Optional Course Assigned — ${opts.courseCode}`,
    body: `You have been assigned to ${opts.courseCode}: ${opts.courseTitle}. Check your updated schedule.`,
    target_type: 'USER',
    target_value: opts.studentUserId,
    created_by: opts.assignedBy ?? null,
    created_by_role: 'ADMIN',
    metadata: { course_code: opts.courseCode },
  });
}
