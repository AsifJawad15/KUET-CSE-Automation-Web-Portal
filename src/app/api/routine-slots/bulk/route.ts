// ==========================================
// API: /api/routine-slots/bulk
// Single Responsibility: Bulk import parsed routine slots into DB
// Matches slots to existing course_offerings; returns unmatched for display-only
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { ROUTINE_SLOT_WITH_DETAILS } from '@/lib/queryConstants';

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
  unmatched: ParsedSlot[];
  errors: string[];
}

// ── Helpers ────────────────────────────────────────────

function getInitials(fullName: string): string {
  return fullName
    .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.|Md\.)\s*/gi, '')
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

/** Try to match teacher by full name, partial name, or initials. */
function findTeacherMatch(
  teacherName: string,
  offerings: { id: string; teacher_name: string }[],
): string | null {
  if (!teacherName) return offerings[0]?.id || null;

  const needle = teacherName.trim().toLowerCase();
  const needleInitials = getInitials(teacherName).toLowerCase();

  // 1) Exact full_name match
  for (const o of offerings) {
    if (o.teacher_name.toLowerCase() === needle) return o.id;
  }

  // 2) Name contains / is contained
  for (const o of offerings) {
    const tn = o.teacher_name.toLowerCase();
    if (tn.includes(needle) || needle.includes(tn)) return o.id;
  }

  // 3) Initials match
  for (const o of offerings) {
    if (getInitials(o.teacher_name).toLowerCase() === needleInitials) return o.id;
  }

  // 4) If only one offering for this course, use it
  if (offerings.length === 1) return offerings[0].id;

  return null;
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

    // Prefetch all course offerings with course code + teacher name
    const { data: allOfferings, error: offerErr } = await supabase
      .from('course_offerings')
      .select('id, course_id, teacher_user_id, term, session, courses(code), teachers!course_offerings_teacher_user_id_fkey(full_name)')
      .eq('is_active', true);

    if (offerErr) throw offerErr;

    // Build lookup: course_code → offerings with teacher names
    const offeringsByCode = new Map<string, { id: string; teacher_name: string }[]>();
    for (const o of allOfferings || []) {
      const code = (o.courses as { code?: string } | null)?.code || '';
      const name = (o.teachers as { full_name?: string } | null)?.full_name || '';
      if (!code) continue;
      const existing = offeringsByCode.get(code) || [];
      existing.push({ id: o.id, teacher_name: name });
      offeringsByCode.set(code, existing);
    }

    const result: BulkResult = { inserted: 0, skipped: 0, unmatched: [], errors: [] };

    for (const slot of slots) {
      const courseCode = slot.course_code.replace(/\s+/g, ' ').trim();
      const offerings = offeringsByCode.get(courseCode);

      if (!offerings || offerings.length === 0) {
        // Course not found in DB — unmatched (display-only with teacher name)
        result.unmatched.push(slot);
        continue;
      }

      // Try to match teacher
      const offeringId = findTeacherMatch(slot.teacher_name, offerings);

      if (!offeringId) {
        // Teacher not matched — unmatched (keep teacher name for grid display)
        result.unmatched.push(slot);
        continue;
      }

      // Check for duplicate (same offering + day + time + section)
      const { data: existing } = await supabase
        .from('routine_slots')
        .select('id')
        .eq('offering_id', offeringId)
        .eq('day_of_week', slot.day_of_week)
        .eq('start_time', slot.start_time + ':00')
        .eq('section', slot.section)
        .limit(1);

      if (existing && existing.length > 0) {
        result.skipped++;
        continue;
      }

      // Insert
      const { error: insertErr } = await supabase
        .from('routine_slots')
        .insert({
          offering_id: offeringId,
          room_number: slot.room_number,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time + ':00',
          end_time: slot.end_time + ':00',
          section: slot.section,
        });

      if (insertErr) {
        result.errors.push(`${slot.course_code}: ${insertErr.message}`);
      } else {
        result.inserted++;
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Bulk import failed';
    return internalError(msg);
  }
}
