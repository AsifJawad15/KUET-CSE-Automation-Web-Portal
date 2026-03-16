// ==========================================
// lib/notifications.ts
// Centralized helper to create notifications from any API route.
// ==========================================

import { createClient } from '@supabase/supabase-js';

import { supabase } from './supabase';

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
  | 'exam_result_published'
  | 'exam_room_assigned'
  | 'exam_reminder'
  | 'class_cancelled'
  | 'class_rescheduled'
  | 'assignment_due'
  | 'attendance_absent'
  | 'attendance_low'
  | 'announcement'
  | 'term_upgrade'
  | 'makeup_class'
  | 'geo_attendance_open'
  | 'optional_course'
  | 'cr_room_request_submitted'
  | 'attendance_marking_reminder'
  | 'course_anomaly_alert';

export interface NotificationTarget {
  targetType: NotificationTargetType;
  targetValue?: string | null;
  targetYearTerm?: string | null;
}

export interface CreateNotificationInput {
  type: NotificationType | string;
  title: string;
  body: string;
  target_type?: NotificationTargetType;
  target_value?: string | null;
  target_year_term?: string | null;
  created_by?: string | null;
  created_by_role?: 'STUDENT_CR' | 'TEACHER' | 'ADMIN' | 'SYSTEM' | null;
  metadata?: Record<string, unknown>;
  expires_at?: string | null;
  targetType?: NotificationTargetType;
  targetValue?: string | null;
  targetYearTerm?: string | null;
  createdBy?: string | null;
  createdByRole?: 'STUDENT_CR' | 'TEACHER' | 'ADMIN' | 'SYSTEM' | null;
  expiresAt?: string | null;
  dedupeKey?: string;
}

export interface OfferingNotificationContext {
  offeringId: string;
  teacherUserId: string | null;
  term: string | null;
  section: string | null;
  courseCode: string;
  courseTitle: string;
}

export interface StudentLookup {
  userId: string;
  rollNo: string;
  term: string | null;
  section: string | null;
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildStudentAudience(context: {
  courseCode: string;
  term?: string | null;
  section?: string | null;
}): NotificationTarget {
  const section = cleanText(context.section);
  if (section) {
    return {
      targetType: 'SECTION',
      targetValue: section,
      targetYearTerm: cleanText(context.term),
    };
  }

  return {
    targetType: 'COURSE',
    targetValue: context.courseCode,
    targetYearTerm: null,
  };
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const targetType = input.target_type ?? input.targetType;
    const targetValue = cleanText(input.target_value ?? input.targetValue);
    const targetYearTerm = cleanText(input.target_year_term ?? input.targetYearTerm);
    const createdBy = input.created_by ?? input.createdBy ?? null;
    const createdByRole = input.created_by_role ?? input.createdByRole ?? 'SYSTEM';
    const dedupeKey = cleanText(input.dedupeKey);
    const metadata = {
      ...(input.metadata ?? {}),
      ...(dedupeKey ? { event_key: dedupeKey } : {}),
    };

    if (!targetType) {
      console.error('[NotificationHelper] Missing target type for notification:', input.type);
      return;
    }

    if (dedupeKey) {
      const { data: existing, error: lookupError } = await notificationClient
        .from('notifications')
        .select('id')
        .eq('type', input.type)
        .contains('metadata', { event_key: dedupeKey })
        .limit(1)
        .maybeSingle();

      if (lookupError) {
        console.error('[NotificationHelper] Failed to check duplicate notification:', lookupError.message);
        return;
      }

      if (existing) {
        return;
      }
    }

    const { error } = await notificationClient.from('notifications').insert({
      type: input.type,
      title: input.title,
      body: input.body,
      target_type: targetType,
      target_value: targetValue,
      target_year_term: targetYearTerm,
      created_by: createdBy,
      created_by_role: createdByRole,
      metadata,
      expires_at: input.expires_at ?? input.expiresAt ?? null,
    });

    if (error) {
      console.error('[NotificationHelper] Failed to create notification:', error.message);
    }
  } catch (err) {
    console.error('[NotificationHelper] Unexpected error:', err);
  }
}

export async function getOfferingNotificationContext(offeringId: string): Promise<OfferingNotificationContext | null> {
  const { data, error } = await notificationClient
    .from('course_offerings')
    .select(`
      id,
      teacher_user_id,
      term,
      section,
      courses!inner(code, title)
    `)
    .eq('id', offeringId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const course = data.courses as { code?: string; title?: string } | { code?: string; title?: string }[] | null;
  const resolvedCourse = Array.isArray(course) ? course[0] : course;
  const courseCode = resolvedCourse?.code?.trim();

  if (!courseCode) return null;

  return {
    offeringId: data.id,
    teacherUserId: data.teacher_user_id ?? null,
    term: cleanText(data.term),
    section: cleanText(data.section),
    courseCode,
    courseTitle: resolvedCourse?.title?.trim() || courseCode,
  };
}

export async function getStudentUsersByRolls(rolls: string[]): Promise<Map<string, StudentLookup>> {
  const uniqueRolls = [...new Set(rolls.map((roll) => roll.trim()).filter(Boolean))];
  if (uniqueRolls.length === 0) return new Map();

  const { data, error } = await notificationClient
    .from('students')
    .select('user_id, roll_no, term, section')
    .in('roll_no', uniqueRolls);

  if (error) throw error;

  const result = new Map<string, StudentLookup>();
  for (const row of data || []) {
    result.set(row.roll_no, {
      userId: row.user_id,
      rollNo: row.roll_no,
      term: cleanText(row.term),
      section: cleanText(row.section),
    });
  }
  return result;
}

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

export function notifyTeacherRoomApproved(opts: {
  teacherUserId: string;
  courseCode: string;
  roomNumber: string;
  period: string;
  dayName: string;
  remarks?: string | null;
  requestId?: string | null;
}): Promise<void> {
  const remarks = cleanText(opts.remarks);
  return createNotification({
    type: 'room_request_approved',
    title: `Room Request Approved — ${opts.courseCode}`,
    body: `Your room booking for ${opts.courseCode} in Room ${opts.roomNumber} on ${opts.dayName} (${opts.period}) was approved.${remarks ? ` Remark: ${remarks}` : ''}`,
    target_type: 'USER',
    target_value: opts.teacherUserId,
    created_by: null,
    created_by_role: 'ADMIN',
    metadata: {
      course_code: opts.courseCode,
      room_number: opts.roomNumber,
      period: opts.period,
      day: opts.dayName,
      ...(remarks ? { remarks } : {}),
      ...(opts.requestId ? { request_id: opts.requestId } : {}),
    },
    dedupeKey: opts.requestId ? `room-request:${opts.requestId}:approved` : undefined,
  });
}

export function notifyTeacherRoomRejected(opts: {
  teacherUserId: string;
  courseCode: string;
  roomNumber: string;
  period: string;
  dayName: string;
  reason: string;
  requestId?: string | null;
}): Promise<void> {
  const reason = cleanText(opts.reason) ?? 'No remarks provided.';
  return createNotification({
    type: 'room_request_rejected',
    title: `Room Request Rejected — ${opts.courseCode}`,
    body: `Room booking for ${opts.courseCode} on ${opts.dayName} (${opts.period}) was rejected. ${reason}`,
    target_type: 'USER',
    target_value: opts.teacherUserId,
    created_by: null,
    created_by_role: 'ADMIN',
    metadata: {
      course_code: opts.courseCode,
      room: opts.roomNumber,
      period: opts.period,
      day: opts.dayName,
      reason,
      ...(opts.requestId ? { request_id: opts.requestId } : {}),
    },
    dedupeKey: opts.requestId ? `room-request:${opts.requestId}:rejected` : undefined,
  });
}

export function notifyCRRoomRequestSubmitted(opts: {
  teacherUserId: string;
  courseCode: string;
  roomNumber: string;
  requestDate: string;
  startTime: string;
  endTime: string;
  term: string;
  section?: string | null;
  studentName?: string | null;
  studentRoll?: string | null;
  createdBy?: string | null;
  requestId?: string | null;
}): Promise<void> {
  const studentLabel = cleanText(opts.studentName)
    || (cleanText(opts.studentRoll) ? `Roll ${cleanText(opts.studentRoll)}` : 'A class representative');
  const sectionLabel = cleanText(opts.section);

  return createNotification({
    type: 'cr_room_request_submitted',
    title: `CR room request submitted — ${opts.courseCode}`,
    body: `${studentLabel} booked Room ${opts.roomNumber} for ${opts.courseCode} on ${opts.requestDate}, ${opts.startTime}-${opts.endTime}.${sectionLabel ? ` Section ${sectionLabel}.` : ` Term ${opts.term}.`}`,
    target_type: 'USER',
    target_value: opts.teacherUserId,
    created_by: opts.createdBy ?? null,
    created_by_role: 'STUDENT_CR',
    metadata: {
      course_code: opts.courseCode,
      room_number: opts.roomNumber,
      request_date: opts.requestDate,
      start_time: opts.startTime,
      end_time: opts.endTime,
      term: opts.term,
      ...(sectionLabel ? { section: sectionLabel } : {}),
      ...(cleanText(opts.studentRoll) ? { student_roll: cleanText(opts.studentRoll) } : {}),
      ...(opts.requestId ? { request_id: opts.requestId } : {}),
    },
    dedupeKey: opts.requestId ? `cr-room-request:${opts.requestId}` : undefined,
  });
}

export function notifyAttendanceMarkingReminder(opts: {
  teacherUserId: string;
  courseCode: string;
  courseTitle?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  roomNumber?: string | null;
  section?: string | null;
  offeringId?: string | null;
}): Promise<void> {
  const sectionLabel = cleanText(opts.section);
  const roomLabel = cleanText(opts.roomNumber);

  return createNotification({
    type: 'attendance_marking_reminder',
    title: `Attendance reminder — ${opts.courseCode}`,
    body: `Attendance has not been recorded yet for ${opts.courseTitle || opts.courseCode} on ${opts.date} (${opts.startTime}-${opts.endTime})${roomLabel ? ` in Room ${roomLabel}` : ''}${sectionLabel ? ` for Section ${sectionLabel}` : ''}.`,
    target_type: 'USER',
    target_value: opts.teacherUserId,
    created_by: null,
    created_by_role: 'SYSTEM',
    metadata: {
      course_code: opts.courseCode,
      date: opts.date,
      start_time: opts.startTime,
      end_time: opts.endTime,
      ...(roomLabel ? { room_number: roomLabel } : {}),
      ...(sectionLabel ? { section: sectionLabel } : {}),
      ...(opts.offeringId ? { offering_id: opts.offeringId } : {}),
    },
    dedupeKey: `attendance-reminder:${opts.teacherUserId}:${opts.offeringId || opts.courseCode}:${opts.date}:${opts.startTime}`,
  });
}

export function notifyCourseAnomalyAlert(opts: {
  teacherUserId: string;
  courseCode: string;
  title: string;
  body: string;
  dedupeKey: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  return createNotification({
    type: 'course_anomaly_alert',
    title: opts.title,
    body: opts.body,
    target_type: 'USER',
    target_value: opts.teacherUserId,
    created_by: null,
    created_by_role: 'SYSTEM',
    metadata: {
      course_code: opts.courseCode,
      ...(opts.metadata ?? {}),
    },
    dedupeKey: opts.dedupeKey,
  });
}

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

export function notifyExamScheduled(opts: {
  createdBy: string;
  createdByRole: 'TEACHER' | 'ADMIN';
  courseCode: string;
  examType: 'Class Test' | 'Mid Term' | 'Final' | 'Lab Exam' | string;
  date: string;
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
