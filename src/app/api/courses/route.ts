// ==========================================
// API: /api/courses
// Single Responsibility: HTTP layer only — delegates to Supabase
// Uses shared response helpers & validators for consistency
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, conflict, guardSupabase, internalError, noContent, ok } from '@/lib/apiResponse';
import { requireField, requireFields, runValidations, validateUppercase, validatePositiveNumber } from '@/lib/validators';

// ── Helpers ────────────────────────────────────────────

function isDuplicateError(error: { message: string }): boolean {
  return error.message.includes('unique') || error.message.includes('duplicate');
}

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── GET /api/courses ───────────────────────────────────

export async function GET() {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('code', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to fetch courses'));
  }
}

// ── POST /api/courses ──────────────────────────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { code, title, credit, course_type, description } = body;

    const validationError = runValidations(
      requireFields({ code, title, credit }),
      validateUppercase(code ?? '', 'Course code'),
      validatePositiveNumber(Number(credit), 'Credit'),
    );
    if (validationError) return badRequest(validationError);

    const { data, error } = await supabase
      .from('courses')
      .insert({
        code: code.trim(),
        title: title.trim(),
        credit: Number(credit),
        course_type: course_type || 'Theory',
        description: description?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (isDuplicateError(error)) return conflict(`Course with code "${code}" already exists`);
      throw error;
    }

    return ok(data);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to add course'));
  }
}

// ── PATCH /api/courses ─────────────────────────────────

export async function PATCH(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { id, code, title, credit, course_type, description } = body;

    const idCheck = requireField(id, 'Course ID');
    if (!idCheck.valid) return badRequest(idCheck.error!);

    // Build update payload with inline validation
    const updates: Record<string, unknown> = {};

    if (code !== undefined) {
      const codeCheck = validateUppercase(code, 'Course code');
      if (!codeCheck.valid) return badRequest(codeCheck.error!);
      updates.code = code.trim();
    }
    if (title !== undefined) updates.title = title.trim();
    if (credit !== undefined) {
      const creditCheck = validatePositiveNumber(Number(credit), 'Credit');
      if (!creditCheck.valid) return badRequest(creditCheck.error!);
      updates.credit = Number(credit);
    }
    if (course_type !== undefined) updates.course_type = course_type;
    if (description !== undefined) updates.description = description?.trim() || null;

    if (Object.keys(updates).length === 0) return badRequest('No fields to update');

    const { data, error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (isDuplicateError(error)) return conflict(`Course code "${code}" already exists`);
      throw error;
    }

    return ok(data);
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to update course'));
  }
}

// ── DELETE /api/courses ────────────────────────────────

export async function DELETE(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return badRequest('Course ID is required');

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return noContent();
  } catch (error: unknown) {
    return internalError(extractErrorMessage(error, 'Failed to delete course'));
  }
}
