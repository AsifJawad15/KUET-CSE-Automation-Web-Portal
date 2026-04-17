// ==========================================
// API: /api/rooms
// Single Responsibility: HTTP layer only — delegates to Supabase
// Uses shared response helpers & validators for consistency
// ==========================================

import { badRequest, conflict, internalError, noContent, ok } from '@/lib/apiResponse';
import { decodePlusCode } from '@/lib/plusCode';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { requireServerSession } from '@/lib/serverAuth';
import { requireField } from '@/lib/validators';
import { NextRequest, NextResponse } from 'next/server';

function serviceGuard() {
  if (!isSupabaseAdminConfigured()) {
    return internalError('Secure Supabase service role is not configured.');
  }
  return null;
}

// ── GET /api/rooms ─────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = requireServerSession(request);
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const { data, error } = await getSupabaseAdmin()
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
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const body = await request.json();
    const { room_number, building_name, capacity, room_type, facilities, plus_code, floor_number } = body;

    const validation = requireField(room_number, 'room_number');
    if (!validation.valid) return badRequest(validation.error!);

    // Auto-decode Plus Code → lat/lng when provided
    let latitude: number | undefined;
    let longitude: number | undefined;
    const rawPlusCode = typeof plus_code === 'string' ? plus_code.trim() : null;
    if (rawPlusCode) {
      const coords = decodePlusCode(rawPlusCode);
      if (coords) { latitude = coords.lat; longitude = coords.lng; }
    }

    const { data, error } = await getSupabaseAdmin()
      .from('rooms')
      .insert({ room_number, building_name, capacity, room_type, facilities, is_active: true, plus_code: rawPlusCode || null, floor_number, latitude, longitude })
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
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const body = await request.json();
    const { room_number, ...updates } = body;

    const validation = requireField(room_number, 'room_number');
    if (!validation.valid) return badRequest(validation.error!);

    // Auto-decode Plus Code → lat/lng when the update includes a plus_code
    const rawPlusCode = updates.plus_code !== undefined
      ? (typeof updates.plus_code === 'string' ? updates.plus_code.trim() : null)
      : undefined;
    if (rawPlusCode !== undefined) {
      updates.plus_code = rawPlusCode || null;
      if (rawPlusCode) {
        const coords = decodePlusCode(rawPlusCode);
        if (coords) {
          (updates as Record<string, unknown>).latitude = coords.lat;
          (updates as Record<string, unknown>).longitude = coords.lng;
        }
      }
    }

    const { data, error } = await getSupabaseAdmin()
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
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;
  const guard = serviceGuard();
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const room_number = searchParams.get('room_number');

    if (!room_number) return badRequest('room_number is required');

    const { error } = await getSupabaseAdmin()
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
