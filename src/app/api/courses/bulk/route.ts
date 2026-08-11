// ==========================================
// API: /api/courses/bulk
// Bulk import courses with duplicate detection
// Batch lookup + batch insert (N+1 eliminated)
// Auth: requireServerSession({ adminLike: true })
// ==========================================

import { NextRequest } from 'next/server';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

interface BulkCourseItem {
  code: string;
  title: string;
  credit: number;
  course_type?: string;
  description?: string | null;
}

export async function POST(request: NextRequest) {
  // ── Auth guard ──
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseAdminConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const items: BulkCourseItem[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('No items provided');
    }

    const db = getSupabaseAdmin();
    const errors: string[] = [];
    let skipped = 0;

    // Validate & normalize
    const validItems: (BulkCourseItem & { _code: string })[] = [];
    for (const item of items) {
      if (!item.code || !item.title || !item.credit) {
        errors.push(`Skipping: missing required fields for "${item.code || 'unknown'}"`);
        skipped++;
        continue;
      }
      validItems.push({ ...item, _code: item.code.trim().toUpperCase() });
    }

    if (validItems.length === 0) {
      return Response.json({ inserted: 0, skipped, errors });
    }

    // Batch lookup: fetch all existing course codes
    const codes = [...new Set(validItems.map(v => v._code))];
    const { data: existingCourses } = await db
      .from('courses')
      .select('code')
      .in('code', codes);

    const existingSet = new Set((existingCourses || []).map(c => c.code));

    // Filter to only new courses
    const newCourses = validItems
      .filter(item => {
        if (existingSet.has(item._code)) {
          skipped++;
          return false;
        }
        existingSet.add(item._code);
        return true;
      })
      .map(item => ({
        code: item._code,
        title: item.title.trim(),
        credit: Number(item.credit),
        course_type: item.course_type || 'Theory',
        description: item.description?.trim() || null,
      }));

    let inserted = 0;
    if (newCourses.length > 0) {
      const { error, count } = await db
        .from('courses')
        .insert(newCourses, { count: 'exact' });

      if (error) {
        errors.push(`Batch insert failed: ${error.message}`);
      } else {
        inserted = count ?? newCourses.length;
      }
    }

    return Response.json({ inserted, skipped, errors });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : 'Bulk import failed');
  }
}
