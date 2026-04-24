import { createClient } from '@supabase/supabase-js';

import { createNotification } from './notifications';
import { dispatchPendingPushNotifications } from './pushDispatch';
import { supabase } from './supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const geoAttendanceNotificationClient =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : supabase;

type GeoAttendanceNotificationInput = {
  teacherUserId: string;
  offeringId?: string | null;
  courseCode: string;
  term: string;
  section?: string | null;
  roomNumber?: string | null;
  durationMinutes: number;
  endTime: string;
  roomId?: string | null;
};

type RollRange = {
  min: number;
  max: number;
};

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeSection(section: string | null | undefined): string | null {
  const cleaned = cleanText(section);
  if (!cleaned) return null;

  const normalized = cleaned.toUpperCase();
  if (/^[A-Z]\d?$/.test(normalized)) {
    return normalized;
  }

  const named = cleaned.match(/\b(section|group)\s+([A-Za-z]\d?)\b/i);
  if (named) {
    return named[2].toUpperCase();
  }

  return normalized;
}

function getRollRange(section: string | null | undefined): RollRange | null {
  switch (normalizeSection(section)) {
    case 'A':
      return { min: 1, max: 60 };
    case 'B':
      return { min: 61, max: 120 };
    case 'A1':
      return { min: 1, max: 30 };
    case 'A2':
      return { min: 31, max: 60 };
    case 'B1':
      return { min: 61, max: 90 };
    case 'B2':
      return { min: 91, max: 120 };
    default:
      return null;
  }
}

function extractRollSuffix(rollNo: string | null | undefined): number | null {
  const digits = rollNo?.replace(/\D/g, '') ?? '';
  if (!digits) return null;

  const suffix = digits.slice(-3);
  const parsed = Number.parseInt(suffix, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSectionLabel(section: string | null | undefined): string {
  const cleaned = cleanText(section);
  if (!cleaned) return '';
  if (/^(section|group)\b/i.test(cleaned)) return ` (${cleaned})`;

  const normalized = normalizeSection(cleaned);
  if (!normalized) return ` (${cleaned})`;

  const prefix = normalized.length === 1 ? 'Section' : 'Group';
  return ` (${prefix} ${normalized})`;
}

async function resolveRecipientIds(opts: {
  term: string;
  section?: string | null;
  offeringId?: string | null;
}): Promise<string[]> {
  const offeringId = cleanText(opts.offeringId);
  if (offeringId) {
    const { data: enrollments, error: enrollmentError } =
      await geoAttendanceNotificationClient
        .from('enrollments')
        .select('student_user_id')
        .eq('offering_id', offeringId);

    if (enrollmentError) throw enrollmentError;

    const enrolledUserIds = [...new Set((enrollments ?? [])
      .map((row) => cleanText(row.student_user_id))
      .filter(Boolean))] as string[];

    if (enrolledUserIds.length > 0) {
      if (!normalizeSection(opts.section)) {
        return enrolledUserIds;
      }

      const normalizedSection = normalizeSection(opts.section);
      const rollRange = getRollRange(opts.section);
      const { data: students, error: studentError } =
        await geoAttendanceNotificationClient
          .from('students')
          .select('user_id, roll_no, section')
          .in('user_id', enrolledUserIds);

      if (studentError) throw studentError;

      const filtered = new Set<string>();
      for (const row of students || []) {
        const userId = cleanText(row.user_id);
        if (!userId) continue;

        const studentSection = cleanText(row.section)?.toUpperCase();
        const sectionMatched = studentSection === normalizedSection;
        const rollSuffix = extractRollSuffix(row.roll_no);
        const rollMatched =
          !!rollRange &&
          rollSuffix !== null &&
          rollSuffix >= rollRange.min &&
          rollSuffix <= rollRange.max;

        if (sectionMatched || rollMatched) {
          filtered.add(userId);
        }
      }

      if (filtered.size > 0) {
        return [...filtered];
      }
    }
  }

  const normalizedTerm = cleanText(opts.term);
  if (!normalizedTerm) return [];

  const normalizedSection = normalizeSection(opts.section);
  const rollRange = getRollRange(opts.section);
  const { data, error } = await geoAttendanceNotificationClient
    .from('students')
    .select('user_id, roll_no, section')
    .eq('term', normalizedTerm);

  if (error) throw error;

  const recipients = new Set<string>();
  for (const row of data || []) {
    const userId = row.user_id?.trim();
    if (!userId) continue;

    if (!normalizedSection) {
      recipients.add(userId);
      continue;
    }

    const studentSection = cleanText(row.section)?.toUpperCase();
    const sectionMatched = studentSection === normalizedSection;
    const rollSuffix = extractRollSuffix(row.roll_no);
    const rollMatched =
      !!rollRange &&
      rollSuffix !== null &&
      rollSuffix >= rollRange.min &&
      rollSuffix <= rollRange.max;

    if (sectionMatched || rollMatched) {
      recipients.add(userId);
    }
  }

  return [...recipients];
}

async function createGeoAttendanceUserNotifications(input: {
  userIds: string[];
  title: string;
  body: string;
  createdBy: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const userIds = [...new Set(input.userIds.map((userId) => userId.trim()).filter(Boolean))];
  if (userIds.length === 0) return;

  const rows = userIds.map((userId) => ({
    type: 'geo_attendance_open',
    title: input.title,
    body: input.body,
    target_type: 'USER' as const,
    target_value: userId,
    target_year_term: null,
    created_by: input.createdBy,
    created_by_role: 'TEACHER' as const,
    metadata: input.metadata,
    expires_at: null,
  }));

  const { data: insertedRows, error } = await geoAttendanceNotificationClient
    .from('notifications')
    .insert(rows)
    .select('id');

  if (error) throw error;

  const insertedIds = (insertedRows ?? [])
    .map((row: { id: string }) => row.id)
    .filter(Boolean);
  if (insertedIds.length === 0) return;

  await geoAttendanceNotificationClient
    .from('notification_push_outbox')
    .upsert(
      insertedIds.map((id) => ({ notification_id: id, status: 'pending' })),
      { onConflict: 'notification_id', ignoreDuplicates: true },
    );

  await dispatchPendingPushNotifications(
    Math.min(200, Math.max(10, insertedIds.length)),
  );
}

export async function notifyGeoAttendanceRoomOpened(
  opts: GeoAttendanceNotificationInput,
): Promise<void> {
  const normalizedTerm = cleanText(opts.term);
  if (!normalizedTerm) return;

  const title = `Attendance Open - ${opts.courseCode}${formatSectionLabel(opts.section)}`;
  const body =
    `Your attendance for ${opts.courseCode} is now open. Submit within ${opts.durationMinutes} minutes (before ${opts.endTime}).`;
  const metadata = {
    course_code: opts.courseCode,
    ...(cleanText(opts.offeringId) ? { offering_id: cleanText(opts.offeringId) } : {}),
    duration_minutes: opts.durationMinutes,
    end_time_label: opts.endTime,
    notification_source: 'teacher_web_portal',
    open_screen: 'student_geo_attendance',
    ...(cleanText(opts.roomNumber) ? { room_number: cleanText(opts.roomNumber) } : {}),
    ...(cleanText(opts.section) ? { geo_room_section: cleanText(opts.section) } : {}),
    ...(cleanText(opts.roomId) ? { geo_room_id: cleanText(opts.roomId) } : {}),
  };

  const recipients = await resolveRecipientIds({
    term: normalizedTerm,
    section: opts.section,
    offeringId: opts.offeringId,
  });

  if (recipients.length > 0) {
    await createGeoAttendanceUserNotifications({
      userIds: recipients,
      title,
      body,
      createdBy: opts.teacherUserId,
      metadata,
    });
    return;
  }

  const normalizedSection = normalizeSection(opts.section);
  await createNotification({
    type: 'geo_attendance_open',
    title,
    body,
    target_type: normalizedSection ? 'SECTION' : 'YEAR_TERM',
    target_value: normalizedSection ?? normalizedTerm,
    target_year_term: normalizedSection ? normalizedTerm : null,
    created_by: opts.teacherUserId,
    created_by_role: 'TEACHER',
    metadata,
  });
}
