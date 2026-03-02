// ==========================================
// API: /api/teachers/bulk
// Bulk import teachers with profile creation
// Auto-generates passwords, detects duplicates by email
// Standardized BulkImportResult response
// ==========================================

import { NextRequest } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { hashPassword, generateTeacherPassword } from '@/lib/passwordUtils';

interface BulkTeacherItem {
  full_name: string;
  email: string;
  phone?: string;
  designation?: string;
}

const VALID_DESIGNATIONS = ['PROFESSOR', 'ASSOCIATE_PROFESSOR', 'ASSISTANT_PROFESSOR', 'LECTURER'];

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const items: BulkTeacherItem[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('No items provided');
    }

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];
    const generatedPasswords: string[] = [];

    for (const item of items) {
      try {
        if (!item.full_name || !item.email) {
          errors.push(`Skipping: missing name or email`);
          skipped++;
          continue;
        }

        const email = item.email.toLowerCase().trim();

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push(`Skipping "${item.full_name}": invalid email "${email}"`);
          skipped++;
          continue;
        }

        // Check duplicate email in profiles
        const { data: existing } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('email', email)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // Normalize designation
        const designation = VALID_DESIGNATIONS.includes(item.designation || '')
          ? item.designation!
          : 'LECTURER';

        // Generate UUID & password
        const userId = crypto.randomUUID();
        const plainPassword = generateTeacherPassword();
        const passwordHash = await hashPassword(plainPassword);

        // Create profile
        const { error: profileError } = await supabase.from('profiles').insert({
          user_id: userId,
          role: 'TEACHER',
          email,
          password_hash: passwordHash,
          is_active: true,
        });

        if (profileError) {
          if (profileError.message.includes('duplicate') || profileError.message.includes('unique')) {
            skipped++;
            continue;
          }
          throw profileError;
        }

        // Create teacher record
        const { error: teacherError } = await supabase.from('teachers').insert({
          user_id: userId,
          full_name: item.full_name.trim(),
          phone: item.phone || '',
          designation,
        });

        if (teacherError) {
          errors.push(`"${item.full_name}": ${teacherError.message}`);
          // Rollback profile
          await supabase.from('profiles').delete().eq('user_id', userId);
          continue;
        }

        inserted++;
        generatedPasswords.push(`${item.full_name} (${email}): ${plainPassword}`);
      } catch (err) {
        errors.push(`"${item.full_name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return Response.json({
      inserted,
      skipped,
      errors,
      created: {
        passwords: generatedPasswords,
      },
    });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : 'Bulk import failed');
  }
}
