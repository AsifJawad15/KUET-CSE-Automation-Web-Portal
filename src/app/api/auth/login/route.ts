// ==========================================
// API: /api/auth/login
// Admin: hardcoded credentials (no DB)
// Teacher: authenticates via Supabase profiles table
// ==========================================

import { NextRequest } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError, ok, unauthorized } from '@/lib/apiResponse';
import { requireFields, runValidations, validateEmail } from '@/lib/validators';
import { comparePassword } from '@/lib/passwordUtils';

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── Hardcoded admin credentials ────────────────────────

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'admin123';

// ── Designation display mapping ────────────────────────

const DESIGNATION_LABELS: Record<string, string> = {
  PROFESSOR: 'Professor',
  ASSOCIATE_PROFESSOR: 'Associate Professor',
  ASSISTANT_PROFESSOR: 'Assistant Professor',
  LECTURER: 'Lecturer',
};

// ── POST /api/auth/login ───────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const validation = runValidations(
      requireFields({ email, password }),
      validateEmail(email ?? ''),
    );
    if (validation) return badRequest(validation);

    const normalizedEmail = email.toLowerCase().trim();

    // ── Admin: hardcoded credentials (no DB lookup) ────
    if (normalizedEmail === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      return ok({
        id: 'admin-001',
        email: ADMIN_EMAIL,
        name: 'System Administrator',
        role: 'admin',
        department: 'Computer Science & Engineering',
        designation: 'System Admin',
      });
    }

    // If someone tries admin email with wrong password
    if (normalizedEmail === ADMIN_EMAIL) {
      return unauthorized('Invalid email or password');
    }

    // ── Teacher/Other: authenticate via Supabase profiles table ────
    const guard = guardSupabase(isSupabaseConfigured());
    if (guard) return guard;

    // 1. Fetch profile with password hash
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, role, email, password_hash, is_active')
      .eq('email', normalizedEmail)
      .single();

    if (profileError || !profile) {
      return unauthorized('Invalid email or password');
    }

    if (!profile.is_active) {
      return unauthorized('Account is deactivated. Contact administrator.');
    }

    // 2. Compare password
    const isValid = await comparePassword(password, profile.password_hash);
    if (!isValid) {
      return unauthorized('Invalid email or password');
    }

    // 3. Build user response based on role
    let name = normalizedEmail;
    let department = 'Computer Science & Engineering';
    let designation: string | undefined;

    if (profile.role === 'TEACHER') {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('full_name, designation, department, office_room')
        .eq('user_id', profile.user_id)
        .single();

      if (teacher) {
        name = teacher.full_name;
        department = teacher.department || department;
        designation = DESIGNATION_LABELS[teacher.designation] || teacher.designation;
      }
    } else if (profile.role === 'ADMIN') {
      name = 'System Administrator';
      designation = 'System Admin';
    }

    // 4. Update last_login
    await supabase
      .from('profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('user_id', profile.user_id);

    return ok({
      id: profile.user_id,
      email: profile.email,
      name,
      role: profile.role.toLowerCase(),
      department,
      designation,
    });
  } catch (error: unknown) {
    return internalError(extractError(error, 'Login failed'));
  }
}
