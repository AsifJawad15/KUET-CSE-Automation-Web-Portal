// ==========================================
// API: /api/students/bulk
// Bulk import students with profile creation
// Password = roll_no, detects duplicates by email & roll
// Standardized BulkImportResult response
// ==========================================

import { NextRequest } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { hashPassword, getStudentInitialPassword } from '@/lib/passwordUtils';

interface BulkStudentItem {
  full_name: string;
  email: string;
  phone?: string;
  roll_no: string;
  term: string;
  session: string;
}

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const items: BulkStudentItem[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('No items provided');
    }

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        if (!item.full_name || !item.email || !item.roll_no || !item.term || !item.session) {
          errors.push(`Skipping: missing required fields for "${item.roll_no || 'unknown'}"`);
          skipped++;
          continue;
        }

        const email = item.email.toLowerCase().trim();

        // Validate email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push(`Skipping "${item.roll_no}": invalid email "${email}"`);
          skipped++;
          continue;
        }

        // Validate term format
        if (!/^[1-4]-[1-2]$/.test(item.term)) {
          errors.push(`Skipping "${item.roll_no}": invalid term "${item.term}"`);
          skipped++;
          continue;
        }

        // Check duplicate by email
        const { data: existingEmail } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('email', email)
          .maybeSingle();

        if (existingEmail) {
          skipped++;
          continue;
        }

        // Check duplicate by roll_no
        const { data: existingRoll } = await supabase
          .from('students')
          .select('user_id')
          .eq('roll_no', item.roll_no.trim())
          .maybeSingle();

        if (existingRoll) {
          skipped++;
          continue;
        }

        // Generate UUID & password (password = roll_no)
        const userId = crypto.randomUUID();
        const initialPassword = getStudentInitialPassword(item.roll_no);
        const passwordHash = await hashPassword(initialPassword);

        // Create profile
        const { error: profileError } = await supabase.from('profiles').insert({
          user_id: userId,
          role: 'STUDENT',
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

        // Create student record
        const { error: studentError } = await supabase.from('students').insert({
          user_id: userId,
          roll_no: item.roll_no.trim(),
          full_name: item.full_name.trim(),
          phone: item.phone || '',
          term: item.term,
          session: item.session,
        });

        if (studentError) {
          errors.push(`"${item.roll_no}": ${studentError.message}`);
          // Rollback profile
          await supabase.from('profiles').delete().eq('user_id', userId);
          continue;
        }

        inserted++;
      } catch (err) {
        errors.push(`"${item.roll_no}": ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return Response.json({ inserted, skipped, errors });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : 'Bulk import failed');
  }
}
