import { getSupabaseAdmin } from './supabaseAdmin';
import { ServerSessionUser, isAdminLike } from './serverAuth';

/** Authorize the audience before using the privileged notification writer. */
export async function canNotify(user: ServerSessionUser, body: Record<string, any>): Promise<boolean> {
  if (isAdminLike(user.role)) return true;
  if (body.target_type === 'USER' && body.target_value === user.id) return true;
  const db = getSupabaseAdmin();
  if (user.role === 'student') {
    const { data: student, error } = await db.from('students').select('is_cr,term,section').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!student?.is_cr || !['announcement', 'exam_scheduled', 'class_rescheduled', 'class_cancelled'].includes(body.type)) return false;
    return (body.target_type === 'YEAR_TERM' && body.target_value === student.term) ||
      (body.target_type === 'SECTION' && body.target_value === student.section && body.target_year_term === student.term);
  }
  if (user.role !== 'teacher') return false;
  let query = db.from('course_offerings').select('id,term,section,courses(code),enrollments(student_user_id,enrollment_status)')
    .eq('teacher_user_id', user.id).eq('is_active', true);
  if (body.target_type === 'SECTION') query = query.eq('term', body.target_year_term).eq('section', body.target_value);
  if (body.target_type === 'YEAR_TERM') query = query.eq('term', body.target_value);
  const { data: offerings, error } = await query;
  if (error) throw error;
  return (offerings ?? []).some(o => {
    const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
    if (body.target_type === 'COURSE') return course?.code === body.target_value;
    if (body.target_type === 'SECTION' || body.target_type === 'YEAR_TERM') return true;
    if (body.target_type === 'USER') return o.enrollments.some(e => e.student_user_id === body.target_value && e.enrollment_status === 'ENROLLED');
    return false;
  });
}
