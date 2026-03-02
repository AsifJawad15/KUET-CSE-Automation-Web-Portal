// ==========================================
// API: /api/rooms/bulk
// Bulk import rooms with duplicate detection
// Standardized BulkImportResult response
// ==========================================

import { NextRequest } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { badRequest, guardSupabase, internalError } from '@/lib/apiResponse';

interface BulkRoomItem {
  room_number: string;
  building_name?: string | null;
  capacity?: number;
  room_type?: string;
}

const VALID_ROOM_TYPES = ['classroom', 'lab', 'seminar', 'research'];

export async function POST(request: NextRequest) {
  const guard = guardSupabase(isSupabaseConfigured());
  if (guard) return guard;

  try {
    const body = await request.json();
    const items: BulkRoomItem[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('No items provided');
    }

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        if (!item.room_number) {
          errors.push('Skipping: missing room number');
          skipped++;
          continue;
        }

        // Check duplicate
        const { data: existing } = await supabase
          .from('rooms')
          .select('room_number')
          .eq('room_number', item.room_number.trim())
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const roomType = VALID_ROOM_TYPES.includes(item.room_type || '')
          ? item.room_type!
          : 'classroom';

        const { error } = await supabase.from('rooms').insert({
          room_number: item.room_number.trim(),
          building_name: item.building_name?.trim() || null,
          capacity: item.capacity || 40,
          room_type: roomType,
          is_active: true,
        });

        if (error) {
          if (error.message.includes('duplicate') || error.message.includes('unique')) {
            skipped++;
          } else {
            errors.push(`"${item.room_number}": ${error.message}`);
          }
        } else {
          inserted++;
        }
      } catch (err) {
        errors.push(`"${item.room_number}": ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return Response.json({ inserted, skipped, errors });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : 'Bulk import failed');
  }
}
