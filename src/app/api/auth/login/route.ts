// ==========================================
// API: /api/auth/login
// Admin/Head/Teacher: authenticates via Supabase profiles table
// Rate-limited: max 5 attempts per IP per minute
// ==========================================

import { NextRequest } from 'next/server';
import { badRequest, internalError, ok, serviceUnavailable, unauthorized } from '@/lib/apiResponse';
import { requireFields, runValidations, validateEmail } from '@/lib/validators';
import { comparePassword } from '@/lib/passwordUtils';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { createSessionToken, ServerUserRole, setSessionCookie } from '@/lib/serverAuth';

interface AdminPermissions {
  all?: boolean;
  menus?: string[];
  source?: string;
}

function normalizeAdminPermissions(raw: unknown): AdminPermissions | null {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as { all?: unknown; menus?: unknown; source?: unknown };
  return {
    all: candidate.all === true,
    menus: Array.isArray(candidate.menus)
      ? candidate.menus.filter((menu): menu is string => typeof menu === 'string' && menu.trim().length > 0)
      : [],
    source: typeof candidate.source === 'string' ? candidate.source : undefined,
  };
}

function extractError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── Simple in-memory rate limiter ──────────────────────

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

// ── Designation display mapping ────────────────────────

const DESIGNATION_LABELS: Record<string, string> = {
  PROFESSOR: 'Professor',
  ASSOCIATE_PROFESSOR: 'Associate Professor',
  ASSISTANT_PROFESSOR: 'Assistant Professor',
  LECTURER: 'Lecturer',
};

const WEB_ALLOWED_ROLES = new Set(['ADMIN', 'TEACHER', 'HEAD']);

function normalizeRole(role: string): ServerUserRole {
  return role.toLowerCase() as ServerUserRole;
}

// ── POST /api/auth/login ───────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Too many login attempts. Please try again later.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    const validation = runValidations(
      requireFields({ email, password }),
      validateEmail(email ?? ''),
    );
    if (validation) return badRequest(validation);

    const normalizedEmail = email.toLowerCase().trim();

    if (!isSupabaseAdminConfigured()) {
      return serviceUnavailable('Secure database client is not configured.');
    }

    const db = getSupabaseAdmin();

    // 1. Fetch profile with password hash
    const { data: profile, error: profileError } = await db
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

    if (!WEB_ALLOWED_ROLES.has(profile.role)) {
      return unauthorized('This account is not allowed to access the web portal.');
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
    let permissions: AdminPermissions | null = null;

    if (profile.role === 'TEACHER' || profile.role === 'HEAD') {
      const { data: teacher } = await db
        .from('teachers')
        .select('full_name, designation, department, office_room, is_head')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (teacher) {
        name = teacher.full_name;
        department = teacher.department || department;
        designation = profile.role === 'HEAD'
          ? 'Head of Department'
          : DESIGNATION_LABELS[teacher.designation] || teacher.designation;
      }
    } else if (profile.role === 'ADMIN') {
      const [{ data: staff }, { data: admin }] = await Promise.all([
        db
          .from('staffs')
          .select('full_name, designation, department')
          .eq('user_id', profile.user_id)
          .maybeSingle(),
        db
          .from('admins')
          .select('full_name, permissions')
          .eq('user_id', profile.user_id)
          .maybeSingle(),
      ]);

      name = staff?.full_name || admin?.full_name || 'Administrator';
      department = staff?.department || department;
      designation = staff?.designation || 'Administrator';
      permissions = normalizeAdminPermissions(admin?.permissions ?? null);
    }

    // 4. Update last_login
    await db
      .from('profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('user_id', profile.user_id);

    const user = {
      id: profile.user_id,
      email: profile.email,
      name,
      role: normalizeRole(profile.role),
      permissions,
      department,
      designation,
    };

    const response = ok(user);
    setSessionCookie(response, createSessionToken(user));
    return response;
  } catch (error: unknown) {
    return internalError(extractError(error, 'Login failed'));
  }
}
