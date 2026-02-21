// ==========================================
// Supabase Query Constants
// Single Responsibility: Centralizes repeated select strings
// DRY: Eliminates duplicated query fragments across API routes
// ==========================================

/**
 * Select clause for course offerings with teacher + course info.
 * Used by: course-offerings, routine-slots API routes.
 */
export const COURSE_OFFERING_WITH_DETAILS = `
  *,
  courses (id, code, title, credit, course_type, description),
  teachers!course_offerings_teacher_user_id_fkey (
    user_id,
    full_name,
    phone,
    department,
    designation,
    is_on_leave,
    profiles!teachers_user_id_fkey (email)
  )
` as const;

/**
 * Select clause for routine slots with course + teacher + room.
 * Used by: routine-slots API route.
 */
export const ROUTINE_SLOT_WITH_DETAILS = `
  *,
  course_offerings!inner (
    id, term, session, batch,
    courses (code, title, credit, course_type),
    teachers!course_offerings_teacher_user_id_fkey (full_name, teacher_uid)
  ),
  rooms (room_number, room_type)
` as const;

/**
 * Select clause for entity + auth profile.
 * Used by: students, teachers API routes.
 */
export const WITH_PROFILE = `
  *,
  profile:profiles(user_id, role, email, is_active, created_at, updated_at)
` as const;

/**
 * Select clause for term upgrade requests with student info.
 * Used by: term-upgrades API route.
 */
export const TERM_UPGRADE_WITH_STUDENT = `
  *,
  students!inner (
    full_name,
    roll_no,
    term,
    session,
    batch,
    section,
    cgpa
  )
` as const;
