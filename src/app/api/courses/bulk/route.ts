// ==========================================
// API: /api/courses/bulk
// Bulk import courses with duplicate detection
// Standardized BulkImportResult response
// ==========================================

import { NextRequest } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';

interface BulkCourseItem {
  code: string;
  title: string;
  credit: number;
  course_type?: string;
  description?: string | null;
}

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const items: BulkCourseItem[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('No items provided');
    }

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        if (!item.code || !item.title || !item.credit) {
          errors.push(`Skipping: missing required fields for "${item.code || 'unknown'}"`);
          skipped++;
          continue;
        }

        // Check duplicate
        const { data: existing } = await supabase
          .from('courses')
          .select('id')
          .eq('code', item.code.trim().toUpperCase())
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const { error } = await supabase.from('courses').insert({
          code: item.code.trim().toUpperCase(),
          title: item.title.trim(),
          credit: Number(item.credit),
          course_type: item.course_type || 'Theory',
          description: item.description?.trim() || null,
        });

        if (error) {
          if (error.message.includes('duplicate') || error.message.includes('unique')) {
            skipped++;
          } else {
            errors.push(`"${item.code}": ${error.message}`);
          }
        } else {
          inserted++;
        }
      } catch (err) {
        errors.push(`"${item.code}": ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return Response.json({ inserted, skipped, errors });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : 'Bulk import failed');
  }
}
