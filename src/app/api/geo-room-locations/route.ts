// ==========================================
// API: /api/geo-room-locations
// Admin CRUD for geo-attendance room coordinates
// ==========================================

import { badRequest, conflict, guardSupabase, internalError, noContent, ok } from '@/lib/apiResponse';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
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
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return badRequest('latitude and longitude are required as numbers');
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return badRequest('Invalid coordinate range');
    }

    const { data, error } = await supabase
      .from('geo_room_locations')
      .insert({
        room_name: room_name.trim(),
        latitude,
        longitude,
        plus_code: plus_code || null,
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
