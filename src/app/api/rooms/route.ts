// ==========================================
// API: /api/rooms
// Single Responsibility: HTTP layer only — delegates to Supabase
// Uses shared response helpers & validators for consistency
// ==========================================

import { badRequest, conflict, guardSupabase, internalError, noContent, ok } from '@/lib/apiResponse';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { requireField } from '@/lib/validators';
import { NextRequest, NextResponse } from 'next/server';

// ── GET /api/rooms ─────────────────────────────────────

export async function GET() {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('room_number');

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch rooms';
    return internalError(message);
  }
}

// ── POST /api/rooms ────────────────────────────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { room_number, building_name, capacity, room_type, facilities } = body;

    const validation = requireField(room_number, 'room_number');
    if (!validation.valid) return badRequest(validation.error!);

    const { data, error } = await supabase
      .from('rooms')
      .insert({ room_number, building_name, capacity, room_type, facilities, is_active: true })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return conflict('Room already exists');
      }
      throw error;
    }

    return ok(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add room';
    return internalError(message);
  }
}

// ── PATCH /api/rooms ───────────────────────────────────

export async function PATCH(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { room_number, ...updates } = body;

    const validation = requireField(room_number, 'room_number');
    if (!validation.valid) return badRequest(validation.error!);

    const { data, error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('room_number', room_number)
      .select()
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update room';
    return internalError(message);
  }
}

// ── DELETE /api/rooms ──────────────────────────────────

export async function DELETE(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const room_number = searchParams.get('room_number');

    if (!room_number) return badRequest('room_number is required');

    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('room_number', room_number);

    if (error) throw error;
    return noContent();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete room';
    return internalError(message);
  }
}
