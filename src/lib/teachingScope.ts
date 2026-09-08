import { getSupabaseAdmin } from './supabaseAdmin';

/** Resolve one explicit offering and its active enrolments before any write. */
export async function teachingScope(teacherId: string, offeringId: unknown) {
  if (typeof offeringId !== 'string' || !offeringId) return null;
  const db = getSupabaseAdmin();
  const { data: offering, error } = await db.from('course_offerings')
    .select('id, courses(code)').eq('id', offeringId).eq('teacher_user_id', teacherId)
    .eq('is_active', true).maybeSingle();
  if (error) throw error;
  if (!offering) return null;
  const course = Array.isArray(offering.courses) ? offering.courses[0] : offering.courses;
  const { data: enrolments, error: enrolmentError } = await db.from('enrollments')
    .select('student_user_id, students(roll_no)').eq('offering_id', offeringId).eq('enrollment_status', 'ENROLLED');
  if (enrolmentError) throw enrolmentError;
  return { offeringId, courseCode: course?.code,
    studentIds: (enrolments ?? []).map(e => e.student_user_id),
    rolls: (enrolments ?? []).map(e => (Array.isArray(e.students) ? e.students[0] : e.students)?.roll_no).filter(Boolean) as string[],
  };
}
