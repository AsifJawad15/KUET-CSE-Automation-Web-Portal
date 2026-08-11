// ==========================================
// API: /api/rooms/bulk
// Bulk import rooms with duplicate detection
// Batch lookup + batch insert (N+1 eliminated)
// Auth: requireServerSession({ adminLike: true })
// ==========================================

import { NextRequest } from 'next/server';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';
import { requireServerSession } from '@/lib/serverAuth';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

interface BulkRoomItem {
  room_number: string;
  building_name?: string | null;
  capacity?: number;
  room_type?: string;
}

const VALID_ROOM_TYPES = ['classroom', 'lab', 'seminar', 'research'];

export async function POST(request: NextRequest) {
  // ── Auth guard ──
  const auth = requireServerSession(request, { adminLike: true });
  if (auth.response) return auth.response;

  const guard = guardSupabase(isSupabaseAdminConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const items: BulkRoomItem[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('No items provided');
    }

    const db = getSupabaseAdmin();

    // Validate & normalize up-front
    const validItems: (BulkRoomItem & { _roomNumber: string })[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (const item of items) {
      if (!item.room_number) {
        errors.push('Skipping: missing room number');
        skipped++;
        continue;
      }
      validItems.push({ ...item, _roomNumber: item.room_number.trim() });
    }

    if (validItems.length === 0) {
      return Response.json({ inserted: 0, skipped, errors });
    }

    // Batch lookup: fetch all existing rooms in one query
    const roomNumbers = [...new Set(validItems.map(v => v._roomNumber))];
    const { data: existingRooms } = await db
      .from('rooms')
      .select('room_number')
      .in('room_number', roomNumbers);

    const existingSet = new Set((existingRooms || []).map(r => r.room_number));

    // Filter to only new rooms
    const newRooms = validItems
      .filter(item => {
        if (existingSet.has(item._roomNumber)) {
          skipped++;
          return false;
        }
        // Prevent duplicates within the batch
        existingSet.add(item._roomNumber);
        return true;
      })
      .map(item => ({
        room_number: item._roomNumber,
        building_name: item.building_name?.trim() || null,
        capacity: item.capacity || 40,
        room_type: VALID_ROOM_TYPES.includes(item.room_type || '')
          ? item.room_type!
          : 'classroom',
        is_active: true,
      }));

    let inserted = 0;
    if (newRooms.length > 0) {
      const { error, count } = await db
        .from('rooms')
        .insert(newRooms, { count: 'exact' });

      if (error) {
        errors.push(`Batch insert failed: ${error.message}`);
      } else {
        inserted = count ?? newRooms.length;
      }
    }

    return Response.json({ inserted, skipped, errors });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : 'Bulk import failed');
  }
}
