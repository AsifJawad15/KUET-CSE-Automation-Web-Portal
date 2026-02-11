import { DBRoutineSlotWithDetails } from '@/lib/supabase';

export interface AddRoutineSlotInput {
  offering_id: string;
  room_number: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  section?: string;
}

export interface RoutineSlotResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function getRoutineSlots(
  term: string,
  session: string,
  section?: string
): Promise<DBRoutineSlotWithDetails[]> {
  try {
    const params = new URLSearchParams({ term, session });
    if (section) params.set('section', section);

    const response = await fetch(`/api/routine-slots?${params}`);
    return response.ok ? await response.json() : [];
  } catch {
    return [];
  }
}

export async function addRoutineSlot(input: AddRoutineSlotInput): Promise<RoutineSlotResponse> {
  try {
    const response = await fetch('/api/routine-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to add routine slot' };
  }
}

export async function deleteRoutineSlot(id: string): Promise<RoutineSlotResponse> {
  try {
    const response = await fetch(`/api/routine-slots?id=${id}`, { method: 'DELETE' });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete routine slot' };
  }
}

export async function updateRoutineSlot(
  id: string,
  updates: Partial<AddRoutineSlotInput>
): Promise<RoutineSlotResponse> {
  try {
    const response = await fetch('/api/routine-slots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update routine slot' };
  }
}
