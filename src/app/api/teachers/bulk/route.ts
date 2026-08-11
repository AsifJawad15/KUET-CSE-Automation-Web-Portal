// ==========================================
// API: /api/teachers/bulk
// Bulk import teachers with profile creation
// Batch lookup + parallel hashing + batch insert
// Auth: requireServerSession({ adminLike: true })
// ==========================================

import { NextRequest } from 'next/server';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { hashPassword, generateTeacherPassword } from '@/lib/passwordUtils';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

interface BulkTeacherItem {
  full_name: string;
  email: string;
  phone?: string;
  designation?: string;
}

const VALID_DESIGNATIONS = ['PROFESSOR', 'ASSOCIATE_PROFESSOR', 'ASSISTANT_PROFESSOR', 'LECTURER'];

export async function POST(request: NextRequest) {
  // ── Auth guard ──
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseAdminConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const items: BulkTeacherItem[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('No items provided');
    }

    const db = getSupabaseAdmin();
    const errors: string[] = [];
    let skipped = 0;

    // Validate & normalize
    type ValidTeacher = BulkTeacherItem & { _email: string };
    const validItems: ValidTeacher[] = [];

    for (const item of items) {
      if (!item.full_name || !item.email) {
        errors.push(`Skipping: missing name or email`);
        skipped++;
        continue;
      }
      const email = item.email.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Skipping "${item.full_name}": invalid email "${email}"`);
        skipped++;
        continue;
      }
      validItems.push({ ...item, _email: email });
    }

    if (validItems.length === 0) {
      return Response.json({ inserted: 0, skipped, errors, created: { passwords: [] } });
    }

    // Batch lookup: fetch all existing emails in one query
    const emails = [...new Set(validItems.map(v => v._email))];
    const { data: existingProfiles } = await db
      .from('profiles')
      .select('email')
      .in('email', emails);

    const existingSet = new Set((existingProfiles || []).map(p => p.email));

    // Filter to new teachers only
    const newTeachers = validItems.filter(item => {
      if (existingSet.has(item._email)) {
        skipped++;
        return false;
      }
      existingSet.add(item._email);
      return true;
    });

    if (newTeachers.length === 0) {
      return Response.json({ inserted: 0, skipped, errors, created: { passwords: [] } });
    }

    // Generate passwords + hash in parallel
    const prepared = await Promise.all(
      newTeachers.map(async (item) => {
        const userId = crypto.randomUUID();
        const plainPassword = generateTeacherPassword();
        const passwordHash = await hashPassword(plainPassword);
        const designation = VALID_DESIGNATIONS.includes(item.designation || '')
          ? item.designation!
          : 'LECTURER';
        return { userId, plainPassword, passwordHash, designation, item };
      }),
    );

    // Batch insert profiles
    const profileRows = prepared.map(p => ({
      user_id: p.userId,
      role: 'TEACHER',
      email: p.item._email,
      password_hash: p.passwordHash,
      is_active: true,
    }));

    const { error: profileError } = await db.from('profiles').insert(profileRows);
    if (profileError) {
      errors.push(`Profile batch insert failed: ${profileError.message}`);
      return Response.json({ inserted: 0, skipped, errors, created: { passwords: [] } });
    }

    // Batch insert teacher records
    const teacherRows = prepared.map(p => ({
      user_id: p.userId,
      full_name: p.item.full_name.trim(),
      phone: p.item.phone || '',
      designation: p.designation,
    }));

    const { error: teacherError } = await db.from('teachers').insert(teacherRows);
    if (teacherError) {
      errors.push(`Teacher batch insert failed: ${teacherError.message}`);
      // Rollback profiles
      const userIds = prepared.map(p => p.userId);
      await db.from('profiles').delete().in('user_id', userIds);
      return Response.json({ inserted: 0, skipped, errors, created: { passwords: [] } });
    }

    const generatedPasswords = prepared.map(
      p => `${p.item.full_name.trim()} (${p.item._email}): ${p.plainPassword}`,
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
