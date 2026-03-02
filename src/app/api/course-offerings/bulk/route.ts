// ==========================================
// API: /api/course-offerings/bulk
// Bulk import course-teacher allocations
// Resolves course by code, teacher by name
// Auto-creates offerings with duplicate detection
// Standardized BulkImportResult response
// ==========================================

import { NextRequest } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';

interface BulkAllocationItem {
  course_code: string;
  teacher_name: string;
  term?: string;
  session?: string;
  section?: string;
}

// ── Helpers ────────────────────────────────────────────

async function findCourseByCode(code: string) {
  const { data } = await supabase
    .from('courses')
    .select('id')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle();
  return data;
}

async function findTeacherByName(name: string) {
  const trimmed = name.trim();

  // 1. Exact match (case-insensitive)
  const { data: exact } = await supabase
    .from('teachers')
    .select('user_id')
    .ilike('full_name', trimmed)
    .limit(1)
    .maybeSingle();
  if (exact) return exact;

  // 2. Partial match
  const { data: partial } = await supabase
    .from('teachers')
    .select('user_id')
    .ilike('full_name', `%${trimmed}%`)
    .limit(1)
    .maybeSingle();
  if (partial) return partial;

  return null;
}

function resolveSession(provided?: string): string {
  if (provided) return provided;
  const currentYear = new Date().getFullYear();
  return `${currentYear - 1}-${currentYear}`;
}

// ── POST Handler ───────────────────────────────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const items: BulkAllocationItem[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('No items provided');
    }

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        if (!item.course_code || !item.teacher_name) {
          errors.push('Skipping: missing course code or teacher name');
          skipped++;
          continue;
        }

        // Find course
        const course = await findCourseByCode(item.course_code);
        if (!course) {
          errors.push(`Course "${item.course_code}" not found in database`);
          skipped++;
          continue;
        }

        // Find teacher
        const teacher = await findTeacherByName(item.teacher_name);
        if (!teacher) {
          errors.push(`Teacher "${item.teacher_name}" not found in database`);
          skipped++;
          continue;
        }

        const resolvedSession = resolveSession(item.session);

        // Check duplicate assignment
        const { data: existing } = await supabase
          .from('course_offerings')
          .select('id')
          .eq('course_id', course.id)
          .eq('teacher_user_id', teacher.user_id)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // Resolve term from course code if not provided
        let resolvedTerm = item.term;
        if (!resolvedTerm) {
          const { data: courseData } = await supabase
            .from('courses')
            .select('code')
            .eq('id', course.id)
            .single();
          if (courseData?.code) {
            const match = courseData.code.match(/\d/);
            if (match) {
              const year = Math.min(parseInt(match[0]), 4);
              resolvedTerm = `${year}-1`;
            }
          }
          resolvedTerm = resolvedTerm || '1-1';
        }

        // Insert offering
        const insertData: Record<string, unknown> = {
          course_id: course.id,
          teacher_user_id: teacher.user_id,
          term: resolvedTerm,
          session: resolvedSession,
        };
        if (item.section) insertData.section = item.section;

        const { error } = await supabase
          .from('course_offerings')
          .insert(insertData);

        if (error) {
          errors.push(`"${item.course_code}" → "${item.teacher_name}": ${error.message}`);
        } else {
          inserted++;
        }
      } catch (err) {
        errors.push(`"${item.course_code}": ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return Response.json({ inserted, skipped, errors });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : 'Bulk import failed');
  }
}
