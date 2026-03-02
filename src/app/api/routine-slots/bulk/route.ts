// ==========================================
// API: /api/routine-slots/bulk
// Bulk import routine slots into DB.
// Auto-creates missing courses, rooms, teachers, and course_offerings.
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { hashPassword } from '@/lib/passwordUtils';

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
    // Must match DB constraint: ^[1-4]-[1-2]$
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

// ── Resource Finders/Creators ──────────────────────────

async function findOrCreateRoom(
  roomNumber: string,
  createdList: string[],
): Promise<string> {
  const cleaned = (roomNumber || '').trim();
  if (!cleaned) return await findOrCreateRoom('UNASSIGNED', createdList);

  const { data: existing } = await supabase
    .from('rooms')
    .select('room_number')
    .eq('room_number', cleaned)
    .single();

  if (existing) return existing.room_number;

  const isLab = /lab/i.test(cleaned);
  const { data: created, error } = await supabase
    .from('rooms')
    .insert({
      room_number: cleaned,
      building_name: 'Academic Building',
      capacity: isLab ? 60 : 80,
      room_type: isLab ? 'LAB' : 'CLASSROOM',
      is_active: true,
    })
    .select('room_number')
    .single();

  if (error) throw new Error(`Room "${cleaned}": ${error.message}`);
  createdList.push(cleaned);
  return created.room_number;
}

async function findOrCreateCourse(
  code: string,
  title: string,
  courseType: string,
  createdList: string[],
): Promise<string> {
  const normalized = normalizeCourseCode(code);

  const { data: existing } = await supabase
    .from('courses')
    .select('id')
    .eq('code', normalized)
    .single();

  if (existing) return existing.id;

  const credit = deriveCreditFromCode(normalized);
  const { data: created, error } = await supabase
    .from('courses')
    .insert({
      code: normalized,
      title: title || `Course ${normalized}`,
      credit,
      course_type: courseType === 'lab' ? 'Lab' : 'Theory',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Course "${normalized}": ${error.message}`);
  createdList.push(normalized);
  return created.id;
}

async function findTeacherByName(name: string): Promise<string | null> {
  const lower = name.toLowerCase().trim();
  if (!lower || lower === 'tba' || lower === 'unknown') return null;

  // Exact match
  const { data: exact } = await supabase
    .from('teachers')
    .select('user_id')
    .ilike('full_name', lower)
    .limit(1);
  if (exact && exact.length > 0) return exact[0].user_id;

  // Partial match
  const { data: all } = await supabase
    .from('teachers')
    .select('user_id, full_name')
    .limit(500);

  if (all) {
    for (const t of all) {
      const tLower = t.full_name.toLowerCase();
      if (tLower.includes(lower) || lower.includes(tLower)) return t.user_id;

      // Initials match (e.g. "KS" matches "Dr. Kazi Shahiduzzaman")
      const tInitials = t.full_name
        .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.|Md\.)\s*/gi, '')
        .trim()
        .split(/\s+/)
        .map((w: string) => w[0]?.toUpperCase() || '')
        .join('');
      if (tInitials.length >= 2 && tInitials.toLowerCase() === lower) return t.user_id;
    }
  }

  return null;
}

async function findOrCreateTeacher(
  teacherName: string,
  createdList: string[],
): Promise<string> {
  const name = (teacherName || 'TBA').trim();

  // Try to find existing teacher
  const existingId = await findTeacherByName(name);
  if (existingId) return existingId;

  // Generate a unique email
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  const emailBase = `${slug}@kuet.ac.bd`;

  // Check if email already used
  const { data: profileCheck } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('email', emailBase)
    .single();

  if (profileCheck) {
    // Profile exists — ensure teacher record too
    const { data: tCheck } = await supabase
      .from('teachers')
      .select('user_id')
      .eq('user_id', profileCheck.user_id)
      .single();

    if (tCheck) return tCheck.user_id;

    await supabase.from('teachers').insert({
      user_id: profileCheck.user_id,
      full_name: name,
      phone: '0000000000',
      designation: 'LECTURER',
      department: 'CSE',
    });
    createdList.push(name);
    return profileCheck.user_id;
  }

  // Create profile + teacher
  const passwordHash = await hashPassword('kuet123456');
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .insert({ role: 'TEACHER', email: emailBase, password_hash: passwordHash, is_active: true })
    .select('user_id')
    .single();

  if (pErr) throw new Error(`Profile for "${name}": ${pErr.message}`);

  const { error: tErr } = await supabase
    .from('teachers')
    .insert({
      user_id: profile.user_id,
      full_name: name,
      phone: '0000000000',
      designation: 'LECTURER',
      department: 'CSE',
    });

  if (tErr) throw new Error(`Teacher "${name}": ${tErr.message}`);
  createdList.push(name);
  return profile.user_id;
}

async function findOrCreateOffering(
  courseId: string,
  teacherUserId: string,
  term: string,
  session: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('course_offerings')
    .select('id')
    .eq('course_id', courseId)
    .eq('teacher_user_id', teacherUserId)
    .eq('term', term)
    .eq('session', session)
    .limit(1);

  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error } = await supabase
    .from('course_offerings')
    .insert({ course_id: courseId, teacher_user_id: teacherUserId, term, session, is_active: true })
    .select('id')
    .single();

  if (error) throw new Error(`Offering: ${error.message}`);
  return created.id;
}

// ── POST Handler ───────────────────────────────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const slots: ParsedSlot[] = body.slots;

    if (!Array.isArray(slots) || slots.length === 0) {
      return badRequest('slots array is required');
    }

    const result: BulkResult = {
      inserted: 0,
      skipped: 0,
      errors: [],
      created_courses: [],
      created_rooms: [],
      created_teachers: [],
    };

    for (const slot of slots) {
      try {
        const courseCode = normalizeCourseCode(slot.course_code);
        const term = slot.term || deriveTermFromCode(courseCode) || '1-1';
        const session = slot.session || '2024-2025';
        const section = slot.section || 'A';

        // 1. Room
        const roomNumber = await findOrCreateRoom(
          slot.room_number || '',
          result.created_rooms,
        );

        // 2. Course
        const courseId = await findOrCreateCourse(
          courseCode,
          slot.course_title,
          slot.course_type,
          result.created_courses,
        );

        // 3. Teacher
        const teacherUserId = await findOrCreateTeacher(
          slot.teacher_name || 'TBA',
          result.created_teachers,
        );

        // 4. Course offering
        const offeringId = await findOrCreateOffering(courseId, teacherUserId, term, session);

        // 5. Duplicate check
        const startTime = normalizeTime(slot.start_time);
        const endTime = normalizeTime(slot.end_time);

        const { data: dup } = await supabase
          .from('routine_slots')
          .select('id')
          .eq('offering_id', offeringId)
          .eq('day_of_week', slot.day_of_week)
          .eq('start_time', startTime)
          .eq('section', section)
          .limit(1);

        if (dup && dup.length > 0) {
          result.skipped++;
          continue;
        }

        // 6. Insert
        const { error: insertErr } = await supabase
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
