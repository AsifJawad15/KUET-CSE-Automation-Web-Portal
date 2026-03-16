import { supabase } from '@/lib/supabase';

export type NotificationTargetType = 'ALL' | 'ROLE' | 'YEAR_TERM' | 'SECTION' | 'COURSE' | 'USER';

export interface NotificationTarget {
  targetType: NotificationTargetType;
  targetValue?: string | null;
  targetYearTerm?: string | null;
}

export interface NotificationDraft extends NotificationTarget {
  type: string;
  title: string;
  body: string;
  createdBy?: string | null;
  createdByRole?: string | null;
  metadata?: Record<string, unknown>;
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

export async function createNotification(draft: NotificationDraft): Promise<boolean> {
  const dedupeKey = cleanText(draft.dedupeKey);
  const metadata = {
    ...(draft.metadata || {}),
    ...(dedupeKey ? { event_key: dedupeKey } : {}),
  };

  if (dedupeKey) {
    const { data: existing, error: lookupError } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', draft.type)
      .contains('metadata', { event_key: dedupeKey })
      .limit(1)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing) return false;
  }

  const { error } = await supabase.from('notifications').insert({
    type: draft.type,
    title: draft.title,
    body: draft.body,
    target_type: draft.targetType,
    target_value: cleanText(draft.targetValue),
    target_year_term: cleanText(draft.targetYearTerm),
    created_by: draft.createdBy ?? null,
    created_by_role: draft.createdByRole ?? 'SYSTEM',
    metadata,
    expires_at: draft.expiresAt ?? null,
  });

  if (error) throw error;
  return true;
}

export async function getOfferingNotificationContext(offeringId: string): Promise<OfferingNotificationContext | null> {
  const { data, error } = await supabase
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

  const { data, error } = await supabase
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