// ==========================================
// API: /api/course-offerings/bulk
// Bulk import course-teacher allocations
// Batch lookups + batch insert (N+1 eliminated)
// Auth: requireServerSession({ adminLike: true })
// ==========================================

import { NextRequest } from 'next/server';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

interface BulkAllocationItem {
  course_code: string;
  teacher_name: string;
  term?: string;
  session?: string;
  section?: string;
}

function resolveSession(provided?: string): string {
  if (provided) return provided;
  const currentYear = new Date().getFullYear();
  return `${currentYear - 1}-${currentYear}`;
}

export async function POST(request: NextRequest) {
  // ── Auth guard ──
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseAdminConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const items: BulkAllocationItem[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('No items provided');
    }

    const db = getSupabaseAdmin();
    const errors: string[] = [];
    let skipped = 0;

    // Pre-validate
    const validItems: (BulkAllocationItem & { _code: string; _teacherName: string })[] = [];
    for (const item of items) {
      if (!item.course_code || !item.teacher_name) {
        errors.push('Skipping: missing course code or teacher name');
        skipped++;
        continue;
      }
      validItems.push({
        ...item,
        _code: item.course_code.trim().toUpperCase(),
        _teacherName: item.teacher_name.trim(),
      });
    }

    if (validItems.length === 0) {
      return Response.json({ inserted: 0, skipped, errors });
    }

    // Batch lookup: courses by code
    const uniqueCodes = [...new Set(validItems.map(v => v._code))];
    const { data: courseRows } = await db
      .from('courses')
      .select('id, code')
      .in('code', uniqueCodes);

    const courseMap = new Map((courseRows || []).map(c => [c.code, c.id]));

    // Batch lookup: all teachers (needed for name matching)
    const { data: teacherRows } = await db
      .from('teachers')
      .select('user_id, full_name')
      .eq('is_active', true);

    // Build a teacher name → user_id lookup
    const teacherByExactName = new Map<string, string>();
    const allTeachers = teacherRows || [];
    for (const t of allTeachers) {
      teacherByExactName.set(t.full_name.toLowerCase(), t.user_id);
    }

    function findTeacher(name: string): string | null {
      const lower = name.toLowerCase();
      // 1. Exact
      const exact = teacherByExactName.get(lower);
      if (exact) return exact;
      // 2. Partial
      for (const t of allTeachers) {
        if (t.full_name.toLowerCase().includes(lower) || lower.includes(t.full_name.toLowerCase())) {
          return t.user_id;
        }
      }
      return null;
    }

    // Batch lookup: existing offerings
    const { data: existingOfferings } = await db
      .from('course_offerings')
      .select('id, course_id, teacher_user_id');

    const offeringSet = new Set(
      (existingOfferings || []).map(o => `${o.course_id}:${o.teacher_user_id}`),
    );

    // Resolve & filter
    const newOfferings: Record<string, unknown>[] = [];
    for (const item of validItems) {
      const courseId = courseMap.get(item._code);
      if (!courseId) {
        errors.push(`Course "${item._code}" not found in database`);
        skipped++;
        continue;
      }

      const teacherUserId = findTeacher(item._teacherName);
      if (!teacherUserId) {
        errors.push(`Teacher "${item._teacherName}" not found in database`);
        skipped++;
        continue;
      }

      const key = `${courseId}:${teacherUserId}`;
      if (offeringSet.has(key)) {
        skipped++;
        continue;
      }
      offeringSet.add(key);

      // Resolve term from course code if not provided
      let resolvedTerm = item.term;
      if (!resolvedTerm) {
        const match = item._code.match(/\d/);
        if (match) {
          const year = Math.min(parseInt(match[0]), 4);
          resolvedTerm = `${year}-1`;
        }
        resolvedTerm = resolvedTerm || '1-1';
      }

      const insertData: Record<string, unknown> = {
        course_id: courseId,
        teacher_user_id: teacherUserId,
        term: resolvedTerm,
        session: resolveSession(item.session),
      };
      if (item.section) insertData.section = item.section;

      newOfferings.push(insertData);
    }

    let inserted = 0;
    if (newOfferings.length > 0) {
      const { error, count } = await db
        .from('course_offerings')
        .insert(newOfferings, { count: 'exact' });

      if (error) {
        errors.push(`Batch insert failed: ${error.message}`);
      } else {
        inserted = count ?? newOfferings.length;
      }
    }

    return Response.json({ inserted, skipped, errors });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : 'Bulk import failed');
  }
}
