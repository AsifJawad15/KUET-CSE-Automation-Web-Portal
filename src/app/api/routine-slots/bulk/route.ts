// ==========================================
// API: /api/routine-slots/bulk
// Bulk import routine slots into DB.
// Auto-creates missing courses, rooms, teachers, and course_offerings.
// Single password hash, batch lookups, auth guard.
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { hashPassword } from '@/lib/passwordUtils';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

// ── Types ──────────────────────────────────────────────

interface ParsedSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  course_code: string;
  course_title: string;
  course_type: string;
  teacher_name: string;
  room_number: string;
  section: string;
  term: string;
  session: string;
}

interface BulkResult {
  inserted: number;
  skipped: number;
  errors: string[];
  created_courses: string[];
  created_rooms: string[];
  created_teachers: string[];
}

// ── Helpers ────────────────────────────────────────────

/** Normalize time to HH:MM:SS format */
function normalizeTime(t: string): string {
  const parts = t.split(':');
  if (parts.length === 2) return `${parts[0]}:${parts[1]}:00`;
  return t;
}

/** Derive term from course code digits e.g. "CSE 3201" → "3-2" */
function deriveTermFromCode(code: string): string | null {
  const digits = code.replace(/[^0-9]/g, '');
  if (digits.length >= 2) {
    const year = parseInt(digits[0]);
    const sem = parseInt(digits[1]);
    if (year >= 1 && year <= 4 && sem >= 1 && sem <= 2) {
      return `${year}-${sem}`;
    }
  }
  return null;
}

/** Derive credit from course code — last digit of the code number */
function deriveCreditFromCode(code: string): number {
  const digits = code.replace(/[^0-9]/g, '');
  if (digits.length >= 4) return parseInt(digits[3]) || 3;
  return 3;
}

/** Normalize course code: "CSE3201" → "CSE 3201", trim, uppercase */
function normalizeCourseCode(raw: string): string {
  let code = raw.trim().toUpperCase();
  code = code.replace(/([A-Z])(\d)/, '$1 $2');
  return code;
}

// ── POST Handler ───────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Auth guard ──
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseAdminConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const slots: ParsedSlot[] = body.slots || body.items || [];

    if (!Array.isArray(slots) || slots.length === 0) {
      return badRequest('slots/items array is required');
    }

    const db = getSupabaseAdmin();

    const result: BulkResult = {
      inserted: 0,
      skipped: 0,
      errors: [],
      created_courses: [],
      created_rooms: [],
      created_teachers: [],
    };

    // ── Pre-compute the default teacher password hash ONCE ──
    const defaultPasswordHash = await hashPassword('kuet123456');

    // ── Batch pre-fetch all reference data ──
    const [
      { data: allRooms },
      { data: allCourses },
      { data: allTeachers },
      { data: allProfiles },
      { data: allOfferings },
      { data: allSlots },
    ] = await Promise.all([
      db.from('rooms').select('room_number'),
      db.from('courses').select('id, code'),
      db.from('teachers').select('user_id, full_name'),
      db.from('profiles').select('user_id, email'),
      db.from('course_offerings').select('id, course_id, teacher_user_id, term, session'),
      db.from('routine_slots').select('id, offering_id, day_of_week, start_time, section'),
    ]);

    const roomSet = new Set((allRooms || []).map(r => r.room_number));
    const courseMap = new Map((allCourses || []).map(c => [c.code, c.id]));
    const teacherList = allTeachers || [];
    const teacherByName = new Map(teacherList.map(t => [t.full_name.toLowerCase(), t.user_id]));
    const profileByEmail = new Map((allProfiles || []).map(p => [p.email, p.user_id]));
    const offeringIndex = new Map(
      (allOfferings || []).map(o => [`${o.course_id}:${o.teacher_user_id}:${o.term}:${o.session}`, o.id]),
    );
    const slotIndex = new Set(
      (allSlots || []).map(s => `${s.offering_id}:${s.day_of_week}:${s.start_time}:${s.section || ''}`),
    );

    // ── Process slots sequentially but with in-memory lookups ──
    // We still insert missing resources one at a time (they are rare)
    // but the core lookup path is O(1) in-memory.

    for (const slot of slots) {
      try {
        const courseCode = normalizeCourseCode(slot.course_code);
        const term = slot.term || deriveTermFromCode(courseCode) || '1-1';
        const session = slot.session || '2024-2025';
        const section = slot.section || 'A';
        const roomNumber = (slot.room_number || 'UNASSIGNED').trim();

        // 1. Room — check in-memory first
        if (!roomSet.has(roomNumber)) {
          const isLab = /lab/i.test(roomNumber);
          const { error: roomErr } = await db
            .from('rooms')
            .insert({
              room_number: roomNumber,
              building_name: 'Academic Building',
              capacity: isLab ? 60 : 80,
              room_type: isLab ? 'LAB' : 'CLASSROOM',
              is_active: true,
            });
          if (roomErr) {
            // Might be a race-condition duplicate, that's OK
            if (!roomErr.message.includes('duplicate') && !roomErr.message.includes('unique')) {
              result.errors.push(`Room "${roomNumber}": ${roomErr.message}`);
              continue;
            }
          } else {
            result.created_rooms.push(roomNumber);
          }
          roomSet.add(roomNumber);
        }

        // 2. Course — check in-memory
        let courseId = courseMap.get(courseCode);
        if (!courseId) {
          const credit = deriveCreditFromCode(courseCode);
          const { data: newCourse, error: courseErr } = await db
            .from('courses')
            .insert({
              code: courseCode,
              title: slot.course_title || `Course ${courseCode}`,
              credit,
              course_type: slot.course_type === 'lab' ? 'Lab' : 'Theory',
            })
            .select('id')
            .single();

          if (courseErr) {
            result.errors.push(`Course "${courseCode}": ${courseErr.message}`);
            continue;
          }
          courseId = newCourse.id;
          courseMap.set(courseCode, courseId);
          result.created_courses.push(courseCode);
        }

        // 3. Teacher — check in-memory
        const teacherName = (slot.teacher_name || 'TBA').trim();
        let teacherUserId = findTeacherInMemory(teacherName, teacherByName, teacherList);

        if (!teacherUserId) {
          // Create profile + teacher using pre-computed hash
          const slug = teacherName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
          const emailBase = `${slug}@kuet.ac.bd`;

          // Check if email already exists in-memory
          const existingProfileId = profileByEmail.get(emailBase);
          if (existingProfileId) {
            teacherUserId = existingProfileId;
          } else {
            const { data: profile, error: pErr } = await db
              .from('profiles')
              .insert({ role: 'TEACHER', email: emailBase, password_hash: defaultPasswordHash, is_active: true })
              .select('user_id')
              .single();

            if (pErr) {
              result.errors.push(`Profile for "${teacherName}": ${pErr.message}`);
              continue;
            }
            teacherUserId = profile.user_id;
            profileByEmail.set(emailBase, teacherUserId);
          }

          const { error: tErr } = await db
            .from('teachers')
            .insert({
              user_id: teacherUserId,
              full_name: teacherName,
              phone: '0000000000',
              designation: 'LECTURER',
              department: 'CSE',
            });

          if (tErr && !tErr.message.includes('duplicate') && !tErr.message.includes('unique')) {
            result.errors.push(`Teacher "${teacherName}": ${tErr.message}`);
            continue;
          }

          teacherByName.set(teacherName.toLowerCase(), teacherUserId);
          result.created_teachers.push(teacherName);
        }

        // 4. Course offering — check in-memory
        const offeringKey = `${courseId}:${teacherUserId}:${term}:${session}`;
        let offeringId = offeringIndex.get(offeringKey);

        if (!offeringId) {
          const { data: newOffering, error: oErr } = await db
            .from('course_offerings')
            .insert({ course_id: courseId, teacher_user_id: teacherUserId, term, session, is_active: true })
            .select('id')
            .single();

          if (oErr) {
            result.errors.push(`Offering: ${oErr.message}`);
            continue;
          }
          offeringId = newOffering.id;
          offeringIndex.set(offeringKey, offeringId);
        }

        // 5. Duplicate slot check — in-memory
        const startTime = normalizeTime(slot.start_time);
        const endTime = normalizeTime(slot.end_time);
        const slotKey = `${offeringId}:${slot.day_of_week}:${startTime}:${section}`;

        if (slotIndex.has(slotKey)) {
          result.skipped++;
          continue;
        }

        // 6. Insert
        const { error: insertErr } = await db
          .from('routine_slots')
          .insert({
            offering_id: offeringId,
            room_number: roomNumber,
            day_of_week: slot.day_of_week,
            start_time: startTime,
            end_time: endTime,
            section,
          });

        if (insertErr) {
          result.errors.push(`${courseCode}: ${insertErr.message}`);
        } else {
          result.inserted++;
          slotIndex.add(slotKey);
        }
      } catch (slotErr: unknown) {
        const msg = slotErr instanceof Error ? slotErr.message : 'Unknown error';
        result.errors.push(`${slot.course_code}: ${msg}`);
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Bulk import failed';
    return internalError(msg);
  }
}

// ── In-memory teacher name resolver ────────────────────

function findTeacherInMemory(
  name: string,
  byName: Map<string, string>,
  allTeachers: { user_id: string; full_name: string }[],
): string | null {
  const lower = name.toLowerCase().trim();
  if (!lower || lower === 'tba' || lower === 'unknown') return null;

  // Exact
  const exact = byName.get(lower);
  if (exact) return exact;

  // Partial / contains
  for (const t of allTeachers) {
    const tLower = t.full_name.toLowerCase();
    if (tLower.includes(lower) || lower.includes(tLower)) return t.user_id;

    // Initials match
    const tInitials = t.full_name
      .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.|Md\.)\s*/gi, '')
      .trim()
      .split(/\s+/)
      .map((w: string) => w[0]?.toUpperCase() || '')
      .join('');
    if (tInitials.length >= 2 && tInitials.toLowerCase() === lower) return t.user_id;
  }

  return null;
}
