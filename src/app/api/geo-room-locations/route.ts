// ==========================================
// API: /api/geo-room-locations
// Admin CRUD for geo-attendance room coordinates
// ==========================================

import { badRequest, conflict, guardSupabase, internalError, noContent, ok } from '@/lib/apiResponse';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { decodePlusCode } from '@/lib/plusCode';
import { NextRequest, NextResponse } from 'next/server';

// ── GET /api/geo-room-locations ────────────────────────

export async function GET() {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { data, error } = await supabase
      .from('geo_room_locations')
      .select('*')
      .order('room_name');

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch geo room locations';
    return internalError(message);
  }
}

// ── POST /api/geo-room-locations ───────────────────────

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { room_name, latitude, longitude, plus_code, building_name, floor_number } = body;

    if (!room_name || typeof room_name !== 'string' || !room_name.trim()) {
      return badRequest('room_name is required');
    }

    // Resolve lat/lng: prefer explicit values, fall back to Plus Code decode
    const rawPlusCode = typeof plus_code === 'string' ? plus_code.trim() : null;
    let resolvedLat = typeof latitude === 'number' ? latitude : undefined;
    let resolvedLng = typeof longitude === 'number' ? longitude : undefined;
    if ((resolvedLat === undefined || resolvedLng === undefined) && rawPlusCode) {
      const coords = decodePlusCode(rawPlusCode);
      if (coords) { resolvedLat = coords.lat; resolvedLng = coords.lng; }
    }
    if (resolvedLat === undefined || resolvedLng === undefined) {
      return badRequest('Provide latitude+longitude or a valid Plus Code (e.g. VGX2+QJQ Khulna)');
    }
    if (resolvedLat < -90 || resolvedLat > 90 || resolvedLng < -180 || resolvedLng > 180) {
      return badRequest('Invalid coordinate range');
    }

    const { data, error } = await supabase
      .from('geo_room_locations')
      .insert({
        room_name: room_name.trim(),
        latitude: resolvedLat,
        longitude: resolvedLng,
        plus_code: rawPlusCode || null,
        building_name: building_name || 'CSE Building',
        floor_number: floor_number || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return conflict('A room with this name already exists');
      }
      throw error;
    }

    return ok(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add geo room location';
    return internalError(message);
  }
}

// ── PATCH /api/geo-room-locations ──────────────────────

export async function PATCH(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) return badRequest('id is required');

    // If plus_code is provided, decode it — decoded coordinates are the source of truth and
    // always override whatever lat/lng the client sent (the client may have sent stale coords).
    const rawPlusCode = updates.plus_code !== undefined
      ? (typeof updates.plus_code === 'string' ? updates.plus_code.trim() : null)
      : undefined;
    if (rawPlusCode !== undefined) {
      updates.plus_code = rawPlusCode || null;
      if (rawPlusCode) {
        const coords = decodePlusCode(rawPlusCode);
        if (coords) {
          updates.latitude  = coords.lat;
          updates.longitude = coords.lng;
        }
        // If decode fails, explicit lat/lng from the request body will be used as-is
      }
    }

    // Validate coordinates if provided
    if (updates.latitude !== undefined && (typeof updates.latitude !== 'number' || updates.latitude < -90 || updates.latitude > 90)) {
      return badRequest('Invalid latitude');
    }
    if (updates.longitude !== undefined && (typeof updates.longitude !== 'number' || updates.longitude < -180 || updates.longitude > 180)) {
      return badRequest('Invalid longitude');
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('geo_room_locations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update geo room location';
    return internalError(message);
  }
}

// ── DELETE /api/geo-room-locations ─────────────────────

export async function DELETE(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return badRequest('id is required');

    const { error } = await supabase
      .from('geo_room_locations')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return noContent();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete geo room location';
    return internalError(message);
  }
}
