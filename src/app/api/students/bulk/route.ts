// ==========================================
// API: /api/students/bulk
// Bulk import students with profile creation
// Secure random passwords, batch operations
// Auth: requireServerSession({ adminLike: true })
// ==========================================

import { NextRequest } from 'next/server';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { hashPassword, getStudentInitialPassword } from '@/lib/passwordUtils';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

interface BulkStudentItem {
  full_name: string;
  email: string;
  phone?: string;
  roll_no: string;
  term: string;
  session: string;
}

export async function POST(request: NextRequest) {
  // ── Auth guard ──
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseAdminConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const items: BulkStudentItem[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('No items provided');
    }

    const db = getSupabaseAdmin();
    const errors: string[] = [];
    let skipped = 0;

    // Validate & normalize
    type ValidStudent = BulkStudentItem & { _email: string; _rollNo: string };
    const validItems: ValidStudent[] = [];

    for (const item of items) {
      if (!item.full_name || !item.email || !item.roll_no || !item.term || !item.session) {
        errors.push(`Skipping: missing required fields for "${item.roll_no || 'unknown'}"`);
        skipped++;
        continue;
      }
      const email = item.email.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Skipping "${item.roll_no}": invalid email "${email}"`);
        skipped++;
        continue;
      }
      if (!/^[1-4]-[1-2]$/.test(item.term)) {
        errors.push(`Skipping "${item.roll_no}": invalid term "${item.term}"`);
        skipped++;
        continue;
      }
      validItems.push({ ...item, _email: email, _rollNo: item.roll_no.trim() });
    }

    if (validItems.length === 0) {
      return Response.json({ inserted: 0, skipped, errors, created: { passwords: [] } });
    }

    // Batch lookup: emails + roll numbers in parallel
    const emails = [...new Set(validItems.map(v => v._email))];
    const rollNos = [...new Set(validItems.map(v => v._rollNo))];

    const [{ data: existingEmails }, { data: existingRolls }] = await Promise.all([
      db.from('profiles').select('email').in('email', emails),
      db.from('students').select('roll_no').in('roll_no', rollNos),
    ]);

    const emailSet = new Set((existingEmails || []).map(p => p.email));
    const rollSet = new Set((existingRolls || []).map(s => s.roll_no));

    // Filter to new students only
    const newStudents = validItems.filter(item => {
      if (emailSet.has(item._email) || rollSet.has(item._rollNo)) {
        skipped++;
        return false;
      }
      emailSet.add(item._email);
      rollSet.add(item._rollNo);
      return true;
    });

    if (newStudents.length === 0) {
      return Response.json({ inserted: 0, skipped, errors, created: { passwords: [] } });
    }

    // Generate secure random passwords + hash in parallel
    const prepared = await Promise.all(
      newStudents.map(async (item) => {
        const userId = crypto.randomUUID();
        const plainPassword = getStudentInitialPassword();
        const passwordHash = await hashPassword(plainPassword);
        return { userId, plainPassword, passwordHash, item };
      }),
    );

    // Batch insert profiles
    const profileRows = prepared.map(p => ({
      user_id: p.userId,
      role: 'STUDENT',
      email: p.item._email,
      password_hash: p.passwordHash,
      is_active: true,
    }));

    const { error: profileError } = await db.from('profiles').insert(profileRows);
    if (profileError) {
      errors.push(`Profile batch insert failed: ${profileError.message}`);
      return Response.json({ inserted: 0, skipped, errors, created: { passwords: [] } });
    }

    // Batch insert student records
    const studentRows = prepared.map(p => ({
      user_id: p.userId,
      roll_no: p.item._rollNo,
      full_name: p.item.full_name.trim(),
      phone: p.item.phone || '',
      term: p.item.term,
      session: p.item.session,
    }));

    const { error: studentError } = await db.from('students').insert(studentRows);
    if (studentError) {
      errors.push(`Student batch insert failed: ${studentError.message}`);
      // Rollback profiles
      const userIds = prepared.map(p => p.userId);
      await db.from('profiles').delete().in('user_id', userIds);
      return Response.json({ inserted: 0, skipped, errors, created: { passwords: [] } });
    }

    // Return generated passwords so admin can distribute them
    const generatedPasswords = prepared.map(
      p => `${p.item.full_name.trim()} (${p.item._email}) [${p.item._rollNo}]: ${p.plainPassword}`,
    );

    return Response.json({
      inserted: prepared.length,
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
